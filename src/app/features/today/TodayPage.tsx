import { Link } from "react-router-dom";
import { ArrowRight, Clock3 } from "lucide-react";
import { Tooltip } from "../../components/ui/Tooltip";
import { formatDateLong, formatTime } from "../../lib/format";
import { useSystem } from "../../state/system";
import { Panel, PanelHeader } from "../../components/PageHeader";
import { DayTimeline } from "./Plan";
import { StartDay } from "./StartDay";
import { Upcoming } from "./Upcoming";
import { useDayPlan } from "./useDayPlan";
import { t, tp } from "../../i18n";

/**
 * The day, in the context panel: one line of time from what was done to what
 * is planned. Tasks start from it (ADR-015); the rest changes in the chat.
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
          {summary.completed + summary.notCompleted > 0
            ? `${tp("start.completed", summary.completed)}${
                summary.notCompleted > 0 ? ` · ${tp("today.notDone", summary.notCompleted)}` : ""
              }`
            : t("today.reviewLink")}
        </span>
        <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
      </Link>
    </Panel>
  );
}
