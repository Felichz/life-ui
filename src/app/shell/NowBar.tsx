import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Tooltip } from "../components/ui/Tooltip";
import { LiveDot, TypeIcon } from "../components/TypeIcon";
import { blockName, blockRange, type Contract, type PlanItem } from "../lib/domain";
import { cn } from "../lib/cn";
import {
  formatClock,
  formatDateLong,
  formatDayMinutes,
  formatNumber,
  formatTime,
} from "../lib/format";
import { useNow } from "../lib/useNow";
import { useDayPlan, type DayPlan } from "../features/today/useDayPlan";
import { t } from "../i18n";
import { useShell } from "./ShellContext";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The HUD above the conversation: what is running and for how long, or what
 * comes next, and the day's tempos. Always in view, whatever the context panel
 * shows. It changes nothing by itself: its button writes in the chat for the
 * person (ADR-002). The bar's bottom edge is the running activity's progress.
 */
export function NowBar({ className }: { className?: string }) {
  const plan = useDayPlan();
  return (
    <div
      className={cn(
        "relative flex min-h-[64px] shrink-0 items-center gap-4 border-b border-line bg-panel px-4 @container sm:px-6",
        className
      )}
    >
      {!plan ? (
        <NoDay />
      ) : plan.active ? (
        <Running item={plan.active} plan={plan} />
      ) : (
        <Idle plan={plan} />
      )}
      {/* On a phone there is no rail: the theme switch rides on the HUD */}
      <ThemeToggle side="bottom" className="-mr-2 size-9 lg:hidden" />
    </div>
  );
}

function NoDay() {
  const { compose } = useShell();
  return (
    <>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-ink-3">{formatDateLong(new Date())}</p>
        <p className="truncate text-md font-semibold text-ink">{t("now.noDay")}</p>
      </div>
      <Button variant="primary" size="sm" onClick={() => compose(t("agent.suggest.start"), "send")}>
        {t("now.startDay")}
      </Button>
    </>
  );
}

function Idle({ plan }: { plan: DayPlan }) {
  const { compose } = useShell();
  const next = plan.next;
  if (!next) {
    return (
      <>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-ink-3">{t("focus.idle.title")}</p>
          <p className="truncate text-md font-semibold text-ink">{t("now.free")}</p>
        </div>
        <Tempos plan={plan} />
      </>
    );
  }
  const { item, group } = next;
  const at = item.instance.scheduledStart;
  // Something of a later block cannot start yet: it says when, and offers nothing
  const canStart = group.status === "now" || group.status === "always";
  const when =
    at !== undefined
      ? formatDayMinutes(at)
      : group.status === "later"
        ? `${blockName(group.block)} · ${blockRange(group.block)}`
        : null;
  return (
    <>
      <TypeIcon type={item.type} boxed className="hidden @md:flex" />
      <div className="min-w-0 flex-1">
        <p className="tabular truncate text-xs text-ink-3">
          {t("now.next")}
          {when && ` · ${when}`}
          {item.contract && ` · ${item.contract.label}`}
        </p>
        <p className="truncate text-md font-semibold text-ink">{item.title}</p>
      </div>
      {canStart && (
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => compose(t("now.startMessage", { title: item.title }), "send")}
        >
          {t("focus.start")}
        </Button>
      )}
      <Tempos plan={plan} />
    </>
  );
}

function Running({ item, plan }: { item: PlanItem; plan: DayPlan }) {
  const { compose } = useShell();
  const now = useNow(1000);
  const startedAt = item.instance.startTime ? new Date(item.instance.startTime) : now;
  const elapsedMs = Math.max(0, now.getTime() - startedAt.getTime());
  const elapsed = elapsedMs / 60000;
  return (
    <section aria-label={t("focus.running")} className="flex min-w-0 flex-1 items-center gap-4">
      <TypeIcon type={item.type} boxed className="hidden @md:flex" />
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-1.5 text-xs">
          <LiveDot className="size-1.5 [&>span]:size-1.5" />
          <span className="tabular shrink-0 font-medium text-live">
            {t("focus.runningSince", { time: formatTime(startedAt.toISOString()) })}
          </span>
          <span className="hidden min-w-0 truncate text-ink-3 @lg:inline">
            · {statusMessage(item, elapsed)}
          </span>
        </p>
        <p className="truncate text-md font-semibold text-ink">{item.title}</p>
      </div>
      <p
        className="tabular shrink-0 text-2xl font-semibold text-ink"
        aria-label={t("focus.elapsed")}
      >
        {formatClock(elapsedMs)}
      </p>
      <Tooltip content={t("now.finishHint")}>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={() => compose(t("now.finishMessage", { title: item.title }))}
        >
          {t("focus.finish")}
        </Button>
      </Tooltip>
      <Tempos plan={plan} />
      {item.contract && <HudLine contract={item.contract} elapsed={elapsed} />}
    </section>
  );
}

/** The day's tempos, small: a number that only goes up, and the share of the reference. */
function Tempos({ plan }: { plan: DayPlan }) {
  const { summary } = plan;
  return (
    <Link
      to="/review"
      aria-label={t("tempo.aria", { total: summary.totalTempos, percent: summary.displayPercent })}
      className="-my-2 hidden shrink-0 flex-col items-end rounded-md px-2 py-1.5 transition-colors hover:bg-hover @md:flex"
    >
      <span className="tabular text-md font-semibold leading-5 text-tempo-ink">
        {formatNumber(summary.totalTempos)}
        <span className="ml-1 text-xs font-normal text-ink-3">{t("tempo.unit")}</span>
      </span>
      <span className="tabular text-xs text-ink-3">{summary.displayPercent}%</span>
    </Link>
  );
}

/**
 * The bar's bottom edge as the running activity's progress: elapsed in
 * indigo against the estimate or the limits, a lighter band for a usual range,
 * and overtime in a lighter indigo (never red, never a debt).
 */
function HudLine({ contract, elapsed }: { contract: Contract; elapsed: number }) {
  const limit = contract.estimate ?? contract.max ?? contract.min ?? 0;
  const scale = Math.max(limit * 1.25, elapsed * 1.04, 1);
  const pct = (minutes: number) => `${Math.min(100, (minutes / scale) * 100)}%`;
  const overFrom = contract.estimate ?? contract.max ?? Infinity;
  const within = Math.min(elapsed, overFrom);
  const marks = [contract.estimate, contract.min, contract.max].filter(
    (mark): mark is number => mark !== undefined
  );
  return (
    <div aria-hidden className="absolute inset-x-0 -bottom-px h-[3px]">
      {contract.min !== undefined && contract.max !== undefined && (
        <div
          className="absolute inset-y-0 bg-accent/15"
          style={{
            left: pct(contract.min),
            width: `calc(${pct(contract.max)} - ${pct(contract.min)})`,
          }}
        />
      )}
      <div
        className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-1000 ease-linear"
        style={{ width: pct(within) }}
      />
      {elapsed > overFrom && (
        <div
          className="absolute inset-y-0 bg-accent/35 transition-[width] duration-1000 ease-linear"
          style={{ left: pct(overFrom), width: `calc(${pct(elapsed)} - ${pct(overFrom)})` }}
        />
      )}
      {marks.map((mark) => (
        <span
          key={mark}
          className="absolute bottom-0 h-2 w-px bg-ink/40"
          style={{ left: pct(mark) }}
        />
      ))}
    </div>
  );
}

export function statusMessage(item: PlanItem, elapsed: number): string {
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
