import type { AppState, CompletedActivityRecord, EventInstance, UUID } from "../../../types";
import { DayStrip, type StripEvent, type StripSegment } from "../../components/DayStrip";
import { TypeIcon } from "../../components/TypeIcon";
import { recordContract } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatMinutes, formatTime, minutesOfDay } from "../../lib/format";
import { getLocale, t } from "../../i18n";

/** Ancho fijo de la columna de hora: "9:40" en español, "11:15 AM" en inglés. */
const timeColumn = () => (getLocale() === "en" ? "w-[62px]" : "w-11");

type Entry =
  | { kind: "record"; at: string; record: CompletedActivityRecord }
  | { kind: "event"; at: string; event: EventInstance };

export function buildStrip(state: AppState, dayId: UUID, now?: Date) {
  const records = state.global.completedActivityRecords.filter((record) => record.dayId === dayId);
  const segments: StripSegment[] = records.map((record) => ({
    id: record.id,
    start: minutesOfDay(new Date(record.startTime)),
    end: minutesOfDay(new Date(record.endTime)),
    type: record.type,
    title: record.templateTitle,
    interrupted: record.state === "interrupted",
  }));
  const current = state.currentDay;
  if (now && current?.day.id === dayId && current.activeActivityInstanceId) {
    const active = current.activityInstances.find(
      (item) => item.id === current.activeActivityInstanceId
    );
    const template =
      active && state.global.activityTemplates.find((item) => item.id === active.templateId);
    if (active?.startTime && template) {
      segments.push({
        id: active.id,
        start: minutesOfDay(new Date(active.startTime)),
        end: minutesOfDay(now),
        type: template.type,
        title: template.title,
        running: true,
      });
    }
  }
  const events: StripEvent[] = state.global.eventInstances
    .filter((event) => event.dayId === dayId)
    .map((event) => ({
      id: event.id,
      minute: minutesOfDay(new Date(event.timestamp)),
      name: event.templateName,
    }));
  return { segments, events, records };
}

/** Lo que ya pasó hoy: la tira del día y el registro, lo más reciente arriba. */
export function DayLog({ state, dayId, now }: { state: AppState; dayId: UUID; now: Date }) {
  const { segments, events, records } = buildStrip(state, dayId, now);
  const entries: Entry[] = [
    ...records.map((record) => ({ kind: "record" as const, at: record.startTime, record })),
    ...state.global.eventInstances
      .filter((event) => event.dayId === dayId)
      .map((event) => ({ kind: "event" as const, at: event.timestamp, event })),
  ].sort((a, b) => b.at.localeCompare(a.at));

  return (
    <div className="flex flex-col gap-3">
      <DayStrip
        segments={segments}
        events={events}
        blocks={state.global.timeBlocks}
        nowMinute={minutesOfDay(now)}
      />
      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">
          {t("log.empty")}
        </p>
      ) : (
        <ol className="flex flex-col">
          {entries.map((entry) =>
            entry.kind === "record" ? (
              <RecordEntry key={entry.record.id} record={entry.record} />
            ) : (
              <li
                key={entry.event.id}
                className="flex items-center gap-3 border-b border-line py-2 last:border-b-0"
              >
                <span
                  className={cn(
                    "tabular shrink-0 whitespace-nowrap text-sm text-ink-3",
                    timeColumn()
                  )}
                >
                  {formatTime(entry.event.timestamp)}
                </span>
                <span aria-hidden className="ml-1.5 mr-1 size-2 shrink-0 rotate-45 bg-event" />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {entry.event.templateName}
                </span>
                <span className="text-xs text-ink-3">{t("log.event")}</span>
              </li>
            )
          )}
        </ol>
      )}
    </div>
  );
}

function RecordEntry({ record }: { record: CompletedActivityRecord }) {
  const interrupted = record.state === "interrupted";
  const contract = recordContract(record);
  return (
    <li className="flex items-start gap-3 border-b border-line py-2.5 last:border-b-0">
      <span
        className={cn("tabular shrink-0 whitespace-nowrap pt-px text-sm text-ink-3", timeColumn())}
      >
        {formatTime(record.startTime)}
      </span>
      <TypeIcon type={record.type} className="mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-sm font-medium", interrupted ? "text-ink-2" : "text-ink")}>
          {record.templateTitle}
        </p>
        <p className="tabular text-xs text-ink-3">
          {formatMinutes(record.durationMinutes)}
          {contract && ` · ${contract.label}`}
          {!interrupted &&
            record.satisfactionScore !== undefined &&
            ` · ${record.satisfactionScore}/10`}
        </p>
      </div>
      {interrupted ? (
        <span className="shrink-0 pt-px text-xs text-ink-3">{t("log.notFinished")}</span>
      ) : (
        <span className="tabular shrink-0 rounded bg-tempo/15 px-1.5 py-0.5 text-xs font-semibold text-tempo-ink">
          +{record.temposAwarded ?? 0}
        </span>
      )}
    </li>
  );
}
