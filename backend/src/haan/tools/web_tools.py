"""
Web interaction tools for Haan.ai agents.

Provides 2 tools mirroring the TypeScript web-tools.ts:
- WebSearchTool:  Search the web via DuckDuckGo HTML scraping
- WebFetchTool:   Fetch and clean web page content
"""

from __future__ import annotations

import re
from html import unescape
from urllib.parse import quote_plus

import httpx
from crewai.tools import BaseTool as CrewAIBaseTool

from haan.utils.logger import logger

# Maximum content length for fetched pages
MAX_CONTENT_LENGTH = 20_000

# Request timeout in seconds
REQUEST_TIMEOUT = 15

# Common headers to mimic a browser
BROWSER_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
    "Accept-Language": "en-US,en;q=0.9",
}


def _strip_html(html: str) -> str:
    """Strip HTML tags and decode entities to plain text."""
    text = re.sub(r"<[^>]+>", " ", html)
    text = unescape(text)
    # Collapse whitespace
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n\s*\n\s*\n", "\n\n", text)
    return text.strip()


class WebSearchTool(CrewAIBaseTool):
    """Search the web for information using DuckDuckGo."""

    name: str = "web-search"
    description: str = (
        "Search the web for information using DuckDuckGo. "
        "Returns titles, URLs, and snippets for top results."
    )

    def _run(self, query: str, maxResults: int = 8) -> str:
        """
        Search the web.

        Args:
            query: Search query string.
            maxResults: Maximum number of results (default 8, max 20).

        Returns:
            Formatted search results with titles, URLs, and snippets.
        """
        max_results = min(maxResults, 20)
        logger.info("web-search", f'Searching: "{query}" (max {max_results} results)')

        try:
            results = self._search_duckduckgo(query, max_results)
            if not results:
                return f'No results found for: "{query}"'

            formatted = "\n\n".join(
                f"{i + 1}. {r['title']}\n   {r['url']}\n   {r['snippet']}"
                for i, r in enumerate(results)
            )
            return (
                f'Search results for "{query}" ({len(results)} results):\n\n{formatted}'
            )
        except Exception as e:
            logger.error("web-search", f"Search failed: {e}")
            return f"Error: Web search failed: {e}"

    def _search_duckduckgo(
        self, query: str, max_results: int
    ) -> list[dict[str, str]]:
        """
        Fetch and parse DuckDuckGo HTML search results.

        Args:
            query: Search query.
            max_results: Maximum number of results to return.

        Returns:
            List of dicts with 'title', 'url', 'snippet' keys.
        """
        url = f"https://html.duckduckgo.com/html/?q={quote_plus(query)}"

        with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
            response = client.get(url, headers=BROWSER_HEADERS)
            response.raise_for_status()

        html = response.text
        results: list[dict[str, str]] = []

        # Parse result blocks from DuckDuckGo HTML
        blocks = re.split(
            r'class="result(?:__body|s_links|[^"]*web-result)', html
        )

        for block in blocks[1:]:
            if len(results) >= max_results:
                break

            # Extract title
            title_match = re.search(
                r'<a[^>]*class="result__a"[^>]*>([\s\S]*?)</a>', block
            )
            if not title_match:
                continue
            title = _strip_html(title_match.group(1)).strip()
            if not title:
                continue

            # Extract URL
            url_match = re.search(
                r'href="(?://duckduckgo\.com/l/\?uddg=)?([^"&]+)', block
            )
            if not url_match:
                continue
            result_url = unescape(url_match.group(1))
            if not result_url.startswith("http"):
                direct_url = re.search(r'href="(https?://[^"]+)"', block)
                result_url = direct_url.group(1) if direct_url else ""
            if not result_url:
                continue

            # Extract snippet
            snippet_match = re.search(
                r'class="result__snippet"[^>]*>([\s\S]*?)</', block
            )
            snippet = (
                _strip_html(snippet_match.group(1)).strip()
                if snippet_match
                else "No description available."
            )

            results.append({
                "title": title,
                "url": result_url.split("&")[0],
                "snippet": snippet,
            })

        return results


class WebFetchTool(CrewAIBaseTool):
    """Fetch the content of a URL and return cleaned text."""

    name: str = "web-fetch"
    description: str = (
        "Fetch the content of a URL and return as cleaned text. "
        "HTML is stripped to readable text. Content is truncated to 20000 characters."
    )

    def _run(self, url: str) -> str:
        """
        Fetch a URL and return cleaned content.

        Args:
            url: URL to fetch.

        Returns:
            Cleaned text content, or error message.
        """
        # Validate URL
        if not url.startswith(("http://", "https://")):
            return f"Error: Invalid URL: {url}"

        logger.info("web-fetch", f"Fetching: {url}")

        try:
            with httpx.Client(
                timeout=REQUEST_TIMEOUT, follow_redirects=True
            ) as client:
                response = client.get(url, headers=BROWSER_HEADERS)
                response.raise_for_status()

            content_type = response.headers.get("content-type", "")

            # Handle JSON responses
            if "application/json" in content_type:
                import json
                text = json.dumps(response.json(), indent=2)
                if len(text) > MAX_CONTENT_LENGTH:
                    text = text[:MAX_CONTENT_LENGTH] + (
                        f"\n...[truncated, {len(text)} total chars]"
                    )
                return text

            # Handle HTML
            text = response.text
            if "html" in content_type:
                text = self._extract_content(text)

            if len(text) > MAX_CONTENT_LENGTH:
                text = text[:MAX_CONTENT_LENGTH] + (
                    f"\n...[truncated, {len(text)} total chars]"
                )

            return text

        except httpx.TimeoutException:
            return f"Error: Request timed out after {REQUEST_TIMEOUT} seconds: {url}"
        except Exception as e:
            return f"Error: Fetch failed: {e}"

    @staticmethod
    def _extract_content(html: str) -> str:
        """
        Extract readable content from HTML.

        Removes scripts, styles, nav, header, and footer elements,
        then extracts the title, headings, and body text.
        """
        text = html

        # Remove non-content elements
        for tag in ("script", "style", "nav", "footer", "header"):
            text = re.sub(
                rf"<{tag}\b[^<]*(?:(?!</{tag}>)<[^<]*)*</{tag}>",
                "",
                text,
                flags=re.IGNORECASE | re.DOTALL,
            )

        # Extract title
        title_match = re.search(r"<title[^>]*>([\s\S]*?)</title>", text, re.IGNORECASE)
        title = _strip_html(title_match.group(1)).strip() if title_match else ""

        # Extract headings
        headings: list[str] = []
        for h_match in re.finditer(
            r"<h[1-6][^>]*>([\s\S]*?)</h[1-6]>", text, re.IGNORECASE
        ):
            h = _strip_html(h_match.group(1)).strip()
            if h and len(h) < 200:
                headings.append(h)

        # Strip all remaining tags
        cleaned = _strip_html(text)

        # Build structured output
        parts: list[str] = []
        if title:
            parts.append(f"Title: {title}")
        if headings:
            parts.append(f"\nHeadings: {' | '.join(headings[:15])}")
        parts.append(f"\n---\n{cleaned}")

        return "\n".join(parts)
