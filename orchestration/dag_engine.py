"""
DualMind AI OS — DAG Execution Engine
Directed Acyclic Graph-based orchestration with parallel execution,
replanning, confidence scoring, and cognitive event streaming.
"""

import time
import json
import logging
import hashlib
from enum import Enum
from typing import Dict, Any, List, Optional, Generator, Callable
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed

logger = logging.getLogger(__name__)


class NodeStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    RETRYING = "retrying"


@dataclass
class DAGNode:
    """A single node in the execution DAG."""
    id: str
    tool: str
    input: str
    purpose: str
    depends_on: List[str] = field(default_factory=list)
    status: NodeStatus = NodeStatus.PENDING
    output: Any = None
    error: str = ""
    confidence: float = 0.0
    execution_time: float = 0.0
    retries: int = 0
    max_retries: int = 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "tool": self.tool,
            "input": self.input,
            "purpose": self.purpose,
            "depends_on": self.depends_on,
            "status": self.status.value,
            "confidence": self.confidence,
            "execution_time": self.execution_time,
            "error": self.error,
        }


@dataclass
class CognitiveEvent:
    """An event emitted during DAG execution for live cognitive streaming."""
    type: str
    data: Dict[str, Any] = field(default_factory=dict)
    timestamp: float = field(default_factory=time.time)

    def to_sse(self) -> Dict[str, Any]:
        return {"type": self.type, **self.data}


class DAGExecutor:
    """
    Executes a DAG of tool nodes with parallel execution, retry logic,
    replanning support, and cognitive event emission.
    """

    def __init__(self, tools: Dict[str, Callable], max_parallel: int = 4):
        self.tools = tools
        self.max_parallel = max_parallel
        self.nodes: Dict[str, DAGNode] = {}
        self.execution_order: List[str] = []
        self.events: List[CognitiveEvent] = []
        self._event_callback: Optional[Callable] = None

    def set_event_callback(self, callback: Callable):
        """Set a callback that receives CognitiveEvents in real-time."""
        self._event_callback = callback

    def build_from_plan(self, plan: Dict[str, Any], query: str) -> None:
        """Build DAG nodes from a planner output."""
        self.nodes.clear()
        pipeline = plan.get("pipeline", [])

        for step in pipeline:
            node_id = f"node_{step.get('step', len(self.nodes)+1)}"
            tool_name = step.get("tool", "")

            # Skip tools we don't have
            if tool_name not in self.tools and tool_name != "qa_engine":
                logger.warning(f"Tool '{tool_name}' not available, skipping node")
                continue

            deps = []
            for dep_step in step.get("depends_on", []):
                dep_id = f"node_{dep_step}"
                if dep_id in self.nodes:
                    deps.append(dep_id)

            node = DAGNode(
                id=node_id,
                tool=tool_name,
                input=step.get("input", query),
                purpose=step.get("purpose", ""),
                depends_on=deps,
            )
            self.nodes[node_id] = node

        # Compute topological execution order
        self.execution_order = self._topological_sort()
        self._emit(CognitiveEvent("dag_built", {
            "node_count": len(self.nodes),
            "nodes": [n.to_dict() for n in self.nodes.values()],
        }))

    def execute(self, query: str, search_terms: str = "") -> Generator[CognitiveEvent, None, List[Dict[str, Any]]]:
        """
        Execute the DAG, yielding cognitive events as nodes complete.

        Returns:
            List of execution results
        """
        results = []

        if not self.nodes:
            yield CognitiveEvent("error", {"message": "Empty DAG — no nodes to execute"})
            return results

        yield CognitiveEvent("execution_started", {
            "total_nodes": len(self.nodes),
            "parallel_limit": self.max_parallel,
        })

        # Group nodes by dependency level for parallel execution
        levels = self._get_execution_levels()

        for level_idx, level_nodes in enumerate(levels):
            yield CognitiveEvent("execution_level", {
                "level": level_idx + 1,
                "total_levels": len(levels),
                "nodes": [n.id for n in level_nodes],
            })

            # Execute level nodes in parallel
            with ThreadPoolExecutor(max_workers=min(len(level_nodes), self.max_parallel)) as executor:
                futures = {}
                for node in level_nodes:
                    if node.tool == "qa_engine":
                        # Skip qa_engine in DAG — synthesis handled separately
                        node.status = NodeStatus.SKIPPED
                        continue

                    # Resolve input — inject search_terms for research tools
                    effective_input = node.input
                    if search_terms and node.tool in [
                        "wikipedia_search", "arxiv_summarizer", "news_fetcher",
                        "semantic_scholar", "pubmed_search", "web_search"
                    ]:
                        effective_input = search_terms

                    node.status = NodeStatus.RUNNING
                    yield CognitiveEvent("node_started", {
                        "node_id": node.id,
                        "tool": node.tool,
                        "purpose": node.purpose,
                    })

                    futures[executor.submit(self._execute_node, node, effective_input)] = node

                for future in as_completed(futures):
                    node = futures[future]
                    try:
                        result = future.result()
                        results.append(result)

                        event_type = "node_completed" if node.status == NodeStatus.COMPLETED else "node_failed"
                        yield CognitiveEvent(event_type, {
                            "node_id": node.id,
                            "tool": node.tool,
                            "status": node.status.value,
                            "confidence": node.confidence,
                            "execution_time": node.execution_time,
                            "output_preview": str(node.output)[:200] if node.output else "",
                        })

                    except Exception as e:
                        node.status = NodeStatus.FAILED
                        node.error = str(e)
                        yield CognitiveEvent("node_failed", {
                            "node_id": node.id,
                            "tool": node.tool,
                            "error": str(e),
                        })

        # Final summary
        success_count = sum(1 for n in self.nodes.values() if n.status == NodeStatus.COMPLETED)
        yield CognitiveEvent("execution_completed", {
            "total": len(self.nodes),
            "succeeded": success_count,
            "failed": sum(1 for n in self.nodes.values() if n.status == NodeStatus.FAILED),
            "skipped": sum(1 for n in self.nodes.values() if n.status == NodeStatus.SKIPPED),
        })

        return results

    def get_accumulated_context(self) -> str:
        """Get all successful outputs as context for synthesis."""
        parts = []
        for node_id in self.execution_order:
            node = self.nodes.get(node_id)
            if node and node.status == NodeStatus.COMPLETED and node.output:
                output_str = str(node.output)[:2000]
                parts.append(f"### Source: {node.tool}\n{output_str}")
        return "\n\n---\n\n".join(parts)

    def get_dag_json(self) -> Dict[str, Any]:
        """Get the DAG as JSON for replay/visualization."""
        return {
            "nodes": [n.to_dict() for n in self.nodes.values()],
            "execution_order": self.execution_order,
        }

    # ── Internal Methods ─────────────────────────────────────────────

    def _execute_node(self, node: DAGNode, effective_input: str) -> Dict[str, Any]:
        """Execute a single node with retry logic."""
        start = time.time()

        for attempt in range(node.max_retries + 1):
            try:
                if node.tool not in self.tools:
                    raise ValueError(f"Tool '{node.tool}' not available")

                output = self.tools[node.tool](effective_input)
                node.output = output
                node.status = NodeStatus.COMPLETED
                node.execution_time = time.time() - start
                node.confidence = self._score_output(output)

                return {
                    "step": node.id,
                    "tool": node.tool,
                    "status": "success",
                    "output": output,
                    "input": effective_input,
                    "purpose": node.purpose,
                    "execution_time": node.execution_time,
                    "confidence": node.confidence,
                }

            except Exception as e:
                node.retries = attempt + 1
                if attempt < node.max_retries:
                    node.status = NodeStatus.RETRYING
                    logger.warning(f"Node {node.id} retry {attempt+1}: {e}")
                    time.sleep(1)
                else:
                    node.status = NodeStatus.FAILED
                    node.error = str(e)
                    node.execution_time = time.time() - start

        return {
            "step": node.id,
            "tool": node.tool,
            "status": "error",
            "error": node.error,
            "output": "",
            "purpose": node.purpose,
        }

    def _score_output(self, output: Any) -> float:
        """Score output quality/confidence based on heuristics."""
        if output is None:
            return 0.0
        text = str(output)
        if len(text) < 20:
            return 0.2
        if len(text) < 100:
            return 0.4
        if "error" in text.lower()[:50]:
            return 0.1
        if "sample" in text.lower() or "demo" in text.lower():
            return 0.3
        if len(text) > 500:
            return 0.8
        return 0.6

    def _topological_sort(self) -> List[str]:
        """Topological sort of DAG nodes."""
        visited = set()
        order = []

        def visit(node_id):
            if node_id in visited:
                return
            visited.add(node_id)
            node = self.nodes.get(node_id)
            if node:
                for dep in node.depends_on:
                    visit(dep)
            order.append(node_id)

        for nid in self.nodes:
            visit(nid)
        return order

    def _get_execution_levels(self) -> List[List[DAGNode]]:
        """Group nodes into dependency levels for parallel execution."""
        levels = []
        assigned = set()

        while len(assigned) < len(self.nodes):
            level = []
            for node_id, node in self.nodes.items():
                if node_id in assigned:
                    continue
                # Node can execute if all dependencies are assigned
                if all(dep in assigned for dep in node.depends_on):
                    level.append(node)

            if not level:
                # Remaining nodes have unresolvable deps — add them anyway
                for nid, n in self.nodes.items():
                    if nid not in assigned:
                        level.append(n)
                levels.append(level)
                break

            for n in level:
                assigned.add(n.id)
            levels.append(level)

        return levels

    def _emit(self, event: CognitiveEvent):
        """Emit a cognitive event."""
        self.events.append(event)
        if self._event_callback:
            try:
                self._event_callback(event)
            except Exception:
                pass
