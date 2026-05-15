"""
DualMind AI OS — Model Router
Environment-driven intelligent model routing for specialized subsystems.

Each cognitive subsystem (planner, synthesizer, memory, etc.) routes to the
optimal model based on Render environment variables. Supports NVIDIA Build API,
OpenRouter, and Gemini as providers with automatic fallback.
"""

import os
import logging
import json
import time
import requests
from typing import Optional, Dict, Any, Generator, List
from functools import lru_cache
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)


# ── Model Role Definitions ──────────────────────────────────────────────
# Each role maps to an env var and has a sensible default.
MODEL_ROLES = {
    "planner":          {"env": "PLANNER_MODEL",          "default": "mistralai/mistral-nemotron"},
    "reasoning":        {"env": "PRIMARY_REASONING_MODEL", "default": "mistralai/mistral-nemotron"},
    "streaming":        {"env": "FAST_STREAM_MODEL",       "default": "mistralai/mistral-nemotron"},
    "embedding":        {"env": "EMBEDDING_MODEL",         "default": "nvidia/llama-3.2-nv-embedqa-1b-v2"},
    "rerank":           {"env": "RERANK_MODEL",            "default": "mistralai/mistral-nemotron"},
    "ocr":              {"env": "OCR_MODEL",               "default": "mistralai/mistral-nemotron"},
    "document_parse":   {"env": "DOCUMENT_PARSE_MODEL",    "default": "mistralai/mistral-nemotron"},
}

# Provider detection from model name
PROVIDER_PREFIXES = {
    "nvidia/":    "nvidia",
    "mistralai/": "nvidia",       # NVIDIA hosts Mistral models
    "meta/":      "nvidia",
    "google/":    "nvidia",
    "openai/":    "openrouter",
    "anthropic/": "openrouter",
    "microsoft/": "openrouter",
}


class ModelRouter:
    """
    Centralized model routing for all DualMind subsystems.

    Reads model assignments from environment variables and routes
    each call to the correct provider (NVIDIA Build / OpenRouter / Gemini).
    """

    def __init__(self):
        # API keys
        self.nvidia_api_key = os.getenv("NVIDIA_API_KEY", "")
        self.openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
        self.gemini_api_key = os.getenv("GEMINI_API_KEY", "")
        self.nvidia_base_url = os.getenv("NVIDIA_BASE_URL", "https://integrate.api.nvidia.com/v1")
        self.openrouter_base_url = "https://openrouter.ai/api/v1"

        # Resolve model assignments from env
        self._models: Dict[str, str] = {}
        for role, cfg in MODEL_ROLES.items():
            self._models[role] = os.getenv(cfg["env"], cfg["default"])

        # OpenAI client for NVIDIA (lazy)
        self._nvidia_client = None

        # Response cache (LRU, keyed by prompt hash)
        self._cache: Dict[str, Any] = {}
        self._cache_max = 200

        logger.info("ModelRouter initialized — model assignments:")
        for role, model in self._models.items():
            logger.info(f"  {role:20s} → {model}")

    # ── Public API ───────────────────────────────────────────────────

    def get_model(self, role: str) -> str:
        """Return the model identifier for a given role."""
        return self._models.get(role, self._models.get("reasoning", "mistralai/mistral-nemotron"))

    def detect_provider(self, model: str) -> str:
        """Determine which provider hosts a given model."""
        for prefix, provider in PROVIDER_PREFIXES.items():
            if model.startswith(prefix):
                return provider
        # Default to NVIDIA if we have the key, else OpenRouter
        if self.nvidia_api_key:
            return "nvidia"
        return "openrouter"

    def call(
        self,
        role: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 2000,
        temperature: float = 0.3,
        require_json: bool = False,
        max_retries: int = 2,
    ) -> Optional[Any]:
        """
        Make an LLM call routed to the model assigned to `role`.

        Args:
            role: Cognitive role (planner, reasoning, streaming, etc.)
            prompt: User prompt
            system_prompt: System prompt
            max_tokens: Max response tokens
            temperature: Sampling temperature
            require_json: If True, parse response as JSON
            max_retries: Retry count on failure

        Returns:
            Response string, parsed JSON dict/list, or None on failure
        """
        model = self.get_model(role)
        provider = self.detect_provider(model)

        for attempt in range(max_retries + 1):
            try:
                if provider == "nvidia":
                    content = self._call_nvidia(model, prompt, system_prompt, max_tokens, temperature)
                elif provider == "openrouter":
                    content = self._call_openrouter(model, prompt, system_prompt, max_tokens, temperature)
                else:
                    logger.error(f"Unknown provider: {provider}")
                    return None

                if not content:
                    raise ValueError(f"Empty response from {provider}/{model}")

                if require_json:
                    return self._extract_json(content)
                return content

            except Exception as e:
                logger.warning(f"[{role}] {provider}/{model} attempt {attempt+1} failed: {e}")
                if attempt < max_retries:
                    time.sleep(min(2 ** attempt, 8))
                    # Try fallback provider on last retry
                    if attempt == max_retries - 1:
                        provider = "openrouter" if provider == "nvidia" else "nvidia"
                        model = self._models.get("reasoning", "mistralai/mistral-nemotron")
                        logger.info(f"[{role}] Falling back to {provider}/{model}")
                continue

        logger.error(f"[{role}] All retries exhausted")
        if require_json:
            return {"error": "All providers failed", "role": role}
        return None

    def call_stream(
        self,
        role: str,
        prompt: str,
        system_prompt: Optional[str] = None,
        max_tokens: int = 3000,
    ) -> Generator[str, None, None]:
        """Stream tokens from the model assigned to `role`."""
        model = self.get_model(role)
        provider = self.detect_provider(model)

        try:
            if provider == "nvidia":
                yield from self._stream_nvidia(model, prompt, system_prompt, max_tokens)
            elif provider == "openrouter":
                yield from self._stream_openrouter(model, prompt, system_prompt, max_tokens)
            else:
                yield "Error: Unknown provider"
        except Exception as e:
            logger.error(f"Streaming failed for {role}: {e}")
            # Fallback to sync call
            result = self.call(role, prompt, system_prompt, max_tokens)
            if result:
                yield str(result)

    def embed(self, texts: List[str]) -> List[List[float]]:
        """
        Generate embeddings using the NVIDIA embedding model.

        Args:
            texts: List of strings to embed

        Returns:
            List of embedding vectors
        """
        model = self.get_model("embedding")

        if not self.nvidia_api_key:
            logger.warning("No NVIDIA API key for embeddings, using hash fallback")
            return [self._hash_embed(t) for t in texts]

        try:
            headers = {
                "Authorization": f"Bearer {self.nvidia_api_key}",
                "Content-Type": "application/json",
            }

            # NVIDIA embedding API — batch up to 50 texts
            all_embeddings = []
            for i in range(0, len(texts), 50):
                batch = texts[i:i+50]
                data = {
                    "model": model,
                    "input": batch,
                    "input_type": "query",
                    "encoding_format": "float",
                    "truncate": "END",
                }

                resp = requests.post(
                    f"{self.nvidia_base_url}/embeddings",
                    headers=headers,
                    json=data,
                    timeout=30,
                )
                resp.raise_for_status()
                result = resp.json()

                for item in sorted(result.get("data", []), key=lambda x: x["index"]):
                    all_embeddings.append(item["embedding"])

            return all_embeddings

        except Exception as e:
            logger.error(f"Embedding API failed: {e}")
            return [self._hash_embed(t) for t in texts]

    # ── NVIDIA Provider ──────────────────────────────────────────────

    def _get_nvidia_client(self):
        if self._nvidia_client is None:
            try:
                from openai import OpenAI
                self._nvidia_client = OpenAI(
                    base_url=self.nvidia_base_url,
                    api_key=self.nvidia_api_key,
                )
            except ImportError:
                raise RuntimeError("openai package required for NVIDIA provider")
        return self._nvidia_client

    def _call_nvidia(
        self, model: str, prompt: str, system_prompt: Optional[str],
        max_tokens: int, temperature: float,
    ) -> Optional[str]:
        client = self._get_nvidia_client()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        completion = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            top_p=0.7,
            max_tokens=max_tokens,
            stream=False,
        )

        if completion.choices and completion.choices[0].message:
            content = completion.choices[0].message.content
            return content.strip() if content else None
        return None

    def _stream_nvidia(
        self, model: str, prompt: str, system_prompt: Optional[str], max_tokens: int,
    ) -> Generator[str, None, None]:
        client = self._get_nvidia_client()
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        stream = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.6,
            top_p=0.7,
            max_tokens=max_tokens,
            stream=True,
        )

        for chunk in stream:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    # ── OpenRouter Provider ──────────────────────────────────────────

    def _call_openrouter(
        self, model: str, prompt: str, system_prompt: Optional[str],
        max_tokens: int, temperature: float,
    ) -> Optional[str]:
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key.strip()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://dualmind-ai.web.app",
            "X-Title": "DualMind AI OS",
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        data = {
            "model": model,
            "messages": messages,
            "max_tokens": min(max_tokens, 4000),
            "temperature": temperature,
        }

        resp = requests.post(
            f"{self.openrouter_base_url}/chat/completions",
            headers=headers,
            json=data,
            timeout=60,
        )
        resp.raise_for_status()
        result = resp.json()

        if not result.get("choices"):
            raise ValueError("No choices in OpenRouter response")
        content = result["choices"][0]["message"]["content"]
        return content if content else None

    def _stream_openrouter(
        self, model: str, prompt: str, system_prompt: Optional[str], max_tokens: int,
    ) -> Generator[str, None, None]:
        headers = {
            "Authorization": f"Bearer {self.openrouter_api_key.strip()}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://dualmind-ai.web.app",
            "X-Title": "DualMind AI OS",
        }

        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})

        data = {
            "model": model,
            "messages": messages,
            "max_tokens": min(max_tokens, 4000),
            "stream": True,
        }

        resp = requests.post(
            f"{self.openrouter_base_url}/chat/completions",
            headers=headers,
            json=data,
            timeout=120,
            stream=True,
        )
        resp.raise_for_status()

        for raw_line in resp.iter_lines():
            if not raw_line:
                continue
            line = raw_line.decode("utf-8", errors="replace")
            if line.startswith("data: "):
                payload = line[6:]
                if payload.strip() == "[DONE]":
                    return
                try:
                    obj = json.loads(payload)
                    delta = obj.get("choices", [{}])[0].get("delta", {})
                    content = delta.get("content")
                    if content:
                        yield content
                except json.JSONDecodeError:
                    continue

    # ── Utilities ────────────────────────────────────────────────────

    def _extract_json(self, text: str) -> Any:
        """Extract JSON from LLM response."""
        import re
        if not text:
            raise ValueError("Empty response")

        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON block
        json_match = re.search(
            r'\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}',
            text, re.DOTALL,
        )
        if json_match:
            try:
                return json.loads(json_match.group(0))
            except json.JSONDecodeError:
                pass

        # Remove markdown fences
        cleaned = re.sub(r'```(?:json)?\s*', '', text, flags=re.IGNORECASE)
        cleaned = re.sub(r'```\s*$', '', cleaned)
        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            pass

        raise ValueError(f"Could not extract JSON from response: {text[:200]}")

    def _hash_embed(self, text: str) -> List[float]:
        """Deterministic hash-based embedding fallback (768-dim)."""
        import hashlib
        h = hashlib.sha256(text.encode()).hexdigest()
        vec = []
        for i in range(0, min(len(h), 768*2), 2):
            val = int(h[i:i+2], 16) / 255.0 - 0.5
            vec.append(val)
        # Pad to 768 dims
        while len(vec) < 768:
            vec.append(0.0)
        return vec[:768]

    def is_available(self) -> bool:
        return bool(self.nvidia_api_key or self.openrouter_api_key)

    def get_status(self) -> Dict[str, Any]:
        """Return router status for health checks."""
        return {
            "nvidia_available": bool(self.nvidia_api_key),
            "openrouter_available": bool(self.openrouter_api_key),
            "gemini_available": bool(self.gemini_api_key),
            "model_assignments": dict(self._models),
        }


# ── Global singleton ────────────────────────────────────────────────────
_router_instance: Optional[ModelRouter] = None


def get_router() -> ModelRouter:
    """Get the global ModelRouter singleton."""
    global _router_instance
    if _router_instance is None:
        _router_instance = ModelRouter()
    return _router_instance
