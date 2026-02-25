/**
 * Rate-limited HTTP client for New Zealand Legislation (legislation.govt.nz)
 *
 * Uses the PCO /subscribe/ endpoint which serves XML and PDF files
 * without the Azure WAF JavaScript challenge that blocks the main site.
 *
 * - 500ms minimum delay between requests (be respectful to government servers)
 * - User-Agent header identifying the MCP
 * - Handles XML responses via /subscribe/ endpoint
 * - No auth needed (CC BY 4.0)
 */

const USER_AGENT = 'NewZealand-Law-MCP/1.0 (https://github.com/Ansvar-Systems/newzealand-law-mcp; hello@ansvar.ai)';
const MIN_DELAY_MS = 500;
const REQUEST_TIMEOUT_MS = 60000; // 60s timeout per request
const SUBSCRIBE_BASE = 'https://legislation.govt.nz/subscribe';

let lastRequestTime = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_DELAY_MS - elapsed));
  }
  lastRequestTime = Date.now();
}

export interface FetchResult {
  status: number;
  body: string;
  contentType: string;
}

/**
 * Fetch a URL with rate limiting and proper headers.
 * Retries up to 3 times on 429/5xx errors with exponential backoff.
 */
export async function fetchWithRateLimit(url: string, maxRetries = 3): Promise<FetchResult> {
  await rateLimit();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'User-Agent': USER_AGENT,
          'Accept': 'application/xml, text/xml, text/html, */*',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
      throw err;
    }

    if (response.status === 429 || response.status >= 500) {
      clearTimeout(timeout);
      if (attempt < maxRetries) {
        const backoff = Math.pow(2, attempt + 1) * 1000;
        console.log(`  HTTP ${response.status} for ${url}, retrying in ${backoff}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoff));
        continue;
      }
    }

    const body = await response.text();
    clearTimeout(timeout);
    return {
      status: response.status,
      body,
      contentType: response.headers.get('content-type') ?? '',
    };
  }

  throw new Error(`Failed to fetch ${url} after ${maxRetries} retries`);
}

/**
 * Discover the XML download URL for an act from the /subscribe/ directory listing.
 *
 * The /subscribe/ endpoint returns an HTML page listing available files (XML, PDF).
 * We parse the listing to find the .xml link.
 *
 * URL pattern: /subscribe/act/public/{year}/{number}/latest
 * Returns listing with links like: /subscribe/act/public/{year}/{number}/{version}/{hash}.xml
 */
export async function discoverXmlUrl(
  year: string,
  number: string,
  type = 'act',
  scope = 'public',
): Promise<string | null> {
  const listingUrl = `${SUBSCRIBE_BASE}/${type}/${scope}/${year}/${number}/latest`;
  const result = await fetchWithRateLimit(listingUrl);

  if (result.status !== 200) {
    return null;
  }

  // Parse the directory listing HTML for the XML file link
  // Pattern: href="/subscribe/act/public/YEAR/NUMBER/VERSION/HASH.xml"
  const xmlLinkMatch = result.body.match(
    /href="(\/subscribe\/[^"]+\.xml)"/i
  );

  if (!xmlLinkMatch) {
    return null;
  }

  return `https://legislation.govt.nz${xmlLinkMatch[1]}`;
}

/**
 * Fetch the XML content of a New Zealand Act via the /subscribe/ endpoint.
 *
 * Flow:
 * 1. Hit /subscribe/act/public/{year}/{number}/latest to get directory listing
 * 2. Extract the .xml file URL from the listing
 * 3. Fetch and return the full XML
 */
export async function fetchNzActXml(
  year: string,
  number: string,
  type = 'act',
  scope = 'public',
): Promise<FetchResult> {
  const xmlUrl = await discoverXmlUrl(year, number, type, scope);

  if (!xmlUrl) {
    return {
      status: 404,
      body: '',
      contentType: '',
    };
  }

  return fetchWithRateLimit(xmlUrl);
}

/**
 * Extract year and number from a legislation.govt.nz URL.
 * Supports both whole.html URLs and subscribe URLs.
 *
 * Examples:
 *   https://www.legislation.govt.nz/act/public/2020/0031/latest/whole.html -> { year: '2020', number: '0031' }
 *   https://legislation.govt.nz/subscribe/act/public/2020/0031/... -> { year: '2020', number: '0031' }
 */
export function extractActIdentifiers(url: string): { type: string; scope: string; year: string; number: string } | null {
  const match = url.match(/\/(act|bill)\/(public|private|local)\/(\d{4})\/(\d{4})\//);
  if (!match) return null;
  return {
    type: match[1],
    scope: match[2],
    year: match[3],
    number: match[4],
  };
}
