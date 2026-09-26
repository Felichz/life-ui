import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarCheck2, Library, Sparkles } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Kbd } from "../../components/ui/Kbd";
import { TypeIcon } from "../../components/TypeIcon";
import { daysNewestFirst, planItem, templateMap } from "../../lib/domain";
import { formatDateLong, formatDateShort, formatNumber, greeting } from "../../lib/format";
import { useHotkey } from "../../lib/useHotkey";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { APP_NAME, t, tp } from "../../i18n";

/** Pantalla sin día en curso: una sola decisión, empezar. */
export function StartDay() {
  const { state, core } = useSystem();
  const toast = useToast();
  const navigate = useNavigate();
  const today = new Date();
  const lastDay = daysNewestFirst(state).find((day) => day.state === "inactive");
  const lastSummary = lastDay ? core.getTempoSummary(lastDay.id) : null;
  const pending = state.global.pendingActivityInstances ?? [];
  const templates = templateMap(state);
  const firstRun = state.global.days.length === 0;

  const start = () => {
    try {
      core.startDay();
      navigate("/");
    } catch (caught) {
      toast({
        tone: "error",
        title: t("error.startDay"),
        description: errorMessage(caught),
      });
    }
  };

  useHotkey("Enter", start);

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col px-5 pb-16 pt-[9vh] sm:pt-[14vh]">
      <p className="text-base text-ink-2">{formatDateLong(today)}</p>
      <h1 className="mt-1 text-4xl font-semibold text-ink">{greeting(today)}</h1>
      <p className="mt-3 max-w-md text-md text-ink-2">
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

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="lg"
          onClick={start}
          className="min-w-[180px]"
          data-testid="start-day"
        >
          {t("start.cta")}
          <Kbd tone="inverse" className="ml-1 hidden bg-white/20 text-white sm:inline-flex">
            ↵
          </Kbd>
        </Button>
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
