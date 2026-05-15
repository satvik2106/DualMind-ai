"""
DualMind AI OS — Artifact Manager
Claude-style artifact system for HTML reports, PDF documents, charts, and dashboards.

Artifacts support:
- Inline rendering (side-panel viewer)
- Live generation streaming
- Fullscreen mode
- PDF download + HTML export
- Workspace persistence
- Reopening from history
"""

import os
import json
import time
import hashlib
import logging
from datetime import datetime
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class ArtifactType(Enum):
    HTML_REPORT = "html_report"
    PDF_REPORT = "pdf_report"
    CHART = "chart"
    DASHBOARD = "dashboard"
    MARKDOWN = "markdown"
    SVG = "svg"
    EXECUTION_REPLAY = "execution_replay"


@dataclass
class Artifact:
    """A generated artifact (report, chart, dashboard)."""
    id: str
    type: ArtifactType
    title: str
    content: str  # HTML content for inline rendering
    query: str = ""
    session_id: str = ""
    conversation_id: str = ""
    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)
    file_path: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    charts: List[Dict[str, Any]] = field(default_factory=list)
    sections: List[Dict[str, Any]] = field(default_factory=list)
    confidence: float = 0.0
    agent_contributions: Dict[str, str] = field(default_factory=dict)
    citations: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        d = asdict(self)
        d["type"] = self.type.value
        return d


class ArtifactManager:
    """
    Manages the lifecycle of artifacts: creation, storage, retrieval, and rendering.
    """

    STORAGE_DIR = "artifacts_store"

    def __init__(self):
        self._artifacts: Dict[str, Artifact] = {}
        self._storage_dir = os.path.join(os.getcwd(), self.STORAGE_DIR)
        os.makedirs(self._storage_dir, exist_ok=True)
        os.makedirs(os.path.join(self._storage_dir, "files"), exist_ok=True)
        self._load_index()

    def create_report(
        self,
        title: str,
        content_html: str,
        query: str = "",
        session_id: str = "",
        conversation_id: str = "",
        charts: Optional[List[Dict]] = None,
        citations: Optional[List[str]] = None,
        confidence: float = 0.0,
        agent_contributions: Optional[Dict[str, str]] = None,
    ) -> Artifact:
        """Create a new HTML report artifact."""
        artifact_id = f"art_{hashlib.md5(f'{title}{time.time()}'.encode()).hexdigest()[:10]}"

        # Wrap content in premium template
        full_html = self._render_report_template(
            title=title,
            content=content_html,
            charts=charts or [],
            citations=citations or [],
            confidence=confidence,
            agent_contributions=agent_contributions or {},
            artifact_id=artifact_id,
        )

        artifact = Artifact(
            id=artifact_id,
            type=ArtifactType.HTML_REPORT,
            title=title,
            content=full_html,
            query=query,
            session_id=session_id,
            conversation_id=conversation_id,
            charts=charts or [],
            citations=citations or [],
            confidence=confidence,
            agent_contributions=agent_contributions or {},
        )

        # Save HTML file
        html_path = os.path.join(self._storage_dir, "files", f"{artifact_id}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(full_html)
        artifact.file_path = html_path

        self._artifacts[artifact_id] = artifact
        self._save_index()

        logger.info(f"Created artifact: {artifact_id} — {title}")
        return artifact

    def create_chart_artifact(
        self, title: str, chart_configs: List[Dict], query: str = ""
    ) -> Artifact:
        """Create a chart/dashboard artifact with Chart.js configs."""
        artifact_id = f"chart_{hashlib.md5(f'{title}{time.time()}'.encode()).hexdigest()[:10]}"

        html = self._render_chart_template(title, chart_configs, artifact_id)

        artifact = Artifact(
            id=artifact_id,
            type=ArtifactType.DASHBOARD,
            title=title,
            content=html,
            query=query,
            charts=chart_configs,
        )

        html_path = os.path.join(self._storage_dir, "files", f"{artifact_id}.html")
        with open(html_path, "w", encoding="utf-8") as f:
            f.write(html)
        artifact.file_path = html_path

        self._artifacts[artifact_id] = artifact
        self._save_index()
        return artifact

    def get(self, artifact_id: str) -> Optional[Artifact]:
        """Retrieve an artifact by ID."""
        return self._artifacts.get(artifact_id)

    def list_artifacts(
        self, conversation_id: str = "", limit: int = 50
    ) -> List[Dict[str, Any]]:
        """List artifacts, optionally filtered by conversation."""
        artifacts = list(self._artifacts.values())
        if conversation_id:
            artifacts = [a for a in artifacts if a.conversation_id == conversation_id]
        artifacts.sort(key=lambda a: a.created_at, reverse=True)
        return [
            {
                "id": a.id,
                "type": a.type.value,
                "title": a.title,
                "created_at": a.created_at,
                "query": a.query[:100],
                "confidence": a.confidence,
            }
            for a in artifacts[:limit]
        ]

    def get_html_content(self, artifact_id: str) -> Optional[str]:
        """Get the rendered HTML content for inline viewing."""
        artifact = self._artifacts.get(artifact_id)
        if not artifact:
            return None
        return artifact.content

    def delete(self, artifact_id: str) -> bool:
        """Delete an artifact."""
        artifact = self._artifacts.pop(artifact_id, None)
        if artifact and artifact.file_path and os.path.exists(artifact.file_path):
            os.remove(artifact.file_path)
        self._save_index()
        return artifact is not None

    # ── Template Rendering ───────────────────────────────────────────

    def _render_report_template(
        self, title, content, charts, citations, confidence, agent_contributions, artifact_id
    ) -> str:
        """Render a premium HTML report with embedded charts and styling."""
        charts_html = ""
        charts_js = ""
        if charts:
            for i, chart in enumerate(charts):
                canvas_id = f"chart_{artifact_id}_{i}"
                charts_html += f'<div class="chart-container"><canvas id="{canvas_id}"></canvas></div>\n'
                config = json.dumps(chart.get("config", chart))
                charts_js += f"""
try {{
  new Chart(document.getElementById('{canvas_id}'), {config});
}} catch(e) {{ console.warn('Chart {canvas_id} error:', e); }}
"""

        citations_html = ""
        if citations:
            citations_html = '<div class="citations"><h3>📚 References</h3><ol>'
            for c in citations:
                citations_html += f"<li>{c}</li>"
            citations_html += "</ol></div>"

        agents_html = ""
        if agent_contributions:
            agents_html = '<div class="agent-contributions"><h3>🤖 Agent Contributions</h3>'
            for agent, contribution in agent_contributions.items():
                agents_html += f'<div class="agent-badge"><span class="agent-name">{agent}</span><span class="agent-desc">{contribution}</span></div>'
            agents_html += "</div>"

        confidence_bar = ""
        if confidence > 0:
            pct = int(confidence * 100)
            color = "#22c55e" if pct >= 70 else "#f59e0b" if pct >= 40 else "#ef4444"
            confidence_bar = f'''
<div class="confidence-section">
  <span class="confidence-label">Confidence Score</span>
  <div class="confidence-bar"><div class="confidence-fill" style="width:{pct}%;background:{color}"></div></div>
  <span class="confidence-value">{pct}%</span>
</div>'''

        return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title} — DualMind Report</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
:root {{
  --bg: #0f0f23; --surface: #1a1a2e; --border: #2a2a4a;
  --text: #e2e8f0; --text-muted: #94a3b8; --accent: #6366f1;
  --accent-glow: rgba(99,102,241,0.15); --success: #22c55e;
}}
[data-theme="light"] {{
  --bg: #f8fafc; --surface: #ffffff; --border: #e2e8f0;
  --text: #1e293b; --text-muted: #64748b;
}}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: 'Inter', -apple-system, sans-serif; background: var(--bg); color: var(--text); line-height: 1.7; padding: 2rem; }}
.report-container {{ max-width: 900px; margin: 0 auto; }}
.report-header {{ background: linear-gradient(135deg, var(--accent), #8b5cf6); padding: 2rem 2.5rem; border-radius: 16px; margin-bottom: 2rem; color: white; }}
.report-header h1 {{ font-size: 1.75rem; font-weight: 700; margin-bottom: 0.5rem; }}
.report-header .meta {{ font-size: 0.85rem; opacity: 0.85; }}
.report-body {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 2.5rem; }}
.report-body h2 {{ font-size: 1.4rem; font-weight: 600; margin: 1.5rem 0 0.75rem; color: var(--accent); border-bottom: 2px solid var(--border); padding-bottom: 0.5rem; }}
.report-body h3 {{ font-size: 1.1rem; font-weight: 600; margin: 1.2rem 0 0.5rem; }}
.report-body p {{ margin-bottom: 1rem; }}
.report-body ul, .report-body ol {{ margin: 0.5rem 0 1rem 1.5rem; }}
.report-body li {{ margin-bottom: 0.4rem; }}
.report-body strong {{ color: var(--accent); }}
.report-body blockquote {{ border-left: 3px solid var(--accent); padding: 0.75rem 1rem; margin: 1rem 0; background: var(--accent-glow); border-radius: 0 8px 8px 0; }}
.chart-container {{ background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 1.5rem; margin: 1.5rem 0; }}
.confidence-section {{ display: flex; align-items: center; gap: 1rem; margin: 1.5rem 0; padding: 1rem; background: var(--accent-glow); border-radius: 10px; }}
.confidence-label {{ font-weight: 600; font-size: 0.9rem; white-space: nowrap; }}
.confidence-bar {{ flex: 1; height: 8px; background: var(--border); border-radius: 4px; overflow: hidden; }}
.confidence-fill {{ height: 100%; border-radius: 4px; transition: width 1s ease; }}
.confidence-value {{ font-weight: 700; font-size: 1.1rem; }}
.citations {{ margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid var(--border); }}
.citations h3 {{ color: var(--text-muted); font-size: 1rem; margin-bottom: 0.75rem; }}
.citations ol {{ color: var(--text-muted); font-size: 0.85rem; }}
.agent-contributions {{ margin-top: 1.5rem; }}
.agent-badge {{ display: inline-flex; align-items: center; gap: 0.5rem; background: var(--accent-glow); border: 1px solid var(--border); border-radius: 8px; padding: 0.4rem 0.8rem; margin: 0.25rem; font-size: 0.8rem; }}
.agent-name {{ font-weight: 600; color: var(--accent); }}
.report-footer {{ text-align: center; margin-top: 2rem; padding: 1rem; color: var(--text-muted); font-size: 0.8rem; }}
.theme-toggle {{ position: fixed; top: 1rem; right: 1rem; background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 0.5rem 1rem; cursor: pointer; color: var(--text); font-size: 0.85rem; }}
@media print {{ body {{ background: white; color: black; }} .theme-toggle {{ display: none; }} }}
</style>
</head>
<body>
<button class="theme-toggle" onclick="toggleTheme()">🌓 Toggle Theme</button>
<div class="report-container">
  <div class="report-header">
    <h1>{title}</h1>
    <div class="meta">Generated by DualMind AI OS • {datetime.now().strftime('%B %d, %Y %H:%M')}</div>
  </div>
  <div class="report-body">
    {confidence_bar}
    {content}
    {charts_html}
    {agents_html}
    {citations_html}
  </div>
  <div class="report-footer">
    DualMind AI Operating System • Artifact ID: {artifact_id}
  </div>
</div>
<script>
function toggleTheme() {{
  const html = document.documentElement;
  html.dataset.theme = html.dataset.theme === 'dark' ? 'light' : 'dark';
}}
{charts_js}
</script>
</body></html>"""

    def _render_chart_template(self, title, chart_configs, artifact_id) -> str:
        """Render an interactive chart/dashboard artifact."""
        canvases = ""
        js_code = ""
        for i, cfg in enumerate(chart_configs):
            cid = f"chart_{artifact_id}_{i}"
            chart_title = cfg.get("title", f"Chart {i+1}")
            canvases += f'<div class="chart-card"><h3>{chart_title}</h3><canvas id="{cid}"></canvas></div>\n'
            config_json = json.dumps(cfg.get("config", cfg))
            js_code += f"try {{ new Chart(document.getElementById('{cid}'), {config_json}); }} catch(e) {{}}\n"

        return f"""<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
<meta charset="UTF-8"><title>{title}</title>
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
:root {{ --bg: #0f0f23; --surface: #1a1a2e; --border: #2a2a4a; --text: #e2e8f0; }}
body {{ font-family:'Inter',sans-serif; background:var(--bg); color:var(--text); padding:2rem; }}
h2 {{ text-align:center; margin-bottom:2rem; }}
.dashboard {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(400px,1fr)); gap:1.5rem; max-width:1200px; margin:0 auto; }}
.chart-card {{ background:var(--surface); border:1px solid var(--border); border-radius:12px; padding:1.5rem; }}
.chart-card h3 {{ font-size:1rem; margin-bottom:1rem; color:#a5b4fc; }}
</style></head>
<body><h2>{title}</h2><div class="dashboard">{canvases}</div>
<script>{js_code}</script></body></html>"""

    # ── Persistence ──────────────────────────────────────────────────

    def _save_index(self):
        """Save artifact index to disk."""
        index_path = os.path.join(self._storage_dir, "index.json")
        index = {}
        for aid, artifact in self._artifacts.items():
            index[aid] = artifact.to_dict()
        try:
            with open(index_path, "w") as f:
                json.dump(index, f, default=str)
        except Exception as e:
            logger.error(f"Failed to save artifact index: {e}")

    def _load_index(self):
        """Load artifact index from disk."""
        index_path = os.path.join(self._storage_dir, "index.json")
        if not os.path.exists(index_path):
            return
        try:
            with open(index_path, "r") as f:
                index = json.load(f)
            for aid, data in index.items():
                art_type = ArtifactType(data.get("type", "html_report"))
                # Load HTML content from file if available
                content = data.get("content", "")
                file_path = data.get("file_path", "")
                if file_path and os.path.exists(file_path) and not content:
                    with open(file_path, "r", encoding="utf-8") as hf:
                        content = hf.read()

                self._artifacts[aid] = Artifact(
                    id=aid,
                    type=art_type,
                    title=data.get("title", ""),
                    content=content,
                    query=data.get("query", ""),
                    session_id=data.get("session_id", ""),
                    conversation_id=data.get("conversation_id", ""),
                    created_at=data.get("created_at", 0),
                    updated_at=data.get("updated_at", 0),
                    file_path=file_path,
                    charts=data.get("charts", []),
                    citations=data.get("citations", []),
                    confidence=data.get("confidence", 0),
                    agent_contributions=data.get("agent_contributions", {}),
                )
            logger.info(f"Loaded {len(self._artifacts)} artifacts from index")
        except Exception as e:
            logger.error(f"Failed to load artifact index: {e}")


# ── Global Singleton ────────────────────────────────────────────────────

_manager_instance: Optional[ArtifactManager] = None


def get_artifact_manager() -> ArtifactManager:
    global _manager_instance
    if _manager_instance is None:
        _manager_instance = ArtifactManager()
    return _manager_instance
