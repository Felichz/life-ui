import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type {
  ActivityInstance,
  CompletedActivityRecord,
  IdealLife,
  PlannedActivity,
  Roadmap,
  RoadmapMilestone,
  RoadmapProgress,
  RoadmapStep,
  StepProgress,
  UUID,
} from "../types";
import { CoreError } from "./errors";

/** The ideal life is a page or two, not a book: enough to always travel with the agent. */
const MAX_IDEAL_LIFE = 20_000;
const MAX_ROADMAPS = 20;

/** What a roadmap is given as: ids are the core's business. */
export interface RoadmapInput {
  id?: UUID;
  title: string;
  why?: string;
  targetDate?: string;
  status?: Roadmap["status"];
  milestones: Array<{
    title: string;
    note?: string;
    steps: Array<{ title?: string; templateId: UUID; unit: "times" | "minutes"; amount: number }>;
  }>;
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
    return roadmap;
  }

  public deleteRoadmap(id: UUID): void {
    if (!this.getRoadmaps().some((roadmap) => roadmap.id === id)) {
      throw new CoreError("roadmap-not-found", `id ${id}`);
    }
    this.systemCore.updateState((state) => {
      state.global.roadmaps = (state.global.roadmaps ?? []).filter((item) => item.id !== id);
      return state;
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
      const ahead = planned.filter((item) => item.templateId === step.templateId);
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
