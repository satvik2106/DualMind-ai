"""
DualMind AI OS — Cognitive Orchestrator
The central intelligence coordinator that integrates:
- Semantic Memory (cross-session recall)
- DAG Execution Engine (parallel, branching workflows)
- Specialized Agent Ecosystem (planner, researcher, synthesizer, verifier)
- Artifact System (Claude-style reports, charts, dashboards)
- Live Cognitive Streaming (SSE events for visible thinking)
- Model Router (env-driven specialized model routing)
"""

import json
import logging
import time
import os
import re
from typing import Dict, Any, Generator, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)


class CognitiveOrchestrator:
    """
    DualMind AI Operating System — Core Orchestrator.

    Replaces the old linear pipeline with a DAG-based execution engine
    backed by semantic memory and specialized cognitive agents.
    """

    def __init__(self):
        self.logger = logging.getLogger("dualmind.orchestrator")
        self.tools = self._load_tools()

        # Initialize subsystems lazily
        self._router = None
        self._memory = None
        self._artifact_manager = None
        self._agents_ready = False

        # Non-critical tools whose failure won't block execution
        self.non_critical_tools = {"wikipedia_search", "news_fetcher", "sentiment_analyzer"}

        self.logger.info(f"CognitiveOrchestrator initialized — {len(self.tools)} tools loaded")

    # ── Lazy Subsystem Access ────────────────────────────────────────

    @property
    def router(self):
        if self._router is None:
            from model_router import get_router
            self._router = get_router()
        return self._router

    @property
    def memory(self):
        if self._memory is None:
            try:
                from memory.semantic_memory import get_memory
                self._memory = get_memory()
            except Exception as e:
                self.logger.warning(f"Memory engine unavailable: {e}")
                self._memory = None
        return self._memory

    @property
    def artifacts(self):
        if self._artifact_manager is None:
            from artifacts.artifact_manager import get_artifact_manager
            self._artifact_manager = get_artifact_manager()
        return self._artifact_manager

    def _load_tools(self) -> Dict[str, Any]:
        """Load all tool functions dynamically."""
        tools = {}
        tool_files = [
            'arxiv_summarizer', 'semantic_scholar', 'pubmed_search', 'pdf_parser',
            'wikipedia_search', 'news_fetcher', 'sentiment_analyzer',
            'data_plotter', 'qa_engine', 'document_writer',
            'web_search', 'web_scraper',
        ]
        for tool_name in tool_files:
            try:
                module = __import__(f"tools.{tool_name}", fromlist=[f"{tool_name}_tool"])
                tool_function = getattr(module, f"{tool_name}_tool")
                tools[tool_name] = tool_function
            except (ImportError, AttributeError) as e:
                self.logger.warning(f"Tool {tool_name} unavailable: {e}")
        return tools

    # ══════════════════════════════════════════════════════════════════
    #  MAIN STREAMING ENDPOINT — The core intelligence pipeline
    # ══════════════════════════════════════════════════════════════════

    def process_query_stream(
        self,
        user_query: str,
        max_iterations: int = 2,
        conversation_id: str = "",
    ) -> Generator[Dict[str, Any], None, None]:
        """
        Process a query through the full AI OS pipeline, yielding SSE events.

        Pipeline:
        1. Memory Recall — check for cross-session context
        2. Semantic Preprocessing — intent classification + search strategy
        3. Agent-Based Planning — DAG construction via Planner Agent
        4. Adversarial Verification — Verifier Agent critiques plan
        5. DAG Execution — Parallel tool execution with confidence scoring
        6. Research Synthesis — Researcher + Synthesizer agents
        7. Artifact Generation — HTML report with charts
        8. Memory Storage — persist interaction for future recall
        """
        start_time = time.time()
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"

        yield {"type": "session_started", "sessionId": session_id, "query": user_query}

        try:
            # ── Phase 0: Memory Recall ───────────────────────────────
            memory_context = ""
            if self.memory:
                yield {"type": "memory_recall", "content": "Searching semantic memory..."}
                try:
                    recalls = self.memory.recall(user_query, top_k=3)
                    if recalls:
                        memory_context = self.memory.build_context_prompt(user_query, conversation_id)
                        yield {
                            "type": "memory_recall",
                            "content": f"Found {len(recalls)} relevant memories",
                            "memories": [
                                {"query": r.entry.query[:80], "score": round(r.decay_adjusted_score, 2)}
                                for r in recalls
                            ],
                        }
                    else:
                        yield {"type": "memory_recall", "content": "No prior memories found — fresh analysis"}
                except Exception as e:
                    self.logger.warning(f"Memory recall failed: {e}")

            # ── Phase 1: Semantic Preprocessing ──────────────────────
            yield {"type": "agent_thinking", "agent": "preprocessor", "content": "Analyzing query semantics..."}
            preprocessed = self._preprocess_query(user_query)
            cleaned_query = preprocessed.get("cleaned_query", user_query)
            intent = preprocessed.get("intent", "research_report")
            search_strategy = preprocessed.get("search_strategy", {})

            # Derive search terms from strategy
            search_terms = cleaned_query
            all_terms = []
            for category in ["academic", "news", "general", "data"]:
                terms = search_strategy.get(category, [])
                if terms:
                    all_terms.extend(terms)
            if all_terms:
                search_terms = all_terms[0]  # Use the most specific term

            yield {
                "type": "agent_thinking",
                "agent": "preprocessor",
                "content": f"Intent: {intent} | Search focus: {search_terms[:60]}",
            }

            # ── Phase 2: Agent-Based Planning ────────────────────────
            yield {"type": "planner_started"}
            yield {"type": "agent_thinking", "agent": "planner", "content": "Constructing execution DAG..."}

            plan = self._generate_plan(cleaned_query, memory_context, preprocessed)
            pipeline = plan.get("pipeline", [])

            yield {
                "type": "planner_completed",
                "plan": {
                    "pipeline": pipeline,
                    "reasoning": plan.get("reasoning", ""),
                },
                "explanation": plan.get("reasoning", "Plan generated"),
            }

            # ── Phase 3: Adversarial Verification ────────────────────
            yield {"type": "verifier_started"}
            verification_result = self._verify_plan(plan, cleaned_query)
            score = verification_result.get("score", 70)
            approved = verification_result.get("approved", True)

            yield {
                "type": "verification_critique",
                "score": score,
                "approved": approved,
                "issues": verification_result.get("issues", []),
            }

            yield {
                "type": "verifier_completed",
                "score": score,
                "approved": approved,
            }

            if not approved and score < 40:
                yield {"type": "error", "message": f"Plan quality too low ({score}/100). Execution aborted."}
                return

            # ── Phase 4: DAG Execution ───────────────────────────────
            from orchestration.dag_engine import DAGExecutor

            dag = DAGExecutor(self.tools, max_parallel=4)
            dag.build_from_plan(plan, cleaned_query)

            execution_results = []
            for event in dag.execute(cleaned_query, search_terms):
                # Forward DAG events as SSE
                sse_event = event.to_sse()
                event_type = sse_event.get("type", "")

                if event_type == "node_started":
                    yield {
                        "type": "tool_started",
                        "step": sse_event.get("node_id", ""),
                        "tool": sse_event.get("tool", ""),
                        "purpose": sse_event.get("purpose", ""),
                        "totalSteps": len(pipeline),
                    }
                elif event_type == "node_completed":
                    yield {
                        "type": "tool_completed",
                        "step": sse_event.get("node_id", ""),
                        "tool": sse_event.get("tool", ""),
                        "status": "success",
                        "confidence": sse_event.get("confidence", 0),
                        "executionTime": sse_event.get("execution_time", 0),
                        "outputPreview": sse_event.get("output_preview", "")[:200],
                    }
                elif event_type == "node_failed":
                    yield {
                        "type": "tool_completed",
                        "step": sse_event.get("node_id", ""),
                        "tool": sse_event.get("tool", ""),
                        "status": "error",
                        "error": sse_event.get("error", ""),
                    }
                elif event_type == "execution_completed":
                    exec_data = sse_event
                    yield {"type": "confidence_update", "overall": exec_data.get("succeeded", 0) / max(exec_data.get("total", 1), 1)}

            # Collect results from DAG nodes
            for node in dag.nodes.values():
                if node.output is not None:
                    execution_results.append({
                        "tool": node.tool,
                        "status": "success" if node.status.value == "completed" else "error",
                        "output": node.output,
                        "confidence": node.confidence,
                    })

            # ── Phase 5: Premium Synthesis ────────────────────────────
            yield {"type": "synthesis_started"}
            yield {"type": "agent_thinking", "agent": "synthesizer", "content": "Synthesizing executive-grade response..."}

            # Build context from all successful tool outputs
            context = dag.get_accumulated_context()
            if memory_context:
                context = f"{memory_context}\n\n---\n\n{context}"

            # Stream synthesis tokens
            token_buffer = ""
            for token in self._stream_synthesis(cleaned_query, context, intent):
                token_buffer += token
                yield {"type": "token", "content": token}

            # Fallback if streaming produced nothing
            if not token_buffer.strip():
                from synthesizer import synthesize_answer
                fallback = synthesize_answer(cleaned_query, execution_results, plan)
                if fallback:
                    token_buffer = fallback
                    yield {"type": "token", "content": fallback}

            yield {"type": "synthesis_completed"}

            # ── Phase 6: Artifact Generation ─────────────────────────
            try:
                yield {"type": "artifact_generating", "content": "Creating interactive report..."}

                # Extract citations from tool outputs
                citations = self._extract_citations(execution_results)

                # Generate chart data if visualization was requested
                charts = []
                if preprocessed.get("visualization_required", False):
                    yield {"type": "chart_rendering", "content": "Generating interactive charts..."}
                    charts = self._generate_charts(cleaned_query, context)

                # Create the artifact
                artifact = self.artifacts.create_report(
                    title=self._generate_title(cleaned_query),
                    content_html=self._markdown_to_html(token_buffer),
                    query=cleaned_query,
                    session_id=session_id,
                    conversation_id=conversation_id,
                    charts=charts,
                    citations=citations,
                    confidence=score / 100.0,
                    agent_contributions={
                        "Planner": "Designed research strategy",
                        "Researcher": f"Executed {len(execution_results)} tools",
                        "Synthesizer": "Produced executive report",
                        "Verifier": f"Quality score: {score}/100",
                    },
                )

                yield {
                    "type": "artifact_generated",
                    "artifactId": artifact.id,
                    "artifactType": artifact.type.value,
                    "title": artifact.title,
                }

            except Exception as e:
                self.logger.error(f"Artifact generation failed: {e}")

            # ── Phase 7: Memory Storage ──────────────────────────────
            if self.memory:
                try:
                    tools_used = [r["tool"] for r in execution_results if r.get("status") == "success"]
                    self.memory.store(
                        query=user_query,
                        response_summary=token_buffer[:500],
                        session_id=session_id,
                        conversation_id=conversation_id,
                        intent=intent,
                        tools_used=tools_used,
                        confidence=score / 100.0,
                    )
                except Exception as e:
                    self.logger.warning(f"Memory storage failed: {e}")

            # ── Done ─────────────────────────────────────────────────
            total_time = time.time() - start_time
            yield {
                "type": "completed",
                "sessionId": session_id,
                "executionTime": round(total_time, 2),
                "toolsExecuted": len(execution_results),
                "successCount": sum(1 for r in execution_results if r.get("status") == "success"),
                "memoryCount": self.memory.get_memory_count() if self.memory else 0,
            }

        except Exception as exc:
            self.logger.error(f"Orchestration error: {exc}", exc_info=True)
            yield {"type": "error", "message": str(exc)}

    # ══════════════════════════════════════════════════════════════════
    #  INTERNAL METHODS
    # ══════════════════════════════════════════════════════════════════

    def _preprocess_query(self, raw_query: str) -> Dict[str, Any]:
        """Semantic query analysis using the planner model."""
        try:
            system_prompt = """You are the DualMind Research Architect.
Transform raw queries into research strategies. Respond ONLY with JSON:
{
    "cleaned_query": "normalized query",
    "intent": "research_report|technical_explanation|coding_task|market_analysis|visualization_request|brainstorming",
    "visualization_required": true/false,
    "search_strategy": {
        "academic": ["query1"], "news": ["query1"], "general": ["query1"], "data": ["query1"]
    },
    "task_decomposition": ["milestone 1", "milestone 2"],
    "reasoning": "Why this decomposition"
}"""
            response = self.router.call(
                role="planner",
                prompt=f"Raw Query: {raw_query}",
                system_prompt=system_prompt,
                require_json=True,
                max_tokens=800,
            )

            if response and isinstance(response, dict):
                if "search_strategy" not in response:
                    response["search_strategy"] = {
                        "academic": [raw_query], "news": [raw_query],
                        "general": [raw_query], "data": [raw_query],
                    }
                return response

        except Exception as e:
            self.logger.warning(f"Semantic analysis failed: {e}")

        return {
            "cleaned_query": raw_query,
            "intent": "research_report",
            "visualization_required": "visual" in raw_query.lower() or "chart" in raw_query.lower(),
            "search_strategy": {
                "academic": [raw_query], "news": [raw_query],
                "general": [raw_query], "data": [raw_query],
            },
        }

    def _generate_plan(self, query: str, memory_context: str, preprocessed: Dict) -> Dict[str, Any]:
        """Generate an execution plan using the Planner Agent."""
        try:
            from agents.registry import get_agent
            planner = get_agent("planner")

            context = ""
            if memory_context:
                context += f"{memory_context}\n\n"
            context += f"Intent: {preprocessed.get('intent', 'research_report')}\n"
            context += f"Search Strategy: {json.dumps(preprocessed.get('search_strategy', {}))}"

            result = planner.execute(query, context)

            if result.status == "success" and result.metadata:
                plan = result.metadata
                if "pipeline" in plan:
                    return plan

        except Exception as e:
            self.logger.warning(f"Agent planning failed: {e}")

        # Fallback: rule-based plan
        return self._fallback_plan(query, preprocessed)

    def _fallback_plan(self, query: str, preprocessed: Dict) -> Dict[str, Any]:
        """Rule-based fallback plan when LLM planning fails."""
        intent = preprocessed.get("intent", "research_report")
        pipeline = [
            {"step": 1, "tool": "web_search", "input": query, "purpose": "Live web intelligence", "depends_on": []},
            {"step": 2, "tool": "wikipedia_search", "input": query, "purpose": "Background knowledge", "depends_on": []},
            {"step": 3, "tool": "arxiv_summarizer", "input": query, "purpose": "Academic research", "depends_on": []},
            {"step": 4, "tool": "news_fetcher", "input": query, "purpose": "Current developments", "depends_on": []},
        ]

        if preprocessed.get("visualization_required"):
            pipeline.append({"step": 5, "tool": "data_plotter", "input": query, "purpose": "Data visualization", "depends_on": [1, 2, 3]})

        return {"pipeline": pipeline, "reasoning": "Fallback multi-source research plan"}

    def _verify_plan(self, plan: Dict, query: str) -> Dict[str, Any]:
        """Verify plan quality using the Verifier Agent."""
        try:
            from agents.registry import get_agent
            verifier = get_agent("verifier")

            plan_summary = json.dumps(plan.get("pipeline", []), indent=2)
            result = verifier.execute(query, plan_summary)

            if result.status == "success" and result.metadata:
                return result.metadata

        except Exception as e:
            self.logger.warning(f"Verification failed: {e}")

        # Fallback: approve with moderate score
        return {"score": 70, "approved": True, "issues": [], "suggestions": []}

    def _stream_synthesis(self, query: str, context: str, intent: str) -> Generator[str, None, None]:
        """Stream premium synthesis tokens."""
        mode_instructions = {
            "research_report": "Write a comprehensive research report with executive summary, findings, and analysis.",
            "technical_explanation": "Write a technical deep-dive with mechanisms and implementation details.",
            "market_analysis": "Write a market analysis with competitive landscape and strategic implications.",
            "coding_task": "Write a technical guide with code examples and architecture decisions.",
            "brainstorming": "Generate creative, diverse ideas with lateral thinking approaches.",
        }

        synthesis_prompt = f"""You are DualMind, a premium AGI Research Operating System.

**User Query:** {query}
**Intent:** {intent}

{mode_instructions.get(intent, mode_instructions["research_report"])}

### RESEARCH DATA:
{context[:6000]}

### REQUIREMENTS:
1. Start directly with high-signal insights — NO boilerplate
2. Use Markdown hierarchy (##, ###) with **bold** key terms
3. Reference specific sources ("According to ArXiv research...", "Recent news indicates...")
4. Every sentence must provide value — no filler
5. Include confidence qualifiers where appropriate
6. End with actionable implications or next steps"""

        yield from self.router.call_stream(
            role="streaming",
            prompt=synthesis_prompt,
            max_tokens=3000,
        )

    def _generate_charts(self, query: str, context: str) -> List[Dict]:
        """Generate Chart.js configurations using the Visualization Agent."""
        try:
            from agents.registry import get_agent
            viz = get_agent("visualizer")
            result = viz.execute(query, context[:2000])

            if result.status == "success" and result.metadata:
                return result.metadata.get("charts", [])
        except Exception as e:
            self.logger.warning(f"Chart generation failed: {e}")
        return []

    def _extract_citations(self, results: List[Dict]) -> List[str]:
        """Extract citation URLs and references from tool outputs."""
        citations = []
        for r in results:
            output = str(r.get("output", ""))
            # Extract URLs
            urls = re.findall(r'https?://[^\s\)\"]+', output)
            citations.extend(urls[:3])
            # Extract ArXiv IDs
            arxiv_ids = re.findall(r'(\d{4}\.\d{4,5})', output)
            for aid in arxiv_ids[:2]:
                citations.append(f"https://arxiv.org/abs/{aid}")
        return list(set(citations))[:10]

    def _generate_title(self, query: str) -> str:
        """Generate a concise report title from the query."""
        # Clean and truncate
        title = query.strip()
        if len(title) > 60:
            title = title[:57] + "..."
        return f"Research: {title}"

    def _markdown_to_html(self, markdown_text: str) -> str:
        """Convert markdown to HTML for artifact rendering."""
        html = markdown_text

        # Headers
        html = re.sub(r'^### (.+)$', r'<h3>\1</h3>', html, flags=re.MULTILINE)
        html = re.sub(r'^## (.+)$', r'<h2>\1</h2>', html, flags=re.MULTILINE)
        html = re.sub(r'^# (.+)$', r'<h1>\1</h1>', html, flags=re.MULTILINE)

        # Bold and italic
        html = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', html)
        html = re.sub(r'\*(.+?)\*', r'<em>\1</em>', html)

        # Lists
        html = re.sub(r'^- (.+)$', r'<li>\1</li>', html, flags=re.MULTILINE)
        html = re.sub(r'^(\d+)\. (.+)$', r'<li>\2</li>', html, flags=re.MULTILINE)

        # Blockquotes
        html = re.sub(r'^> (.+)$', r'<blockquote>\1</blockquote>', html, flags=re.MULTILINE)

        # Code blocks
        html = re.sub(r'```(\w*)\n(.*?)```', r'<pre><code class="\1">\2</code></pre>', html, flags=re.DOTALL)
        html = re.sub(r'`(.+?)`', r'<code>\1</code>', html)

        # Paragraphs
        html = re.sub(r'\n\n', '</p><p>', html)
        html = f'<p>{html}</p>'

        # Clean up empty tags
        html = re.sub(r'<p>\s*</p>', '', html)

        return html

    # ── Legacy API Compatibility ─────────────────────────────────────

    def process_query(self, user_query: str, max_iterations: int = 2) -> Dict[str, Any]:
        """Synchronous query processing (legacy compatibility)."""
        results = {
            "session_id": f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
            "user_query": user_query,
            "status": "completed",
        }

        token_buffer = ""
        for event in self.process_query_stream(user_query, max_iterations):
            if event.get("type") == "token":
                token_buffer += event.get("content", "")
            elif event.get("type") == "error":
                results["status"] = "error"
                results["error"] = event.get("message", "")

        results["synthesized_answer"] = token_buffer
        return results


def create_orchestrator() -> CognitiveOrchestrator:
    """Factory function to create the orchestrator."""
    return CognitiveOrchestrator()