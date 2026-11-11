import type { ISystemCore } from "../../types";
import { isCoreError } from "../../system";
import { daySnapshot } from "./snapshot";
import { ToolError, TOOLS, toolByName, toolSchemas, type Tool } from "./tools";
import { t } from "../i18n";
import {
  DEFAULT_CONTEXT,
  REPLY_RESERVE,
  estimateTokens,
  historyTokens,
  shrinkToolResults,
  splitForCompaction,
  summarize,
  textOf,
} from "./context";
import type { ChatMessage, ContentPart, ModelReply, ToolCall } from "./llm";

/**
 * The agent loop (ADR-002): the person writes, the model answers or calls
 * tools, mutations wait for the person's yes in confirm mode, and every
 * executed change can be undone. The UI only renders `entries`.
 *
 * It also keeps the conversations (ADR-007): several of them, each one within
 * the loaded model's context, compacted with the model itself when it grows.
 */

export type Mode = "confirm" | "auto";

/** A file the person adds to a message. `data` is a data URL (image) or the text. */
export interface Attachment {
  kind: "image" | "text";
  name: string;
  data: string;
}

export type Entry =
  | {
      id: string;
      kind: "user";
      text: string;
      attachments?: Array<{ kind: "image" | "text"; name: string; url?: string }>;
      /** Where this message sits in the history, for editing it. */
      h?: number;
    }
  | {
      id: string;
      kind: "assistant";
      text: string;
      /** The history length once this answer was given, for branching from it. */
      h?: number;
    }
  | {
      id: string;
      kind: "tool";
      name: string;
      summary: string;
      status: "pending" | "running" | "done" | "rejected" | "error" | "undone";
      error?: string;
      /** Tempos the change earns: the preview while it waits, the real ones once done. */
      tempos?: number;
    }
  | {
      id: string;
      kind: "compact";
      /** The summary that replaced the older messages: the person can read it. */
      text: string;
      chunks: number;
      before: number;
      after: number;
    }
  | { id: string; kind: "error"; text: string };

export type ChatFn = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options?: { maxTokens?: number }
) => Promise<ModelReply>;

/** One conversation as it is kept between launches. */
export interface SavedChat {
  id: string;
  title: string;
  updatedAt: number;
  entries: Entry[];
  history: ChatMessage[];
  /** What was said before the kept history, written by a compaction. */
  summary?: string;
  /** Messages a compaction removed from the start of the history. */
  dropped?: number;
}

export interface SavedChats {
  activeId: string;
  chats: SavedChat[];
}

export interface ChatStore {
  load: () => SavedChats | null;
  save: (all: SavedChats) => void;
}

export interface ChatSummary {
  id: string;
  title: string;
  updatedAt: number;
  active: boolean;
}

export interface ContextUsage {
  used: number;
  context: number;
  /** The conversation no longer fits: it has to be compacted before going on. */
  overflow: boolean;
  /** There is something older than the last turn to summarize. */
  canCompact: boolean;
}

export interface AgentOptions {
  core: ISystemCore;
  chat: ChatFn;
  prompt: string;
  now?: () => Date;
  /** Tool calls per message before the agent gives up (a small model can loop). */
  maxSteps?: number;
  /** The interface's language, a hint for the reply's language. */
  language?: () => string;
  /** Where the conversations are kept, so closing the app does not lose them. */
  store?: ChatStore;
  /** Tokens of context the loaded model has. */
  context?: () => number;
}

/** Entries kept on screen and on disk per conversation; older ones fall off the top. */
const MAX_ENTRIES = 400;
/** Past this share of the context the conversation is compacted before the next call. */
const AUTO_COMPACT_AT = 0.85;

let counter = 0;
const nextId = (prefix = "e") => `${prefix}${Date.now().toString(36)}-${++counter}`;

/** Chat templates such as Gemma's reject two messages in a row from the person. */
export function mergeUserRuns(messages: ChatMessage[]): ChatMessage[] {
  const merged: ChatMessage[] = [];
  for (const message of messages) {
    const last = merged[merged.length - 1];
    if (message.role === "user" && last?.role === "user") {
      const parts = (content: string | ContentPart[]): ContentPart[] =>
        typeof content === "string" ? [{ type: "text", text: content }] : content;
      merged[merged.length - 1] =
        typeof last.content === "string" && typeof message.content === "string"
          ? { role: "user", content: `${last.content}\n\n${message.content}` }
          : { role: "user", content: [...parts(last.content), ...parts(message.content)] };
    } else {
      merged.push(message);
    }
  }
  return merged;
}

export class Agent {
  entries: Entry[] = [];
  busy = false;
  mode: Mode = "confirm";
  /** Progress of a compaction in course, for the UI. */
  compacting: { done: number; total: number } | null = null;

  private chatId = nextId("c");
  private title = "";
  private summary = "";
  private dropped = 0;
  private history: ChatMessage[] = [];
  /** The conversations that are not open. */
  private others: SavedChat[] = [];

  private listeners = new Set<() => void>();
  private decisions = new Map<string, (yes: boolean) => void>();
  /** The state before the last executed change, for undo. */
  private lastUndo: { entryId: string; snapshot: string } | null = null;
  private abort: AbortController | null = null;
  /** Entries that came back from a previous session: shown without their entrance. */
  private restored = new Set<string>();
  /** Real tokens over estimated ones, from the model's own count. */
  private tokenRatio = 1;

  constructor(private readonly options: AgentOptions) {
    const saved = options.store?.load();
    if (saved) {
      const active = saved.chats.find((chat) => chat.id === saved.activeId);
      this.others = saved.chats.filter((chat) => chat !== active);
      if (active) this.adopt(active);
      for (const chat of saved.chats) for (const entry of chat.entries) this.restored.add(entry.id);
    }
  }

  // ---------------------------------------------------------------- conversations

  private adopt(chat: SavedChat) {
    this.chatId = chat.id;
    this.title = chat.title;
    this.summary = chat.summary ?? "";
    this.dropped = chat.dropped ?? 0;
    this.entries = chat.entries;
    this.history = chat.history;
    this.lastUndo = null;
  }

  private blank() {
    this.adopt({ id: nextId("c"), title: "", updatedAt: 0, entries: [], history: [] });
  }

  private current(): SavedChat {
    return {
      id: this.chatId,
      title: this.title,
      updatedAt: Date.now(),
      entries: this.entries.slice(-MAX_ENTRIES),
      history: this.history,
      ...(this.summary ? { summary: this.summary } : {}),
      ...(this.dropped ? { dropped: this.dropped } : {}),
    };
  }

  /** Puts the open conversation with the others, unless nothing was said in it. */
  private stash() {
    if (this.entries.length > 0) this.others = [this.current(), ...this.others];
  }

  /** Written only between turns, so what is kept is always a whole exchange. */
  private persist() {
    const chats = this.entries.length > 0 ? [this.current(), ...this.others] : this.others;
    this.options.store?.save({ activeId: this.chatId, chats });
  }

  /** Every conversation, the latest first. */
  list(): ChatSummary[] {
    const all = this.entries.length > 0 ? [this.current(), ...this.others] : this.others;
    return all
      .map((chat) => ({
        id: chat.id,
        title: chat.title,
        updatedAt: chat.updatedAt,
        active: chat.id === this.chatId,
      }))
      .sort((a, b) => Number(b.active) - Number(a.active) || b.updatedAt - a.updatedAt);
  }

  /** Starts a new conversation and keeps the open one. The day is untouched. */
  newChat() {
    if (this.busy) return;
    this.stash();
    this.blank();
    this.persist();
    this.emit();
  }

  openChat(id: string) {
    if (this.busy || id === this.chatId) return;
    const target = this.others.find((chat) => chat.id === id);
    if (!target) return;
    this.others = this.others.filter((chat) => chat !== target);
    this.stash();
    this.adopt(target);
    this.persist();
    this.emit();
  }

  deleteChat(id: string) {
    if (this.busy) return;
    if (id === this.chatId) this.blank();
    else this.others = this.others.filter((chat) => chat.id !== id);
    this.persist();
    this.emit();
  }

  /** Removes every conversation (clearing or importing data). */
  clear() {
    if (this.busy) return;
    this.others = [];
    this.blank();
    this.persist();
    this.emit();
  }

  /** A message can be branched from or edited while its history is still there. */
  canRewind(entryId: string): boolean {
    const entry = this.entries.find((e) => e.id === entryId);
    return (
      !this.busy &&
      (entry?.kind === "user" || entry?.kind === "assistant") &&
      entry.h !== undefined &&
      entry.h >= this.dropped
    );
  }

  /** A copy of the conversation up to a point becomes the open conversation. */
  private fork(entries: Entry[], historyLength: number, title: string) {
    const branch: SavedChat = {
      id: nextId("c"),
      title,
      updatedAt: Date.now(),
      entries,
      history: this.history.slice(0, historyLength - this.dropped),
      summary: this.summary,
      dropped: this.dropped,
    };
    this.stash();
    this.adopt(branch);
    this.persist();
    this.emit();
  }

  /** A new conversation that continues from this answer; the original stays as it is. */
  branchFrom(entryId: string) {
    const index = this.entries.findIndex((e) => e.id === entryId);
    const entry = this.entries[index];
    if (!this.canRewind(entryId) || entry?.kind !== "assistant" || entry.h === undefined) return;
    this.fork(
      this.entries.slice(0, index + 1),
      entry.h,
      t("agent.branchTitle", { title: this.title })
    );
  }

  /**
   * Goes back to a message to write it again: a new conversation that stops
   * right before it, and the message's text to put back in the composer.
   * Changes already made to the day stay made.
   */
  editFrom(entryId: string): string | null {
    const index = this.entries.findIndex((e) => e.id === entryId);
    const entry = this.entries[index];
    if (!this.canRewind(entryId) || entry?.kind !== "user" || entry.h === undefined) return null;
    this.fork(this.entries.slice(0, index), entry.h, this.title);
    return entry.text;
  }

  // ---------------------------------------------------------------- context

  private get context(): number {
    return this.options.context?.() ?? DEFAULT_CONTEXT;
  }

  /** What every request carries before the conversation: the prompt, the day and the tools. */
  private fixedTokens(): number {
    return (
      estimateTokens(this.system().content as string) +
      estimateTokens(JSON.stringify(toolSchemas()))
    );
  }

  private promptTokens(): number {
    return Math.round((this.fixedTokens() + historyTokens(this.history)) * this.tokenRatio);
  }

  /** How full the model's context is with this conversation. */
  usage(): ContextUsage {
    const used = this.promptTokens();
    const context = this.context;
    return {
      used,
      context,
      // Past the window itself. Short of that, the next message compacts on its own
      overflow: used > context,
      canCompact: this.history.findIndex((m, i) => i > 0 && m.role === "user") > 0,
    };
  }

  /**
   * Summarizes everything but the last turns with the loaded model and keeps
   * the summary in their place. Returns false when there was nothing to
   * summarize.
   */
  private async compactNow(signal: AbortSignal, tailShare = 0.25): Promise<boolean> {
    const context = this.context;
    const available = Math.max(1000, context - this.fixedTokens() - REPLY_RESERVE);
    const { old, tail } = splitForCompaction(this.history, Math.floor(available * tailShare));
    if (old.length === 0) {
      // One huge turn: its tool results are the only thing that can shrink
      this.history = shrinkToolResults(this.history);
      return false;
    }
    const before = this.promptTokens();
    this.compacting = { done: 0, total: 1 };
    this.emit();
    try {
      const { summary, chunks } = await summarize(old, {
        chat: this.options.chat,
        context,
        language: this.languageName(),
        previous: this.summary || undefined,
        signal,
        onProgress: (done, total) => {
          this.compacting = { done, total };
          this.emit();
        },
      });
      this.summary = summary;
      this.dropped += old.length;
      this.history = tail;
      this.add({
        id: nextId(),
        kind: "compact",
        text: summary,
        chunks,
        before,
        after: this.promptTokens(),
      });
      return true;
    } finally {
      this.compacting = null;
    }
  }

  /** Compacts on the person's request. */
  async compact() {
    if (this.busy) return;
    this.busy = true;
    const abort = new AbortController();
    this.abort = abort;
    this.emit();
    try {
      // Asked for by hand, everything but the last turn is summarized
      await this.compactNow(abort.signal, 0);
    } catch (caught) {
      if (!abort.signal.aborted) {
        this.add({
          id: nextId(),
          kind: "error",
          text: caught instanceof Error ? caught.message : String(caught),
        });
      }
    } finally {
      this.busy = false;
      this.abort = null;
      this.persist();
      this.emit();
    }
  }

  // ---------------------------------------------------------------- plumbing

  /** Added in this session (not restored from the last one). */
  isFresh(entryId: string): boolean {
    return !this.restored.has(entryId);
  }

  /** Stops the turn in progress: the model call is dropped, a pending question counts as a no. */
  stop() {
    if (!this.busy) return;
    this.abort?.abort();
    for (const [id, resolve] of this.decisions) {
      resolve(false);
      this.decisions.delete(id);
    }
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit() {
    this.entries = [...this.entries];
    this.listeners.forEach((listener) => listener());
  }

  private add(entry: Entry) {
    this.entries.push(entry);
    this.emit();
    return entry;
  }

  private patch(id: string, change: Partial<Entry>) {
    this.entries = this.entries.map((e) => (e.id === id ? ({ ...e, ...change } as Entry) : e));
    this.emit();
  }

  setMode(mode: Mode) {
    this.mode = mode;
    this.emit();
  }

  canUndo(entryId: string): boolean {
    return this.lastUndo?.entryId === entryId && !this.busy;
  }

  /** Puts the state back as it was before the last change. */
  undo(entryId: string) {
    if (!this.canUndo(entryId) || !this.lastUndo) return;
    this.options.core.importData(this.lastUndo.snapshot);
    const entry = this.entries.find((e) => e.id === entryId);
    this.lastUndo = null;
    this.patch(entryId, { status: "undone" });
    if (entry?.kind === "tool") {
      this.history.push({ role: "user", content: `[I undid this change: ${entry.summary}]` });
    }
    this.persist();
  }

  decide(entryId: string, yes: boolean) {
    this.decisions.get(entryId)?.(yes);
    this.decisions.delete(entryId);
  }

  private languageName(): string {
    return this.options.language?.() === "es" ? "Spanish" : "English";
  }

  private system(): ChatMessage & { role: "system" } {
    const now = (this.options.now ?? (() => new Date()))();
    const day = daySnapshot(this.options.core, now);
    const earlier = this.summary
      ? `\n\n## Earlier in this conversation\n\nThe conversation was compacted. These notes replace its older messages:\n\n${this.summary}`
      : "";
    return {
      role: "system",
      content: `${this.options.prompt}\n\n## Right now\n\nThe app's interface is in ${this.languageName()}. Reply in that language, even if earlier messages in this conversation were in another one. The "To do" block is shown to the person as "${t("block.todo")}".\n\n${JSON.stringify(day)}${earlier}`,
    };
  }

  /**
   * Small models follow the last thing they read, and the old replies in the
   * history are in the old language. A reminder rides on the latest message
   * the person wrote (a copy: it is not kept in the history).
   */
  private withLanguageReminder(messages: ChatMessage[]): ChatMessage[] {
    const index = messages.map((m) => m.role).lastIndexOf("user");
    const message = messages[index];
    if (!message || message.role !== "user") return messages;
    const reminder = `\n\n[Reply in ${this.languageName()}.]`;
    const copy = [...messages];
    copy[index] = {
      role: "user",
      content:
        typeof message.content === "string"
          ? `${message.content}${reminder}`
          : [...message.content, { type: "text", text: reminder }],
    };
    return copy;
  }

  private request(): ChatMessage[] {
    return this.withLanguageReminder(mergeUserRuns([this.system(), ...this.history]));
  }

  /** What the person wrote lately, to check a change against their own words. */
  private recentUserText(count = 3): string {
    return this.history
      .filter((message) => message.role === "user")
      .slice(-count)
      .map((message) => textOf(message.content))
      .join("\n");
  }

  private async runTool(call: ToolCall): Promise<unknown> {
    const tool: Tool | undefined = toolByName(call.function.name);
    if (!tool) return { error: "unknown-tool", tools: "see the tool list" };
    let args: Record<string, unknown>;
    try {
      args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
    } catch {
      return { error: "invalid-arguments", detail: "arguments must be a JSON object" };
    }
    // A small model invents times. An exact time has to come from the person,
    // and a time they gave always has a digit in it.
    if (
      tool.mutates &&
      typeof args.time === "string" &&
      args.time &&
      !/\d/.test(this.recentUserText())
    ) {
      return {
        error: "time-not-said",
        detail:
          "The person did not give a time. Do not invent one: ask them in words, or make the change without a time.",
      };
    }
    const ctx = { core: this.options.core, now: this.options.now ?? (() => new Date()) };

    if (!tool.mutates) {
      try {
        return tool.run(ctx, args);
      } catch (caught) {
        return failure(caught);
      }
    }

    let summary: string;
    let tempos: number | undefined;
    try {
      const described = tool.describe?.(ctx, args) ?? tool.name;
      if (typeof described === "string") summary = described;
      else ({ text: summary, tempos } = described);
    } catch (caught) {
      return failure(caught);
    }
    const entry = this.add({
      id: nextId(),
      kind: "tool",
      name: tool.name,
      summary,
      status: "pending",
      ...(tempos !== undefined ? { tempos } : {}),
    });

    if (this.mode === "confirm" || tool.alwaysConfirm) {
      const yes = await new Promise<boolean>((resolve) => this.decisions.set(entry.id, resolve));
      if (!yes) {
        this.patch(entry.id, { status: "rejected" });
        return { rejected: true, note: "The person said no. Ask what they want instead." };
      }
    }

    this.patch(entry.id, { status: "running" });
    const snapshot = this.options.core.exportData();
    try {
      const result = tool.run(ctx, args);
      this.lastUndo = { entryId: entry.id, snapshot };
      // The card promised a preview; once done it shows what the core awarded
      const earned = (result as { tempos_earned?: unknown } | undefined)?.tempos_earned;
      this.patch(entry.id, {
        status: "done",
        ...(typeof earned === "number" ? { tempos: earned } : {}),
      });
      return result ?? { ok: true };
    } catch (caught) {
      // A change that fails halfway leaves nothing behind (an activity created
      // for a start the core then refused, for example)
      if (this.options.core.exportData() !== snapshot) this.options.core.importData(snapshot);
      const result = failure(caught);
      this.patch(entry.id, { status: "error", error: String(result.error) });
      return result;
    }
  }

  /** The person writes; the agent answers, calling tools as needed. */
  async send(text: string, attachments: Attachment[] = []) {
    const message = text.trim();
    if ((!message && attachments.length === 0) || this.busy) return;
    this.busy = true;
    const abort = new AbortController();
    this.abort = abort;

    // Text files travel inside the message; images as parts a vision model reads
    const files = attachments
      .filter((file) => file.kind === "text")
      .map((file) => `\n\n[File: ${file.name}]\n${file.data}`)
      .join("");
    const images = attachments.filter((file) => file.kind === "image");
    const content: string | ContentPart[] =
      images.length === 0
        ? `${message}${files}`
        : [
            { type: "text", text: `${message}${files}` },
            ...images.map(
              (image): ContentPart => ({ type: "image_url", image_url: { url: image.data } })
            ),
          ];

    if (!this.title) this.title = (message || attachments[0]?.name || "").slice(0, 60);
    this.add({
      id: nextId(),
      kind: "user",
      text: message,
      h: this.dropped + this.history.length,
      ...(attachments.length > 0
        ? {
            attachments: attachments.map((file) => ({
              kind: file.kind,
              name: file.name,
              ...(file.kind === "image" ? { url: file.data } : {}),
            })),
          }
        : {}),
    });
    this.history.push({ role: "user", content });

    try {
      const maxSteps = this.options.maxSteps ?? 8;
      let corrected = false;
      let compacted = false;
      for (let step = 0; step < maxSteps; step++) {
        // Before the model is asked, the conversation has to fit in its context
        if (!compacted && this.promptTokens() > this.context * AUTO_COMPACT_AT) {
          compacted = true;
          await this.compactNow(abort.signal);
          if (abort.signal.aborted) return;
        }
        const request = this.request();
        const reply = await this.options.chat(request, toolSchemas(), abort.signal);
        if (abort.signal.aborted) return;
        this.learnTokens(request, reply);
        if (reply.toolCalls.length === 0) {
          // A reply that names tools is the model reading its own notes aloud:
          // it is not shown, and the model gets one chance to answer the person
          if (!corrected && leaksTools(reply.content)) {
            corrected = true;
            this.history.push({ role: "assistant", content: reply.content });
            this.history.push({
              role: "user",
              content:
                "[Automatic note, not from the person: that reply was not shown because it recited your internal instructions and tool names. Answer the person's last message directly, in everyday words, without naming tools.]",
            });
            continue;
          }
          const answer = reply.content || "…";
          this.history.push({ role: "assistant", content: answer });
          this.add({
            id: nextId(),
            kind: "assistant",
            text: answer,
            h: this.dropped + this.history.length,
          });
          return;
        }
        if (reply.content) this.add({ id: nextId(), kind: "assistant", text: reply.content });
        this.history.push({
          role: "assistant",
          content: reply.content || null,
          tool_calls: reply.toolCalls,
        });
        for (const call of reply.toolCalls) {
          // After a stop the rest of the calls are answered, not run
          const result = abort.signal.aborted
            ? { rejected: true, note: "The person stopped this turn." }
            : await this.runTool(call);
          this.history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
        if (abort.signal.aborted) return;
      }
      this.add({ id: nextId(), kind: "error", text: "too-many-steps" });
    } catch (caught) {
      // Stopping is the person's choice, not a failure to report
      if (!abort.signal.aborted) {
        this.add({
          id: nextId(),
          kind: "error",
          text: caught instanceof Error ? caught.message : String(caught),
        });
      }
    } finally {
      this.busy = false;
      this.abort = null;
      this.persist();
      this.emit();
    }
  }

  /** The runtime's own token count corrects the estimate from then on. */
  private learnTokens(request: ChatMessage[], reply: ModelReply) {
    if (!reply.usage?.prompt) return;
    const estimated = historyTokens(request) + estimateTokens(JSON.stringify(toolSchemas()));
    if (estimated <= 0) return;
    this.tokenRatio = Math.max(0.6, Math.min(1.8, reply.usage.prompt / estimated));
  }
}

const TOOL_NAMES = new RegExp(
  `\\b(${TOOLS.map((tool) => tool.name)
    .filter((name) => name.includes("_"))
    .join("|")})\\b`
);

/** True when a reply meant for the person mentions a tool by name. */
export function leaksTools(text: string): boolean {
  return TOOL_NAMES.test(text);
}

function failure(caught: unknown): { error: string; detail?: string } {
  if (isCoreError(caught)) return { error: caught.code, detail: caught.message };
  if (caught instanceof ToolError) return { error: caught.code, detail: caught.message };
  return { error: "failed", detail: caught instanceof Error ? caught.message : String(caught) };
}
