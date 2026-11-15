import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { Tooltip } from "../../components/ui/Tooltip";
import { TempoMeter } from "../../components/TempoMeter";
import { formatDateLong, formatNumber, formatTime } from "../../lib/format";
import { useSystem } from "../../state/system";
import { Panel, PanelHeader } from "../../components/PageHeader";
import { DayTimeline } from "./Plan";
import { StartDay } from "./StartDay";
import { Upcoming } from "./Upcoming";
import { useDayPlan } from "./useDayPlan";
import { t, tp } from "../../i18n";

/**
 * The day, in the context panel: one line of time from what was done to what
 * is planned. Read-only (ADR-002): it changes as the person talks to the coach.
 */
export function TodayPage() {
  const plan = useDayPlan();
  const { state } = useSystem();
  if (!plan || !state.currentDay) return <StartDay />;
  const day = state.currentDay;
  const { summary } = plan;

  return (
    <Panel>
      <PanelHeader
        title={t("nav.today")}
        subtitle={
          <span className="tabular">
            {formatDateLong(new Date())}
            {day.day.startTime && ` · ${t("today.since", { time: formatTime(day.day.startTime) })}`}
          </span>
        }
        actions={
          <Tooltip content={t("plan.editBlocks")}>
            <Link
              to="/library?tab=blocks"
              aria-label={t("plan.editBlocks")}
              className="flex size-8 items-center justify-center rounded text-ink-3 transition-colors hover:bg-hover hover:text-ink coarse:size-10"
            >
              <Clock3 className="size-4" />
            </Link>
          </Tooltip>
        }
      />

      {/* On a phone the HUD is too narrow for the tempos: they are here instead */}
      <div className="mb-6 lg:hidden">
        <TempoMeter summary={summary} variant="compact" />
      </div>

      <DayTimeline
        state={state}
        dayId={day.day.id}
        groups={plan.groups}
        active={plan.active}
        nowMinutes={plan.nowMinutes}
      />

      <Upcoming className="mt-10" />

      <Link
        to="/review"
        className="group mt-10 flex items-center gap-3 border-t border-line pt-4 text-sm text-ink-2 transition-colors hover:text-ink"
      >
        <span className="min-w-0 flex-1">
          {summary.completedActivities > 0
            ? `${tp("start.completed", summary.completedActivities)} · ${t("today.avgSatisfaction")} ${formatNumber(summary.averageSatisfaction, 1)}`
            : t("today.reviewLink")}
        </span>
        <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </Link>
    </Panel>
  );
}
