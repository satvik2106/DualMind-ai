"""
DualMind AI OS — Planner & Researcher Agents
"""
import logging
from agents.base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class PlannerAgent(BaseAgent):
    ROLE = "planner"
    MODEL_ROLE = "planner"
    MAX_TOKENS = 2000
    SYSTEM_PROMPT = """You are the DualMind Strategic Planner — an elite AI research architect.
Decompose user queries into precise, executable research plans as JSON DAGs.

AVAILABLE TOOLS:
- wikipedia_search, arxiv_summarizer, semantic_scholar, pubmed_search
- news_fetcher, web_search, web_scraper
- sentiment_analyzer, data_plotter, document_writer

Respond ONLY with valid JSON:
{
    "pipeline": [
        {"step": 1, "tool": "tool_name", "input": "specific query", "purpose": "why", "depends_on": []},
    ],
    "reasoning": "Why this plan",
    "estimated_confidence": 0.0-1.0,
    "visualization_needed": true/false,
    "report_needed": true/false
}"""

    def execute(self, task, context="", **kwargs):
        result = super().execute(task, context, require_json=True, temperature=0.2)
        if result.status == "success" and result.metadata:
            result.confidence = result.metadata.get("estimated_confidence", 0.7)
            result.reasoning = result.metadata.get("reasoning", "")
        return result

    def _build_prompt(self, task, context="", **kwargs):
        parts = []
        if context:
            parts.append(f"## Memory Context\n{context}\n")
        parts.append(f"## User Query\n{task}\n")
        parts.append("Generate an optimal research execution plan as JSON.")
        return "\n".join(parts)


class ResearcherAgent(BaseAgent):
    ROLE = "researcher"
    MODEL_ROLE = "reasoning"
    MAX_TOKENS = 2500
    SYSTEM_PROMPT = """You are the DualMind Research Coordinator.
Given raw outputs from research tools, you:
1. Identify the most relevant and high-quality information
2. Cross-reference findings across sources
3. Flag contradictions or gaps
4. Rank sources by reliability
5. Extract key entities, statistics, and claims with citations
Always cite sources explicitly. Never fabricate information."""

    def _build_prompt(self, task, context="", **kwargs):
        return f"## Research Task\n{task}\n\n## Raw Tool Outputs\n{context}\n\nProduce a structured research brief."
