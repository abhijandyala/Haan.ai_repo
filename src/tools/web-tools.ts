import { BaseTool, ToolResult } from './types.js';
import { logger } from '../utils/logger.js';

const MAX_CONTENT_LENGTH = 20000;
const SEARCH_TIMEOUT = 10000;

export class WebSearchTool extends BaseTool {
  name = 'web-search';
  description = 'Search the web for information using DuckDuckGo. Returns titles, URLs, and snippets for top results.';
  parameters = {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Maximum number of results to return (default 8)' },
    },
    required: ['query'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params.query as string;
    const maxResults = Math.min((params.maxResults as number) || 8, 20);

    logger.info('web-search', `Searching: "${query}" (max ${maxResults} results)`);

    try {
      const results = await this.searchDuckDuckGo(query, maxResults);
      if (results.length === 0) {
        return this.success(`No results found for: "${query}"`, { query, resultCount: 0 });
      }

      const formatted = results
        .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`)
        .join('\n\n');

      return this.success(
        `Search results for "${query}" (${results.length} results):\n\n${formatted}`,
        { query, resultCount: results.length },
      );
    } catch (err) {
      const msg = (err as Error).message;
      logger.error('web-search', `Search failed: ${msg}`);
      return this.error(`Web search failed: ${msg}`);
    }
  }

  private async searchDuckDuckGo(
    query: string,
    maxResults: number,
  ): Promise<Array<{ title: string; url: string; snippet: string }>> {
    const encoded = encodeURIComponent(query);
    const url = `https://html.duckduckgo.com/html/?q=${encoded}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), SEARCH_TIMEOUT);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`DuckDuckGo returned HTTP ${response.status}`);
      }

      const html = await response.text();
      return this.parseDuckDuckGoResults(html, maxResults);
    } catch (err) {
      clearTimeout(timeoutId);
      const msg = (err as Error).message;
      if (msg.includes('abort')) {
        throw new Error('Search timed out');
      }
      throw err;
    }
  }

  private parseDuckDuckGoResults(
    html: string,
    maxResults: number,
  ): Array<{ title: string; url: string; snippet: string }> {
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    // Parse DuckDuckGo HTML results
    // Results are in <div class="result results_links results_links_deep web-result">
    const resultBlocks = html.split(/class="result(?:__body|s_links|[^"]*web-result)/);

    for (let i = 1; i < resultBlocks.length && results.length < maxResults; i++) {
      const block = resultBlocks[i];

      // Extract title from <a class="result__a"> or <a class="result-link">
      const titleMatch = block.match(
        /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>|<a[^>]*class="result-link"[^>]*>([\s\S]*?)<\/a>/,
      );
      const rawTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (!rawTitle) continue;

      const title = this.stripTags(rawTitle).trim();
      if (!title) continue;

      // Extract URL from href
      const urlMatch = block.match(
        /href="(?:\/\/duckduckgo\.com\/l\/\?uddg=)?([^"&]+)/,
      );
      let url = '';
      if (urlMatch) {
        url = decodeURIComponent(urlMatch[1]);
        if (!url.startsWith('http')) {
          // Try finding a direct URL in the block
          const directUrl = block.match(/href="(https?:\/\/[^"]+)"/);
          url = directUrl ? directUrl[1] : '';
        }
      }
      if (!url) continue;

      // Extract snippet from <a class="result__snippet"> or <td class="result-snippet">
      const snippetMatch = block.match(
        /class="result__snippet"[^>]*>([\s\S]*?)<\/|class="result-snippet"[^>]*>([\s\S]*?)<\//,
      );
      const rawSnippet = snippetMatch ? (snippetMatch[1] || snippetMatch[2]) : '';
      const snippet = this.stripTags(rawSnippet).trim() || 'No description available.';

      results.push({ title, url: url.split('&')[0], snippet });
    }

    return results;
  }

  private stripTags(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}

export class WebFetchTool extends BaseTool {
  name = 'web-fetch';
  description = 'Fetch the content of a URL and return as cleaned text. HTML is stripped to readable text. Content is truncated to 20000 characters.';
  parameters = {
    type: 'object' as const,
    properties: {
      url: { type: 'string', description: 'URL to fetch' },
      selector: { type: 'string', description: 'Optional: CSS-like content area hint (e.g., "main", "article", "body")' },
    },
    required: ['url'],
  };

  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const url = params.url as string;

    try {
      new URL(url);
    } catch {
      return this.error(`Invalid URL: ${url}`);
    }

    logger.info('web-fetch', `Fetching: ${url}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return this.error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await response.json();
        const text = JSON.stringify(json, null, 2);
        const truncated = text.length > MAX_CONTENT_LENGTH
          ? text.slice(0, MAX_CONTENT_LENGTH) + `\n...[truncated, ${text.length} total chars]`
          : text;
        return this.success(truncated, { url, contentType, length: text.length });
      }

      const text = await response.text();
      let cleaned = text;
      if (contentType.includes('html')) {
        cleaned = this.extractContent(text);
      }

      const truncated = cleaned.length > MAX_CONTENT_LENGTH
        ? cleaned.slice(0, MAX_CONTENT_LENGTH) + `\n...[truncated, ${cleaned.length} total chars]`
        : cleaned;

      return this.success(truncated, { url, contentType, length: cleaned.length });
    } catch (err) {
      const message = (err as Error).message;
      if (message.includes('abort')) {
        return this.error(`Request timed out after 15 seconds: ${url}`);
      }
      return this.error(`Fetch failed: ${message}`);
    }
  }

  private extractContent(html: string): string {
    // Remove non-content elements
    let text = html;
    text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<nav\b[^<]*(?:(?!<\/nav>)<[^<]*)*<\/nav>/gi, '');
    text = text.replace(/<footer\b[^<]*(?:(?!<\/footer>)<[^<]*)*<\/footer>/gi, '');
    text = text.replace(/<header\b[^<]*(?:(?!<\/header>)<[^<]*)*<\/header>/gi, '');

    // Extract title
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch ? this.stripHtml(titleMatch[1]).trim() : '';

    // Extract headings for structure
    const headings: string[] = [];
    const headingRegex = /<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi;
    let hMatch;
    while ((hMatch = headingRegex.exec(text)) !== null) {
      const h = this.stripHtml(hMatch[1]).trim();
      if (h && h.length < 200) headings.push(h);
    }

    // Strip all remaining tags
    let cleaned = this.stripHtml(text);

    // Build structured output
    const parts: string[] = [];
    if (title) parts.push(`Title: ${title}`);
    if (headings.length > 0) {
      parts.push(`\nHeadings: ${headings.slice(0, 15).join(' | ')}`);
    }
    parts.push(`\n---\n${cleaned}`);

    return parts.join('\n');
  }

  private stripHtml(html: string): string {
    let text = html.replace(/<[^>]+>/g, ' ');
    // Decode entities
    text = text.replace(/&nbsp;/g, ' ');
    text = text.replace(/&amp;/g, '&');
    text = text.replace(/&lt;/g, '<');
    text = text.replace(/&gt;/g, '>');
    text = text.replace(/&quot;/g, '"');
    text = text.replace(/&#39;/g, "'");
    text = text.replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num)));
    // Collapse whitespace
    text = text.replace(/[ \t]+/g, ' ');
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    return text.trim();
  }
}
