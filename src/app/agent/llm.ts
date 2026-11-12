import { desktopFetch, isDesktop } from "../platform/desktop";

/**
 * One contract for every model (ADR-005): the chat completions API with
 * tools. LM Studio and Ollama both serve it on localhost; cloud providers
 * serve it on their own URL.
 */

export interface ModelEndpoint {
  baseUrl: string;
  model: string;
  apiKey?: string;
  /** Tokens of context the model was loaded with. */
  context?: number;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** A message with images follows the chat completions shape for vision models. */
export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type ChatMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: string | ContentPart[] }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ModelReply {
  content: string;
  toolCalls: ToolCall[];
  /** Tokens the runtime counted for this call, when it says so. */
  usage?: { prompt: number; completion: number };
  /** Tokens per second while it wrote, when the reply was streamed. */
  speed?: number;
}

/** Some local models think out loud between <think> tags: never shown. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^[\s\S]*<\/think>/, "")
    .trim();
}

/** The same, for a reply still being written: an open <think> hides what follows it. */
export function visibleSoFar(text: string): string {
  const closed = text.replace(/<think>[\s\S]*?<\/think>/g, "");
  const open = closed.indexOf("<think>");
  const shown = open >= 0 ? closed.slice(0, open) : closed;
  // A tag that is only half written yet ("<thi") is not text either
  return shown.replace(/<\/?t?h?i?n?k?$/, "").trimStart();
}

export interface ChatOptions {
  maxTokens?: number;
  /**
   * false: a reasoning model is asked to answer straight away, without
   * thinking first (ADR-004, section 12). Left out: the model's own default.
   */
  reasoning?: boolean;
  /** "required": the model has to answer with a tool call, not with words. */
  toolChoice?: "required";
  /** Called with the whole visible text so far, as the model writes it. */
  onText?: (text: string) => void;
}

interface Delta {
  content?: string | null;
  tool_calls?: Array<{
    index?: number;
    id?: string;
    function?: { name?: string; arguments?: string };
  }>;
}

/**
 * Reads a streamed completion (server-sent events). Text arrives in pieces;
 * tool calls arrive split too, each piece addressed by its index.
 */
async function readStream(
  response: Response,
  onText: ((text: string) => void) | undefined
): Promise<ModelReply> {
  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  const calls: ToolCall[] = [];
  let buffer = "";
  let content = "";
  let usage: ModelReply["usage"];
  let firstAt = 0;

  const take = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: {
      choices?: Array<{ delta?: Delta }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof chunk.usage?.prompt_tokens === "number") {
      usage = { prompt: chunk.usage.prompt_tokens, completion: chunk.usage.completion_tokens ?? 0 };
    }
    const delta = chunk.choices?.[0]?.delta;
    if (!delta) return;
    if (!firstAt) firstAt = performance.now();
    if (delta.content) {
      content += delta.content;
      onText?.(visibleSoFar(content));
    }
    for (const piece of delta.tool_calls ?? []) {
      const index = piece.index ?? 0;
      calls[index] ??= { id: "", type: "function", function: { name: "", arguments: "" } };
      if (piece.id) calls[index].id = piece.id;
      if (piece.function?.name) calls[index].function.name += piece.function.name;
      if (piece.function?.arguments) calls[index].function.arguments += piece.function.arguments;
    }
  };

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    lines.forEach((line) => take(line.trim()));
  }
  take(buffer.trim());

  const seconds = firstAt ? (performance.now() - firstAt) / 1000 : 0;
  return {
    usage,
    // Timed from the first piece, so the wait before it does not count as writing
    speed:
      usage && usage.completion >= 8 && seconds > 0.2
        ? Math.round(usage.completion / seconds)
        : undefined,
    content: stripThinking(content),
    toolCalls: calls
      .filter(Boolean)
      .map((call, index) => ({ ...call, id: call.id || `call_${index}` })),
  };
}

/** Tokens left for thinking on top of a call's limit (675 were measured on a short answer). */
const REASONING_ROOM = 4096;
/** Endpoints that answered 400 to the reasoning switch, for this session. */
const refusesSwitch = new Set<string>();

export async function chat(
  endpoint: ModelEndpoint,
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options: ChatOptions = {}
): Promise<ModelReply> {
  const send = isDesktop() ? desktopFetch : fetch;
  const post = (reasoningOff: boolean, required = options.toolChoice === "required") =>
    send(`${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: endpoint.model,
        messages,
        // A call without tools (a summary) must not carry an empty tool list
        ...(tools.length > 0 ? { tools, tool_choice: required ? "required" : "auto" } : {}),
        // What a model thinks counts against the limit too: while it thinks it
        // gets room for that, or the limit would cut the answer itself
        ...(options.maxTokens
          ? { max_tokens: options.maxTokens + (reasoningOff ? 0 : REASONING_ROOM) }
          : {}),
        // LM Studio turns thinking off with reasoning_effort "none" (measured:
        // 2 s instead of 62 s on Qwen3.5 9B); Ollama's own switch is `think`
        ...(reasoningOff ? { reasoning_effort: "none", think: false } : {}),
        temperature: 0.2,
        stream: true,
        stream_options: { include_usage: true },
      }),
      signal,
    });
  // A server or a model that does not know the switch refuses the request:
  // it is sent again without it, and not offered the switch again
  const id = `${endpoint.baseUrl}|${endpoint.model}`;
  const reasoningOff = options.reasoning === false && !refusesSwitch.has(id);
  let response = await post(reasoningOff);
  if (reasoningOff && response.status === 400) {
    refusesSwitch.add(id);
    response = await post(false);
  }
  // A server that does not know "required" still gets the request, as a free choice
  if (options.toolChoice === "required" && response.status === 400) {
    response = await post(reasoningOff && !refusesSwitch.has(id), false);
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `The model answered ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }
  // A server that ignores `stream` answers with one JSON document
  const type = response.headers.get("content-type") ?? "";
  if (response.body && type.includes("text/event-stream")) {
    return readStream(response, options.onText);
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const message = data.choices?.[0]?.message ?? {};
  return {
    usage:
      typeof data.usage?.prompt_tokens === "number"
        ? { prompt: data.usage.prompt_tokens, completion: data.usage.completion_tokens ?? 0 }
        : undefined,
    content: stripThinking(message.content ?? ""),
    toolCalls: (message.tool_calls ?? []).map((call, index) => ({
      ...call,
      id: call.id || `call_${index}`,
      type: "function",
    })),
  };
}
