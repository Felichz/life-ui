import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarCheck2,
  Library,
  MessageSquare,
  Milestone,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Settings,
} from "lucide-react";
import { ChatPanel } from "../agent/ChatPanel";
import { Tooltip } from "../components/ui/Tooltip";
import { LiveDot, Logo } from "../components/TypeIcon";
import { cn } from "../lib/cn";
import { contractOf, templateMap } from "../lib/domain";
import { formatClock } from "../lib/format";
import { modKeyLabel, useHotkey } from "../lib/useHotkey";
import { useNow } from "../lib/useNow";
import { useSystem } from "../state/system";
import { useToast } from "../state/toast";
import { APP_NAME, t, type MessageKey } from "../i18n";
import { NowBar } from "./NowBar";
import { ThemeToggle } from "./ThemeToggle";
import { PANEL_MIN, clampWidth, usePanel } from "./usePanel";
import { useShell } from "./ShellContext";

interface NavEntry {
  to: string;
  label: MessageKey;
  icon: typeof Library;
  /** The key after G that goes there. */
  key: string;
  /** Paths that count as this place too. */
  also?: string[];
}

/** The places the context panel shows; the conversation stays beside all of them. */
const PLACES: NavEntry[] = [
  { to: "/", label: "nav.today", icon: CalendarCheck2, key: "h", also: ["/today"] },
  { to: "/goals", label: "nav.goals", icon: Milestone, key: "m" },
  { to: "/library", label: "nav.library", icon: Library, key: "b" },
  { to: "/review", label: "nav.review", icon: BarChart3, key: "r" },
];
const SETTINGS: NavEntry = { to: "/settings", label: "nav.settings", icon: Settings, key: "a" };

/** On a phone the conversation is a place of its own, and the day is another. */
const PHONE: NavEntry[] = [
  { to: "/", label: "nav.coach", icon: MessageSquare, key: "" },
  { to: "/today", label: "nav.today", icon: CalendarCheck2, key: "" },
  { to: "/goals", label: "nav.goals", icon: Milestone, key: "" },
  { to: "/library", label: "nav.library", icon: Library, key: "" },
  SETTINGS,
];

const isAt = (pathname: string, entry: NavEntry) =>
  entry.to === "/"
    ? pathname === "/" || (entry.also ?? []).includes(pathname)
    : pathname === entry.to ||
      pathname.startsWith(`${entry.to}/`) ||
      (entry.also ?? []).includes(pathname);

/**
 * The shell (ADR-002): the conversation in the middle of every screen, the HUD
 * above it, and one context panel beside it that shows what the conversation
 * is about (the day by default). On a phone the conversation and each place
 * are screens of their own under the same HUD.
 */
export function AppShell() {
  const { openPalette } = useShell();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const home = pathname === "/";
  const panel = usePanel();
  // While the edge is dragged the width follows the pointer; it is kept when let go
  const [dragging, setDragging] = useState<number | null>(null);
  const width = dragging ?? panel.width;

  useHotkey("k", openPalette, { mod: true, allowInInputs: true });
  useHotkey("b", () => panel.setOpen(!panel.open), { mod: true, allowInInputs: true });

  // Linear-style navigation: G, then H/M/B/R/A
  useGoTo((key) => {
    const target = [...PLACES, SETTINGS].find((item) => item.key === key);
    if (!target) return;
    panel.setOpen(true);
    navigate(target.to);
  });

  return (
    <div
      style={{ "--panel": panel.open ? `${width}px` : "0px" } as CSSProperties}
      className={cn(
        "grid h-dvh overflow-hidden bg-canvas",
        "grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)_auto] [grid-template-areas:'now''main''nav']",
        // The rail sits on the right, next to the panel it switches
        "lg:grid-cols-[minmax(0,1fr)_var(--panel)_84px] lg:grid-rows-[auto_minmax(0,1fr)] lg:[grid-template-areas:'now_ctx_rail''chat_ctx_rail']"
      )}
    >
      <Rail open={panel.open} setOpen={panel.setOpen} />
      <NowBar className="[grid-area:now]" />
      {/* The conversation: the way everything changes */}
      <ChatPanel
        className={cn(
          "min-h-0 [grid-area:main] lg:flex lg:[grid-area:chat]",
          home ? "flex" : "hidden"
        )}
      />
      {/* The context: what the conversation is about */}
      <main
        className={cn(
          "min-h-0 overflow-y-auto bg-panel @container [grid-area:main] lg:border-l lg:border-line lg:[grid-area:ctx]",
          home ? "hidden" : "block",
          panel.open ? "lg:block" : "lg:hidden"
        )}
      >
        <Outlet />
      </main>
      {panel.open && (
        <PanelEdge
          width={width}
          onDrag={setDragging}
          onDone={(next) => {
            setDragging(null);
            // Dragged nearly shut: the panel folds away instead of staying a sliver
            if (next < PANEL_MIN - 80) panel.setOpen(false);
            else panel.setWidth(clampWidth(next));
          }}
          onReset={() => panel.setWidth(null)}
        />
      )}
      <PhoneNav />
      <ActivityWatcher />
    </div>
  );
}

/** The places, in a narrow rail with their names: nothing here competes with the day. */
function Rail({ open, setOpen }: { open: boolean; setOpen: (open: boolean) => void }) {
  const { openPalette } = useShell();
  const { pathname } = useLocation();
  const running = Boolean(useRunning());
  const toggle = t(open ? "shell.panel.hide" : "shell.panel.show");
  return (
    <nav
      aria-label={t("nav.main")}
      className="hidden flex-col items-center gap-1 border-l border-line bg-sidebar px-2 pb-3 pt-4 [grid-area:rail] lg:flex"
    >
      <NavLink to="/" aria-label={APP_NAME} className="mb-4 rounded-lg p-1">
        <Logo className="size-7" />
      </NavLink>
      {PLACES.map((entry) => (
        <RailItem
          key={entry.to}
          entry={entry}
          active={isAt(pathname, entry)}
          live={entry.to === "/" && running}
          open={open}
          setOpen={setOpen}
        />
      ))}
      <span className="flex-1" />
      <Tooltip content={`${toggle} · ${modKeyLabel}+B`} side="left">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-label={toggle}
          aria-pressed={open}
          className="flex size-10 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          {open ? (
            <PanelRightClose className="size-[18px]" />
          ) : (
            <PanelRightOpen className="size-[18px]" />
          )}
        </button>
      </Tooltip>
      <ThemeToggle />
      <Tooltip content={t("shell.search")} side="left">
        <button
          type="button"
          onClick={openPalette}
          aria-label={t("shell.search")}
          className="flex size-10 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <Search className="size-[18px]" />
        </button>
      </Tooltip>
      <RailItem entry={SETTINGS} active={isAt(pathname, SETTINGS)} open={open} setOpen={setOpen} />
    </nav>
  );
}

function RailItem({
  entry,
  active,
  live = false,
  open,
  setOpen,
}: {
  entry: NavEntry;
  active: boolean;
  live?: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      aria-current={active && open ? "page" : undefined}
      // The place already shown folds the panel away; any place opens it
      onClick={(event) => {
        if (active && open) {
          event.preventDefault();
          setOpen(false);
        } else setOpen(true);
      }}
      className={cn(
        "flex w-full flex-col items-center gap-1 rounded-lg px-0.5 pb-1.5 pt-2 text-2xs font-medium transition-colors",
        active && open ? "bg-hover text-ink" : "text-ink-3 hover:bg-hover/70 hover:text-ink"
      )}
    >
      <span className="relative">
        <Icon className="size-5" strokeWidth={1.9} />
        {live && <LiveDot className="absolute -right-1 -top-0.5" />}
      </span>
      <span className="w-full truncate text-center">{t(entry.label)}</span>
    </NavLink>
  );
}

/**
 * The edge between the conversation and the panel: dragged to resize the
 * panel, arrow keys for the same by keyboard, a double click for the usual
 * width. Its line lights up while it is held.
 */
function PanelEdge({
  width,
  onDrag,
  onDone,
  onReset,
}: {
  width: number;
  onDrag: (width: number) => void;
  onDone: (width: number) => void;
  onReset: () => void;
}) {
  const start = useRef<{ x: number; width: number } | null>(null);
  const [held, setHeld] = useState(false);
  const current = useRef(width);

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width };
    current.current = width;
    setHeld(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!start.current) return;
    // The panel is on the right: moving left makes it wider
    const next = start.current.width + (start.current.x - event.clientX);
    current.current = next;
    onDrag(next < PANEL_MIN ? Math.max(PANEL_MIN - 80, next) : clampWidth(next));
  };
  const end = () => {
    if (!start.current) return;
    start.current = null;
    setHeld(false);
    onDone(current.current);
  };
  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 64 : 16;
    if (event.key === "ArrowLeft") onDone(width + step);
    else if (event.key === "ArrowRight") onDone(width - step);
    else return;
    event.preventDefault();
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={t("shell.panel.resize")}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onDoubleClick={onReset}
      onKeyDown={onKeyDown}
      className="group relative z-10 -ml-[5px] hidden w-[9px] cursor-col-resize touch-none justify-self-start outline-none [grid-area:ctx] lg:block"
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-1 w-px transition-colors duration-150",
          held
            ? "bg-accent"
            : "bg-transparent group-hover:bg-accent/60 group-focus-visible:bg-accent"
        )}
      />
    </div>
  );
}

function useGoTo(onKey: (key: string) => void) {
  const armed = useRef<number | null>(null);
  const handler = useRef(onKey);
  handler.current = onKey;
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (target.closest("input, textarea, select, [contenteditable='true'], [role='dialog']"))
        return;
      const key = event.key.toLowerCase();
      if (armed.current !== null) {
        window.clearTimeout(armed.current);
        armed.current = null;
        handler.current(key);
        return;
      }
      if (key === "g") armed.current = window.setTimeout(() => (armed.current = null), 900);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

function useRunning() {
  const { state } = useSystem();
  const activeId = state.currentDay?.activeActivityInstanceId;
  const instance = activeId
    ? state.currentDay?.activityInstances.find((item) => item.id === activeId)
    : undefined;
  const template = instance
    ? state.global.activityTemplates.find((item) => item.id === instance.templateId)
    : undefined;
  return instance && template ? { instance, template } : null;
}

function PhoneNav() {
  const { pathname } = useLocation();
  const running = Boolean(useRunning());
  return (
    <nav
      aria-label={t("nav.main")}
      className="pb-safe border-t border-line bg-panel [grid-area:nav] lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-5">
        {PHONE.map((entry) => {
          const Icon = entry.icon;
          const active = entry.to === "/" ? pathname === "/" : isAt(pathname, entry);
          return (
            <NavLink
              key={entry.to}
              to={entry.to}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors",
                active ? "text-accent-ink" : "text-ink-3"
              )}
            >
              <span className="relative">
                <Icon className="size-[22px]" strokeWidth={1.9} />
                {entry.to === "/today" && running && (
                  <LiveDot className="absolute -right-1 -top-0.5" />
                )}
              </span>
              {t(entry.label)}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

/**
 * Tab title with the stopwatch (visible from other tabs) and timebox
 * alerts when crossing the minimum or the maximum.
 */
function ActivityWatcher() {
  const running = useRunning();
  const { state } = useSystem();
  const toast = useToast();
  const now = useNow(1000);
  const notified = useRef<Record<string, { min?: boolean; max?: boolean; warn?: boolean }>>({});

  const elapsedMs = running?.instance.startTime
    ? now.getTime() - new Date(running.instance.startTime).getTime()
    : 0;
  const elapsedMinutes = elapsedMs / 60000;

  useEffect(() => {
    document.title = running ? `${formatClock(elapsedMs)} · ${running.template.title}` : APP_NAME;
  }, [running, elapsedMs]);

  useEffect(() => {
    if (!running || running.template.type !== "timeboxing") return;
    const contract = contractOf(
      "timeboxing",
      running.instance,
      templateMap(state).get(running.template.id)
    );
    if (!contract) return;
    const flags = (notified.current[running.instance.id] ??= {});
    if (contract.min !== undefined && !flags.min && elapsedMinutes >= contract.min) {
      flags.min = true;
      toast({
        title: t("timebox.minReached", { title: running.template.title }),
        description: t("timebox.minReachedHint"),
      });
    }
    if (
      contract.max !== undefined &&
      !flags.warn &&
      contract.max >= 10 &&
      elapsedMinutes >= contract.max - 2 &&
      elapsedMinutes < contract.max
    ) {
      flags.warn = true;
      toast({
        title: t("timebox.maxSoon", { title: running.template.title }),
        description: t("timebox.maxSoonHint"),
      });
    }
    if (contract.max !== undefined && !flags.max && elapsedMinutes >= contract.max) {
      flags.max = true;
      toast({
        title: t("timebox.maxReached", { title: running.template.title }),
        description: t("timebox.maxReachedHint"),
        duration: 9000,
      });
    }
  }, [running, elapsedMinutes, state, toast]);

  return null;
}
