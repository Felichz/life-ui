import type { ISystemCore, Roadmap } from "../../types";
import { isCoreError } from "../../system";
import { daySnapshot } from "./snapshot";
import { ToolError, TOOLS, toolByName, toolSchemas, type Tool, type ToolContext } from "./tools";
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
import type { ChatMessage, ChatOptions, ContentPart, ModelReply, ToolCall } from "./llm";
import type { WebSetting } from "./web";
import { daysStated, phaseWeeks, whenLabel } from "./when";
import { describeFacts, disagreements, savedFacts } from "./saved";
import {
  briefLines,
  nextMove,
  planGaps,
  planNeeds,
  saidIn,
  unagreed,
  updateBrief,
  worthNoting,
  type Brief,
} from "./brief";

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
      /** Still being written by the model. */
      writing?: boolean;
      /** Tokens of the answer and how fast they came, when the runtime says. */
      stats?: { tokens: number; speed?: number };
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
      /** A search on the web rather than a change to the day. */
      external?: boolean;
      /** What the change consists of, line by line (a roadmap's milestones). */
      details?: string[];
      /** What a search found: shown by the app itself, whatever the model says of it. */
      sources?: Array<{ title: string; url: string }>;
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
  options?: ChatOptions
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
  /** The title came from the model (otherwise it is the first words of the first message). */
  titled?: boolean;
  /** The coach's notes on what the person has told it (ADR-012). */
  brief?: Brief;
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
  /** Whether the loaded model reads images. Unknown counts as yes. */
  vision?: () => boolean;
  /** Whether to ask the model for a short title after the first exchange. */
  titles?: () => boolean;
  /** Whether the model thinks before answering. Left out: the model's own default. */
  reasoning?: () => boolean;
  /**
   * Whether the coach keeps notes on what the person tells it (ADR-012). One
   * short call more per message that says something; off unless asked for.
   */
  notes?: () => boolean;
  /** Research on the web (ADR-009): the person's setting, and how to reach out. */
  web?: {
    setting: () => WebSetting;
    /** Called when the person allows searching from the chat. */
    allow: () => void;
    http: typeof fetch;
  };
}

/** The longest answer the coach is allowed in one go. */
const MAX_REPLY_TOKENS = 2048;
/**
 * The way out of the first move of a turn, for a message that needs nothing
 * read and nothing changed.
 */
const JUST_ANSWER = {
  type: "function" as const,
  function: {
    name: "just_answer",
    description:
      "Nothing has to be read, looked up or changed for this message: answer the person in words. Never for a message that asks you to add, move, start, finish, plan or note something: that is done with its tool.",
    parameters: { type: "object", properties: {} },
  },
};

/** The tools that need a request or a yes: they plan days ahead, delete, or write in the ideal life. */
const HELD_BACK = new Set([
  "plan_ahead",
  "plan_roadmap",
  "cancel_planned",
  "remove_from_plan",
  "delete_from_library",
  "start_day",
  "end_day",
  // A marker of something that happened: chosen, wrongly, for a habit the person only spoke of
  "log_event",
  "note_ideal_life",
  "edit_ideal_life",
]);
/** The tools that put a plan on the calendar. */
const PLANNING_TOOLS = new Set(["plan_roadmap", "plan_ahead"]);
/** Tools that act on what is running: offered only while something is. */
const NEEDS_RUNNING = new Set(["finish_activity", "stop_activity"]);

/**
 * The tools that change the day itself. While a plan is still being shaped
 * they wait for a request: told to build a plan, a 9B model once created and
 * started an activity named after it.
 */
const DAY_TOOLS = new Set([
  "add_to_plan",
  "set_notes",
  "schedule",
  "move_to_block",
  "remove_from_plan",
  "start_activity",
  "finish_activity",
  "stop_activity",
  "log_event",
]);
/** Failures of one tool in one turn before it is not run again. */
const MAX_FAILURES = 2;
/** A reply this long, to someone who wants a plan, is taken to be the plan (ADR-012). */
const PLAN_LENGTH = 700;
/** How much of the ideal life goes in every request: about 450 tokens. */
const IDEAL_LIFE_CHARS = 1500;
/** Entries kept on screen and on disk per conversation; older ones fall off the top. */
const MAX_ENTRIES = 400;
/** Past this share of the context the conversation is compacted before the next call. */
const AUTO_COMPACT_AT = 0.85;
/** Tokens kept free beyond the longest answer, for what the estimate misses. */
const REPLY_MARGIN = 400;

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
  /** What the runtime counted at the last reply, and the history length it covers. */
  private measured: { tokens: number; at: number } | null = null;
  private titled = false;
  /** What the person has told the coach, kept in a few lists. */
  private brief: Brief | null = null;
  /** Something read from the web is in this turn: changes ask first, whatever the mode. */
  private webThisTurn = false;
  /** The notes speak of the person's latest message (the call was made, and it worked). */
  private notesRead = false;
  /** Tool calls that failed in this turn, by tool. */
  private failures = new Map<string, number>();

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
    this.titled = chat.titled ?? false;
    this.brief = chat.brief ?? null;
    this.lastUndo = null;
    this.measured = null;
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
      ...(this.titled ? { titled: true } : {}),
      ...(this.brief ? { brief: this.brief } : {}),
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

  private webSetting(): WebSetting {
    return this.options.web?.setting() ?? "off";
  }

  /** The tools the model is offered now: web search only while the person allows it. */
  /**
   * The tools offered in this turn. Those that plan days ahead, delete, or
   * write in the person's ideal life are offered only when the person told
   * the app to do something or said yes to what was proposed (the notes say
   * which, ADR-012). Rule 0 of the prompt ("act only on a request"), held by
   * construction where a mistake costs most: made to choose a tool, a 9B
   * model told a time of day planned 63 sessions, and told of a bad habit
   * tried to delete an activity.
   *
   * The tools of the day itself (add, start, finish, move) are there in a
   * normal turn, but a plan being shaped is not a day: a 9B model told to
   * build one created and started an activity named after it. They come back
   * the moment the person asks for a change to the day.
   */
  private schemas() {
    // A tool that cannot apply is not on the table: with nothing running there
    // is nothing to close or to stop. Told "I have started reading", a 9B
    // model picked "finish" when it was offered, and "start" when it was not.
    const running = this.somethingRuns();
    const all = toolSchemas(this.webSetting() !== "off").filter(
      (tool) => running || !NEEDS_RUNNING.has(tool.function.name)
    );
    // The notes do not speak of this message (too short, or the call failed): nothing is held back
    if (!this.notesRead || this.brief?.instruction) return all;
    const plan = this.brief?.plan;
    const shaping = Boolean(plan && !plan.built);
    const offered =
      this.brief?.agreed && shaping
        ? // A plan they said yes to goes in as a roadmap, which puts its own sessions on the calendar
          all.filter((tool) => tool.function.name !== "plan_ahead")
        : all.filter(
            (tool) =>
              !HELD_BACK.has(tool.function.name) ||
              // A roadmap that exists can be changed on a plain request ("move it to
              // Saturdays"). A yes is not one: "yes, and you should make the roadmap
              // too", said of one already made, had the planner build it over.
              (tool.function.name === "plan_roadmap" && plan?.built && !this.brief?.agreed) ||
              // A yes to "shall I note it in your ideal life?" has to be able to do it:
              // held back, the model said it had noted it and noted nothing. The
              // note still waits for their yes on the card, in their own words.
              (tool.function.name === "note_ideal_life" && this.brief?.agreed)
          );
    return shaping ? offered.filter((tool) => !DAY_TOOLS.has(tool.function.name)) : offered;
  }

  /** Whether an activity is running; taken as yes when the core cannot say. */
  private somethingRuns(): boolean {
    try {
      return Boolean(this.options.core.getActiveActivity());
    } catch {
      return true;
    }
  }

  /** What every request carries before the conversation: the prompt, the day and the tools. */
  private fixedTokens(): number {
    return (
      estimateTokens(this.system().content as string) +
      estimateTokens(JSON.stringify(this.schemas()))
    );
  }

  /**
   * Tokens the next request would take. Up to the last reply it is the
   * runtime's own count; what came after (tool results, a new message) is
   * estimated. Before any reply it is all estimate.
   */
  private promptTokens(): number {
    const sent = this.sendable();
    if (this.measured && this.measured.at <= sent.length) {
      return Math.round(
        this.measured.tokens + historyTokens(sent.slice(this.measured.at)) * this.tokenRatio
      );
    }
    return Math.round((this.fixedTokens() + historyTokens(sent)) * this.tokenRatio);
  }

  /**
   * The history as it is sent. Results of tools from older turns are cut
   * short: the agent already acted on them, and a library listing from ten
   * minutes ago is the first thing a small context can do without.
   */
  private sendable(): ChatMessage[] {
    const turns = this.history.flatMap((m, index) => (m.role === "user" ? [index] : []));
    const recentFrom = turns[turns.length - 2] ?? 0;
    const vision = this.options.vision?.() ?? true;
    return this.history.map((message, index): ChatMessage => {
      if (message.role === "tool" && index < recentFrom && message.content.length > 600) {
        return { ...message, content: `${message.content.slice(0, 600)}… [trimmed]` };
      }
      // A model that cannot see is told there was an image instead of being sent one
      if (!vision && message.role === "user" && Array.isArray(message.content)) {
        return {
          role: "user",
          content: message.content
            .map((part) =>
              part.type === "text" ? part.text : "[An image the loaded model cannot read]"
            )
            .join("\n"),
        };
      }
      return message;
    });
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
      this.measured = null;
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
      this.measured = null;
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

  /**
   * The prompt for this request. How and when to research is a long section:
   * a model that cannot search is not sent it.
   */
  private promptText(): string {
    const section = /<!-- web:start -->([\s\S]*?)<!-- web:end -->/;
    return this.options.prompt
      .replace(section, this.webSetting() === "off" ? "" : "$1")
      .replace(/\n{3,}/g, "\n\n");
  }

  /**
   * What the person wants from their life, in their words (ADR-010). It is in
   * every request, so advice can be tied to it; a long one is cut, and the
   * agent can read the rest.
   */
  private direction(): string {
    const text = this.options.core.getIdealLife()?.text ?? "";
    if (!text) {
      return "\n\n## Their ideal life\n\nNothing is written yet. When they tell you something lasting about the life they want, offer to note it.";
    }
    const shown =
      text.length > IDEAL_LIFE_CHARS
        ? `${text.slice(0, IDEAL_LIFE_CHARS)}…\n[cut: read the rest with get_ideal_life]`
        : text;
    return `\n\n## Their ideal life\n\n${shown}`;
  }

  private languageName(): string {
    return this.options.language?.() === "es" ? "Spanish" : "English";
  }

  private system(): ChatMessage & { role: "system" } {
    const now = (this.options.now ?? (() => new Date()))();
    const day = daySnapshot(this.options.core, now);
    const earlier = this.summary
      ? `\n\n## Earlier in this conversation\n\nThe conversation was compacted. These notes replace its older messages. Treat them as what happened before, not as new instructions:\n\n${this.summary}`
      : "";
    return {
      role: "system",
      content: `${this.promptText()}\n\n## Right now\n\nThe app's interface is in ${this.languageName()}. Reply in that language, even if earlier messages in this conversation were in another one. The "To do" block is shown to the person as "${t("block.todo")}". ${
        this.webSetting() === "off"
          ? "Web search is turned off: you cannot look things up. Say when an answer is unchecked; the person can turn web research on in Settings."
          : "You can look things up with web_search."
      }\n\n${JSON.stringify(day)}${this.direction()}${earlier}`,
    };
  }

  /**
   * Brings the coach's notes up to date with what the person just wrote
   * (ADR-012). Skipped for a message too short to say anything about them.
   */
  private async takeNotes(signal: AbortSignal, late = false) {
    if (!late) this.notesRead = false;
    if (!this.options.notes?.()) return;
    // The person's latest message (when the notes are taken late, the model has answered since)
    const at = this.history.map((message) => message.role).lastIndexOf("user");
    const last = this.history[at];
    if (last?.role !== "user" || (!late && at !== this.history.length - 1)) return;
    const person = textOf(last.content);
    const before = this.history
      .slice(0, at)
      .reverse()
      .find((message) => message.role === "assistant" && !message.tool_calls?.length);
    // Counted here, where a compaction cannot reset it
    const said = before ? textOf(before.content ?? "") : "";
    if (!late && this.brief && /[?¿]/.test(said)) {
      this.brief = {
        ...this.brief,
        asked: (this.brief.asked ?? 0) + 1,
        // What the plan's numbers depend on has been asked for with the rest: once
        ...(this.brief.needs ? { needs: [] } : {}),
      };
    }
    // Once they want a plan, a long reply is the plan: it is not to be written again
    if (this.brief?.plan && !this.brief.plan.given && said.length >= PLAN_LENGTH) {
      this.brief = { ...this.brief, plan: { ...this.brief.plan, given: true } };
    }
    this.keepStated(said, person);
    if (!late && !worthNoting(person, this.brief)) {
      this.brief = unagreed(this.brief);
      return;
    }
    this.brief = await updateBrief({
      chat: this.options.chat,
      brief: this.brief,
      coach: before ? textOf(before.content ?? "") : undefined,
      person,
      language: this.languageName(),
      signal,
      now: this.options.now?.(),
      onRead: () => {
        this.notesRead = true;
      },
    });
    // A plan is wanted and there is still room to ask: what do its numbers depend on?
    if (
      this.brief?.plan &&
      !this.brief.plan.given &&
      this.brief.needs === undefined &&
      (this.brief.asked ?? 0) < 2 &&
      !signal.aborted
    ) {
      const { needs, use } = await planNeeds({
        chat: this.options.chat,
        brief: this.brief,
        signal,
      });
      if (this.brief) this.brief = { ...this.brief, needs, use };
    }
  }

  /** The person asked for something to be looked up, searching is allowed, and no search was made yet. */
  private owesSearch(): boolean {
    return Boolean(this.brief?.research) && this.webSetting() !== "off" && !this.webThisTurn;
  }

  /** Whether a tool has changed something since the person's last message. */
  private changedThisTurn(): boolean {
    const from = this.history.map((message) => message.role).lastIndexOf("user");
    const calls = new Map<string, string>();
    for (const message of this.history.slice(from + 1)) {
      if (message.role === "assistant") {
        message.tool_calls?.forEach((call) => calls.set(call.id, call.function.name));
      } else if (message.role === "tool") {
        const tool = toolByName(calls.get(message.tool_call_id) ?? "");
        if (tool?.mutates && !/"(error|rejected)"/.test(message.content)) return true;
      }
    }
    return false;
  }

  /**
   * The change asked for last in this turn, when it was refused or failed and
   * nothing was changed after it: the reason, as the tool gave it.
   */
  private refusedThisTurn(): string | null {
    const from = this.history.map((message) => message.role).lastIndexOf("user");
    const calls = new Map<string, string>();
    let refused: string | null = null;
    for (const message of this.history.slice(from + 1)) {
      if (message.role === "assistant") {
        message.tool_calls?.forEach((call) => calls.set(call.id, call.function.name));
      } else if (message.role === "tool") {
        const tool = toolByName(calls.get(message.tool_call_id) ?? "");
        if (!tool?.mutates) continue;
        refused = /"(error|rejected)"/.test(message.content) ? message.content.slice(0, 300) : null;
      }
    }
    return refused;
  }

  /**
   * What this turn calls for, read from the conversation itself. A small model
   * keeps asking the same questions and walks past the one it was asked: a
   * rule in the prompt does not hold it, a line next to the message does.
   */
  private turnNotes(): string[] {
    const notes: string[] = [];
    const turns = this.history.filter(
      (message) =>
        message.role === "user" ||
        (message.role === "assistant" && !message.tool_calls?.length && message.content)
    );
    const last = turns[turns.length - 1];
    const personAsked = last?.role === "user" && /[?¿]/.test(textOf(last.content));
    // The replies before this message that ended in questions, counted back from the latest
    let asked = 0;
    for (let index = turns.length - 2; index >= 0; index--) {
      const message = turns[index];
      if (message.role !== "assistant") continue;
      if (!/[?¿]/.test(textOf(message.content))) break;
      asked++;
    }
    // A change that did not happen is never told as done: a 9B model whose
    // note was refused wrote "I have noted it in your ideal life" all the same
    const refused = this.refusedThisTurn();
    if (refused) {
      notes.push(
        `Your last change did NOT happen: ${refused} Nothing was saved by it. Never say it was done. Either make it again the way that answer asks, or tell them plainly that it was not done and ask them for what is missing.`
      );
    }
    // Something was changed in this turn already: what is left is to say so
    if (this.changedThisTurn()) {
      notes.push(
        "The change is made. Tell them what was done, from the tool's answer as it is, in a few lines. It is saved whole: do not ask for a yes to it, do not plan it again, and do not offer to add tasks or sessions for it. End there."
      );
      const made = this.options.core.getRoadmaps();
      if (this.brief?.plan && made.length > 0) {
        notes.push(
          `The roadmap they asked for exists already (${made
            .map((roadmap) => `"${roadmap.title}"`)
            .join(
              ", "
            )}), with its sessions on the calendar: if they ask for it, say it is done and that they can see it on the page called "${t("nav.goals")}" (use that name as it is).`
        );
      }
      return notes;
    }
    if (this.owesSearch()) {
      notes.push(
        "They asked you to look this up: call web_search now, before you say anything about what is known. Never say you looked something up without a search in this reply."
      );
    }
    // With notes on the person, the move comes from them: ask what is missing, or recommend
    const move = nextMove(this.brief, personAsked);
    if (move) notes.push(move);
    // What exists is said last: a plan that is already a roadmap is not built twice
    const roadmaps = this.options.core.getRoadmaps();
    if (this.brief?.plan && roadmaps.length > 0) {
      notes.push(
        `Roadmaps that exist already, with their sessions on the calendar: ${roadmaps
          .map(roadmapFacts)
          .join(
            "; "
          )}. Take any number about them from here, never from memory. If the plan is one of these it is done: say so, and never build it again. To change one, hand the planner only the change.`
      );
    } else if (personAsked) {
      notes.push(
        "They asked you something: answer it first, directly, with the number if it has one."
      );
    } else if (asked >= 2) {
      notes.push(
        `Your last ${asked} replies asked them questions. Do not ask again: give your recommendation now, and say what you assumed where you are not sure.`
      );
    }
    return notes;
  }

  /**
   * Small models follow the last thing they read, and the old replies in the
   * history are in the old language. A reminder rides on the latest message
   * the person wrote (a copy: it is not kept in the history), with what this
   * turn calls for.
   */
  private withLanguageReminder(messages: ChatMessage[]): ChatMessage[] {
    const index = messages.map((m) => m.role).lastIndexOf("user");
    const message = messages[index];
    if (!message || message.role !== "user") return messages;
    const brief = briefLines(this.brief);
    // The notes first, the move last: a small model acts on the last thing it reads
    const reminder = `\n\n[${brief ? `${brief}\n\n` : ""}${[
      ...this.turnNotes(),
      `Reply in ${this.languageName()}.`,
    ].join(" ")}]`;
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
    return this.withLanguageReminder(mergeUserRuns([this.system(), ...this.sendable()]));
  }

  /**
   * The latest of what was said, as text: the plan the person agreed to is in
   * it, and a planner that reads it does not depend on the coach retelling it.
   */
  private recentConversation(limit = 7000): string {
    const lines: string[] = [];
    let size = 0;
    for (const message of [...this.history].reverse()) {
      if (message.role !== "user" && message.role !== "assistant") continue;
      const words = textOf(message.content ?? "").trim();
      if (!words) continue;
      const line = `${message.role === "user" ? "PERSON" : "COACH"}: ${words}`;
      if (size + line.length > limit && lines.length > 0) break;
      lines.unshift(line.slice(-limit));
      size += line.length;
    }
    return lines.join("\n\n");
  }

  /**
   * The days of the week as the conversation last stated them: in the plan
   * the coach laid out, or in a later message of the person's that lists them.
   */
  /**
   * The days and the phases' weeks, kept in the notes when they are said: the
   * coach's latest plan, or the person's own message naming two days or more.
   */
  private keepStated(coach: string, person: string) {
    const plan = this.brief?.plan;
    if (!plan || plan.built) return;
    const stated = { ...plan.stated };
    if (coach.length >= PLAN_LENGTH) {
      const days = daysStated(coach);
      if (days && days.days.length >= 2) {
        stated.days = days.days;
        stated.daysQuote = days.quote;
      }
      const weeks = phaseWeeks(coach);
      if (weeks) stated.phaseWeeks = weeks;
    }
    const theirs = daysStated(person);
    if (theirs && theirs.days.length >= 2) {
      stated.days = theirs.days;
      stated.daysQuote = theirs.quote;
    }
    if (this.brief?.plan) this.brief = { ...this.brief, plan: { ...this.brief.plan, stated } };
  }

  private daysSaid(): { days?: number[]; daysQuote?: string } {
    if (!this.brief?.plan) return {};
    const kept = this.brief.plan.stated;
    for (const message of [...this.history].reverse()) {
      const words = textOf(message.content ?? "");
      const stated =
        message.role === "assistant" && !message.tool_calls?.length && words.length >= PLAN_LENGTH
          ? daysStated(words)
          : message.role === "user"
            ? daysStated(words)
            : null;
      // One day alone is as often the start ("para el próximo martes") as the plan:
      // in the person's words or in the coach's, it is not the plan's days
      if (stated && stated.days.length >= 2) {
        return { days: stated.days, daysQuote: stated.quote };
      }
    }
    // A compaction took the messages: what was kept when they were said
    return kept?.days ? { days: kept.days, daysQuote: kept.daysQuote } : {};
  }

  /** The weeks of each phase in the plan the coach last laid out: read from its own text. */
  private phasesSaid(): { phaseWeeks?: number[] } {
    if (!this.brief?.plan) return {};
    const kept = this.brief.plan.stated?.phaseWeeks;
    for (const message of [...this.history].reverse()) {
      if (message.role !== "assistant" || message.tool_calls?.length) continue;
      const words = textOf(message.content ?? "");
      if (words.length < PLAN_LENGTH) continue;
      const weeks = phaseWeeks(words);
      if (weeks) return { phaseWeeks: weeks };
    }
    return kept ? { phaseWeeks: kept } : {};
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
    const name = call.function.name;
    // A small model told "that did not work" tries the same thing again, eight
    // times if let. After two failures in one turn the tool is not run again.
    // A message too short to be worth notes may still ask for a whole plan
    // ("armame un plan"). The model reaching for a planning tool is the sign:
    // the notes are taken then, so the plan is not built before it was seen.
    if (
      PLANNING_TOOLS.has(name) &&
      this.options.notes?.() &&
      !this.notesRead &&
      this.abort &&
      !this.abort.signal.aborted
    ) {
      await this.takeNotes(this.abort.signal, true);
    }
    // A tool that was not offered (a model can name one from memory) changes nothing
    if (toolByName(name) && !this.schemas().some((tool) => tool.function.name === name)) {
      return {
        error: "not-yet",
        detail:
          "Nothing is changed in this reply: the person has not asked for this change, and has not said yes to one. Answer in words. If a change would help, propose it and ask for their yes.",
      };
    }
    if ((this.failures.get(name) ?? 0) >= MAX_FAILURES) {
      return {
        error: "stop-trying",
        detail:
          "This has not worked twice in this turn. Do not try again: tell the person in plain words that it could not be done this time, without naming tools or inner workings, and ask how they want to go on.",
      };
    }
    const result = await this.runToolOnce(call);
    if (result && typeof result === "object" && "error" in result) {
      this.failures.set(name, (this.failures.get(name) ?? 0) + 1);
    }
    return result;
  }

  private async runToolOnce(call: ToolCall): Promise<unknown> {
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
    const ctx: ToolContext = {
      core: this.options.core,
      now: this.options.now ?? (() => new Date()),
      http: this.options.web?.http,
      signal: this.abort?.signal,
      said: { ...saidIn(this.brief), ...this.daysSaid(), ...this.phasesSaid() },
      // What the person has written in this conversation, and what was noted of it
      spoken: [
        ...this.history
          .filter((message) => message.role === "user")
          .map((message) => textOf(message.content)),
        ...(this.brief ? [...this.brief.wants, ...this.brief.has, ...this.brief.limits] : []),
      ].join(" "),
      // Their guesses about themselves, and their own measures ("80kg", "180cm")
      private: [
        ...(this.brief?.unsure ?? []),
        ...(this.brief?.has ?? []).flatMap((fact) => fact.match(/\d+\s?[a-zA-Z]+/g) ?? []),
      ],
      conversation: this.recentConversation(),
      ...(this.brief?.plan
        ? {
            planning: {
              given: Boolean(this.brief.plan.given),
              agreed: Boolean(this.brief.agreed),
              built: () => {
                if (this.brief?.plan) {
                  this.brief = { ...this.brief, plan: { ...this.brief.plan, built: true } };
                }
              },
            },
          }
        : {}),
      delegate: {
        chat: this.options.chat,
        language: this.languageName(),
        reasoning: this.options.reasoning?.(),
      },
    };

    if (tool.external) return this.runExternal(tool, ctx, args);
    if (tool.prepare) return this.runPrepared(tool, ctx, args);

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

    // What a web page says must not change the day on its own: after a search
    // in this turn every change waits for the person, also in auto mode
    if (this.mode === "confirm" || tool.alwaysConfirm || this.webThisTurn) {
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

  /**
   * A tool that works before it asks (the roadmap planner). While it works a
   * line says so; what it proposes is then confirmed, run and undone like any
   * other change. When it proposes nothing, the line goes away.
   */
  private async runPrepared(tool: Tool, ctx: ToolContext, args: Record<string, unknown>) {
    const entry = this.add({
      id: nextId(),
      kind: "tool",
      name: tool.name,
      summary: tool.working?.() ?? tool.name,
      status: "running",
    });
    let prepared;
    try {
      prepared = await tool.prepare!(ctx, args);
    } catch (caught) {
      const result = failure(caught);
      this.patch(entry.id, { status: "error", error: String(result.error) });
      return result;
    }
    const proposal = prepared.proposal;
    if (!proposal) {
      if (prepared.failed) this.patch(entry.id, { status: "error" });
      else {
        this.entries = this.entries.filter((e) => e.id !== entry.id);
        this.emit();
      }
      return prepared.result ?? { changed: false };
    }
    this.patch(entry.id, {
      summary: proposal.text,
      details: proposal.details,
      status: "pending",
    });
    if (this.mode === "confirm" || proposal.alwaysConfirm || this.webThisTurn) {
      const yes = await new Promise<boolean>((resolve) => this.decisions.set(entry.id, resolve));
      if (!yes) {
        this.patch(entry.id, { status: "rejected" });
        return { rejected: true, note: "The person said no. Ask what they want instead." };
      }
    }
    this.patch(entry.id, { status: "running" });
    const snapshot = this.options.core.exportData();
    try {
      const result = proposal.commit();
      this.lastUndo = { entryId: entry.id, snapshot };
      this.patch(entry.id, { status: "done" });
      return result ?? { ok: true };
    } catch (caught) {
      if (this.options.core.exportData() !== snapshot) this.options.core.importData(snapshot);
      const result = failure(caught);
      this.patch(entry.id, { status: "error", error: String(result.error) });
      return result;
    }
  }

  /**
   * A tool that reaches outside the machine (a web search). It shows in the
   * conversation, so what left the machine is always in sight, and the first
   * one waits for the person's yes.
   */
  private async runExternal(tool: Tool, ctx: ToolContext, args: Record<string, unknown>) {
    const web = this.options.web;
    const setting = this.webSetting();
    if (!web || setting === "off") {
      return {
        error: "web-off",
        detail:
          "Web search is turned off. Answer from what you know and say that you did not check it.",
      };
    }
    let summary: string;
    try {
      const described = tool.describe?.(ctx, args) ?? tool.name;
      summary = typeof described === "string" ? described : described.text;
    } catch (caught) {
      return failure(caught);
    }
    const entry = this.add({
      id: nextId(),
      kind: "tool",
      name: tool.name,
      summary,
      status: "pending",
      external: true,
    });
    if (setting === "ask") {
      const yes = await new Promise<boolean>((resolve) => this.decisions.set(entry.id, resolve));
      if (!yes) {
        this.patch(entry.id, { status: "rejected" });
        return {
          rejected: true,
          note: "The person does not want a web search now. Answer from what you know and say that you did not check it.",
        };
      }
      web.allow();
    }
    this.patch(entry.id, { status: "running" });
    try {
      const result = await tool.run(ctx, args);
      this.webThisTurn = true;
      const found = (result as { results?: Array<{ title?: string; url?: string }> }).results;
      this.patch(entry.id, {
        status: "done",
        // The links are the app's to show: a model names its sources and forgets to link them
        ...(Array.isArray(found) && found.length > 0
          ? {
              sources: found
                .filter((one) => one.url && /^https?:\/\//.test(one.url))
                .slice(0, 5)
                .map((one) => ({ title: one.title || one.url!, url: one.url! })),
            }
          : {}),
      });
      return result;
    } catch (caught) {
      const result = failure(caught);
      if (result.error === "about-the-person") {
        // Nothing left the machine, and the query is not worth a line: the model searches again
        this.entries = this.entries.filter((one) => one.id !== entry.id);
        this.emit();
        return result;
      }
      this.patch(entry.id, { status: "error", error: String(result.error) });
      return {
        ...result,
        note: "The search failed. Answer from what you know and say that you did not check it.",
      };
    }
  }

  /** The person writes; the agent answers, calling tools as needed. */
  async send(text: string, attachments: Attachment[] = []) {
    const message = text.trim();
    if ((!message && attachments.length === 0) || this.busy) return;

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
    await this.run();
  }

  /**
   * The last answer can be asked for again while it changed nothing: an answer
   * that came with changes to the day is part of what happened.
   */
  canRegenerate(entryId: string): boolean {
    const last = this.entries[this.entries.length - 1];
    if (this.busy || last?.id !== entryId || last.kind !== "assistant") return false;
    const turn = this.entries.slice(this.entries.map((e) => e.kind).lastIndexOf("user"));
    return (
      turn[0]?.kind === "user" &&
      turn[0].h !== undefined &&
      turn[0].h >= this.dropped &&
      !turn.some((e) => e.kind === "tool" || e.kind === "compact")
    );
  }

  /** Drops the last answer and asks the model again for the same message. */
  async regenerate(entryId: string) {
    if (!this.canRegenerate(entryId)) return;
    const index = this.entries.map((e) => e.kind).lastIndexOf("user");
    const question = this.entries[index];
    if (question?.kind !== "user" || question.h === undefined) return;
    this.entries = this.entries.slice(0, index + 1);
    this.history = this.history.slice(0, question.h - this.dropped + 1);
    this.measured = null;
    this.emit();
    await this.run();
  }

  /** One turn of the model: it answers, or calls tools and is asked again. */
  private async run() {
    this.busy = true;
    this.webThisTurn = false;
    this.failures.clear();
    const abort = new AbortController();
    this.abort = abort;
    this.emit();
    // The answer shows while it is written; this is the entry it is written into
    let writing: string | null = null;
    let shownAt = 0;
    const onText = (text: string) => {
      if (abort.signal.aborted || !text) return;
      if (!writing) {
        writing = this.add({ id: nextId(), kind: "assistant", text, writing: true }).id;
        return;
      }
      // A repaint per token is wasted work: the eye does not read that fast
      const now = Date.now();
      if (now - shownAt < 40) return;
      shownAt = now;
      this.patch(writing, { text });
    };
    /** Closes the entry being written with its final text, or adds one. */
    const settle = (text: string, extra: Partial<Extract<Entry, { kind: "assistant" }>> = {}) => {
      const id = writing;
      writing = null;
      if (id) this.patch(id, { text, writing: false, ...extra });
      else this.add({ id: nextId(), kind: "assistant", text, ...extra });
    };
    const discard = () => {
      if (writing) this.entries = this.entries.filter((e) => e.id !== writing);
      writing = null;
      this.emit();
    };

    try {
      await this.takeNotes(abort.signal);
      if (abort.signal.aborted) return;
      const maxSteps = this.options.maxSteps ?? 8;
      let corrected = false;
      let planChecked = false;
      let numbersChecked = false;
      let searchOwed = false;
      let chosen = false;
      let compacted = false;
      let recovered = false;
      for (let step = 0; step < maxSteps; step++) {
        // Before the model is asked, the conversation has to fit in its context
        // Room has to be left for the answer too: a request that fits and an
        // answer that does not end in "context size has been exceeded" half way
        const room = Math.min(
          this.context * AUTO_COMPACT_AT,
          this.context - MAX_REPLY_TOKENS - REPLY_MARGIN
        );
        if (!compacted && this.promptTokens() > room) {
          compacted = true;
          await this.compactNow(abort.signal);
          if (abort.signal.aborted) return;
        }
        const request = this.request();
        // The first move of a turn is a choice held to a schema (ADR-012): one
        // of the tools, or "just answer". Left free, a 9B model told to add
        // something answered "added" three times out of three and called
        // nothing. A choice it has to make by name, it makes right.
        const choosing: boolean = !chosen;
        chosen = true;
        const offered = choosing ? [...this.schemas(), JUST_ANSWER] : this.schemas();
        let reply: ModelReply;
        try {
          reply = await this.options.chat(request, offered, abort.signal, {
            // The choice arrives as JSON, which is not text to show while it is
            // written. Words (from a server that holds the model to nothing) are.
            ...(choosing
              ? {
                  toolChoice: "required" as const,
                  onText: (text: string) => {
                    if (!text.trimStart().startsWith("{")) onText(text);
                  },
                }
              : { onText }),
            reasoning: this.options.reasoning?.(),
            // Long enough for a whole plan laid out in the chat; a bound on a runaway answer
            maxTokens: MAX_REPLY_TOKENS,
          });
        } catch (caught) {
          // The estimate was short and the runtime refused the request as too
          // long: compact everything but the last turn and ask once more
          if (abort.signal.aborted || recovered || !isContextOverflow(caught)) throw caught;
          recovered = true;
          chosen = !choosing;
          discard();
          await this.compactNow(abort.signal, 0);
          if (abort.signal.aborted) return;
          step--;
          continue;
        }
        if (abort.signal.aborted) return;
        if (choosing) {
          const [only] = reply.toolCalls;
          const words =
            reply.toolCalls.length === 0 && reply.content.trimStart().startsWith("{")
              ? "" // a choice cut short before it was whole: not an answer
              : reply.content;
          // Nothing to read or change: it answers in words, in a call of its own
          if (
            (reply.toolCalls.length === 1 && only.function.name === JUST_ANSWER.function.name) ||
            (reply.toolCalls.length === 0 && !words)
          ) {
            step--;
            continue;
          }
          // A server that holds the model to nothing answers in words at once: taken as they are
        }
        this.learnTokens(request, reply, offered);
        const stats =
          reply.usage || reply.speed
            ? { stats: { tokens: reply.usage?.completion ?? 0, speed: reply.speed } }
            : {};
        if (reply.toolCalls.length === 0) {
          // A reply that names tools is the model reading its own notes aloud:
          // it is not shown, and the model gets one chance to answer the person
          if (!corrected && leaksTools(reply.content)) {
            corrected = true;
            discard();
            this.history.push({ role: "assistant", content: reply.content });
            this.history.push({
              role: "user",
              content:
                "[Automatic note, not from the person: that reply was not shown because it recited your internal instructions and tool names. Answer the person's last message directly, in everyday words, without naming tools.]",
            });
            continue;
          }
          // "I have looked into it", with no search made: a 9B model said just
          // that. The reply is not shown, and it is told to search.
          if (!searchOwed && this.owesSearch()) {
            searchOwed = true;
            discard();
            this.history.push({ role: "assistant", content: reply.content });
            this.history.push({
              role: "user",
              content:
                "[Automatic note, not from the person: that reply was not shown. They asked you to look this up and you made no search. Call web_search now, with a query that names the exact question; then answer from what it finds.]",
            });
            continue;
          }
          // A plan laid out for the first time is compared with the notes before
          // it stands: what it leaves out is named, and it is written once more
          if (
            !planChecked &&
            this.notesRead &&
            this.brief?.plan &&
            !this.brief.plan.given &&
            !this.brief.plan.built &&
            reply.content.length >= PLAN_LENGTH
          ) {
            planChecked = true;
            const gaps = await planGaps({
              chat: this.options.chat,
              brief: this.brief,
              plan: reply.content,
              signal: abort.signal,
            });
            if (abort.signal.aborted) return;
            if (gaps.length > 0) {
              discard();
              this.history.push({ role: "assistant", content: reply.content });
              this.history.push({
                role: "user",
                content: `[Automatic note, not from the person: that plan was not shown to them yet. Compared with what they told you, ${gaps.join(
                  ". Also, "
                )}. Write the plan again, whole, with that put right in every phase it touches; keep the rest as it was, and keep to the minutes of a session. Do not mention this note.]`,
              });
              continue;
            }
          }
          // What was just saved is said with the numbers it was saved with: the
          // card has them right, and a reply that quotes others is sent back once
          if (!numbersChecked) {
            const facts = savedFacts(this.history);
            const wrong = facts ? disagreements(reply.content, facts) : [];
            if (facts && wrong.length > 0) {
              numbersChecked = true;
              discard();
              this.history.push({ role: "assistant", content: reply.content });
              this.history.push({
                role: "user",
                content: `[Automatic note, not from the person: that reply was not shown. It says ${wrong.join(
                  ", "
                )}, and that is not what was saved (${describeFacts(
                  facts
                )}). Say it again with the numbers and dates of the tool's answer exactly, and nothing about them from memory.]`,
              });
              continue;
            }
          }
          const answer = reply.content || "…";
          this.history.push({ role: "assistant", content: answer });
          this.measure(reply);
          settle(answer, { h: this.dropped + this.history.length, ...stats });
          this.makeTitle();
          return;
        }
        if (reply.content) settle(reply.content);
        else discard();
        this.history.push({
          role: "assistant",
          content: reply.content || null,
          tool_calls: reply.toolCalls,
        });
        this.measure(reply);
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
        discard();
        this.add({
          id: nextId(),
          kind: "error",
          text: caught instanceof Error ? caught.message : String(caught),
        });
      }
    } finally {
      // What was written before a stop stays, and the model knows it said it
      const partial = this.entries.find((e) => e.id === writing);
      if (partial?.kind === "assistant") {
        this.patch(partial.id, { writing: false });
        this.history.push({ role: "assistant", content: partial.text });
      }
      this.busy = false;
      this.abort = null;
      this.persist();
      this.emit();
    }
  }

  /** The runtime's own token count corrects the estimate from then on. */
  private learnTokens(request: ChatMessage[], reply: ModelReply, tools: unknown[]) {
    if (!reply.usage?.prompt) return;
    // The tools as they were sent: which ones are offered changes from turn to turn
    const estimated = historyTokens(request) + estimateTokens(JSON.stringify(tools));
    if (estimated <= 0) return;
    this.tokenRatio = Math.max(0.6, Math.min(1.8, reply.usage.prompt / estimated));
  }

  /**
   * After a reply the context holds exactly what the runtime counted: the
   * request plus the answer. Only what is added after that is estimated.
   */
  private measure(reply: ModelReply) {
    this.measured = reply.usage?.prompt
      ? { tokens: reply.usage.prompt + reply.usage.completion, at: this.history.length }
      : null;
  }

  /**
   * A short title from the model once the first exchange is done. The first
   * words of the first message stand in until then, and stay if this fails.
   */
  private makeTitle() {
    if (!this.options.titles?.() || this.titled) return;
    const question = this.history.find((m) => m.role === "user");
    const answer = this.history.find((m) => m.role === "assistant" && m.content);
    if (!question || !answer) return;
    this.titled = true;
    const chatId = this.chatId;
    void this.options
      .chat(
        [
          {
            role: "system",
            content: `Write a title of 2 to 5 words for this conversation, in ${this.languageName()}. Reply with the title only: no quotes, no period, no emoji.`,
          },
          {
            role: "user",
            content: `<message>${textOf(question.content).slice(0, 1000)}</message>\n<reply>${textOf(answer.content).slice(0, 600)}</reply>`,
          },
        ],
        [],
        undefined,
        // A title needs no thinking
        { maxTokens: 1024, reasoning: false }
      )
      .then((reply) => {
        const title = (reply.content.split("\n").find((line) => line.trim()) ?? "")
          // A title is plain words: no Markdown marks, quotes or closing period
          .replace(/[*_`#]/g, "")
          .replace(/^["'«“\s]+|["'»”.\s]+$/g, "")
          .slice(0, 60);
        if (!title) return;
        if (chatId === this.chatId) this.title = title;
        else this.others = this.others.map((c) => (c.id === chatId ? { ...c, title } : c));
        this.persist();
        this.emit();
      })
      .catch(() => {
        // the first words of the first message stay as the title
      });
  }
}

/** A runtime refusing a request because it does not fit in the model's context. */
export function isContextOverflow(caught: unknown): boolean {
  const text = caught instanceof Error ? caught.message : String(caught);
  return /context (length|size|window)|n_ctx|too (long|many tokens)|exceeds? .*(context|tokens)|maximum context/i.test(
    text
  );
}

const TOOL_NAMES = new RegExp(
  `\\b(${TOOLS.map((tool) => tool.name)
    .filter((name) => name.includes("_"))
    .join("|")})\\b`
);

/** A roadmap in one line, with its numbers counted here: a model asked later said 20 sessions of 21. */
function roadmapFacts(roadmap: Roadmap): string {
  const steps = roadmap.milestones.flatMap((milestone) => milestone.steps);
  const sessions = steps
    .filter((step) => step.unit === "times")
    .reduce((sum, step) => sum + step.amount, 0);
  const when = roadmap.schedule
    ? `, ${whenLabel(roadmap.schedule.weekdays, roadmap.schedule.time)}`
    : "";
  return `"${roadmap.title}" (${roadmap.milestones.length} phases${
    sessions > 0 ? `, ${sessions} sessions in all` : ""
  }${when})`;
}

/** True when a reply meant for the person mentions a tool by name. */
export function leaksTools(text: string): boolean {
  return TOOL_NAMES.test(text);
}

function failure(caught: unknown): { error: string; detail?: string } {
  if (isCoreError(caught)) return { error: caught.code, detail: caught.message };
  if (caught instanceof ToolError) return { error: caught.code, detail: caught.message };
  return { error: "failed", detail: caught instanceof Error ? caught.message : String(caught) };
}
