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
  /**
   * "required": the answer has to be one call to one of the tools, not words.
   * Held by a JSON schema where the server enforces one (see `moveSchema`).
   */
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
  let failure = "";

  const take = (line: string) => {
    if (!line.startsWith("data:")) return;
    const data = line.slice(5).trim();
    if (!data || data === "[DONE]") return;
    let chunk: {
      error?: string | { message?: string };
      choices?: Array<{ delta?: Delta }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number } | null;
    };
    try {
      chunk = JSON.parse(data);
    } catch {
      return;
    }
    // A server that fails half way says so inside the stream, with a 200 already sent
    if (chunk.error) {
      failure = (typeof chunk.error === "string" ? chunk.error : chunk.error.message) || "unknown";
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

  // Without this the failure reads as a model that chose to say nothing
  if (failure && !content && calls.length === 0) {
    throw new Error(`The model stopped with an error: ${failure.slice(0, 300)}`);
  }
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
  const post = (reasoningOff: boolean, force: Force) =>
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
        ...(tools.length > 0
          ? { tools, tool_choice: force === "choice" ? "required" : "auto" }
          : {}),
        // The tools stay in the request so the model reads what each one is for;
        // the schema is what holds its answer to one of them
        ...(force === "schema"
          ? {
              response_format: {
                type: "json_schema",
                json_schema: { name: "move", strict: true, schema: moveSchema(tools) },
              },
            }
          : {}),
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
  const id = `${endpoint.baseUrl}|${endpoint.model}`;
  let reasoningOff = options.reasoning === false && !refusesSwitch.has(id);
  let force: Force =
    options.toolChoice !== "required" || tools.length === 0
      ? "none"
      : refusesSchema.has(id)
        ? "choice"
        : "schema";
  let response = await post(reasoningOff, force);
  // A 400 does not say which part of the request it refuses, and a context
  // that is too long is a 400 as well. So each extra is taken off in turn, and
  // the endpoint is remembered as refusing one only when the request went
  // through without it: otherwise one overflow would turn thinking back on
  // for the rest of the session.
  if (response.status === 400 && force === "schema") {
    const retry = await post(reasoningOff, "choice");
    if (retry.status !== 400) refusesSchema.add(id);
    response = retry;
    force = "choice";
  }
  if (response.status === 400 && force === "choice") {
    response = await post(reasoningOff, "none");
    force = "none";
  }
  if (response.status === 400 && reasoningOff) {
    const retry = await post(false, force);
    if (retry.status !== 400) {
      refusesSwitch.add(id);
      response = retry;
      reasoningOff = false;
    }
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
    return asMove(await readStream(response, options.onText), force);
  }
  return asMove(await readWhole(response), force);
}

/**
 * How a call is held to answering with a tool. "schema": the answer has to
 * match a JSON schema, which LM Studio, llama.cpp and Ollama enforce with a
 * grammar. "choice": tool_choice "required", for servers without schemas.
 */
type Force = "schema" | "choice" | "none";

/** Endpoints that answered 400 to a schema and took the request without it. */
const refusesSchema = new Set<string>();

/**
 * One move as a schema: the name of one tool and its arguments, in the shape
 * models already write a tool call in. Measured on LM Studio with Qwen3.5 9B:
 * `tool_choice: "required"` is not enforced (the model wrote the call as prose
 * and went on for 1,500 tokens, three times out of three); a schema is, with
 * tools in the request and while streaming.
 */
export function moveSchema(tools: unknown[]) {
  return {
    anyOf: (tools as Array<{ function: { name: string; parameters: unknown } }>).map((tool) => ({
      type: "object",
      properties: { name: { const: tool.function.name }, arguments: tool.function.parameters },
      required: ["name", "arguments"],
      additionalProperties: false,
    })),
  };
}

let moves = 0;

/** A reply held to the schema arrives as text: it is read back as the tool call it is. */
function asMove(reply: ModelReply, force: Force): ModelReply {
  if (force !== "schema" || reply.toolCalls.length > 0) return reply;
  try {
    const move = JSON.parse(reply.content) as { name?: unknown; arguments?: unknown };
    if (typeof move?.name !== "string") return reply;
    return {
      ...reply,
      content: "",
      toolCalls: [
        {
          id: `move_${++moves}`,
          type: "function",
          function: { name: move.name, arguments: JSON.stringify(move.arguments ?? {}) },
        },
      ],
    };
  } catch {
    // Cut short by the token limit: what there is comes back as text
    return reply;
  }
}

async function readWhole(response: Response): Promise<ModelReply> {
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
