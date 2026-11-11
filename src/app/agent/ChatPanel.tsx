import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowUp,
  Check,
  CircleSlash,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Button } from "../components/ui/Button";
import { Segmented } from "../components/ui/Segmented";
import { cn } from "../lib/cn";
import { isDesktop } from "../platform/desktop";
import { useModel } from "../runtime/ModelGate";
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
  const [draft, setDraft] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [entries, busy]);

  const waiting = entries.some((e) => e.kind === "tool" && e.status === "pending");

  const send = () => {
    if (!draft.trim() || busy || !available) return;
    void agent.send(draft);
    setDraft("");
  };

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
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <h2 className="flex items-center gap-2 text-md font-semibold text-ink">
          <Sparkles className="size-4 text-accent" />
          {t("agent.title")}
        </h2>
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
      </header>
      <ModelBadge className="border-b border-line px-4 py-2.5" />
      {mode === "auto" && (
        <p className="border-b border-line bg-subtle px-4 py-2 text-xs text-ink-2">
          {t("agent.mode.autoHint")}
        </p>
      )}

      <div
        ref={listRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {!available ? (
          <NoModel onChoose={openSetup} />
        ) : entries.length === 0 ? (
          <div className="m-auto max-w-[300px] text-center">
            <p className="text-md font-semibold text-ink">{t("agent.empty.title")}</p>
            <p className="mt-1 text-sm text-ink-2">{t("agent.empty.body")}</p>
          </div>
        ) : (
          entries.map((entry) => <EntryView key={entry.id} entry={entry} />)
        )}
        {busy && !waiting && (
          <p className="flex items-center gap-2 text-sm text-ink-3">
            <Loader2 className="size-3.5 animate-spin" />
            {t("agent.thinking")}
          </p>
        )}
      </div>

      <div className="shrink-0 border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-canvas px-3 py-2 focus-within:border-accent/60">
          <textarea
            ref={inputRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={onKey}
            rows={1}
            disabled={!available}
            placeholder={t("agent.placeholder")}
            aria-label={t("agent.placeholder")}
            className="max-h-40 min-h-[24px] flex-1 resize-none bg-transparent text-base text-ink outline-none placeholder:text-ink-3 [field-sizing:content] disabled:opacity-60"
          />
          <Button
            variant="primary"
            size="sm"
            onClick={send}
            disabled={!draft.trim() || busy || !available}
            aria-label={t("agent.send")}
            className="size-8 shrink-0 px-0"
          >
            <ArrowUp />
          </Button>
        </div>
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

const STATUS: Record<Extract<Entry, { kind: "tool" }>["status"], MessageKey> = {
  pending: "agent.status.pending",
  running: "agent.status.running",
  done: "agent.status.done",
  rejected: "agent.status.rejected",
  error: "agent.status.error",
  undone: "agent.status.undone",
};

function EntryView({ entry }: { entry: Entry }) {
  const { agent } = useAgent();
  if (entry.kind === "user") {
    return (
      <p className="ml-8 self-end whitespace-pre-wrap rounded-lg rounded-br-sm bg-accent/10 px-3 py-2 text-base text-ink">
        {entry.text}
      </p>
    );
  }
  if (entry.kind === "assistant") {
    return (
      <div className="mr-4">
        <Markdown>{entry.text}</Markdown>
      </div>
    );
  }
  if (entry.kind === "error") {
    return (
      <p className="flex gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-ink">
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        {entry.text === "too-many-steps"
          ? t("agent.error.steps")
          : t("agent.error", { error: entry.text })}
      </p>
    );
  }

  const done = entry.status === "done";
  return (
    <div
      className={cn(
        "rounded-lg border px-3 py-2.5",
        entry.status === "pending" ? "border-accent/50 bg-accent/5" : "border-line bg-subtle",
        (entry.status === "rejected" || entry.status === "undone") && "opacity-70"
      )}
    >
      <p
        className={cn("text-sm font-medium text-ink", entry.status === "undone" && "line-through")}
      >
        {entry.summary}
      </p>
      <div className="mt-1.5 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs",
            done ? "text-success" : entry.status === "error" ? "text-danger" : "text-ink-3"
          )}
        >
          {done && <Check className="size-3.5" />}
          {entry.status === "running" && <Loader2 className="size-3.5 animate-spin" />}
          {entry.status === "rejected" && <CircleSlash className="size-3.5" />}
          {t(STATUS[entry.status])}
        </span>
        {entry.status === "pending" && (
          <span className="flex gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => agent.decide(entry.id, false)}>
              {t("agent.reject")}
            </Button>
            <Button size="sm" variant="primary" onClick={() => agent.decide(entry.id, true)}>
              {t("agent.accept")}
            </Button>
          </span>
        )}
        {done && agent.canUndo(entry.id) && (
          <Button size="sm" variant="ghost" onClick={() => agent.undo(entry.id)}>
            <RotateCcw />
            {t("agent.undo")}
          </Button>
        )}
      </div>
    </div>
  );
}
