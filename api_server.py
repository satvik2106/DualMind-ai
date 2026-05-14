"""
FastAPI backend for Claude-style chatbot interface.
Provides chat and file upload endpoints that integrate with the existing orchestrator.
"""

import json
import logging
import os
import random
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field
import time

# --- Production Logging ---
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("dualmind_api")

from orchestrator import create_orchestrator
from tools.pdf_parser import PDFParserTool
from firebase_helper import init_firebase
from tools.wikipedia_search import wikipedia_search_tool

try:
    from synthesizer import synthesize_answer
except ImportError:
    synthesize_answer = None


CASUAL_GREETINGS = {
    "hi", "hello", "hey", "heya", "hiya", "howdy", "yo", "sup", "what's up", "whats up",
    "good morning", "good afternoon", "good evening", "thanks", "thank you", "ty", "hey there",
    "who are you", "what are you", "help", "menu", "status", "ready", "ok", "cool", "nice",
}

LIGHTWEIGHT_RESPONSES = [
    "DualMind OS online. I'm ready to orchestrate your commands. What's on your mind?",
    "Hello! I've initialized the neural link. How can I assist you today?",
    "Hey! The multi-agent pipeline is active. Give me a complex task to solve.",
    "System ready. I can research papers, fetch news, or analyze data for you.",
    "DualMind here. Standing by for your next query.",
]

DEFAULT_ERROR_RESPONSE = "I wasn't able to generate a response. Please try again."

LAST_VALID_RESPONSES: Dict[str, str] = {}
LAST_GLOBAL_RESPONSE: Optional[str] = None

def _normalize_message(message: str) -> str:
    """Normalize whitespace and casing for comparison."""
    return " ".join(message.lower().strip().split())

def _is_casual_message(message: str) -> bool:
    """Detect lightweight greetings or casual conversation openers."""
    normalized = _normalize_message(message)
    if not normalized:
        return False

    # Exact matches for greetings
    if normalized in CASUAL_GREETINGS:
        return True

    # Short phrases or help requests
    words = normalized.split()
    if len(words) <= 4:
        # Check if all words are greetings or if it's a 'who are you' style query
        if all(word in CASUAL_GREETINGS for word in words):
            return True
        if normalized in ["who are you", "what is this", "how are you"]:
            return True

    return False


def _remember_response(session_id: Optional[str], response: str) -> None:
    """Cache the most recent valid response per session and globally."""
    global LAST_GLOBAL_RESPONSE
    if not response or not response.strip():
        return
    if session_id:
        LAST_VALID_RESPONSES[session_id] = response
    LAST_GLOBAL_RESPONSE = response


def _retrieve_last_valid_response(session_id: Optional[str]) -> Optional[str]:
    """Retrieve the last cached valid response for fallback usage."""
    if session_id and session_id in LAST_VALID_RESPONSES:
        return LAST_VALID_RESPONSES[session_id]
    return LAST_GLOBAL_RESPONSE


def _stringify_output(output: Any) -> str:
    """Convert tool outputs into a readable string."""
    if output is None:
        return ""
    if isinstance(output, str):
        return output.strip()
    if isinstance(output, (dict, list)):
        try:
            return json.dumps(output, ensure_ascii=False, indent=2)
        except TypeError:
            return str(output)
    return str(output)


def _get_last_successful_output(execution_results: Any) -> Tuple[str, Optional[Dict[str, Any]]]:
    """Return the most recent successful execution result."""
    if not execution_results:
        return "", None
    for step in reversed(execution_results):
        if step.get("status") == "success":
            output = _stringify_output(step.get("output"))
            if output:
                return output, step
    return "", None


def _assemble_answer_from_results(user_query: str, execution_results: Any) -> str:
    """Assemble a structured answer from successful tool outputs."""
    if not execution_results:
        return ""

    answer_parts = [f"# 🎯 Answer to: {user_query}\n\n"]

    for result in execution_results:
        if result.get("status") != "success":
            continue

        tool_name = result.get("tool", "Unknown")
        output_str = _stringify_output(result.get("output"))

        if not output_str or output_str.lower().startswith("error"):
            continue

        tool_section = {
            "wikipedia_search": "## 📚 Background\n\n",
            "arxiv_summarizer": "## 🔬 Research\n\nAcademic papers found (see execution details for full list)\n\n",
            "news_fetcher": "## 📰 News\n\nRecent articles found (see execution details for full list)\n\n",
            "qa_engine": "## 💡 Answer\n\n",
        }.get(tool_name)

        if tool_section:
            answer_parts.append(f"{tool_section}{output_str}\n\n")
        elif "successfully" not in output_str.lower():
            answer_parts.append(f"## {tool_name}\n\n{output_str}\n\n")

    if len(answer_parts) == 1:
        return ""

    answer_parts.append("✅ Query completed. Check execution details for more information.")
    return "".join(answer_parts)


def _generate_answer(results: Dict[str, Any], user_query: str) -> Tuple[str, bool, Optional[str], Optional[str], Dict[str, Any]]:
    """Generate the best possible answer with fallbacks."""
    execution_results = results.get("execution_results", [])
    fallback_used = False
    fallback_reason: Optional[str] = None
    fallback_source: Optional[str] = None
    fallback_payload: Dict[str, Any] = {}

    answer = ""

    if synthesize_answer:
        try:
            answer = synthesize_answer(user_query, execution_results, results.get("plan", {}))
        except Exception as exc:  # pragma: no cover - synthesizer optional
            logging.getLogger(__name__).error("Error in synthesizer: %s", exc)

    if not answer:
        answer = _assemble_answer_from_results(user_query, execution_results)

    if not answer:
        qa_answer = ""
        for step in execution_results:
            if step.get("tool") == "qa_engine" and step.get("status") == "success":
                qa_answer = _stringify_output(step.get("output"))
                if qa_answer:
                    break
        answer = qa_answer

    last_success_output, last_success_step = _get_last_successful_output(execution_results)
    if not answer and last_success_output:
        answer = last_success_output

    research_tools = {"arxiv_summarizer", "semantic_scholar", "pubmed_search", "document_writer"}
    has_research_success = any(
        step.get("tool") in research_tools and step.get("status") == "success"
        for step in execution_results
    )
    has_wikipedia_success = any(
        step.get("tool") == "wikipedia_search" and step.get("status") == "success"
        for step in execution_results
    )

    if not has_research_success and not has_wikipedia_success:
        try:
            wikipedia_summary = wikipedia_search_tool(user_query)
            if wikipedia_summary:
                fallback_used = True
                fallback_reason = "research_source_missing"
                fallback_source = "wikipedia"
                fallback_payload["wikipedia_summary"] = wikipedia_summary
                if not answer or len(answer.strip()) < 120:
                    answer = wikipedia_summary
                else:
                    answer = f"{answer}\n\n---\n\n{wikipedia_summary}"
        except Exception as exc:  # pragma: no cover - external API
            logging.getLogger(__name__).warning("Wikipedia fallback failed: %s", exc)

    if not answer:
        fallback_response = _retrieve_last_valid_response(results.get("session_id"))
        if fallback_response:
            fallback_used = True
            fallback_reason = "llm_output_missing"
            fallback_source = "previous_response"
            fallback_payload["previous_response"] = fallback_response
            answer = fallback_response

    if not answer:
        answer = DEFAULT_ERROR_RESPONSE
        if last_success_step:
            fallback_payload["last_successful_step"] = last_success_step

    return answer, fallback_used, fallback_reason, fallback_source, fallback_payload


def _build_execution_details(
    results: Dict[str, Any],
    fallback_used: bool,
    fallback_reason: Optional[str],
    fallback_source: Optional[str],
    fallback_payload: Dict[str, Any],
) -> Dict[str, Any]:
    """Compose structured execution details for the frontend."""
    execution_results = results.get("execution_results", [])
    steps = []

    for step in execution_results or []:
        steps.append(
            {
                "step": step.get("step"),
                "tool": step.get("tool"),
                "status": step.get("status"),
                "executionTime": step.get("execution_time"),
                "purpose": step.get("purpose"),
                "input": step.get("input"),
                "output": _stringify_output(step.get("output")),
                "error": step.get("error"),
            }
        )

    metadata = {
        "sessionId": results.get("session_id"),
        "status": results.get("status"),
        "executionTime": results.get("execution_time"),
        "iterations": results.get("iterations"),
        "planScore": results.get("final_plan_score"),
        "planApproved": results.get("plan_approved"),
        "fallbackUsed": fallback_used,
        "fallbackReason": fallback_reason,
        "fallbackSource": fallback_source,
        "timestampUtc": datetime.utcnow().isoformat() + "Z",
    }

    if fallback_payload:
        metadata["fallbackPayloadKeys"] = list(fallback_payload.keys())

    details = {
        "planSummary": results.get("plan_explanation"),
        "plan": results.get("plan"),
        "verification": results.get("verifier_feedback"),
        "executionSteps": steps,
        "summary": orchestrator.get_execution_summary(results) if hasattr(orchestrator, "get_execution_summary") else "",
        "metadata": metadata,
        "reasoning": (results.get("plan") or {}).get("reasoning"),
        "finalVerification": results.get("final_verification"),
    }

    if fallback_payload:
        details["fallbacks"] = fallback_payload

    return details


logger = logging.getLogger(__name__)


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    file_context: Optional[str] = Field(default=None, max_length=20000)


class ChatResponse(BaseModel):
    response: str
    status: str
    session_id: Optional[str]
    execution_details: Dict[str, Any] = Field(default_factory=dict)
    fallback_used: bool = False
    fallback_reason: Optional[str] = None
    fallback_source: Optional[str] = None
    lightweight_mode: bool = False


def _sanitize_text(text: str) -> str:
    """Basic text sanitisation to strip control characters."""
    clean = text.replace("\x00", "").strip()
    return clean


# FastAPI application setup
app = FastAPI(
    title="DualMind Orchestration API",
    description="Production-grade multi-agent AGI operating system backend.",
    version="1.0.0"
)

# --- CORS & Security ---
ALLOWED_ORIGINS = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://localhost:3001,https://dualmind-ai.web.app,https://dualmind-88ab9.web.app,https://dualmind-88ab9.firebaseapp.com,https://dualmind-ai-cgss.onrender.com"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

startup_time = time.time()

orchestrator = create_orchestrator()
pdf_parser = PDFParserTool()

@app.on_event("startup")
async def startup_event():
    init_firebase()

# --- Auth Dependency ---
from firebase_helper import verify_id_token
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

auth_scheme = HTTPBearer()

async def get_current_user():
    """No-op auth for anonymous mode."""
    return {"uid": "dualmind_global_user", "email": "anonymous@dualmind.ai"}

UPLOADS_DIR = Path("uploads")
UPLOADS_DIR.mkdir(exist_ok=True)

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png"}
ALLOWED_PDF_TYPES = {"application/pdf"}


@app.get("/")
async def root() -> dict:
    """Root endpoint for Render health checks and frontend connectivity validation."""
    return {
        "status": "online",
        "service": "DualMind Orchestration API",
        "version": "1.0.0",
        "streaming": True,
    }


@app.get("/health")
@app.get("/api/health")
async def health() -> dict:
    """Health-check endpoint."""
    uptime = round(time.time() - startup_time, 1)
    return {"status": "healthy", "uptime_seconds": uptime, "timestamp": datetime.utcnow().isoformat()}


class StreamChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=4000)
    conversationId: str = Field(default="")


@app.post("/api/chat/stream")
async def stream_chat_endpoint(payload: StreamChatRequest, user: dict = Depends(get_current_user)):
    """SSE streaming endpoint for the real-time orchestration experience."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    message = _sanitize_text(payload.message)
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    # Handle lightweight / casual messages immediately
    if _is_casual_message(message):
        response_text = random.choice(LIGHTWEIGHT_RESPONSES)

        async def _casual_stream():
            for evt in [
                {"type": "session_started", "sessionId": None, "query": message},
                {"type": "token", "content": response_text},
                {"type": "completed", "sessionId": None, "executionTime": 0,
                 "toolsExecuted": 0, "successCount": 0},
            ]:
                yield f"data: {json.dumps(evt)}\n\n"

        return StreamingResponse(_casual_stream(), media_type="text/event-stream")

    # Full orchestration streaming
    def _orchestration_stream():
        for evt in orchestrator.process_query_stream(message, conversation_id=payload.conversationId):
            yield f"data: {json.dumps(evt, default=str)}\n\n"

    return StreamingResponse(
        _orchestration_stream(), 
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Critical for Nginx
            "Content-Encoding": "none",
        }
    )


@app.post("/api/chat", response_model=ChatResponse)
async def chat_endpoint(payload: ChatRequest) -> ChatResponse:
    """Process chat messages through the orchestrator."""
    message = _sanitize_text(payload.message)
    if not message:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    logger.info("Processing chat message")

    if _is_casual_message(message):
        response_text = random.choice(LIGHTWEIGHT_RESPONSES)
        execution_details = {
            "planSummary": None,
            "plan": None,
            "verification": None,
            "executionSteps": [],
            "summary": "Lightweight mode response. Orchestrator execution skipped for a casual input.",
            "metadata": {
                "lightweightMode": True,
                "fallbackUsed": False,
                "timestampUtc": datetime.utcnow().isoformat() + "Z",
            },
        }
        _remember_response(None, response_text)
        return ChatResponse(
            response=response_text,
            status="success",
            session_id=None,
            execution_details=execution_details,
            fallback_used=False,
            fallback_reason=None,
            fallback_source=None,
            lightweight_mode=True,
        )

    final_input = message
    if payload.file_context:
        context = _sanitize_text(payload.file_context)
        final_input = f"Context:\n{context}\n\nQuestion:\n{message}"

    try:
        results = orchestrator.process_query(final_input)
    except Exception as exc:  # pragma: no cover - orchestrator internal failure
        logger.error("Error in orchestrator: %s", exc)
        raise HTTPException(status_code=500, detail="Failed to process message.") from exc

    answer, fallback_used, fallback_reason, fallback_source, fallback_payload = _generate_answer(results, message)
    session_id = results.get("session_id")

    if answer and answer != DEFAULT_ERROR_RESPONSE:
        _remember_response(session_id, answer)

    execution_details = _build_execution_details(results, fallback_used, fallback_reason, fallback_source, fallback_payload)

    status_value = results.get("status", "success")
    status = "success" if status_value not in {"error", "failed", "rejected_by_verifier"} else "error"

    return ChatResponse(
        response=answer,
        status=status,
        session_id=session_id,
        execution_details=execution_details,
        fallback_used=fallback_used,
        fallback_reason=fallback_reason,
        fallback_source=fallback_source,
        lightweight_mode=False,
    )


def _store_upload(file: UploadFile, content: bytes) -> Path:
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    safe_name = file.filename or "upload"
    safe_name = safe_name.replace("/", "_").replace("\\", "_")
    target_path = UPLOADS_DIR / f"{timestamp}_{safe_name}"
    with open(target_path, "wb") as f:
        f.write(content)
    return target_path


@app.post("/api/upload")
async def upload_endpoint(
    file: UploadFile = File(...),
    message: Optional[str] = Form(None),
):
    """Handle secure upload of images and PDF files."""

    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file must have a name.")

    content_type = file.content_type or ""
    if content_type not in ALLOWED_IMAGE_TYPES and content_type not in ALLOWED_PDF_TYPES:
        raise HTTPException(status_code=400, detail="Unsupported file type. Only JPG, PNG, and PDF are allowed.")

    data = await file.read()
    if len(data) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File exceeds 10MB size limit.")

    saved_path = _store_upload(file, data)
    logger.info("Stored file at %s", saved_path)

    file_context = None
    file_info = {
        "filename": file.filename,
        "content_type": content_type,
        "size": len(data),
        "saved_path": str(saved_path),
    }

    if content_type in ALLOWED_PDF_TYPES:
        try:
            parsed = pdf_parser.parse_pdf(str(saved_path))
            if parsed.get("success"):
                file_context = parsed.get("text", "")[:5000]
                file_info["word_count"] = parsed.get("metadata", {}).get("word_count")
            else:
                file_info["parse_error"] = parsed.get("error")
        except Exception as exc:
            logger.warning("PDF parsing failed: %s", exc)
            file_info["parse_error"] = "Unable to extract text from PDF."

    response_text = None
    session_id = None
    execution_details: Optional[Dict[str, Any]] = None
    fallback_used = False
    fallback_reason: Optional[str] = None
    fallback_source: Optional[str] = None
    lightweight_mode = False
    if message:
        chat_payload = ChatRequest(message=_sanitize_text(message), file_context=file_context)
        chat_response = await chat_endpoint(chat_payload)
        response_text = chat_response.response
        session_id = chat_response.session_id
        execution_details = chat_response.execution_details
        fallback_used = chat_response.fallback_used
        fallback_reason = chat_response.fallback_reason
        fallback_source = chat_response.fallback_source
        lightweight_mode = chat_response.lightweight_mode

    preview = None
    if file_context:
        preview = file_context[:500]
        if len(file_context) > 500:
            preview += "..."

    return JSONResponse(
        {
            "status": "success",
            "file": file_info,
            "file_context_preview": preview,
            "response": response_text,
            "session_id": session_id,
            "execution_details": execution_details,
            "fallback_used": fallback_used,
            "fallback_reason": fallback_reason,
            "fallback_source": fallback_source,
            "lightweight_mode": lightweight_mode,
        }
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    # Render sets PORT; fallback to API_PORT or 8000 for local dev
    port = int(os.getenv("PORT", os.getenv("API_PORT", "8000")))
    host = os.getenv("API_HOST", "0.0.0.0")
    logger.info("Starting DualMind API on %s:%s", host, port)
    uvicorn.run(app, host=host, port=port)
