import type { ISystemCore } from "../../types";
import { isCoreError } from "../../system";
import { daySnapshot } from "./snapshot";
import { ToolError, toolByName, toolSchemas, type Tool } from "./tools";
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
    }
  | { id: string; kind: "error"; text: string };

export type ChatFn = (messages: ChatMessage[], tools: unknown[]) => Promise<ModelReply>;

export interface AgentOptions {
  core: ISystemCore;
  chat: ChatFn;
  prompt: string;
  now?: () => Date;
  /** Tool calls per message before the agent gives up (a small model can loop). */
  maxSteps?: number;
  /** The interface's language, a hint for the reply's language. */
  language?: () => string;
}

const MAX_HISTORY = 24;

let counter = 0;
const nextId = () => `e${++counter}`;

export class Agent {
  entries: Entry[] = [];
  busy = false;
  mode: Mode = "confirm";

  private history: ChatMessage[] = [];
  private listeners = new Set<() => void>();
  private decisions = new Map<string, (yes: boolean) => void>();
  /** The state before the last executed change, for undo. */
  private lastUndo: { entryId: string; snapshot: string } | null = null;

  constructor(private readonly options: AgentOptions) {}

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
      }. Answer in the language the person writes in.\n\n${JSON.stringify(day)}`,
    };
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
    const ctx = { core: this.options.core, now: this.options.now ?? (() => new Date()) };

    if (!tool.mutates) {
      try {
        return tool.run(ctx, args);
      } catch (caught) {
        return failure(caught);
      }
    }

    let summary: string;
    try {
      summary = tool.describe?.(ctx, args) ?? tool.name;
    } catch (caught) {
      return failure(caught);
    }
    const entry = this.add({
      id: nextId(),
      kind: "tool",
      name: tool.name,
      summary,
      status: "pending",
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
      this.patch(entry.id, { status: "done" });
      return result ?? { ok: true };
    } catch (caught) {
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
    this.add({ id: nextId(), kind: "user", text: message });
    this.history.push({ role: "user", content: message });

    try {
      const maxSteps = this.options.maxSteps ?? 8;
      for (let step = 0; step < maxSteps; step++) {
        const reply = await this.options.chat(
          [this.system(), ...this.history.slice(-MAX_HISTORY)],
          toolSchemas()
        );
        if (reply.toolCalls.length === 0) {
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
          const result = await this.runTool(call);
          this.history.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        }
      }
      this.add({ id: nextId(), kind: "error", text: "too-many-steps" });
    } catch (caught) {
      this.add({
        id: nextId(),
        kind: "error",
        text: caught instanceof Error ? caught.message : String(caught),
      });
    } finally {
      this.busy = false;
      this.emit();
    }
  }
}

function failure(caught: unknown): { error: string; detail?: string } {
  if (isCoreError(caught)) return { error: caught.code, detail: caught.message };
  if (caught instanceof ToolError) return { error: caught.code, detail: caught.message };
  return { error: "failed", detail: caught instanceof Error ? caught.message : String(caught) };
}
