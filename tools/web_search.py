"""
DualMind AI OS — Web Search Tool
Live web search using DuckDuckGo for current information retrieval.
"""

import logging
from typing import Dict, Any, List

logger = logging.getLogger(__name__)


class WebSearch:
    """Search the web using DuckDuckGo for real-time results."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def search(self, query: str, max_results: int = 8) -> List[Dict[str, str]]:
        """Perform a web search and return results."""
        try:
            from duckduckgo_search import DDGS

            results = []
            with DDGS() as ddgs:
                for r in ddgs.text(query, max_results=max_results):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("href", r.get("link", "")),
                        "snippet": r.get("body", r.get("snippet", "")),
                    })
            return results

        except ImportError:
            self.logger.warning("duckduckgo-search not installed")
            return [{"title": "Search unavailable", "url": "", "snippet": "Install duckduckgo-search package"}]
        except Exception as e:
            self.logger.error(f"Web search failed: {e}")
            return []

    def search_news(self, query: str, max_results: int = 5) -> List[Dict[str, str]]:
        """Search for recent news articles."""
        try:
            from duckduckgo_search import DDGS

            results = []
            with DDGS() as ddgs:
                for r in ddgs.news(query, max_results=max_results):
                    results.append({
                        "title": r.get("title", ""),
                        "url": r.get("url", r.get("link", "")),
                        "snippet": r.get("body", ""),
                        "source": r.get("source", ""),
                        "date": r.get("date", ""),
                    })
            return results

        except Exception as e:
            self.logger.error(f"News search failed: {e}")
            return []

    def run(self, query: str, max_results: int = 8) -> str:
        """Main tool interface — returns formatted search results."""
        results = self.search(query, max_results)

        if not results:
            return f"No web results found for: {query}"

        output = f"Found {len(results)} web results for '{query}':\n\n"
        for i, r in enumerate(results, 1):
            output += f"{i}. **{r['title']}**\n"
            output += f"   URL: {r['url']}\n"
            output += f"   {r['snippet']}\n\n"

        return output


def web_search_tool(query: str, max_results: int = 8) -> str:
    """Standalone function for web search tool."""
    searcher = WebSearch()
    return searcher.run(query, max_results)
