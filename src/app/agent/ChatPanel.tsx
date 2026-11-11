import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  CircleSlash,
  Loader2,
  RotateCcw,
  Square,
  SquarePen,
  TriangleAlert,
  Undo2,
} from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { Tooltip } from "../components/ui/Tooltip";
import { Logo } from "../components/TypeIcon";
import { cn } from "../lib/cn";
import { isDesktop } from "../platform/desktop";
import { useModel } from "../runtime/ModelGate";
import { useSystem } from "../state/system";
import { ModelBadge } from "../runtime/ModelBadge";
import { t, type MessageKey } from "../i18n";
import { useAgent } from "./AgentProvider";
import { Markdown } from "./Markdown";
import type { Entry, Mode } from "./agent";

/**
 * The only way to change the day (ADR-002): the person writes, the agent
 * answers, and every change it makes shows as a card to accept, or, in auto
 * mode, to undo.
 */
export function ChatPanel({ className }: { className?: string }) {
  const { agent, entries, busy, mode, available } = useAgent();
  const { openSetup } = useModel();
  const { state } = useSystem();
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, busy]);

  const waiting = entries.some((e) => e.kind === "tool" && e.status === "pending");

  const send = (text = draft) => {
    if (!text.trim() || busy || !available) return;
    void agent.send(text);
    setDraft("");
    inputRef.current?.focus();
  };

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <section
      aria-label={t("agent.title")}
      className={cn("flex min-h-0 flex-col bg-panel", className)}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line pl-5 pr-3">
        <h2 className="text-md font-semibold text-ink">{t("agent.title")}</h2>
        {entries.length > 0 && (
          <Tooltip content={t("agent.new")} side="bottom">
            <IconButton
              label={t("agent.new")}
              size="sm"
              disabled={busy}
              onClick={() => agent.clear()}
            >
              <SquarePen />
            </IconButton>
          </Tooltip>
        )}
      </header>
      <ModelBadge className="border-b border-line py-2.5 pl-5 pr-3" />

      {/* The last lines fade out under the composer instead of meeting a hard rule */}
      <div
        ref={listRef}
        className="fade-bottom flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto px-5 pb-7 pt-5"
        aria-live="polite"
      >
        {!available ? (
          <NoModel onChoose={openSetup} />
        ) : entries.length === 0 ? (
          <div className="m-auto flex max-w-[320px] flex-col items-center text-center">
            <Logo className="size-9" />
            <p className="mt-4 text-lg font-semibold text-ink">{t("agent.empty.title")}</p>
            <p className="text-balance mt-1 text-sm text-ink-2">{t("agent.empty.body")}</p>
            <ul className="mt-5 flex flex-wrap justify-center gap-1.5">
              {(state.currentDay ? DURING_DAY : BEFORE_DAY).map((key) => (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => send(t(key))}
                    className="h-8 rounded-full border border-line bg-panel px-3 text-sm text-ink-2 shadow-xs transition-colors duration-150 hover:border-line-strong hover:bg-subtle hover:text-ink coarse:h-10"
                  >
                    {t(key)}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          groups.map((group) =>
            Array.isArray(group) ? (
              <ToolList key={group[0].id} entries={group} />
            ) : (
              <EntryView key={group.id} entry={group} />
            )
          )
        )}
        {busy && !waiting && (
          <p className="flex animate-entry-in items-center gap-2 text-sm text-ink-3">
            <span className="flex items-center gap-1" aria-hidden>
              {[0, 160, 320].map((delay) => (
                <span
                  key={delay}
                  className="size-1 animate-thinking rounded-full bg-ink-3"
                  style={{ animationDelay: `${delay}ms` }}
                />
              ))}
            </span>
            {t("agent.thinking")}
          </p>
        )}
      </div>

      <div className="shrink-0 px-3 pb-3">
        <div
          className={cn(
            "rounded-xl border border-line bg-canvas shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20",
            !available && "opacity-60"
          )}
        >
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={!available}
            placeholder={t("agent.placeholder")}
            aria-label={t("agent.placeholder")}
            className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-base text-ink outline-none placeholder:text-ink-3 [field-sizing:content]"
          />
          {/* How changes run sits where the message is sent from */}
          <div className="flex items-center justify-between gap-2 px-2 pb-2">
            <Segmented<Mode>
              label={t("agent.mode")}
              size="sm"
              value={mode}
              onChange={(next) => agent.setMode(next)}
              options={[
                { value: "confirm", label: t("agent.mode.confirm") },
                { value: "auto", label: t("agent.mode.auto") },
              ]}
            />
            {busy ? (
              <Tooltip content={t("agent.stop")}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => agent.stop()}
                  aria-label={t("agent.stop")}
                  className="size-8 shrink-0 px-0 [&_svg]:size-3"
                >
                  <Square fill="currentColor" />
                </Button>
              </Tooltip>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => send()}
                disabled={!draft.trim() || !available}
                aria-label={t("agent.send")}
                className="size-8 shrink-0 px-0"
              >
                <ArrowUp />
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 px-2 text-center text-xs text-ink-3">
          {t(mode === "auto" ? "agent.mode.autoHint" : "agent.mode.confirmHint")}
        </p>
      </div>
    </section>
  );
}

function NoModel({ onChoose }: { onChoose: () => void }) {
  return (
    <div className="m-auto max-w-[300px] text-center">
      <p className="text-md font-semibold text-ink">{t("agent.noModel.title")}</p>
      <p className="mt-1 text-sm text-ink-2">
        {isDesktop() ? t("agent.noModel.body") : t("agent.webModel")}
      </p>
      {isDesktop() && (
        <Button variant="secondary" size="sm" className="mt-3" onClick={onChoose}>
          {t("agent.noModel.cta")}
        </Button>
      )}
    </div>
  );
}

const BEFORE_DAY: MessageKey[] = [
  "agent.suggest.start",
  "agent.suggest.plan",
  "agent.suggest.week",
];
const DURING_DAY: MessageKey[] = ["agent.suggest.plan", "agent.suggest.next", "agent.suggest.week"];

type ToolEntry = Extract<Entry, { kind: "tool" }>;

/**
 * Changes already decided read as one quiet list; a change waiting for an
 * answer stays a card of its own, so the question is never lost in the list.
 */
function groupEntries(entries: Entry[]): Array<Entry | ToolEntry[]> {
  const groups: Array<Entry | ToolEntry[]> = [];
  for (const entry of entries) {
    const last = groups[groups.length - 1];
    if (entry.kind === "tool" && entry.status !== "pending") {
      if (Array.isArray(last)) last.push(entry);
      else groups.push([entry]);
    } else {
      groups.push(entry);
    }
  }
  return groups;
}

const STATUS: Record<ToolEntry["status"], MessageKey> = {
  pending: "agent.status.pending",
  running: "agent.status.running",
  done: "agent.status.done",
  rejected: "agent.status.rejected",
  error: "agent.status.error",
  undone: "agent.status.undone",
};

/** Entries restored from the last session are simply there; new ones arrive. */
function useEntrance(entryId: string): string | false {
  const { agent } = useAgent();
  return agent.isFresh(entryId) && "animate-entry-in";
}

function StatusIcon({ status }: { status: ToolEntry["status"] }) {
  const className = "mt-0.5 size-3.5 shrink-0";
  if (status === "done") return <Check className={cn(className, "text-success")} />;
  if (status === "running") return <Loader2 className={cn(className, "animate-spin text-ink-3")} />;
  if (status === "error") return <TriangleAlert className={cn(className, "text-danger")} />;
  if (status === "undone") return <Undo2 className={cn(className, "text-ink-3")} />;
  return <CircleSlash className={cn(className, "text-ink-3")} />;
}

/** Amber is for tempos and nothing else: the reward, where the close happens. */
function TempoBadge({ tempos, earned = false }: { tempos: number; earned?: boolean }) {
  return (
    <span
      className={cn(
        "tabular shrink-0 rounded bg-tempo/15 px-1.5 py-0.5 text-xs font-semibold text-tempo-ink",
        earned && "animate-tempo-bump"
      )}
    >
      +{tempos}
      <span className="sr-only"> {t("tempo.unit")}</span>
    </span>
  );
}

function ToolRow({ entry }: { entry: ToolEntry }) {
  const { agent } = useAgent();
  const entrance = useEntrance(entry.id);
  const quiet = entry.status === "rejected" || entry.status === "undone";
  return (
    <li className={cn("flex min-h-7 items-start gap-2 py-1", entrance)}>
      <StatusIcon status={entry.status} />
      <span className="min-w-0 flex-1 text-sm">
        <span
          className={cn(
            quiet ? "text-ink-3" : "text-ink",
            entry.status === "undone" && "line-through"
          )}
        >
          {entry.summary}
        </span>
        {entry.status !== "done" && (
          <span className={entry.status === "error" ? "text-danger" : "text-ink-3"}>
            {" · "}
            {t(STATUS[entry.status])}
          </span>
        )}
      </span>
      {entry.status === "done" && entry.tempos !== undefined && (
        <TempoBadge tempos={entry.tempos} earned={agent.isFresh(entry.id)} />
      )}
      {entry.status === "done" && agent.canUndo(entry.id) && (
        <button
          type="button"
          onClick={() => agent.undo(entry.id)}
          className="-my-0.5 inline-flex h-6 shrink-0 items-center gap-1 rounded px-1.5 text-xs font-medium text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink coarse:h-9"
        >
          <RotateCcw className="size-3" />
          {t("agent.undo")}
        </button>
      )}
    </li>
  );
}

function ToolList({ entries }: { entries: ToolEntry[] }) {
  return (
    <ul className="flex flex-col gap-0.5 rounded-lg border border-line bg-subtle/60 px-3 py-2">
      {entries.map((entry) => (
        <ToolRow key={entry.id} entry={entry} />
      ))}
    </ul>
  );
}

function EntryView({ entry }: { entry: Entry }) {
  const { agent } = useAgent();
  const entrance = useEntrance(entry.id);
  if (entry.kind === "user") {
    // A new turn: more air above than between the parts of one answer
    return (
      <p
        className={cn(
          "mt-3 max-w-[88%] self-end whitespace-pre-wrap rounded-lg rounded-br-sm bg-hover px-3 py-2 text-base text-ink first:mt-0",
          entrance
        )}
      >
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "assistant") {
    return (
      <div className={cn("pr-2", entrance)}>
        <Markdown>{entry.text}</Markdown>
      </div>
    );
  }
  if (entry.kind === "error") {
    return (
      <p className={cn("flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-ink", entrance)}>
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        {entry.text === "too-many-steps"
          ? t("agent.error.steps")
          : t("agent.error", { error: entry.text })}
      </p>
    );
  }

  // A change waiting for the person's answer: the one indigo thing in the conversation
  return (
    <div className={cn("rounded-lg border border-accent/50 bg-accent/5 px-3 py-2.5", entrance)}>
      <p className="flex items-start justify-between gap-3 text-base font-medium text-ink">
        {entry.summary}
        {entry.tempos !== undefined && <TempoBadge tempos={entry.tempos} />}
      </p>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-2">{t(STATUS[entry.status])}</span>
        <span className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => agent.decide(entry.id, false)}>
            {t("agent.reject")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => agent.decide(entry.id, true)}>
            {t("agent.accept")}
          </Button>
        </span>
      </div>
    </div>
  );
}
