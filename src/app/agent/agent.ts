import type { ISystemCore } from "../../types";
import { isCoreError } from "../../system";
import { daySnapshot } from "./snapshot";
import { ToolError, TOOLS, toolByName, toolSchemas, type Tool } from "./tools";
import { t } from "../i18n";
import type { ChatMessage, ModelReply, ToolCall } from "./llm";

/**
 * The agent loop (ADR-002): the person writes, the model answers or calls
 * tools, mutations wait for the person's yes in confirm mode, and every
 * executed change can be undone. The UI only renders `entries`.
 */

export type Mode = "confirm" | "auto";

export type Entry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
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
  | { id: string; kind: "error"; text: string };

export type ChatFn = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal
) => Promise<ModelReply>;

/** The conversation as it is kept between launches. */
export interface SavedChat {
  entries: Entry[];
  history: ChatMessage[];
}

export interface ChatStore {
  load: () => SavedChat | null;
  save: (chat: SavedChat) => void;
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
  /** Where the conversation is kept, so closing the app does not lose it. */
  store?: ChatStore;
}

const MAX_HISTORY = 24;
/** Entries kept on screen and on disk; older ones fall off the top. */
const MAX_ENTRIES = 200;

let counter = 0;
const nextId = () => `e${Date.now().toString(36)}-${++counter}`;

/**
 * The last messages sent to the model. A cut must not start in the middle of a
 * tool exchange (a tool result without its call is an API error), so it backs
 * up to the nearest message the person wrote.
 */
export function recentHistory(history: ChatMessage[], max = MAX_HISTORY): ChatMessage[] {
  if (history.length <= max) return history;
  let start = history.length - max;
  while (start < history.length && history[start].role !== "user") start++;
  return start < history.length ? history.slice(start) : history.slice(-1);
}

export class Agent {
  entries: Entry[] = [];
  busy = false;
  mode: Mode = "confirm";

  private history: ChatMessage[] = [];
  private listeners = new Set<() => void>();
  private decisions = new Map<string, (yes: boolean) => void>();
  /** The state before the last executed change, for undo. */
  private lastUndo: { entryId: string; snapshot: string } | null = null;
  private abort: AbortController | null = null;
  /** Entries that came back from a previous session: shown without their entrance. */
  private restored = new Set<string>();

  constructor(private readonly options: AgentOptions) {
    const saved = options.store?.load();
    if (saved) {
      this.entries = saved.entries;
      this.history = saved.history;
      this.restored = new Set(saved.entries.map((entry) => entry.id));
    }
  }

  /** Added in this session (not restored from the last one). */
  isFresh(entryId: string): boolean {
    return !this.restored.has(entryId);
  }

  /** Written only between turns, so what is kept is always a whole exchange. */
  private persist() {
    this.options.store?.save({
      entries: this.entries.slice(-MAX_ENTRIES),
      history: recentHistory(this.history),
    });
  }

  /** Starts a new conversation. The day itself is untouched. */
  clear() {
    if (this.busy) return;
    this.entries = [];
    this.history = [];
    this.lastUndo = null;
    this.persist();
    this.emit();
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

  private system(): ChatMessage {
    const now = (this.options.now ?? (() => new Date()))();
    const day = daySnapshot(this.options.core, now);
    return {
      role: "system",
      content: `${this.options.prompt}\n\n## Right now\n\nThe app's interface is in ${
        this.options.language?.() === "es" ? "Spanish" : "English"
      }. Reply in that language, even if earlier messages in this conversation were in another one. The "To do" block is shown to the person as "${t("block.todo")}".\n\n${JSON.stringify(day)}`,
    };
  }

  /**
   * Small models follow the last thing they read, and the old replies in the
   * history are in the old language. A reminder rides on the latest message
   * the person wrote (a copy: it is not kept in the history).
   */
  private withLanguageReminder(messages: ChatMessage[]): ChatMessage[] {
    const language = this.options.language?.() === "es" ? "Spanish" : "English";
    const index = messages.map((m) => m.role).lastIndexOf("user");
    if (index < 0 || messages[index].role !== "user") return messages;
    const copy = [...messages];
    copy[index] = {
      role: "user",
      content: `${(messages[index] as { content: string }).content}

[Reply in ${language}.]`,
    };
    return copy;
  }

  /** What the person wrote lately, to check a change against their own words. */
  private recentUserText(count = 3): string {
    return this.history
      .filter((message) => message.role === "user")
      .slice(-count)
      .map((message) => message.content)
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
  async send(text: string) {
    const message = text.trim();
    if (!message || this.busy) return;
    this.busy = true;
    const abort = new AbortController();
    this.abort = abort;
    this.add({ id: nextId(), kind: "user", text: message });
    this.history.push({ role: "user", content: message });

    try {
      const maxSteps = this.options.maxSteps ?? 8;
      let corrected = false;
      for (let step = 0; step < maxSteps; step++) {
        const reply = await this.options.chat(
          this.withLanguageReminder([this.system(), ...recentHistory(this.history)]),
          toolSchemas(),
          abort.signal
        );
        if (abort.signal.aborted) return;
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
          this.add({ id: nextId(), kind: "assistant", text: answer });
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
