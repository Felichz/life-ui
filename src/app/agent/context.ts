import { COMPACT_GUIDE, SUMMARY_HEADINGS, SUMMARY_SHAPE } from "./guides";
import type { ChatMessage, ChatOptions, ModelReply } from "./llm";

/**
 * The model's context window as a budget (ADR-007): how much a conversation
 * takes, and how to make it smaller with the loaded model itself when it no
 * longer fits.
 */

/** Used when the runtime does not say how the model was loaded. */
export const DEFAULT_CONTEXT = 16384;
/** Tokens always left free for the model's answer. */
export const REPLY_RESERVE = 1024;

/**
 * Without the model's tokenizer the count is an estimate. Spanish with JSON
 * runs near 3.2 characters per token; the agent corrects it with the real
 * count every time the model reports one.
 */
const CHARS_PER_TOKEN = 3.2;
const IMAGE_TOKENS = 800;

export const estimateTokens = (text: string) => Math.ceil(text.length / CHARS_PER_TOKEN);

/** The words in a message, without its images. */
export function textOf(content: ChatMessage["content"]): string {
  if (typeof content === "string") return content;
  if (!content) return "";
  return content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

export function messageTokens(message: ChatMessage): number {
  let tokens = 4;
  if (Array.isArray(message.content)) {
    for (const part of message.content) {
      tokens += part.type === "text" ? estimateTokens(part.text) : IMAGE_TOKENS;
    }
  } else if (message.content) {
    tokens += estimateTokens(message.content);
  }
  if (message.role === "assistant" && message.tool_calls) {
    tokens += estimateTokens(JSON.stringify(message.tool_calls));
  }
  return tokens;
}

export const historyTokens = (messages: ChatMessage[]) =>
  messages.reduce((sum, message) => sum + messageTokens(message), 0);

/**
 * What to summarize and what to keep word for word. The kept tail always
 * starts on a message the person wrote (a tool result without its call is an
 * API error) and always holds at least the last turn.
 */
export function splitForCompaction(
  history: ChatMessage[],
  tailTokens: number
): { old: ChatMessage[]; tail: ChatMessage[] } {
  let start = -1;
  for (let index = history.length - 1; index >= 0; index--) {
    if (history[index].role !== "user") continue;
    if (start === -1 || historyTokens(history.slice(index)) <= tailTokens) start = index;
    else break;
  }
  if (start <= 0) return { old: [], tail: history };
  return { old: history.slice(0, start), tail: history.slice(start) };
}

/** Long tool results are the first thing to go when even one turn is too big. */
export function shrinkToolResults(messages: ChatMessage[], maxChars = 400): ChatMessage[] {
  return messages.map((message) =>
    message.role === "tool" && message.content.length > maxChars
      ? { ...message, content: `${message.content.slice(0, maxChars)}… [trimmed]` }
      : message
  );
}

/** The conversation as plain lines a model can summarize. */
export function transcript(messages: ChatMessage[]): string[] {
  const lines: string[] = [];
  for (const message of messages) {
    if (message.role === "user") {
      const images = Array.isArray(message.content)
        ? message.content.filter((part) => part.type === "image_url").length
        : 0;
      lines.push(`Person: ${textOf(message.content)}${images ? ` [${images} image(s)]` : ""}`);
    } else if (message.role === "assistant") {
      if (message.content) lines.push(`Agent: ${message.content}`);
      for (const call of message.tool_calls ?? []) {
        lines.push(`Agent did: ${call.function.name} ${call.function.arguments}`);
      }
    } else if (message.role === "tool") {
      lines.push(`Result: ${message.content.slice(0, 400)}`);
    }
  }
  return lines;
}

/** Packs lines into chunks of about `chunkTokens`, cutting a line only when it alone is too long. */
export function chunkLines(lines: string[], chunkTokens: number): string[] {
  const maxChars = Math.floor(chunkTokens * CHARS_PER_TOKEN);
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current) chunks.push(current);
    current = "";
  };
  for (const line of lines) {
    for (let offset = 0; offset < line.length || offset === 0; offset += maxChars) {
      const piece = line.slice(offset, offset + maxChars);
      if (current && current.length + piece.length + 1 > maxChars) flush();
      current = current ? `${current}\n${piece}` : piece;
      if (line.length === 0) break;
    }
  }
  flush();
  return chunks;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export type SummaryChat = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options?: ChatOptions
) => Promise<ModelReply>;

export interface SummarizeOptions {
  chat: SummaryChat;
  /** The loaded model's context: it sets how big a chunk it can read. */
  context: number;
  /** "Spanish" or "English": the summary is read by the person too. */
  language: string;
  /** The summary of an earlier compaction, folded into this one. */
  previous?: string;
  signal?: AbortSignal;
  onProgress?: (done: number, total: number) => void;
}

/**
 * Summarizes a conversation with the loaded model, one chunk per call so a
 * small model only handles one piece at a time. The number of chunks follows
 * the conversation and the model: a 100K conversation on a 16K model becomes
 * many chunks, and when the joined notes are still too long they are
 * summarized again.
 */
export async function summarize(
  messages: ChatMessage[],
  options: SummarizeOptions
): Promise<{ summary: string; chunks: number }> {
  const { chat, context, language, signal, onProgress } = options;
  // Small models summarize better in small pieces, whatever their window
  const chunkTokens = clamp(Math.floor(context * 0.45), 1000, 4000);
  const targetTokens = clamp(Math.floor(context * 0.12), 400, 2000);

  let lines = transcript(messages);
  if (options.previous)
    lines = [`Notes from earlier in the conversation:\n${options.previous}`, ...lines];

  let chunks = chunkLines(lines, chunkTokens);
  const firstPassChunks = chunks.length;
  let summary = "";
  for (let pass = 0; pass < 4; pass++) {
    const words = clamp(Math.floor((targetTokens / chunks.length) * 0.6), 60, 250);
    const notes: string[] = [];
    for (let index = 0; index < chunks.length; index++) {
      onProgress?.(index, chunks.length);
      const reply = await chat(
        [
          { role: "system", content: COMPACT_GUIDE(words, language) },
          {
            role: "user",
            content: `Part ${index + 1} of ${chunks.length}:\n\n${chunks[index]}`,
          },
        ],
        [],
        signal,
        // Thinking models spend output tokens before they write: leave them room
        // and a summary needs no thinking at all, when the model can skip it
        { maxTokens: 2048, reasoning: false }
      );
      if (signal?.aborted) throw new Error("aborted");
      const note = reply.content.trim();
      if (!note) throw new Error("empty-summary");
      notes.push(note);
    }
    onProgress?.(chunks.length, chunks.length);
    summary = notes.join("\n\n");
    if (chunks.length === 1 || estimateTokens(summary) <= targetTokens * 1.3) break;
    // Still too long: the notes themselves are summarized
    chunks = chunkLines(summary.split("\n"), chunkTokens);
  }

  // The notes are put in a fixed shape, so the agent (and the person) always
  // find the goal, the decisions, the changes and what is open in the same place
  const headings = SUMMARY_HEADINGS[language === "Spanish" ? "es" : "en"];
  const shaped = (text: string) => headings.filter((heading) => text.includes(heading)).length >= 2;
  const ask: ChatMessage[] = [
    { role: "system", content: SUMMARY_SHAPE(headings, Math.floor(targetTokens * 0.6), language) },
    { role: "user", content: summary },
  ];
  for (let attempt = 0; attempt < 2; attempt++) {
    const reply = await chat(ask, [], signal, { maxTokens: 3072, reasoning: false });
    if (signal?.aborted) throw new Error("aborted");
    const text = reply.content.trim();
    if (shaped(text)) return { summary: text, chunks: firstPassChunks };
    // One reminder, as a small model often answers in prose the first time
    ask.push(
      { role: "assistant", content: text || "…" },
      {
        role: "user",
        content: `Write it again using exactly these headings:\n${headings.join("\n")}`,
      }
    );
  }
  // Notes without the shape are still the conversation: they are kept as they are
  return { summary, chunks: firstPassChunks };
}
