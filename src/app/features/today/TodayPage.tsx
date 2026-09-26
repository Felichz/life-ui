import { useMemo, useState } from "react";
import { Clock3, MoonStar, MoreHorizontal, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, IconButton } from "../../components/ui/Button";
import { Kbd } from "../../components/ui/Kbd";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "../../components/ui/Menu";
import { Tooltip } from "../../components/ui/Tooltip";
import { Page, PageHeader, SectionTitle } from "../../components/PageHeader";
import { TempoMeter } from "../../components/TempoMeter";
import { planItem, sortBlocks, templateMap } from "../../lib/domain";
import { formatDateLong, formatNumber, minutesOfDay } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { useSystem } from "../../state/system";
import { useShell } from "../../shell/ShellContext";
import { DayLog } from "./DayLog";
import { EndDayDialog } from "./EndDayDialog";
import { EventButton } from "./EventButton";
import { FocusPanel } from "./FocusPanel";
import { Plan, planGroups } from "./Plan";
import { QuickStart } from "./QuickStart";
import { StartDay } from "./StartDay";

export function TodayPage() {
  const { state } = useSystem();
  return state.currentDay ? <Today /> : <StartDay />;
}

function Today() {
  const { state, core } = useSystem();
  const { openAddActivity } = useShell();
  const navigate = useNavigate();
  const now = useNow(30_000);
  const [endingDay, setEndingDay] = useState(false);
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
  const pinned = state.global.activityTemplates.filter((template) => template.pinned);

  const tempo = (
    <section aria-label="Tempos de hoy" className="flex flex-col gap-3">
      <TempoMeter summary={summary} />
      {summary.completedActivities > 0 && (
        <p className="text-sm text-ink-2">
          {summary.completedActivities === 1
            ? "1 completada"
            : `${summary.completedActivities} completadas`}{" "}
          · satisfacción media{" "}
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
        <span id="log-title">Registro</span>
      </SectionTitle>
      <DayLog state={state} dayId={day.day.id} now={now} />
    </section>
  );

  return (
    <Page>
      <PageHeader
        title="Hoy"
        subtitle={formatDateLong(now)}
        actions={
          <>
            <EventButton />
            <Tooltip content="Añadir actividad" shortcut={["N"]}>
              <Button
                variant="primary"
                onClick={() => openAddActivity()}
                data-testid="add-activity"
              >
                <Plus />
                <span className="hidden sm:inline">Añadir</span>
                <Kbd tone="inverse" className="ml-0.5 hidden bg-white/20 text-white lg:inline-flex">
                  N
                </Kbd>
              </Button>
            </Tooltip>
            <Menu>
              <MenuTrigger asChild>
                <IconButton label="Más opciones del día" variant="secondary">
                  <MoreHorizontal />
                </IconButton>
              </MenuTrigger>
              <MenuContent>
                <MenuItem icon={<Clock3 />} onSelect={() => navigate("/biblioteca?tab=bloques")}>
                  Editar bloques horarios
                </MenuItem>
                <MenuSeparator />
                <MenuItem icon={<MoonStar />} onSelect={() => setEndingDay(true)}>
                  Terminar el día
                </MenuItem>
              </MenuContent>
            </Menu>
          </>
        }
      />

      <div className="mt-6 grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_320px] xl:gap-10">
        <div className="flex min-w-0 flex-col gap-8">
          <div className="xl:hidden">{tempo}</div>
          <FocusPanel active={active} suggestions={suggestions} />
          <QuickStart
            templates={pinned}
            hasLibrary={state.global.activityTemplates.length > 0}
            runningTemplateId={active?.instance.templateId}
          />
          <Plan groups={groups} total={total} />
          <div className="xl:hidden">{log}</div>
        </div>
        <aside className="hidden flex-col gap-8 xl:flex">
          {tempo}
          {log}
        </aside>
      </div>

      <EndDayDialog open={endingDay} onOpenChange={setEndingDay} />
    </Page>
  );
}
