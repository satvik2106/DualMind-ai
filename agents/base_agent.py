"""
DualMind AI OS — Base Agent Framework
Provides the foundation for all specialized cognitive agents.

Each agent has a role, system prompt, model routing, and structured output.
Agents are composable units that the DAG orchestrator can invoke independently.
"""

import logging
import time
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """Structured output from any agent execution."""
    agent: str
    status: str  # "success", "error", "partial"
    content: str
    confidence: float = 0.0
    reasoning: str = ""
    citations: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)
    execution_time: float = 0.0
    tokens_used: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent": self.agent,
            "status": self.status,
            "content": self.content,
            "confidence": self.confidence,
            "reasoning": self.reasoning,
            "citations": self.citations,
            "metadata": self.metadata,
            "execution_time": self.execution_time,
        }


class BaseAgent:
    """
    Base class for all DualMind cognitive agents.

    Subclasses must implement:
        - ROLE: str — human-readable role name
        - MODEL_ROLE: str — key into ModelRouter (e.g. "planner", "reasoning")
        - SYSTEM_PROMPT: str — the agent's persona/instructions
        - execute(task, context) -> AgentResult
    """

    ROLE: str = "base"
    MODEL_ROLE: str = "reasoning"
    SYSTEM_PROMPT: str = "You are a helpful AI assistant."
    MAX_TOKENS: int = 2000

    def __init__(self):
        self.logger = logging.getLogger(f"agent.{self.ROLE}")
        self._router = None

    @property
    def router(self):
        """Lazy-load the model router."""
        if self._router is None:
            from model_router import get_router
            self._router = get_router()
        return self._router

    def execute(self, task: str, context: str = "", **kwargs) -> AgentResult:
        """
        Execute the agent's primary task.

        Args:
            task: The task description / query
            context: Additional context (memory, tool outputs, etc.)
            **kwargs: Agent-specific parameters

        Returns:
            AgentResult with the agent's output
        """
        start_time = time.time()

        try:
            prompt = self._build_prompt(task, context, **kwargs)
            response = self.router.call(
                role=self.MODEL_ROLE,
                prompt=prompt,
                system_prompt=self.SYSTEM_PROMPT,
                max_tokens=self.MAX_TOKENS,
                temperature=kwargs.get("temperature", 0.3),
                require_json=kwargs.get("require_json", False),
            )

            if response is None:
                return AgentResult(
                    agent=self.ROLE,
                    status="error",
                    content="Agent received no response from LLM",
                    execution_time=time.time() - start_time,
                )

            # Parse structured output if JSON was requested
            if kwargs.get("require_json") and isinstance(response, dict):
                return AgentResult(
                    agent=self.ROLE,
                    status="success",
                    content=str(response),
                    confidence=response.get("confidence", 0.7),
                    reasoning=response.get("reasoning", ""),
                    metadata=response,
                    execution_time=time.time() - start_time,
                )

            return AgentResult(
                agent=self.ROLE,
                status="success",
                content=str(response),
                confidence=0.7,
                execution_time=time.time() - start_time,
            )

        except Exception as e:
            self.logger.error(f"Agent execution failed: {e}")
            return AgentResult(
                agent=self.ROLE,
                status="error",
                content=f"Agent error: {str(e)}",
                execution_time=time.time() - start_time,
            )

    def _build_prompt(self, task: str, context: str = "", **kwargs) -> str:
        """Build the full prompt. Override in subclasses for custom formatting."""
        parts = []
        if context:
            parts.append(f"## Context\n{context}\n")
        parts.append(f"## Task\n{task}")
        return "\n".join(parts)
