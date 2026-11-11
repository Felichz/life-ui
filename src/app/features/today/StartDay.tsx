import { Link } from "react-router-dom";
import { ArrowRight, CalendarCheck2, Library, Sparkles } from "lucide-react";
import { TypeIcon } from "../../components/TypeIcon";
import { daysNewestFirst, planItem, templateMap } from "../../lib/domain";
import { formatDateLong, formatDateShort, formatNumber, greeting } from "../../lib/format";
import { useSystem } from "../../state/system";
import { APP_NAME, t, tp } from "../../i18n";
import { Upcoming } from "./Upcoming";

/** Screen with no day in progress: the day starts from the chat. */
export function StartDay() {
  const { state, core } = useSystem();
  const today = new Date();
  const lastDay = daysNewestFirst(state).find((day) => day.state === "inactive");
  const lastSummary = lastDay ? core.getTempoSummary(lastDay.id) : null;
  const pending = state.global.pendingActivityInstances ?? [];
  const templates = templateMap(state);
  const firstRun = state.global.days.length === 0;

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col px-5 pb-16 pt-[9vh] sm:pt-[14vh]">
      <h1 className="text-4xl font-semibold text-ink">{greeting(today)}</h1>
      <p className="mt-1.5 text-md text-ink-2">{formatDateLong(today)}</p>
      <p className="mt-5 max-w-md text-md text-ink-2">
        {firstRun ? t("start.intro", { app: APP_NAME }) : t("start.back")}
      </p>

      {pending.length > 0 && (
        <div className="mt-7 rounded-lg border border-line bg-panel shadow-xs">
          <p className="border-b border-line px-4 py-2.5 text-sm font-medium text-ink">
            {tp("start.pending", pending.length)}
          </p>
          <ul className="px-1.5 py-1">
            {pending.slice(0, 4).map((instance) => {
              const item = planItem(instance, templates);
              return (
                <li
                  key={instance.id}
                  className="flex h-9 items-center gap-2.5 px-2.5 text-base text-ink"
                >
                  <TypeIcon type={item.type} />
                  <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  {item.contract && (
                    <span className="tabular text-sm text-ink-3">{item.contract.label}</span>
                  )}
                </li>
              );
            })}
            {pending.length > 4 && (
              <li className="px-2.5 pb-1.5 text-sm text-ink-3">
                {t("start.andMore", { count: pending.length - 4 })}
              </li>
            )}
          </ul>
        </div>
      )}

      {/* What to say, shown the way it will look once said */}
      <div className="mt-8 flex flex-col items-start gap-2.5">
        <p className="text-base text-ink-2">{t("start.chatLead")}</p>
        <p className="rounded-lg rounded-br-sm bg-hover px-3 py-2 text-base text-ink">
          {t("agent.suggest.start")}
        </p>
        {firstRun && (
          <Link
            to="/library"
            className="inline-flex h-10 items-center gap-1.5 px-2 text-base font-medium text-ink-2 hover:text-ink"
          >
            {t("start.prepareLibrary")}
            <ArrowRight className="size-4" />
          </Link>
        )}
      </div>

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
              <span className="tabular font-semibold text-tempo-ink">
                {t("endDay.tempos", { count: formatNumber(lastSummary.totalTempos) })}
              </span>
              <span className="text-ink-2">
                {" "}
                ·{" "}
                {t("start.lastDayDetail", {
                  percent: lastSummary.displayPercent,
                  completed: tp("start.completed", lastSummary.completedActivities),
                })}
              </span>
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
    </div>
  );
}
