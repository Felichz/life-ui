import type { AppState, UUID } from "../../../types";
import type { StripEvent, StripSegment } from "../../components/DayStrip";
import { minutesOfDay } from "../../lib/format";

/** A day as the day strip draws it: what was done, what is running, the events. */
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
