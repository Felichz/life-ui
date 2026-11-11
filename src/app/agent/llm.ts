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

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export interface ModelReply {
  content: string;
  toolCalls: ToolCall[];
}

/** Some local models think out loud between <think> tags: never shown. */
export function stripThinking(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/g, "")
    .replace(/^[\s\S]*<\/think>/, "")
    .trim();
}

export async function chat(
  endpoint: ModelEndpoint,
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal
): Promise<ModelReply> {
  const send = isDesktop() ? desktopFetch : fetch;
  const response = await send(`${endpoint.baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(endpoint.apiKey ? { Authorization: `Bearer ${endpoint.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: endpoint.model,
      messages,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      stream: false,
    }),
    signal,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(
      `The model answered ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`
    );
  }
  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string | null; tool_calls?: ToolCall[] } }>;
  };
  const message = data.choices?.[0]?.message ?? {};
  return {
    content: stripThinking(message.content ?? ""),
    toolCalls: (message.tool_calls ?? []).map((call, index) => ({
      ...call,
      id: call.id || `call_${index}`,
      type: "function",
    })),
  };
}
