import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BarChart3, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import type { ActivityType, AppState, Day } from "../../../types";
import { DayStrip } from "../../components/DayStrip";
import { Page, PageHeader, SectionTitle } from "../../components/PageHeader";
import { TempoMeter } from "../../components/TempoMeter";
import { TypeIcon } from "../../components/TypeIcon";
import { Button, IconButton } from "../../components/ui/Button";
import { Menu, MenuCheckItem, MenuContent, MenuTrigger } from "../../components/ui/Menu";
import {
  TYPE_META,
  dayStart,
  daysNewestFirst,
  recordContract,
  withinContract,
} from "../../lib/domain";
import { cn } from "../../lib/cn";
import {
  formatDateLong,
  formatDateShort,
  formatMinutes,
  formatNumber,
  formatTime,
  isSameLocalDay,
  minutesOfDay,
} from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { useSystem } from "../../state/system";
import { buildStrip } from "../today/DayLog";
import { TrendChart } from "./TrendChart";

function dayLabel(day: Day, now: Date): string {
  const start = new Date(dayStart(day));
  if (day.state === "active") return "Hoy";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameLocalDay(start, yesterday)) return "Ayer";
  if (isSameLocalDay(start, now)) return "Hoy";
  return formatDateLong(start);
}

export function ReviewPage() {
  const { state } = useSystem();
  const [params, setParams] = useSearchParams();
  const now = useNow(60_000);
  const days = daysNewestFirst(state);
  const selectedId = params.get("dia");
  const selectedIndex = Math.max(
    0,
    days.findIndex((day) => day.id === selectedId)
  );
  const day = days[selectedIndex];

  if (!day) {
    return (
      <Page width="narrow">
        <PageHeader title="Resumen" />
        <div className="mt-8 rounded-xl border border-line bg-panel px-6 py-10 text-center shadow-xs">
          <BarChart3 className="mx-auto size-6 text-ink-3" />
          <p className="mt-3 text-base font-medium text-ink">Todavía no hay días registrados</p>
          <p className="mx-auto mt-1 max-w-sm text-sm text-ink-2">
            Cuando empieces y cierres actividades, aquí verás tus tempos, tu satisfacción y cómo fue
            cada día.
          </p>
          <Link to="/" className="mt-5 inline-block">
            <Button variant="primary">Ir a Hoy</Button>
          </Link>
        </div>
      </Page>
    );
  }

  const select = (id: string) => setParams({ dia: id }, { replace: true });
  const older = days[selectedIndex + 1];
  const newer = days[selectedIndex - 1];

  return (
    <Page width="narrow">
      <PageHeader
        title="Resumen"
        subtitle="Mirar para ajustar, no para juzgarte."
        wrap
        actions={
          <div className="flex items-center gap-1">
            <IconButton
              label="Día anterior"
              variant="secondary"
              disabled={!older}
              onClick={() => older && select(older.id)}
            >
              <ChevronLeft />
            </IconButton>
            <Menu>
              <MenuTrigger asChild>
                <Button variant="secondary" className="min-w-[150px] justify-between">
                  <span className="truncate">{dayLabel(day, now)}</span>
                  <ChevronDown className="text-ink-3" />
                </Button>
              </MenuTrigger>
              <MenuContent className="max-h-80 overflow-y-auto">
                {days.map((item) => (
                  <MenuCheckItem
                    key={item.id}
                    checked={item.id === day.id}
                    onSelect={() => select(item.id)}
                  >
                    {item.state === "active" ? "Hoy (en curso)" : formatDateShort(dayStart(item))}
                  </MenuCheckItem>
                ))}
              </MenuContent>
            </Menu>
            <IconButton
              label="Día siguiente"
              variant="secondary"
              disabled={!newer}
              onClick={() => newer && select(newer.id)}
            >
              <ChevronRight />
            </IconButton>
          </div>
        }
      />
      <DayReview key={day.id} state={state} day={day} now={now} />
      <section aria-labelledby="trend-title" className="mt-12">
        <SectionTitle>
          <span id="trend-title">Últimos días</span>
        </SectionTitle>
        <TrendChart days={days.slice(0, 14).reverse()} selectedId={day.id} onSelect={select} />
      </section>
    </Page>
  );
}

function DayReview({ state, day, now }: { state: AppState; day: Day; now: Date }) {
  const { core } = useSystem();
  const summary = core.getTempoSummary(day.id);
  const isLive = day.state === "active";
  const { segments, events, records } = buildStrip(state, day.id, isLive ? now : undefined);
  const interrupted = records.filter((record) => record.state === "interrupted").length;
  const trackedMinutes = records.reduce((sum, record) => sum + record.durationMinutes, 0);

  const byType = useMemo(() => {
    const totals: Record<ActivityType, number> = {
      "clear-objective": 0,
      "flexible-duration": 0,
      timeboxing: 0,
    };
    for (const record of records) totals[record.type] += record.durationMinutes;
    return totals;
  }, [records]);

  return (
    <div className="mt-6 flex flex-col gap-10">
      <section aria-label="Tempos del día" className="flex flex-col gap-3">
        <TempoMeter summary={summary} label={isLive ? "tempos hoy" : "tempos"} />
        <p className="text-sm text-ink-2">
          {summary.completedActivities > 0 ? (
            <>
              {summary.completedActivities === 1
                ? "1 completada"
                : `${summary.completedActivities} completadas`}{" "}
              · satisfacción media{" "}
              <span className="tabular font-medium text-ink">
                {formatNumber(summary.averageSatisfaction, 1)}
              </span>
            </>
          ) : (
            "Sin actividades completadas este día."
          )}
        </p>
      </section>

      <section aria-labelledby="journey-title">
        <SectionTitle meta={interrupted > 0 ? `${interrupted} sin terminar` : undefined}>
          <span id="journey-title">Cómo fue el día</span>
        </SectionTitle>
        <DayStrip
          segments={segments}
          events={events}
          blocks={state.global.timeBlocks}
          nowMinute={isLive ? minutesOfDay(now) : undefined}
          size="large"
        />
        {trackedMinutes > 0 && <TypeSplit totals={byType} total={trackedMinutes} />}
      </section>

      <section aria-labelledby="records-title">
        <SectionTitle meta={records.length || undefined}>
          <span id="records-title">Actividades</span>
        </SectionTitle>
        {records.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
            {isLive
              ? "Todavía no cerraste ninguna actividad hoy."
              : "Este día no tiene actividades cerradas."}
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
            <table className="w-full text-left text-sm">
              <thead className="hidden border-b border-line bg-subtle text-xs text-ink-2 sm:table-header-group">
                <tr>
                  <th scope="col" className="w-20 px-4 py-2 font-medium">
                    Hora
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Actividad
                  </th>
                  <th scope="col" className="px-2 py-2 font-medium">
                    Real · esperado
                  </th>
                  <th scope="col" className="w-24 px-2 py-2 text-right font-medium">
                    Satisfacción
                  </th>
                  <th scope="col" className="w-24 px-4 py-2 text-right font-medium">
                    Tempos
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const contract = recordContract(record);
                  const within = withinContract(record.durationMinutes, contract);
                  const done = record.state === "completed";
                  return (
                    <tr
                      key={record.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-0.5 border-b border-line px-4 py-2.5 last:border-b-0 sm:table-row sm:px-0 sm:py-0"
                    >
                      <td className="tabular order-1 text-ink-3 sm:px-4 sm:py-2.5">
                        {formatTime(record.startTime)}
                      </td>
                      <td className="order-2 min-w-0 flex-1 sm:px-2 sm:py-2.5">
                        <span className="flex items-center gap-2">
                          <TypeIcon type={record.type} />
                          <span
                            className={cn("truncate font-medium", done ? "text-ink" : "text-ink-2")}
                          >
                            {record.templateTitle}
                          </span>
                          {!done && (
                            <span className="shrink-0 rounded bg-hover px-1.5 py-px text-xs text-ink-2">
                              Sin terminar
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="tabular order-4 w-full pl-[52px] text-ink-2 sm:w-auto sm:px-2 sm:py-2.5">
                        {formatMinutes(record.durationMinutes)}
                        {contract && (
                          <span className="text-ink-3">
                            {" "}
                            · {contract.label}
                            {done && within === true && (
                              <span className="text-success"> · dentro</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="tabular order-3 hidden text-right text-ink-2 sm:table-cell sm:px-2 sm:py-2.5">
                        {done ? `${record.satisfactionScore ?? 0}/10` : "—"}
                      </td>
                      <td className="tabular order-3 text-right sm:px-4 sm:py-2.5">
                        {done ? (
                          <span className="rounded bg-tempo/15 px-1.5 py-0.5 text-xs font-semibold text-tempo-ink">
                            +{record.temposAwarded ?? 0}
                          </span>
                        ) : (
                          <span className="text-ink-3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** Tiempo por tipo de actividad: una barra apilada con etiquetas directas. */
function TypeSplit({ totals, total }: { totals: Record<ActivityType, number>; total: number }) {
  const entries = (Object.keys(totals) as ActivityType[]).filter((type) => totals[type] > 0);
  const sum = entries.reduce((acc, type) => acc + totals[type], 0);
  return (
    <div className="mt-6">
      <p className="mb-2 text-sm font-medium text-ink">
        Tiempo registrado{" "}
        <span className="tabular font-normal text-ink-2">· {formatMinutes(total)}</span>
      </p>
      <div
        className="flex h-2.5 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={entries
          .map((type) => `${TYPE_META[type].label}: ${formatMinutes(totals[type])}`)
          .join(", ")}
      >
        {entries.map((type) => (
          <div
            key={type}
            className={cn("h-full first:rounded-l-full last:rounded-r-full", TYPE_META[type].bg)}
            style={{ width: `${(totals[type] / sum) * 100}%` }}
          />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
        {entries.map((type) => (
          <li key={type} className="flex items-center gap-1.5 text-ink-2">
            <span className={cn("size-2 rounded-full", TYPE_META[type].bg)} aria-hidden />
            {TYPE_META[type].label}
            <span className="tabular font-medium text-ink">{formatMinutes(totals[type])}</span>
            <span className="tabular text-ink-3">{Math.round((totals[type] / sum) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
