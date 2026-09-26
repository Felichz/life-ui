import { useState } from "react";
import { Play, Plus, SlidersHorizontal } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Kbd } from "../../components/ui/Kbd";
import { Tooltip } from "../../components/ui/Tooltip";
import { LiveDot, TypeIcon } from "../../components/TypeIcon";
import { TYPE_META, blockName, type Contract, type PlanItem } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatClock, formatTime } from "../../lib/format";
import { useHotkey } from "../../lib/useHotkey";
import { useNow } from "../../lib/useNow";
import { useDayActions } from "../../state/actions";
import { useSystem } from "../../state/system";
import { useShell } from "../../shell/ShellContext";
import { EditInstanceDialog } from "../activity/EditInstanceDialog";
import { t } from "../../i18n";

interface FocusPanelProps {
  active: PlanItem | null;
  suggestions: PlanItem[];
}

export function FocusPanel({ active, suggestions }: FocusPanelProps) {
  return active ? <Running item={active} /> : <Idle suggestions={suggestions} />;
}

function Running({ item }: { item: PlanItem }) {
  const { closeActive } = useDayActions();
  const { core } = useSystem();
  const now = useNow(1000);
  const [editing, setEditing] = useState(false);
  const startedAt = item.instance.startTime ? new Date(item.instance.startTime) : now;
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const elapsedMinutes = elapsedMs / 60000;
  const block = core.getTimeBlocks().find((candidate) => candidate.id === item.instance.blockId);

  useHotkey("t", closeActive);

  return (
    <section
      aria-label={t("focus.running")}
      className="overflow-hidden rounded-xl border border-line bg-panel shadow-sm"
    >
      <div className="px-5 pb-5 pt-4 sm:px-6 sm:pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2.5 text-2xl font-semibold text-ink text-balance sm:text-3xl">
              <TypeIcon type={item.type} boxed className="shrink-0" />
              <span className="min-w-0">{item.title}</span>
            </h2>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-sm text-ink-2">
              <span className="inline-flex items-center gap-2 font-medium text-live">
                <LiveDot />
                <span className="tabular">
                  {t("focus.runningSince", { time: formatTime(startedAt.toISOString()) })}
                </span>
              </span>
              <span className="hidden text-ink-3 sm:inline">·</span>
              <span className="hidden sm:inline">{TYPE_META[item.type].label}</span>
              {block && (
                <>
                  <span className="text-ink-3">·</span>
                  <span>{blockName(block)}</span>
                </>
              )}
            </p>
          </div>
          <p
            className="tabular shrink-0 text-4xl font-semibold text-ink sm:text-clock"
            aria-label={t("focus.elapsed")}
          >
            {formatClock(elapsedMs)}
          </p>
        </div>

        {item.contract && <ProgressTrack contract={item.contract} elapsed={elapsedMinutes} />}
        <p className="mt-2.5 text-sm text-ink-2">{statusMessage(item, elapsedMinutes)}</p>
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-line bg-subtle/60 px-3 py-2.5 sm:px-4">
        <Button variant="ghost" size="md" onClick={() => setEditing(true)}>
          <SlidersHorizontal />
          {t("focus.adjust")}
        </Button>
        <Tooltip content={t("focus.finishTooltip")} shortcut={["T"]}>
          <Button
            variant="primary"
            size="lg"
            onClick={closeActive}
            className="min-w-[132px]"
            data-testid="finish-active"
          >
            {t("focus.finish")}
            <Kbd tone="inverse" className="ml-0.5 hidden bg-white/20 text-white sm:inline-flex">
              T
            </Kbd>
          </Button>
        </Tooltip>
      </div>
      <EditInstanceDialog
        instanceId={editing ? item.instance.id : null}
        onClose={() => setEditing(false)}
      />
    </section>
  );
}

function statusMessage(item: PlanItem, elapsed: number): string {
  const contract = item.contract;
  if (!contract) return t("focus.status.noContract");
  const remaining = (limit: number) => Math.max(1, Math.ceil(limit - elapsed));
  if (contract.estimate !== undefined) {
    return elapsed < contract.estimate
      ? t("focus.status.estimateLeft", { n: remaining(contract.estimate) })
      : t("focus.status.estimateOver", { n: Math.floor(elapsed - contract.estimate) });
  }
  if (
    item.type === "flexible-duration" &&
    contract.min !== undefined &&
    contract.max !== undefined
  ) {
    if (elapsed < contract.min)
      return t("focus.status.rangeUsual", { min: contract.min, max: contract.max });
    if (elapsed <= contract.max) return t("focus.status.rangeWithin");
    return t("focus.status.rangeOver");
  }
  const parts: string[] = [];
  if (contract.min !== undefined) {
    parts.push(
      elapsed < contract.min
        ? t("focus.status.minIn", { n: remaining(contract.min) })
        : t("focus.status.minDone")
    );
  }
  if (contract.max !== undefined) {
    if (elapsed >= contract.max) parts.push(t("focus.status.maxDone"));
    else if (contract.min === undefined || elapsed >= contract.min)
      parts.push(t("focus.status.maxIn", { n: remaining(contract.max) }));
  }
  return parts.join(" ");
}

/** Barra de tiempo contra el contrato: estimado, rango o límites del timebox. */
function ProgressTrack({ contract, elapsed }: { contract: Contract; elapsed: number }) {
  const limit = contract.estimate ?? contract.max ?? contract.min ?? 0;
  const scale = Math.max(limit * 1.25, elapsed * 1.04, 1);
  const pct = (minutes: number) => `${Math.min(100, (minutes / scale) * 100)}%`;
  const hasOverflowLimit = contract.estimate !== undefined || contract.max !== undefined;
  const overflowFrom = contract.estimate ?? contract.max ?? Infinity;
  const within = Math.min(elapsed, hasOverflowLimit ? overflowFrom : elapsed);

  const markers: { at: number; label: string }[] = [];
  if (contract.estimate !== undefined)
    markers.push({ at: contract.estimate, label: `~${contract.estimate}` });
  if (contract.min !== undefined) markers.push({ at: contract.min, label: `${contract.min}` });
  if (contract.max !== undefined) markers.push({ at: contract.max, label: `${contract.max}` });

  return (
    <div className="mt-5" aria-hidden>
      <div className="relative h-2 rounded-full bg-hover">
        {contract.min !== undefined && contract.max !== undefined && (
          <div
            className="absolute inset-y-0 rounded-full bg-accent/15"
            style={{
              left: pct(contract.min),
              width: `calc(${pct(contract.max)} - ${pct(contract.min)})`,
            }}
          />
        )}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-accent transition-[width] duration-1000 ease-linear"
          style={{ width: pct(within) }}
        />
        {elapsed > overflowFrom && (
          <div
            className="absolute inset-y-0 rounded-r-full bg-accent/35 transition-[width] duration-1000 ease-linear"
            style={{
              left: pct(overflowFrom),
              width: `calc(${pct(elapsed)} - ${pct(overflowFrom)})`,
            }}
          />
        )}
        {markers.map((marker) => (
          <span
            key={`${marker.label}-${marker.at}`}
            className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink/50"
            style={{ left: pct(marker.at) }}
          />
        ))}
      </div>
      <div className="relative mt-1.5 h-4 text-xs text-ink-3">
        <span className="absolute left-0">0</span>
        {markers.map((marker) => (
          <span
            key={`${marker.label}-l`}
            className="tabular absolute -translate-x-1/2"
            style={{ left: pct(marker.at) }}
          >
            {marker.label} min
          </span>
        ))}
      </div>
    </div>
  );
}

function Idle({ suggestions }: { suggestions: PlanItem[] }) {
  const { startInstance } = useDayActions();
  const { openAddActivity } = useShell();

  return (
    <section
      aria-label={t("focus.label")}
      className="rounded-xl border border-line bg-panel px-5 py-5 shadow-xs sm:px-6"
    >
      <h2 className="text-xl font-semibold text-ink">{t("focus.idle.title")}</h2>
      <p className="mt-1 text-base text-ink-2">
        {suggestions.length > 0 ? t("focus.idle.pick") : t("focus.idle.add")}
      </p>

      {suggestions.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-1.5">
          {suggestions.map((item, index) => (
            <li key={item.instance.id}>
              <button
                type="button"
                onClick={() => startInstance(item.instance.id)}
                className={cn(
                  "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color] duration-150 coarse:py-3",
                  index === 0
                    ? "border-accent/40 bg-accent/5 hover:border-accent hover:bg-accent/10"
                    : "border-line hover:border-line-strong hover:bg-subtle"
                )}
              >
                <TypeIcon type={item.type} boxed />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink">
                    {item.title}
                  </span>
                  {item.contract && (
                    <span className="tabular block text-sm text-ink-2">{item.contract.label}</span>
                  )}
                </span>
                <span
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded px-2.5 text-sm font-medium transition-colors",
                    index === 0
                      ? "bg-accent-fill text-white group-hover:bg-accent-fill-hover"
                      : "text-ink-2 group-hover:text-ink"
                  )}
                >
                  <Play className="size-3.5 fill-current" />
                  {t("focus.start")}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Button variant="primary" className="mt-4" onClick={() => openAddActivity()}>
          <Plus />
          {t("palette.addActivity")}
        </Button>
      )}
    </section>
  );
}
