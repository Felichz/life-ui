import { useMemo } from "react";
import { Page, PageHeader, SectionTitle } from "../../components/PageHeader";
import { TempoMeter } from "../../components/TempoMeter";
import { planItem, sortBlocks, templateMap } from "../../lib/domain";
import { formatDateLong, formatNumber, minutesOfDay } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { useSystem } from "../../state/system";
import { DayLog } from "./DayLog";
import { FocusPanel } from "./FocusPanel";
import { Plan, planGroups } from "./Plan";
import { StartDay } from "./StartDay";
import { t, tp } from "../../i18n";

export function TodayPage() {
  const { state } = useSystem();
  return state.currentDay ? <Today /> : <StartDay />;
}

function Today() {
  const { state, core } = useSystem();
  const now = useNow(30_000);
  const day = state.currentDay!;
  const nowMinutes = minutesOfDay(now);

  const { groups, active, suggestions, total } = useMemo(() => {
    const templates = templateMap(state);
    const activeId = day.activeActivityInstanceId;
    const items = day.activityInstances
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((instance) => planItem(instance, templates, activeId));
    const blocks = sortBlocks(state.global.timeBlocks);
    const grouped = planGroups(blocks, items, nowMinutes);
    const startable = grouped
      .filter((group) => group.status === "now" || group.status === "always")
      .sort((a, b) => Number(a.status === "always") - Number(b.status === "always"))
      .flatMap((group) => group.items.filter((item) => !item.isActive));
    return {
      groups: grouped,
      active: items.find((item) => item.isActive) ?? null,
      suggestions: startable.slice(0, 3),
      total: items.length,
    };
  }, [day, state, nowMinutes]);

  const summary = core.getTempoSummary(day.day.id);

  const tempo = (
    <section aria-label={t("today.temposLabel")} className="flex flex-col gap-3">
      <TempoMeter summary={summary} />
      {summary.completedActivities > 0 && (
        <p className="text-sm text-ink-2">
          {tp("start.completed", summary.completedActivities)} · {t("today.avgSatisfaction")}{" "}
          <span className="tabular font-medium text-ink">
            {formatNumber(summary.averageSatisfaction, 1)}
          </span>
        </p>
      )}
    </section>
  );

  const log = (
    <section aria-labelledby="log-title">
      <SectionTitle>
        <span id="log-title">{t("today.log")}</span>
      </SectionTitle>
      <DayLog state={state} dayId={day.day.id} now={now} />
    </section>
  );

  return (
    <Page>
      {/* Read-only: every change goes through the chat (ADR-002) */}
      <PageHeader title={t("nav.today")} subtitle={formatDateLong(now)} />

      <div className="mt-6 grid grid-cols-1 gap-8 2xl:grid-cols-[minmax(0,1fr)_320px] 2xl:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="2xl:hidden">{tempo}</div>
          <FocusPanel active={active} suggestions={suggestions} />
          <Plan groups={groups} total={total} nowMinutes={nowMinutes} />
          <div className="2xl:hidden">{log}</div>
        </div>
        <aside className="hidden flex-col gap-8 2xl:flex">
          {tempo}
          {log}
        </aside>
      </div>
    </Page>
  );
}
