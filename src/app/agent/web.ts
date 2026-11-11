/**
 * Research on the web (ADR-009). One provider, the way OpenCode does it by
 * default: Exa's hosted search endpoint, which needs no key. Only the search
 * text leaves the machine; nothing about the person or the day goes with it.
 */

export const WEB_ENDPOINT = "https://mcp.exa.ai/mcp";
/** Results kept per search, and characters per result: a small context has to hold them. */
const MAX_RESULTS = 5;
const MAX_CHARS = 700;
const TIMEOUT_MS = 25_000;

export interface WebResult {
  title: string;
  url: string;
  /** "2026-08-01", when the source says. */
  published?: string;
  text: string;
}

/** The endpoint answers as plain JSON or as one server-sent event carrying it. */
function payloadOf(body: string): { result?: { content?: Array<{ text?: string }> } } | null {
  const candidates = [
    body.trim(),
    ...body
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trim()),
  ];
  for (const candidate of candidates) {
    if (!candidate.startsWith("{")) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // not this one
    }
  }
  return null;
}

/** Exa returns one text with a block per result: Title, URL, Published, then the highlights. */
export function parseResults(text: string): WebResult[] {
  return text
    .split(/\n\s*---\s*\n|\n(?=Title:\s)/)
    .flatMap((block): WebResult[] => {
      const url = block.match(/^URL:\s*(.+)$/m)?.[1]?.trim();
      if (!url || !/^https?:\/\//.test(url)) return [];
      const title = block.match(/^Title:\s*(.+)$/m)?.[1]?.trim();
      const published = block.match(/^Published:\s*(\d{4}-\d{2}-\d{2})/m)?.[1];
      const content = (block.match(/^(?:Highlights|Text):\s*\n?([\s\S]*)$/m)?.[1] ?? "")
        .replace(/\s+/g, " ")
        .trim();
      return [
        {
          title: title && title !== "N/A" ? title : url,
          url,
          ...(published ? { published } : {}),
          text: content.length > MAX_CHARS ? `${content.slice(0, MAX_CHARS)}…` : content,
        },
      ];
    })
    .slice(0, MAX_RESULTS);
}

export async function searchWeb(
  query: string,
  http: typeof fetch,
  signal?: AbortSignal
): Promise<WebResult[]> {
  // One controller for both ways out: the person stopping the turn, and time running out
  const controller = new AbortController();
  const stop = () => controller.abort();
  const timer = setTimeout(stop, TIMEOUT_MS);
  signal?.addEventListener("abort", stop);
  try {
    const response = await http(WEB_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "web_search_exa", arguments: { query, numResults: MAX_RESULTS } },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`web search answered ${response.status}`);
    const payload = payloadOf(await response.text());
    const text = payload?.result?.content?.find((item) => item.text)?.text;
    return text ? parseResults(text) : [];
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

// ------------------------------------------------------------------ the setting

/**
 * ask: the first search asks the person (the default: nothing leaves the
 * machine without a yes). on: the agent searches when it helps. off: it has
 * no way to search.
 */
export type WebSetting = "ask" | "on" | "off";

const KEY = "lifeui.web";
const listeners = new Set<() => void>();

export function getWebSetting(): WebSetting {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "on" || saved === "off" ? saved : "ask";
  } catch {
    return "ask";
  }
}

export function setWebSetting(setting: WebSetting): void {
  try {
    localStorage.setItem(KEY, setting);
  } catch {
    // kept for this session only: the listeners below still hear it
  }
  listeners.forEach((listener) => listener());
}

export function onWebSetting(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
