"""
DualMind AI OS — Web Scraper Tool
Extract clean text content from web pages using trafilatura.
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)


class WebScraper:
    """Extract structured text content from web pages."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def scrape(self, url: str) -> Dict[str, Any]:
        """
        Scrape a URL and extract clean text content.

        Returns dict with: text, title, author, date, url
        """
        try:
            import trafilatura

            downloaded = trafilatura.fetch_url(url)
            if not downloaded:
                return {"error": f"Could not fetch URL: {url}", "text": ""}

            text = trafilatura.extract(
                downloaded,
                include_comments=False,
                include_tables=True,
                favor_precision=True,
            )

            metadata = trafilatura.extract(
                downloaded,
                output_format="json",
                include_comments=False,
            )

            meta_dict = {}
            if metadata:
                import json
                try:
                    meta_dict = json.loads(metadata)
                except Exception:
                    pass

            return {
                "text": text or "",
                "title": meta_dict.get("title", ""),
                "author": meta_dict.get("author", ""),
                "date": meta_dict.get("date", ""),
                "url": url,
                "word_count": len(text.split()) if text else 0,
            }

        except ImportError:
            self.logger.warning("trafilatura not installed, using fallback")
            return self._fallback_scrape(url)
        except Exception as e:
            self.logger.error(f"Scraping failed for {url}: {e}")
            return {"error": str(e), "text": "", "url": url}

    def _fallback_scrape(self, url: str) -> Dict[str, Any]:
        """Fallback scraper using requests + basic HTML parsing."""
        try:
            import requests
            from html.parser import HTMLParser

            resp = requests.get(url, timeout=15, headers={
                "User-Agent": "DualMind-AI/1.0 (Research Bot)"
            })
            resp.raise_for_status()

            # Basic text extraction
            import re
            text = re.sub(r'<script[^>]*>.*?</script>', '', resp.text, flags=re.DOTALL)
            text = re.sub(r'<style[^>]*>.*?</style>', '', text, flags=re.DOTALL)
            text = re.sub(r'<[^>]+>', ' ', text)
            text = re.sub(r'\s+', ' ', text).strip()

            # Extract title
            title_match = re.search(r'<title[^>]*>(.*?)</title>', resp.text, re.IGNORECASE)
            title = title_match.group(1) if title_match else ""

            return {
                "text": text[:5000],
                "title": title,
                "url": url,
                "word_count": len(text.split()),
            }
        except Exception as e:
            return {"error": str(e), "text": "", "url": url}

    def run(self, url: str) -> str:
        """Main tool interface."""
        result = self.scrape(url)

        if result.get("error"):
            return f"Error scraping {url}: {result['error']}"

        text = result.get("text", "")
        if not text:
            return f"No content extracted from {url}"

        title = result.get("title", "Unknown")
        word_count = result.get("word_count", 0)

        output = f"**Extracted from:** {title}\n"
        output += f"**URL:** {url}\n"
        output += f"**Word count:** {word_count}\n\n"
        output += text[:3000]

        if len(text) > 3000:
            output += f"\n\n... (truncated, {word_count} total words)"

        return output


def web_scraper_tool(url: str) -> str:
    """Standalone function for web scraper tool."""
    scraper = WebScraper()
    return scraper.run(url)
