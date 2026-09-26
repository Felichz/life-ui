import { useEffect, useRef } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, CalendarCheck2, Library, Search, Settings } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Kbd } from "../components/ui/Kbd";
import { LiveDot, Logo, TypeIcon } from "../components/TypeIcon";
import { TempoMeter } from "../components/TempoMeter";
import { cn } from "../lib/cn";
import { contractOf, templateMap } from "../lib/domain";
import { formatClock, formatTime } from "../lib/format";
import { modKeyLabel, useHotkey } from "../lib/useHotkey";
import { useNow } from "../lib/useNow";
import { useSystem } from "../state/system";
import { useToast } from "../state/toast";
import { useShell } from "./ShellContext";

const NAV = [
  { to: "/", label: "Hoy", icon: CalendarCheck2, end: true, key: "h" },
  { to: "/biblioteca", label: "Biblioteca", icon: Library, end: false, key: "b" },
  { to: "/resumen", label: "Resumen", icon: BarChart3, end: false, key: "r" },
  { to: "/ajustes", label: "Ajustes", icon: Settings, end: false, key: "a" },
];

export function AppShell() {
  const { openPalette, openAddActivity } = useShell();
  const { state } = useSystem();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const pillVisible = Boolean(state.currentDay?.activeActivityInstanceId) && pathname !== "/";

  useHotkey("k", openPalette, { mod: true, allowInInputs: true });
  useHotkey("n", () => {
    if (!state.currentDay) return;
    openAddActivity();
  });

  // Navegación estilo Linear: G y luego H/B/R/A
  useGoTo((key) => {
    const target = NAV.find((item) => item.key === key);
    if (target) navigate(target.to);
  });

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <main
        className={cn(
          "min-w-0 flex-1 lg:pb-0",
          pillVisible
            ? "pb-[calc(128px+env(safe-area-inset-bottom))]"
            : "pb-[calc(64px+env(safe-area-inset-bottom))]"
        )}
      >
        <Outlet />
      </main>
      <MobileNav />
      <RunningPill />
      <ActivityWatcher />
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

function Sidebar() {
  const { openPalette } = useShell();
  const { state, core } = useSystem();
  const running = Boolean(state.currentDay?.activeActivityInstanceId);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <aside className="sticky top-0 hidden h-dvh w-[232px] shrink-0 flex-col self-start border-r border-line bg-sidebar px-3 pb-3 pt-4 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <Logo />
        <span className="text-md font-semibold tracking-[-0.01em] text-ink">Qualia Control</span>
      </div>

      <button
        type="button"
        onClick={openPalette}
        className="mt-4 flex h-8 items-center gap-2 rounded-md border border-line bg-panel px-2.5 text-sm text-ink-3 shadow-xs transition-colors hover:border-line-strong hover:text-ink-2"
      >
        <Search className="size-4" />
        <span className="min-w-0 flex-1 truncate whitespace-nowrap text-left">Buscar…</span>
        <span className="flex gap-0.5">
          <Kbd>{modKeyLabel}</Kbd>
          <Kbd>K</Kbd>
        </span>
      </button>

      <nav aria-label="Principal" className="mt-4 flex flex-col gap-px">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "flex h-8 items-center gap-2.5 rounded-md px-2 text-base font-medium transition-colors",
                isActive ? "bg-hover text-ink" : "text-ink-2 hover:bg-hover/70 hover:text-ink"
              )
            }
          >
            <Icon className="size-4 shrink-0" strokeWidth={2} />
            <span className="flex-1">{label}</span>
            {to === "/" && running && <LiveDot />}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto">
        {state.currentDay ? (
          <SidebarDay />
        ) : (
          <div className="rounded-lg border border-line bg-panel p-3">
            <p className="text-sm font-medium text-ink">Sin día en curso</p>
            <p className="mt-0.5 text-sm text-ink-2">Empieza cuando quieras.</p>
            {pathname !== "/" && (
              <Button
                variant="primary"
                size="sm"
                className="mt-3 w-full"
                onClick={() => {
                  core.startDay();
                  navigate("/");
                }}
              >
                Empezar el día
              </Button>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

function SidebarDay() {
  const { state, core } = useSystem();
  const day = state.currentDay!;
  const summary = core.getTempoSummary(day.day.id);
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-panel p-3">
      <div>
        <p className="text-xs text-ink-3">
          Día en curso{day.day.startTime && ` · desde ${formatTime(day.day.startTime)}`}
        </p>
        <div className="mt-2">
          <TempoMeter summary={summary} variant="compact" />
        </div>
      </div>
      <RunningLink />
    </div>
  );
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

function RunningLink() {
  const running = useRunning();
  const now = useNow(1000);
  if (!running) return <p className="text-sm text-ink-3">Nada en marcha.</p>;
  const elapsed = now.getTime() - new Date(running.instance.startTime ?? now).getTime();
  return (
    <NavLink
      to="/"
      className="-mx-1 flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-hover"
    >
      <LiveDot />
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
        {running.template.title}
      </span>
      <span className="tabular text-sm text-ink-2">{formatClock(elapsed)}</span>
    </NavLink>
  );
}

function MobileNav() {
  const { state } = useSystem();
  const running = Boolean(state.currentDay?.activeActivityInstanceId);
  return (
    <nav
      aria-label="Principal"
      className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-panel/95 backdrop-blur-md lg:hidden"
    >
      <div className="mx-auto grid h-16 max-w-md grid-cols-4">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                "relative flex flex-col items-center justify-center gap-1 text-2xs font-medium transition-colors",
                isActive ? "text-accent-ink" : "text-ink-3"
              )
            }
          >
            <span className="relative">
              <Icon className="size-[22px]" strokeWidth={1.9} />
              {to === "/" && running && <LiveDot className="absolute -right-1 -top-0.5" />}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** En móvil, fuera de Hoy: lo que está en marcha, siempre a la vista. */
function RunningPill() {
  const running = useRunning();
  const { pathname } = useLocation();
  const now = useNow(1000);
  if (!running || pathname === "/") return null;
  const elapsed = now.getTime() - new Date(running.instance.startTime ?? now).getTime();
  return (
    <NavLink
      to="/"
      className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 flex h-12 animate-toast-in items-center gap-3 rounded-lg border border-line bg-panel px-3.5 shadow-pop lg:hidden"
    >
      <LiveDot />
      <TypeIcon type={running.template.type} />
      <span className="min-w-0 flex-1 truncate text-base font-medium">
        {running.template.title}
      </span>
      <span className="tabular text-base font-medium text-ink-2">{formatClock(elapsed)}</span>
    </NavLink>
  );
}

/**
 * Título de la pestaña con el cronómetro (se ve desde otras pestañas) y
 * avisos de timebox al cruzar el mínimo o el máximo.
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
    document.title = running
      ? `${formatClock(elapsedMs)} · ${running.template.title}`
      : "Qualia Control";
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
        title: `Mínimo cumplido: ${running.template.title}`,
        description: "Puedes seguir si hay flujo, o cerrarla cuando quieras.",
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
        title: `Quedan 2 min de «${running.template.title}»`,
        description: "Buen momento para ir cerrando.",
      });
    }
    if (contract.max !== undefined && !flags.max && elapsedMinutes >= contract.max) {
      flags.max = true;
      toast({
        title: `Llegaste al máximo de «${running.template.title}»`,
        description: "Cuando puedas, ciérrala desde Hoy.",
        duration: 9000,
      });
    }
  }, [running, elapsedMinutes, state, toast]);

  return null;
}
