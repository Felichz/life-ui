import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type { ActivityInstance, DayMinutes, PlannedActivity, UUID } from "../types";
import { CoreError } from "./errors";

/** "2026-11-12": a calendar day where the person is, not in UTC. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
/** Planned items kept at once: two months of three a day, with room to spare. */
const MAX_PLANNED = 400;

/**
 * Activities planned for days ahead (ADR-008). They wait here, outside any
 * day, and join the plan of the day when their date comes: at the start of
 * that day, or at once when the day is already running.
 *
 * A date is a plan, not a debt: an item whose date went by without a day
 * being started comes along with the next day, without its time.
 */
export class AgendaManager {
  constructor(private systemCore: SystemCore) {}

  public getPlannedActivities(): PlannedActivity[] {
    return [...(this.systemCore.getState().global.plannedActivities ?? [])].sort(
      (a, b) => a.date.localeCompare(b.date) || (a.time ?? 1440) - (b.time ?? 1440)
    );
  }

  /**
   * Plans one library activity on each of the dates. The dates of one call
   * share a series, so they can be cancelled together.
   */
  public planActivity(
    templateId: UUID,
    dates: string[],
    options: { time?: DayMinutes; notes?: string } = {}
  ): PlannedActivity[] {
    const state = this.systemCore.getState();
    if (!state.global.activityTemplates.some((template) => template.id === templateId)) {
      throw new CoreError("activity-template-not-found", `id ${templateId}`);
    }
    if (dates.length === 0) throw new CoreError("invalid-date", "no dates given");
    for (const date of dates) {
      if (!DATE.test(date) || Number.isNaN(new Date(`${date}T12:00:00`).getTime())) {
        throw new CoreError("invalid-date", date);
      }
    }
    const { time } = options;
    if (time !== undefined && (!Number.isInteger(time) || time < 0 || time > 1439)) {
      throw new CoreError("minutes-out-of-range");
    }
    const existing = state.global.plannedActivities ?? [];
    if (existing.length + dates.length > MAX_PLANNED) {
      throw new CoreError("too-many-planned", `limit ${MAX_PLANNED}`);
    }

    const notes = options.notes?.trim().slice(0, 4000) || undefined;
    const seriesId = dates.length > 1 ? UtilityService.generateUUID() : undefined;
    const createdAt = UtilityService.getCurrentISODateTime();
    const planned: PlannedActivity[] = [...new Set(dates)].sort().map((date) => ({
      id: UtilityService.generateUUID(),
      templateId,
      date,
      ...(time !== undefined ? { time } : {}),
      ...(notes ? { notes } : {}),
      ...(seriesId ? { seriesId } : {}),
      createdAt,
    }));

    this.systemCore.updateState((current) => {
      current.global.plannedActivities = [...(current.global.plannedActivities ?? []), ...planned];
      return current;
    });
    // Something planned for a day that is already running belongs to its plan now
    this.bringDue();
    return planned;
  }

  /**
   * The sessions a roadmap plans for itself (ADR-011): whatever it had planned
   * is replaced by these, in one go. Nothing is touched when they are already
   * the same, so calling it again and again changes nothing.
   */
  public replaceRoadmapSessions(
    roadmapId: UUID,
    sessions: Array<{
      templateId: UUID;
      stepId: UUID;
      date: string;
      time?: DayMinutes;
      notes?: string;
      minutes?: number;
    }>
  ): void {
    const all = this.systemCore.getState().global.plannedActivities ?? [];
    const mine = all.filter((item) => item.roadmap?.id === roadmapId);
    const others = all.filter((item) => item.roadmap?.id !== roadmapId);
    const key = (item: {
      templateId: UUID;
      date: string;
      time?: DayMinutes;
      notes?: string;
      minutes?: number;
      stepId: UUID;
    }) =>
      [
        item.stepId,
        item.templateId,
        item.date,
        item.time ?? "",
        item.minutes ?? "",
        item.notes ?? "",
      ].join("|");
    const wanted = sessions.map(key).sort();
    const current = mine.map((item) => key({ ...item, stepId: item.roadmap!.stepId })).sort();
    if (wanted.length === current.length && wanted.every((one, i) => one === current[i])) return;
    if (others.length + sessions.length > MAX_PLANNED) {
      throw new CoreError("too-many-planned", `limit ${MAX_PLANNED}`);
    }
    const createdAt = UtilityService.getCurrentISODateTime();
    const planned: PlannedActivity[] = sessions.map((session) => ({
      id: UtilityService.generateUUID(),
      templateId: session.templateId,
      date: session.date,
      ...(session.time !== undefined ? { time: session.time } : {}),
      ...(session.notes ? { notes: session.notes } : {}),
      ...(session.minutes ? { minutes: session.minutes } : {}),
      roadmap: { id: roadmapId, stepId: session.stepId },
      createdAt,
    }));
    this.systemCore.updateState((state) => {
      state.global.plannedActivities = [...others, ...planned];
      return state;
    });
  }

  /** Removes planned items by id. Returns how many were removed. */
  public cancelPlannedActivities(ids: UUID[]): number {
    const wanted = new Set(ids);
    let removed = 0;
    this.systemCore.updateState((state) => {
      const before = state.global.plannedActivities ?? [];
      state.global.plannedActivities = before.filter((item) => !wanted.has(item.id));
      removed = before.length - state.global.plannedActivities.length;
      return state;
    });
    return removed;
  }

  /** A library activity that goes away takes its planned days with it. */
  public forgetTemplate(templateId: UUID): void {
    this.systemCore.updateState((state) => {
      if (state.global.plannedActivities) {
        state.global.plannedActivities = state.global.plannedActivities.filter(
          (item) => item.templateId !== templateId
        );
      }
      return state;
    });
  }

  /**
   * Moves what is due into the running day's plan: items dated today keep
   * their time, items from days that went by come without it. Does nothing
   * when no day is running.
   */
  public bringDue(now = new Date()): ActivityInstance[] {
    const state = this.systemCore.getState();
    if (!state.currentDay) return [];
    const today = localDate(now);
    const due = (state.global.plannedActivities ?? []).filter((item) => item.date <= today);
    if (due.length === 0) return [];

    const todo = state.global.timeBlocks.find((block) => block.isDefault);
    const known = new Map(
      state.global.activityTemplates.map((template) => [template.id, template])
    );
    const brought: ActivityInstance[] = [];
    for (const item of due) {
      const template = known.get(item.templateId);
      if (!todo || !template) continue;
      // A session planned longer or shorter than usual keeps that length today
      let instance = this.systemCore.createActivityInstance(
        item.templateId,
        todo.id,
        item.minutes && template.type === "clear-objective"
          ? { clearObjectiveSettings: { estimatedDurationMinutes: item.minutes } }
          : undefined
      );
      if (item.notes) {
        instance = this.systemCore.updateActivityInstance(instance.id, { notes: item.notes });
      }
      if (item.date === today && item.time !== undefined) {
        instance = this.systemCore.scheduleActivityInstance(instance.id, item.time);
      }
      brought.push(instance);
    }
    this.cancelPlannedActivities(due.map((item) => item.id));
    return brought;
  }
}
