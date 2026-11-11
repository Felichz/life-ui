import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type DragEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowUp,
  Check,
  ChevronDown,
  CircleSlash,
  Copy,
  FileText,
  FoldVertical,
  GitBranch,
  Globe,
  History,
  Loader2,
  Paperclip,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  Square,
  SquarePen,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Menu, MenuContent, MenuItem, MenuTrigger } from "../components/ui/Menu";
import { Segmented } from "../components/ui/Segmented";
import { Tooltip } from "../components/ui/Tooltip";
import { Logo } from "../components/TypeIcon";
import { cn } from "../lib/cn";
import {
  formatContext,
  formatDateShort,
  formatNumber,
  formatTime,
  formatTokens,
} from "../lib/format";
import { isDesktop } from "../platform/desktop";
import { useModel } from "../runtime/ModelGate";
import { useSystem } from "../state/system";
import { useToast } from "../state/toast";
import { ModelBadge } from "../runtime/ModelBadge";
import { t, type MessageKey } from "../i18n";
import { useAgent } from "./AgentProvider";
import { Markdown } from "./Markdown";
import type { Attachment, ContextUsage, Entry, Mode } from "./agent";

const TEXT_FILES = ".txt,.md,.markdown,.csv,.json,.log,.yaml,.yml,text/plain";

/** Photos are sent small: a model reads 1280 px as well as 4000, at a fraction of the weight. */
async function readImage(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

/**
 * The only way to change the day (ADR-002): the person writes, the agent
 * answers, and every change it makes shows as a card to accept, or, in auto
 * mode, to undo. The conversations themselves are kept, compacted when they
 * outgrow the model, branched and edited (ADR-007).
 */
export function ChatPanel({ className }: { className?: string }) {
  const { agent, entries, busy, mode, available, vision, compacting } = useAgent();
  const { openSetup, endpoint } = useModel();
  const { state } = useSystem();
  const toast = useToast();
  const [draft, setDraft] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [view, setView] = useState<"chat" | "list">("chat");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // The list follows the newest text only while the person is at the bottom:
  // scrolling up to read stops it, and coming back down resumes it
  const following = useRef(true);
  const onScroll = () => {
    const list = listRef.current;
    if (list) following.current = list.scrollHeight - list.scrollTop - list.clientHeight < 48;
  };
  useEffect(() => {
    const list = listRef.current;
    if (list && following.current) list.scrollTop = list.scrollHeight;
  }, [entries, busy]);
  // Opening the conversation, or sending a message, always goes to the end
  useEffect(() => {
    following.current = true;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [view, entries.length === 0]);

  const waiting = entries.some((e) => e.kind === "tool" && e.status === "pending");
  // The day's snapshot is part of what is sent, so the count follows the day too
  const usage = useMemo(
    () => agent.usage(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [agent, entries, busy, endpoint?.context, state]
  );
  const blocked = usage.overflow && !busy;

  const send = (text = draft) => {
    if ((!text.trim() && files.length === 0) || busy || !available || blocked) return;
    following.current = true;
    void agent.send(text, files);
    setDraft("");
    setFiles([]);
    inputRef.current?.focus();
  };

  const groups = useMemo(() => groupEntries(entries), [entries]);

  const onKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
    if (event.key === "Escape" && busy) agent.stop();
  };

  const onPaste = (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = Array.from(event.clipboardData.files);
    if (pasted.length === 0) return;
    event.preventDefault();
    void addFiles(pasted);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    if (event.dataTransfer.files.length === 0) return;
    event.preventDefault();
    void addFiles(Array.from(event.dataTransfer.files));
  };

  const writing = entries.some((e) => e.kind === "assistant" && e.writing);
  const lastId = entries[entries.length - 1]?.id;

  const onFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addFiles(picked);
  };

  /** Files from the picker, the clipboard or a drop all come through here. */
  const addFiles = async (picked: File[]) => {
    if (picked.length === 0 || !available || blocked) return;
    // A file may take a quarter of the context at most: the rest is for the conversation
    const maxChars = Math.floor(usage.context * 0.25 * 3.2);
    const added: Attachment[] = [];
    for (const file of picked) {
      try {
        if (file.type.startsWith("image/")) {
          if (!vision) {
            toast({ tone: "error", title: t("agent.attach.noVision") });
            continue;
          }
          added.push({ kind: "image", name: file.name, data: await readImage(file) });
        } else {
          const text = await file.text();
          if (text.length > maxChars) {
            toast({ tone: "error", title: t("agent.attach.tooBig", { name: file.name }) });
            continue;
          }
          added.push({ kind: "text", name: file.name, data: text });
        }
      } catch {
        toast({ tone: "error", title: t("agent.attach.failed", { name: file.name }) });
      }
    }
    if (added.length > 0) setFiles((current) => [...current, ...added]);
    inputRef.current?.focus();
  };

  const edit = (entryId: string) => {
    const text = agent.editFrom(entryId);
    if (text === null) return;
    setDraft(text);
    inputRef.current?.focus();
  };

  return (
    <section
      aria-label={t("agent.title")}
      className={cn("flex min-h-0 flex-col bg-panel", className)}
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line pl-5 pr-3">
        {view === "list" ? (
          <>
            <h2 className="text-md font-semibold text-ink">{t("agent.chats")}</h2>
            <Button size="sm" variant="ghost" onClick={() => setView("chat")}>
              <ArrowLeft />
              {t("agent.chats.back")}
            </Button>
          </>
        ) : (
          <>
            <h2 className="min-w-0 truncate text-md font-semibold text-ink">{t("agent.title")}</h2>
            <div className="flex shrink-0 items-center gap-0.5">
              {available && <ContextMeter usage={usage} busy={busy} />}
              <Tooltip content={t("agent.chats")} side="bottom">
                <IconButton label={t("agent.chats")} size="sm" onClick={() => setView("list")}>
                  <History />
                </IconButton>
              </Tooltip>
              {entries.length > 0 && (
                <Tooltip content={t("agent.new")} side="bottom">
                  <IconButton
                    label={t("agent.new")}
                    size="sm"
                    disabled={busy}
                    onClick={() => agent.newChat()}
                  >
                    <SquarePen />
                  </IconButton>
                </Tooltip>
              )}
            </div>
          </>
        )}
      </header>
      <ModelBadge className="border-b border-line py-2.5 pl-5 pr-3" />

      {view === "list" ? (
        <ChatList onOpen={() => setView("chat")} />
      ) : (
        <>
          {/* The last lines fade out under the composer instead of meeting a hard rule */}
          <div
            ref={listRef}
            onScroll={onScroll}
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
                  <EntryView
                    key={group.id}
                    entry={group}
                    onEdit={edit}
                    last={group.id === lastId}
                  />
                )
              )
            )}
            {busy && !waiting && !writing && (
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
                {compacting
                  ? t("agent.compacting", {
                      done: Math.min(compacting.done + 1, compacting.total),
                      total: compacting.total,
                    })
                  : t("agent.thinking")}
              </p>
            )}
          </div>

          <div className="shrink-0 px-3 pb-3">
            {blocked && (
              <div className="mb-2 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2.5">
                <p className="text-sm text-ink">
                  {t("agent.overflow", {
                    used: formatTokens(usage.used),
                    total: formatContext(usage.context),
                  })}
                </p>
                <Button
                  size="sm"
                  variant="primary"
                  className="mt-2"
                  disabled={!usage.canCompact}
                  onClick={() => void agent.compact()}
                >
                  {t("agent.compact")}
                </Button>
              </div>
            )}
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={onDrop}
              className={cn(
                "rounded-xl border border-line bg-canvas shadow-xs transition-[border-color,box-shadow] duration-150 focus-within:border-accent focus-within:ring-[3px] focus-within:ring-accent/20",
                (!available || blocked) && "opacity-60"
              )}
            >
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 px-2.5 pt-2.5">
                  {files.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex h-7 max-w-full items-center gap-1.5 rounded-md border border-line bg-panel pl-1.5 pr-0.5 text-xs text-ink"
                    >
                      {file.kind === "image" ? (
                        <img src={file.data} alt="" className="size-5 rounded-sm object-cover" />
                      ) : (
                        <FileText className="size-3.5 text-ink-3" />
                      )}
                      <span className="min-w-0 truncate">{file.name}</span>
                      <button
                        type="button"
                        aria-label={t("agent.attach.remove", { name: file.name })}
                        onClick={() => setFiles((current) => current.filter((_, i) => i !== index))}
                        className="flex size-6 items-center justify-center rounded text-ink-3 hover:bg-hover hover:text-ink"
                      >
                        <X className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={onKey}
                onPaste={onPaste}
                rows={1}
                disabled={!available || blocked}
                placeholder={t("agent.placeholder")}
                aria-label={t("agent.placeholder")}
                className="block max-h-40 min-h-[44px] w-full resize-none bg-transparent px-3.5 pb-1 pt-3 text-base text-ink outline-none placeholder:text-ink-3 [field-sizing:content]"
              />
              {/* How changes run sits where the message is sent from */}
              <div className="flex items-center gap-1 px-2 pb-2">
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
                <span className="flex-1" />
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  hidden
                  accept={vision ? `image/*,${TEXT_FILES}` : TEXT_FILES}
                  onChange={onFiles}
                />
                <Tooltip content={t(vision ? "agent.attach.any" : "agent.attach.text")}>
                  <IconButton
                    label={t("agent.attach")}
                    disabled={!available || blocked || busy}
                    onClick={() => fileRef.current?.click()}
                  >
                    <Paperclip />
                  </IconButton>
                </Tooltip>
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
                    disabled={(!draft.trim() && files.length === 0) || !available || blocked}
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
        </>
      )}
    </section>
  );
}

/**
 * How full the model's context is, always in sight, with the way to compact
 * by hand. Neutral until it is nearly full: it is a gauge, not an alarm.
 */
function ContextMeter({ usage, busy }: { usage: ContextUsage; busy: boolean }) {
  const { agent } = useAgent();
  const share = Math.min(1, usage.used / usage.context);
  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={t("agent.context.label", {
            used: formatTokens(usage.used),
            total: formatContext(usage.context),
          })}
          className="tabular mr-1 flex h-7 items-center gap-2 rounded px-2 text-xs text-ink-2 transition-colors duration-150 hover:bg-hover hover:text-ink coarse:h-9"
        >
          <span className="h-1 w-8 overflow-hidden rounded-full bg-hover" aria-hidden>
            <span
              className={cn("block h-full rounded-full", share > 0.85 ? "bg-accent" : "bg-ink-3")}
              style={{ width: `${Math.max(6, share * 100)}%` }}
            />
          </span>
          {formatTokens(usage.used)} / {formatContext(usage.context)}
        </button>
      </MenuTrigger>
      <MenuContent className="w-[280px]">
        <div className="px-2 pb-2 pt-1.5">
          <p className="text-sm font-medium text-ink">{t("agent.context")}</p>
          <p className="tabular mt-0.5 text-xs text-ink-2">
            {t("agent.context.usage", {
              used: formatNumber(usage.used),
              total: formatNumber(usage.context),
              percent: Math.round(share * 100),
            })}
          </p>
          <p className="mt-1.5 text-xs text-ink-3">{t("agent.context.hint")}</p>
        </div>
        <MenuItem
          icon={<FoldVertical />}
          disabled={busy || !usage.canCompact}
          onSelect={() => void agent.compact()}
        >
          {t("agent.compact")}
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}

/** Every conversation kept, the latest first. */
function ChatList({ onOpen }: { onOpen: () => void }) {
  const { agent, busy } = useAgent();
  const [confirming, setConfirming] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const all = agent.list();
  const chats = all.filter((chat) => chat.title.toLowerCase().includes(query.trim().toLowerCase()));
  if (all.length === 0) {
    return (
      <p className="m-auto max-w-[280px] px-5 text-center text-sm text-ink-2">
        {t("agent.chats.empty")}
      </p>
    );
  }
  return (
    <ul className="min-h-0 flex-1 overflow-y-auto p-2">
      {all.length > 5 && (
        <li className="mb-1 px-1">
          <label className="flex h-8 items-center gap-2 rounded-md border border-line bg-canvas px-2.5 focus-within:border-accent coarse:h-10">
            <Search className="size-3.5 shrink-0 text-ink-3" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("agent.chats.search")}
              aria-label={t("agent.chats.search")}
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-3"
            />
          </label>
        </li>
      )}
      {chats.map((chat) => (
        <li key={chat.id} className="group relative">
          <button
            type="button"
            disabled={busy}
            aria-current={chat.active}
            onClick={() => {
              agent.openChat(chat.id);
              onOpen();
            }}
            className="flex w-full flex-col rounded-md px-3 py-2 pr-11 text-left transition-colors duration-150 hover:bg-hover aria-[current=true]:bg-hover"
          >
            <span className="w-full truncate text-base font-medium text-ink">
              {chat.title || t("agent.chats.untitled")}
            </span>
            <span className="tabular text-xs text-ink-3">
              {formatDateShort(new Date(chat.updatedAt))} ·{" "}
              {formatTime(new Date(chat.updatedAt).toISOString())}
            </span>
          </button>
          {confirming === chat.id ? (
            <Button
              size="sm"
              variant="danger"
              className="absolute right-2 top-1/2 -translate-y-1/2"
              onClick={() => {
                agent.deleteChat(chat.id);
                setConfirming(null);
              }}
              onBlur={() => setConfirming(null)}
              autoFocus
            >
              {t("agent.chats.deleteConfirm")}
            </Button>
          ) : (
            <IconButton
              label={t("agent.chats.delete")}
              size="sm"
              disabled={busy}
              onClick={() => setConfirming(chat.id)}
              className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 focus-visible:opacity-100 group-hover:opacity-100 coarse:opacity-100"
            >
              <Trash2 />
            </IconButton>
          )}
        </li>
      ))}
    </ul>
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

function StatusIcon({ status, external }: { status: ToolEntry["status"]; external?: boolean }) {
  const className = "mt-0.5 size-3.5 shrink-0";
  // A search changed nothing: it reads as a lookup, not as a change that went through
  if (status === "done" && external) return <Globe className={cn(className, "text-ink-3")} />;
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
      <StatusIcon status={entry.status} external={entry.external} />
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

/** What can be done with one message: quiet until the message is pointed at. */
function MessageActions({
  children,
  align,
  shown = false,
}: {
  children: ReactNode;
  align: "start" | "end";
  /** The latest message keeps its actions in sight; older ones show them when pointed at. */
  shown?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex h-6 items-center gap-0.5 transition-opacity duration-150 focus-within:opacity-100 group-hover/message:opacity-100 coarse:opacity-100",
        !shown && "opacity-0",
        align === "end" ? "justify-end" : "-ml-1.5 justify-start"
      )}
    >
      {children}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip content={label} side="bottom">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="flex size-6 items-center justify-center rounded text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink coarse:size-9 [&_svg]:size-3.5"
      >
        {children}
      </button>
    </Tooltip>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // the clipboard is not available here; nothing to report
    }
  };
  return (
    <ActionButton label={t(copied ? "agent.copied" : "agent.copy")} onClick={() => void copy()}>
      {copied ? <Check className="text-success" /> : <Copy />}
    </ActionButton>
  );
}

/** The notes a compaction left in place of the older messages, readable on demand. */
function CompactNote({ entry }: { entry: Extract<Entry, { kind: "compact" }> }) {
  const [open, setOpen] = useState(false);
  const entrance = useEntrance(entry.id);
  return (
    <div className={cn("rounded-lg border border-line bg-subtle/60", entrance)}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-ink"
      >
        <FoldVertical className="size-3.5 shrink-0 text-ink-3" />
        <span className="min-w-0 flex-1">
          {t("agent.compacted")}
          <span className="tabular text-ink-3">
            {" · "}
            {t("agent.compacted.detail", {
              before: formatTokens(entry.before),
              after: formatTokens(entry.after),
            })}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-ink-3 transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <div className="border-t border-line px-3 py-2.5">
          <Markdown>{entry.text}</Markdown>
        </div>
      )}
    </div>
  );
}

function EntryView({
  entry,
  onEdit,
  last,
}: {
  entry: Entry;
  onEdit: (entryId: string) => void;
  last: boolean;
}) {
  const { agent } = useAgent();
  const entrance = useEntrance(entry.id);
  if (entry.kind === "compact") return <CompactNote entry={entry} />;
  if (entry.kind === "user") {
    // A new turn: more air above than between the parts of one answer
    return (
      <div className={cn("group/message mt-3 flex flex-col items-end gap-1 first:mt-0", entrance)}>
        <div className="max-w-[88%] rounded-lg rounded-br-sm bg-hover px-3 py-2 text-base text-ink">
          {entry.attachments && entry.attachments.length > 0 && (
            <ul className="mb-1.5 flex flex-wrap gap-1.5">
              {entry.attachments.map((file, index) => (
                <li key={`${file.name}-${index}`}>
                  {file.kind === "image" && file.url ? (
                    <img
                      src={file.url}
                      alt={file.name}
                      className="max-h-40 max-w-full rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-6 items-center gap-1.5 rounded bg-panel px-1.5 text-xs text-ink-2">
                      <FileText className="size-3.5 text-ink-3" />
                      {file.name}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
          {entry.text && <p className="whitespace-pre-wrap">{entry.text}</p>}
        </div>
        <MessageActions align="end">
          <CopyButton text={entry.text} />
          {agent.canRewind(entry.id) && (
            <ActionButton label={t("agent.edit")} onClick={() => onEdit(entry.id)}>
              <Pencil />
            </ActionButton>
          )}
        </MessageActions>
      </div>
    );
  }
  if (entry.kind === "assistant") {
    return (
      <div className={cn("group/message flex flex-col gap-1 pr-2", entrance)}>
        <Markdown>{entry.text}</Markdown>
        {/* While it is being written there is nothing to act on yet */}
        {!entry.writing && (
          <MessageActions align="start" shown={last}>
            <CopyButton text={entry.text} />
            {agent.canRegenerate(entry.id) && (
              <ActionButton
                label={t("agent.regenerate")}
                onClick={() => void agent.regenerate(entry.id)}
              >
                <RefreshCw />
              </ActionButton>
            )}
            {agent.canRewind(entry.id) && (
              <ActionButton label={t("agent.branch")} onClick={() => agent.branchFrom(entry.id)}>
                <GitBranch />
              </ActionButton>
            )}
            {entry.stats && entry.stats.tokens > 0 && (
              <span className="tabular ml-1.5 text-xs text-ink-3">
                {entry.stats.speed
                  ? t("agent.stats.speed", {
                      tokens: formatNumber(entry.stats.tokens),
                      speed: formatNumber(entry.stats.speed),
                    })
                  : t("agent.stats", { tokens: formatNumber(entry.stats.tokens) })}
              </span>
            )}
          </MessageActions>
        )}
      </div>
    );
  }
  if (entry.kind === "error") {
    return (
      <p className={cn("flex gap-2 rounded-lg bg-danger/10 px-3 py-2 text-sm text-ink", entrance)}>
        <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        {entry.text === "too-many-steps"
          ? t("agent.error.steps")
          : entry.text === "empty-summary"
            ? t("agent.error.compact")
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
      {/* The first search asks: what leaves the machine, and where it goes */}
      {entry.external && <p className="mt-1 text-xs text-ink-2">{t("agent.web.ask")}</p>}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="text-xs text-ink-2">{t(STATUS[entry.status])}</span>
        <span className="flex gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => agent.decide(entry.id, false)}>
            {t("agent.reject")}
          </Button>
          <Button size="sm" variant="primary" onClick={() => agent.decide(entry.id, true)}>
            {t(entry.external ? "agent.web.allow" : "agent.accept")}
          </Button>
        </span>
      </div>
    </div>
  );
}
