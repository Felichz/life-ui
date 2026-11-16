import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck2, Library, Play, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { useTaskActions } from "../../shell/useTaskActions";
import { localDate } from "../../../system/agendaManager";
import { TypeIcon } from "../../components/TypeIcon";
import { contractOf, daysNewestFirst, planItem, templateMap } from "../../lib/domain";
import { formatDateLong, formatDateShort, formatDayMinutes, greeting } from "../../lib/format";
import { useSystem } from "../../state/system";
import { APP_NAME, t, tp } from "../../i18n";
import { Upcoming } from "./Upcoming";
import { Panel, PanelHeader } from "../../components/PageHeader";

/**
 * Screen with no day in progress (ADR-015): a button starts the day, and each
 * task for today (planned for today, or left from before) can start it at once.
 * The coach is told in the chat either way.
 */
export function StartDay() {
  const { state, core } = useSystem();
  const { startTheDay, startBeforeDay } = useTaskActions();
  const today = new Date();
  const lastDay = daysNewestFirst(state).find((day) => day.state === "inactive");
  const lastSummary = lastDay ? core.getDaySummary(lastDay.id) : null;
  const templates = templateMap(state);
  const firstRun = state.global.days.length === 0;
  // Today's tasks: what was left from before, and what is planned for today
  const todayDate = localDate(today);
  const forToday = [
    ...(state.global.pendingActivityInstances ?? []).map((instance) => {
      const item = planItem(instance, templates);
      return {
        key: instance.id,
        item: { ...item, templateId: instance.templateId },
        time: instance.scheduledStart,
      };
    }),
    ...core
      .getPlannedActivities()
      .filter((planned) => planned.date <= todayDate)
      .flatMap((planned) => {
        const template = templates.get(planned.templateId);
        if (!template) return [];
        return [
          {
            key: planned.id,
            item: {
              title: template.title,
              type: template.type,
              contract: contractOf(template.type, template),
              templateId: template.id,
            },
            time: planned.time,
          },
        ];
      }),
  ];

  return (
    <Panel>
      <PanelHeader title={greeting(today)} subtitle={formatDateLong(today)} />
      <p className="max-w-md text-base text-ink-2">
        {firstRun ? t("start.intro", { app: APP_NAME }) : t("start.back")}
      </p>

      <Button variant="primary" className="mt-6" onClick={startTheDay}>
        <Play />
        {t("now.startDay")}
      </Button>

      {forToday.length > 0 && (
        <div className="mt-7 rounded-lg border border-line bg-panel shadow-xs">
          <p className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
            {tp("start.forToday", forToday.length)}
          </p>
          <ul className="px-1.5 py-1">
            {forToday.map(({ key, item, time }) => (
              <li
                key={key}
                className="flex min-h-10 items-center gap-2.5 px-2.5 text-base text-ink"
              >
                <TypeIcon type={item.type} />
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {time !== undefined && (
                  <span className="tabular text-sm text-ink-3">{formatDayMinutes(time)}</span>
                )}
                {item.contract && (
                  <span className="tabular hidden text-sm text-ink-3 @md:inline">
                    {item.contract.label}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="shrink-0 text-ink-2"
                  onClick={() => startBeforeDay(item.templateId)}
                  aria-label={t("plan.startAria", { title: item.title })}
                >
                  <Play />
                  {t("focus.start")}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {firstRun && (
        <Link
          to="/library"
          className="-ml-2 mt-4 inline-flex h-10 items-center gap-1.5 px-2 text-base font-medium text-ink-2 hover:text-ink"
        >
          {t("start.prepareLibrary")}
          <ArrowRight className="size-4" />
        </Link>
      )}

      <Upcoming className="mt-10" />

      {lastDay && lastSummary && (
        <Link
          to={`/review?day=${lastDay.id}`}
          className="group mt-10 flex items-center gap-4 rounded-lg border border-line bg-panel px-4 py-3.5 shadow-xs transition-colors hover:border-line-strong"
        >
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-2">
              {t("start.lastDay", {
                date: formatDateShort(lastDay.startTime ?? lastDay.createdAt),
              })}
            </p>
            <p className="mt-0.5 text-base text-ink">
              {tp("start.completed", lastSummary.completed)}
              {lastSummary.notCompleted > 0 && (
                <span className="text-ink-2">
                  {" "}
                  · {tp("today.notDone", lastSummary.notCompleted)}
                </span>
              )}
            </p>
          </div>
          <ArrowRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-ink" />
        </Link>
      )}

      {firstRun && (
        <ul className="mt-12 flex flex-col gap-4 border-t border-line pt-6">
          {[
            {
              icon: <Library className="size-4" />,
              title: t("nav.library"),
              body: t("start.step.library"),
            },
            {
              icon: <CalendarCheck2 className="size-4" />,
              title: t("start.step.planTitle"),
              body: t("start.step.plan"),
            },
            {
              icon: <Sparkles className="size-4" />,
              title: t("start.step.closeTitle"),
              body: t("start.step.close"),
            },
          ].map((step) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-hover text-ink-2">
                {step.icon}
              </span>
              <div>
                <p className="text-base font-medium text-ink">{step.title}</p>
                <p className="text-sm text-ink-2">{step.body}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
