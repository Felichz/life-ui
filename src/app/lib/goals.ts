import type { ISystemCore, RoadmapProgress, UUID } from "../../types";

/**
 * Where a goal stands (ADR-015): the reward the app shows is the way to a
 * goal, counted from the sessions really done.
 */
export interface GoalStanding {
  roadmapId: UUID;
  title: string;
  /** 0 to 100, rounded down: 100 only when every step is complete. */
  percent: number;
  /** The phase being worked on, or the last one when the goal is reached. */
  phase: string;
  /** Sessions done and planned in that phase (sessions of steps counted in times). */
  phaseDone: number;
  phaseTotal: number;
  reached: boolean;
}

function standing(progress: RoadmapProgress): GoalStanding {
  const current =
    progress.milestones.find((one) => one.status === "current") ??
    progress.milestones[progress.milestones.length - 1];
  const steps = current?.steps ?? [];
  const reached = progress.milestones.every((one) => one.status === "done");
  // Counted in sessions when every step is: 1 of 30 is 3%, not the mean of the phases
  const all = progress.milestones.flatMap((one) => one.steps);
  const sessions = all.length > 0 && all.every((one) => one.step.unit === all[0].step.unit);
  const share = sessions
    ? all.reduce((sum, one) => sum + one.done, 0) /
      Math.max(
        1,
        all.reduce((sum, one) => sum + one.step.amount, 0)
      )
    : progress.fraction;
  return {
    roadmapId: progress.roadmap.id,
    title: progress.roadmap.title,
    percent: reached ? 100 : Math.min(99, Math.floor(share * 100)),
    phase: current?.milestone.title ?? "",
    phaseDone: steps.reduce((sum, one) => sum + one.done, 0),
    phaseTotal: steps.reduce((sum, one) => sum + one.step.amount, 0),
    reached,
  };
}

/** The goal an activity of the library works toward, if a roadmap is built on it. */
export function goalFor(core: ISystemCore, templateId: UUID): GoalStanding | null {
  const found = core
    .getRoadmapProgress()
    .find(
      (progress) =>
        progress.roadmap.status === "active" &&
        progress.roadmap.milestones.some((milestone) =>
          milestone.steps.some((step) => step.templateId === templateId)
        )
    );
  return found ? standing(found) : null;
}

/** The goals that are active, the ones nearest their end first. */
export function activeGoals(core: ISystemCore): GoalStanding[] {
  return core
    .getRoadmapProgress()
    .filter((progress) => progress.roadmap.status === "active")
    .map(standing)
    .sort((a, b) => Number(a.reached) - Number(b.reached) || b.percent - a.percent);
}
