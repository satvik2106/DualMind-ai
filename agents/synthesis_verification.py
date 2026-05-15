"""
DualMind AI OS — Synthesizer & Verifier Agents
"""
import logging
from agents.base_agent import BaseAgent, AgentResult

logger = logging.getLogger(__name__)


class SynthesizerAgent(BaseAgent):
    ROLE = "synthesizer"
    MODEL_ROLE = "reasoning"
    MAX_TOKENS = 3000
    SYSTEM_PROMPT = """You are the DualMind Synthesis Engine — a world-class research writer.
You produce executive-grade, publication-quality reports.

STRICT RULES:
1. NO generic AI boilerplate ("Here is a summary...", "In conclusion...")
2. Start DIRECTLY with high-signal insights
3. Use Markdown: ## sections, ### subsections, **bold** for key terms
4. Every claim must reference its source
5. Include confidence assessment for major claims
6. Write 800+ words for research reports
7. Structure: Executive Summary → Key Findings → Analysis → Implications → References"""

    def _build_prompt(self, task, context="", **kwargs):
        intent = kwargs.get("intent", "research_report")
        return f"## Query\n{task}\n\n## Intent: {intent}\n\n## Research Context\n{context}\n\nWrite a premium executive-grade response. No boilerplate."


class VerifierAgent(BaseAgent):
    ROLE = "verifier"
    MODEL_ROLE = "reasoning"
    MAX_TOKENS = 1500
    SYSTEM_PROMPT = """You are the DualMind Verifier — a rigorous fact-checker and quality auditor.
Evaluate outputs for factual consistency, unsupported claims, and quality.

Respond with JSON:
{
    "score": 0-100,
    "approved": true/false,
    "issues": [{"type": "factual|quality|coverage", "description": "...", "severity": "high|medium|low"}],
    "suggestions": ["..."],
    "confidence_assessment": "overall assessment"
}"""

    def execute(self, task, context="", **kwargs):
        result = super().execute(task, context, require_json=True, temperature=0.1)
        if result.status == "success" and result.metadata:
            result.confidence = result.metadata.get("score", 50) / 100.0
        return result

    def _build_prompt(self, task, context="", **kwargs):
        return f"## Original Query\n{task}\n\n## Output to Verify\n{context}\n\nPerform rigorous verification. Respond with JSON."


class AnalystAgent(BaseAgent):
    ROLE = "analyst"
    MODEL_ROLE = "reasoning"
    MAX_TOKENS = 2000
    SYSTEM_PROMPT = """You are the DualMind Data Analyst — expert at extracting insights.
1. Identify trends and patterns
2. Perform comparative analysis
3. Generate chart data as JSON: {"chart_data": {"type": "bar", "title": "...", "labels": [...], "datasets": [...]}}
4. Calculate confidence scores for claims"""

    def _build_prompt(self, task, context="", **kwargs):
        return f"## Analysis Task\n{task}\n\n## Research Data\n{context}\n\nProduce key insights with confidence scores."


class VisualizationAgent(BaseAgent):
    ROLE = "visualizer"
    MODEL_ROLE = "reasoning"
    MAX_TOKENS = 1500
    SYSTEM_PROMPT = """You are the DualMind Visualization Architect.
Produce Chart.js-compatible configs for interactive charts.

Use professional colors:
- Primary: rgba(99, 102, 241, 0.8)
- Secondary: rgba(168, 85, 247, 0.8)
- Accent: rgba(236, 72, 153, 0.8)

Respond with JSON:
{
    "charts": [{"id": "chart_1", "type": "bar|line|pie", "title": "...", "config": {<Chart.js config>}}],
    "dashboard_layout": "single|grid_2x1|grid_2x2",
    "narrative": "What the charts show"
}"""

    def execute(self, task, context="", **kwargs):
        return super().execute(task, context, require_json=True, temperature=0.2)

    def _build_prompt(self, task, context="", **kwargs):
        return f"## Visualization Request\n{task}\n\n## Data\n{context}\n\nGenerate Chart.js configs."
