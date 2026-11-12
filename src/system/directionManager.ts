import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type {
  ActivityInstance,
  ActivityTemplate,
  CompletedActivityRecord,
  IdealLife,
  PlannedActivity,
  Roadmap,
  RoadmapInput,
  RoadmapMilestone,
  RoadmapProgress,
  RoadmapSchedule,
  RoadmapSessions,
  RoadmapStep,
  StepProgress,
  UUID,
} from "../types";
import { CoreError } from "./errors";
import { localDate } from "./agendaManager";

/** The ideal life is a page or two, not a book: enough to always travel with the agent. */
const MAX_IDEAL_LIFE = 20_000;
const MAX_ROADMAPS = 20;

export type { RoadmapInput };

/** Sessions one roadmap may keep planned at once. */
const MAX_SESSIONS = 200;

/** How long one session of an activity lasts, to turn a total of minutes into sessions. */
export function sessionMinutes(template: ActivityTemplate | undefined): number {
  return (
    template?.clearObjectiveSettings?.estimatedDurationMinutes ??
    template?.flexibleDurationSettings?.maximumDurationMinutes ??
    template?.timeboxingSettings?.maximumDurationMinutes ??
    template?.timeboxingSettings?.minimumDurationMinutes ??
    30
  );
}

/** The next `count` dates that fall on those weekdays, from a date on (itself included). */
export function sessionDates(weekdays: number[], from: string, count: number): string[] {
  const dates: string[] = [];
  const day = new Date(`${from}T12:00:00`);
  for (let guard = 0; dates.length < count && guard < 3700; guard++) {
    if (weekdays.includes(day.getDay())) dates.push(localDate(day));
    day.setDate(day.getDate() + 1);
  }
  return dates;
}

/** The calendar day after a date. */
export const dayAfter = (date: string) => {
  const day = new Date(`${date}T12:00:00`);
  day.setDate(day.getDate() + 1);
  return localDate(day);
};

/** What a planned session says: what this phase's session consists of, then what always holds. */
export function sessionNotes(step: RoadmapStep, roadmap: Roadmap): string | undefined {
  return [step.notes, roadmap.rules].filter(Boolean).join("\n\n") || undefined;
}

export interface LaidOutSession {
  templateId: UUID;
  stepId: UUID;
  date: string;
  time?: number;
  notes?: string;
  minutes?: number;
}

/**
 * The sessions a roadmap still has ahead, laid on its days (ADR-011).
 *
 * - Milestones follow one another: the sessions of one start after the last
 *   session of the one before.
 * - What was closed is not planned again. A session that waits (in today's
 *   plan, or planned for a day that has come and not brought in yet) is one
 *   of those left, and stays as it is.
 * - A day holds one session of a step: after one was done, dropped or brought
 *   in today, the next is on a later day. Only a roadmap that was just saved
 *   (`fresh`) may put its first session on today itself.
 */
export function layOutSessions(
  progress: RoadmapProgress,
  schedule: RoadmapSchedule,
  templates: Map<UUID, ActivityTemplate>,
  now: Date,
  state: {
    /** Today's plan. */
    today: ActivityInstance[];
    /** What this roadmap has planned now. */
    planned: PlannedActivity[];
    /** Activities closed today. */
    closedToday: Set<UUID>;
    fresh?: boolean;
  }
): LaidOutSession[] {
  const todayDate = localDate(now);
  const tomorrow = dayAfter(todayDate);
  let cursor = schedule.start > todayDate ? schedule.start : todayDate;
  // Planned for a day that has come, and not in a day's plan yet: they wait as they are
  const due = state.planned.filter((item) => item.date <= todayDate);
  const sessions: LaidOutSession[] = [];
  for (const entry of progress.milestones) {
    if (entry.status === "done") continue;
    let last = "";
    for (const step of entry.steps) {
      if (step.complete) continue;
      const templateId = step.step.templateId;
      const left = step.step.amount - step.done;
      const length = step.step.sessionMinutes ?? sessionMinutes(templates.get(templateId));
      const need = step.step.unit === "times" ? left : Math.ceil(left / length);
      const base = {
        templateId,
        stepId: step.step.id,
        ...(schedule.time !== undefined ? { time: schedule.time } : {}),
        ...(sessionNotes(step.step, progress.roadmap)
          ? { notes: sessionNotes(step.step, progress.roadmap) }
          : {}),
        ...(step.step.sessionMinutes ? { minutes: step.step.sessionMinutes } : {}),
      };
      let waiting = 0;
      if (entry.status === "current") {
        waiting = state.today.filter((instance) => instance.templateId === templateId).length;
        for (const item of due.filter((one) => one.templateId === templateId).slice(0, need)) {
          sessions.push({ ...base, date: item.date });
          waiting++;
        }
      }
      const touchedToday = waiting > 0 || state.closedToday.has(templateId) || !state.fresh;
      const from = touchedToday && cursor <= todayDate ? tomorrow : cursor;
      for (const date of sessionDates(schedule.weekdays, from, Math.max(0, need - waiting))) {
        sessions.push({ ...base, date });
        if (date > last) last = date;
      }
      if (waiting > 0 && todayDate > last) last = todayDate;
    }
    if (last) cursor = dayAfter(last);
  }
  return sessions;
}

/**
 * Where the person is going (ADR-010): the ideal life they describe, and the
 * roadmaps that lead there. A roadmap is made only of the person's real
 * activities, so its progress is never declared: it is read from what was
 * actually closed.
 */
export class DirectionManager {
  constructor(private systemCore: SystemCore) {}

  // ---------------------------------------------------------------- ideal life

  public getIdealLife(): IdealLife | null {
    return this.systemCore.getState().global.idealLife ?? null;
  }

  public setIdealLife(text: string): IdealLife {
    const idealLife: IdealLife = {
      text: text.replace(/\r\n/g, "\n").trim().slice(0, MAX_IDEAL_LIFE),
      updatedAt: UtilityService.getCurrentISODateTime(),
    };
    this.systemCore.updateState((state) => {
      state.global.idealLife = idealLife;
      return state;
    });
    return idealLife;
  }

  // ---------------------------------------------------------------- roadmaps

  public getRoadmaps(): Roadmap[] {
    return this.systemCore.getState().global.roadmaps ?? [];
  }

  /**
   * Creates a roadmap, or replaces the one with that id. Every step has to
   * point at an activity of the library and say how much of it: a roadmap
   * that is not anchored to real activities is refused whole.
   */
  public saveRoadmap(input: RoadmapInput): Roadmap {
    const state = this.systemCore.getState();
    const existing = (state.global.roadmaps ?? []).find((roadmap) => roadmap.id === input.id);
    if (input.id && !existing) throw new CoreError("roadmap-not-found", `id ${input.id}`);
    if (!existing && (state.global.roadmaps ?? []).length >= MAX_ROADMAPS) {
      throw new CoreError("roadmap-invalid", `at most ${MAX_ROADMAPS} roadmaps`);
    }

    const title = input.title.trim();
    if (!title) throw new CoreError("roadmap-invalid", "the roadmap needs a title");
    if (input.milestones.length === 0) {
      throw new CoreError("roadmap-invalid", "a roadmap needs at least one milestone");
    }
    if (input.targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate)) {
      throw new CoreError("invalid-date", input.targetDate);
    }
    const schedule = input.schedule === undefined ? existing?.schedule : input.schedule;
    if (schedule) {
      const days = schedule.weekdays;
      if (
        !Array.isArray(days) ||
        days.length === 0 ||
        days.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
      ) {
        throw new CoreError("roadmap-invalid", "the schedule needs weekdays, 0 (Sunday) to 6");
      }
      if (
        schedule.time !== undefined &&
        (!Number.isInteger(schedule.time) || schedule.time < 0 || schedule.time > 1439)
      ) {
        throw new CoreError("minutes-out-of-range");
      }
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(schedule.start) ||
        Number.isNaN(new Date(`${schedule.start}T12:00:00`).getTime())
      ) {
        throw new CoreError("invalid-date", schedule.start);
      }
    }
    const templates = new Map(state.global.activityTemplates.map((t) => [t.id, t]));
    const milestones: RoadmapMilestone[] = input.milestones.map((milestone, index) => {
      const milestoneTitle = milestone.title.trim();
      const where = `milestone ${index + 1}`;
      if (!milestoneTitle) throw new CoreError("roadmap-invalid", `${where} needs a title`);
      if (milestone.steps.length === 0) {
        throw new CoreError("roadmap-invalid", `${where} ("${milestoneTitle}") has no steps`);
      }
      const steps: RoadmapStep[] = milestone.steps.map((step, stepIndex) => {
        const template = templates.get(step.templateId);
        if (!template) {
          throw new CoreError(
            "activity-template-not-found",
            `${where}, step ${stepIndex + 1}: id ${step.templateId}`
          );
        }
        if (!Number.isInteger(step.amount) || step.amount < 1 || step.amount > 100_000) {
          throw new CoreError(
            "roadmap-invalid",
            `${where}, step ${stepIndex + 1}: the amount must be a whole number, 1 or more`
          );
        }
        if (step.unit !== "times" && step.unit !== "minutes") {
          throw new CoreError("roadmap-invalid", `${where}, step ${stepIndex + 1}: unknown unit`);
        }
        return {
          id: UtilityService.generateUUID(),
          title: step.title?.trim() || template.title,
          templateId: template.id,
          unit: step.unit,
          amount: step.amount,
          ...(step.notes?.trim() ? { notes: step.notes.trim().slice(0, 4000) } : {}),
          ...(step.sessionMinutes &&
          Number.isInteger(step.sessionMinutes) &&
          step.sessionMinutes >= 1 &&
          step.sessionMinutes <= 600
            ? { sessionMinutes: step.sessionMinutes }
            : {}),
        };
      });
      return {
        id: UtilityService.generateUUID(),
        title: milestoneTitle,
        ...(milestone.note?.trim() ? { note: milestone.note.trim().slice(0, 500) } : {}),
        steps,
      };
    });

    const now = UtilityService.getCurrentISODateTime();
    const roadmap: Roadmap = {
      id: existing?.id ?? UtilityService.generateUUID(),
      title: title.slice(0, 120),
      ...(input.why?.trim() ? { why: input.why.trim().slice(0, 600) } : {}),
      ...(input.targetDate ? { targetDate: input.targetDate } : {}),
      status: input.status ?? existing?.status ?? "active",
      ...((input.rules ?? existing?.rules)?.trim()
        ? { rules: (input.rules ?? existing?.rules)!.trim().slice(0, 2000) }
        : {}),
      ...(schedule
        ? {
            schedule: {
              weekdays: [...new Set(schedule.weekdays)].sort(),
              ...(schedule.time !== undefined ? { time: schedule.time } : {}),
              start: schedule.start,
            },
          }
        : {}),
      milestones,
      // Progress counts from the day the roadmap was first made, whatever is edited later
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    this.systemCore.updateState((current) => {
      const others = (current.global.roadmaps ?? []).filter((item) => item.id !== roadmap.id);
      current.global.roadmaps = existing
        ? (current.global.roadmaps ?? []).map((item) => (item.id === roadmap.id ? roadmap : item))
        : [...others, roadmap];
      return current;
    });
    // Just saved: its first session may be today's
    this.syncSessions(roadmap.id, new Date(), true);
    return roadmap;
  }

  public deleteRoadmap(id: UUID): void {
    if (!this.getRoadmaps().some((roadmap) => roadmap.id === id)) {
      throw new CoreError("roadmap-not-found", `id ${id}`);
    }
    // Its sessions go with it: they were planned for the roadmap, not asked for one by one
    this.systemCore.agenda.replaceRoadmapSessions(id, []);
    this.systemCore.updateState((state) => {
      state.global.roadmaps = (state.global.roadmaps ?? []).filter((item) => item.id !== id);
      return state;
    });
  }

  /**
   * Keeps a roadmap's remaining sessions planned on its days (ADR-011): after
   * it is saved, and whenever the day's plan is brought up to date. A paused
   * roadmap, or one without a schedule, has nothing planned for it.
   */
  public syncSessions(id?: UUID, now = new Date(), fresh = false): void {
    const state = this.systemCore.getState();
    const templates = new Map(state.global.activityTemplates.map((t) => [t.id, t]));
    const today = state.currentDay?.activityInstances ?? [];
    const todayDate = localDate(now);
    const closedToday = new Set(
      state.global.completedActivityRecords
        .filter((record) => localDate(new Date(record.endTime)) === todayDate)
        .map((record) => record.templateId)
    );
    for (const roadmap of this.getRoadmaps()) {
      if (id && roadmap.id !== id) continue;
      if (!roadmap.schedule || roadmap.status === "paused") {
        this.systemCore.agenda.replaceRoadmapSessions(roadmap.id, []);
        continue;
      }
      const progress = roadmapProgress(
        roadmap,
        state.global.completedActivityRecords,
        state.global.plannedActivities ?? [],
        today
      );
      const sessions = layOutSessions(progress, roadmap.schedule, templates, now, {
        today,
        planned: (state.global.plannedActivities ?? []).filter(
          (item) => item.roadmap?.id === roadmap.id
        ),
        closedToday,
        fresh: fresh && roadmap.id === id,
      });
      if (sessions.length > MAX_SESSIONS) {
        throw new CoreError(
          "too-many-planned",
          `a roadmap plans at most ${MAX_SESSIONS} sessions, this one needs ${sessions.length}`
        );
      }
      this.systemCore.agenda.replaceRoadmapSessions(roadmap.id, sessions);
    }
    // A session that falls today belongs to today's plan from now on
    this.systemCore.agenda.bringDue(now);
  }

  /** Where each milestone's planned sessions fall. */
  public getRoadmapSessions(id: UUID): RoadmapSessions[] {
    const roadmap = this.getRoadmaps().find((item) => item.id === id);
    if (!roadmap) throw new CoreError("roadmap-not-found", `id ${id}`);
    const planned = (this.systemCore.getState().global.plannedActivities ?? []).filter(
      (item) => item.roadmap?.id === id
    );
    return roadmap.milestones.map((milestone) => {
      const steps = new Set(milestone.steps.map((step) => step.id));
      const dates = planned
        .filter((item) => steps.has(item.roadmap!.stepId))
        .map((item) => item.date)
        .sort();
      return {
        milestone: milestone.title,
        sessions: dates.length,
        ...(dates.length > 0 ? { first: dates[0], last: dates[dates.length - 1] } : {}),
      };
    });
  }

  /** An activity a roadmap is built on cannot leave the library from under it. */
  public assertTemplateFree(templateId: UUID): void {
    const holder = this.getRoadmaps().find((roadmap) =>
      roadmap.milestones.some((m) => m.steps.some((step) => step.templateId === templateId))
    );
    if (holder) throw new CoreError("activity-in-roadmap", `roadmap "${holder.title}"`);
  }

  public getRoadmapProgress(): RoadmapProgress[] {
    const state = this.systemCore.getState();
    return this.getRoadmaps().map((roadmap) =>
      roadmapProgress(
        roadmap,
        state.global.completedActivityRecords,
        state.global.plannedActivities ?? [],
        state.currentDay?.activityInstances ?? []
      )
    );
  }
}

/**
 * Where a roadmap stands, from what was really closed. Milestones are walked
 * in order: a step counts the closes of its activity since the milestone
 * before it was reached, so the same activity can be a step of two milestones
 * without being counted twice. Milestones not reached yet count nothing.
 */
export function roadmapProgress(
  roadmap: Roadmap,
  records: CompletedActivityRecord[],
  planned: PlannedActivity[],
  today: ActivityInstance[]
): RoadmapProgress {
  const closes = records
    .filter((record) => record.state === "completed")
    .sort((a, b) => a.endTime.localeCompare(b.endTime));
  let cursor = roadmap.createdAt;
  let reachedAll = true;
  let currentIndex: number | undefined;

  const milestones = roadmap.milestones.map((milestone, index) => {
    const open = reachedAll;
    let reachedAt = cursor;
    const steps: StepProgress[] = milestone.steps.map((step) => {
      // Sessions a roadmap planned belong to their step; anything else planned
      // for that activity is counted by the activity alone
      const ahead = planned
        .filter((item) =>
          item.roadmap ? item.roadmap.stepId === step.id : item.templateId === step.templateId
        )
        .sort((a, b) => a.date.localeCompare(b.date));
      const base = {
        step,
        plannedAhead: ahead.length,
        ...(ahead[0]
          ? {
              next: {
                date: ahead[0].date,
                ...(ahead[0].time !== undefined ? { time: ahead[0].time } : {}),
              },
            }
          : {}),
        inPlanToday: today.some((instance) => instance.templateId === step.templateId),
      };
      if (!open) return { ...base, done: 0, complete: false, fraction: 0 };
      let done = 0;
      let completeAt: string | undefined;
      for (const record of closes) {
        if (record.templateId !== step.templateId || record.endTime <= cursor) continue;
        done += step.unit === "times" ? 1 : record.durationMinutes;
        if (done >= step.amount) {
          completeAt = record.endTime;
          break;
        }
      }
      if (completeAt && completeAt > reachedAt) reachedAt = completeAt;
      return {
        ...base,
        done: Math.min(done, step.amount),
        complete: completeAt !== undefined,
        fraction: Math.min(1, done / step.amount),
      };
    });
    const complete = open && steps.every((step) => step.complete);
    if (open && !complete) {
      reachedAll = false;
      currentIndex = index;
    }
    if (complete) cursor = reachedAt;
    return {
      milestone,
      status: complete ? ("done" as const) : open ? ("current" as const) : ("upcoming" as const),
      steps,
      ...(complete ? { reachedAt } : {}),
    };
  });

  const all = milestones.flatMap((milestone) => milestone.steps);
  return {
    roadmap,
    milestones,
    fraction: all.length > 0 ? all.reduce((sum, step) => sum + step.fraction, 0) / all.length : 0,
    doneSteps: all.filter((step) => step.complete).length,
    totalSteps: all.length,
    complete: reachedAll && milestones.length > 0,
    ...(currentIndex !== undefined ? { current: currentIndex } : {}),
  };
}
