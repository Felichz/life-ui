import { useMemo } from "react";
import type { TempoSummary } from "../../../types";
import { planItem, sortBlocks, templateMap, type PlanItem } from "../../lib/domain";
import { minutesOfDay } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { useSystem } from "../../state/system";
import { planGroups, type PlanGroup } from "./Plan";

export interface DayPlan {
  /** The day's plan by time block, in order. */
  groups: PlanGroup[];
  /** What is running, if anything. */
  active: PlanItem | null;
  /**
   * What comes next: the first thing that can be started now (scheduled first),
   * else the first thing of a later block. Null when the plan holds nothing else.
   */
  next: { item: PlanItem; group: PlanGroup } | null;
  /** Items in the plan, the running one included. */
  total: number;
  nowMinutes: number;
  summary: TempoSummary;
}

/** The day as the screens read it. Null when no day is in progress. */
export function useDayPlan(): DayPlan | null {
  const { state, core } = useSystem();
  const now = useNow(30_000);
  const nowMinutes = minutesOfDay(now);
  const day = state.currentDay;

  const plan = useMemo(() => {
    if (!day) return null;
    const templates = templateMap(state);
    const activeId = day.activeActivityInstanceId;
    const items = day.activityInstances
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((instance) => planItem(instance, templates, activeId));
    const groups = planGroups(sortBlocks(state.global.timeBlocks), items, nowMinutes);
    const open = groups
      .filter((group) => group.status === "now" || group.status === "always")
      // The block that is current comes before "To do"
      .sort((a, b) => Number(a.status === "always") - Number(b.status === "always"));
    const later = groups.filter((group) => group.status === "later");
    let next: DayPlan["next"] = null;
    for (const group of [...open, ...later]) {
      const item = group.items.find((candidate) => !candidate.isActive);
      if (item) {
        next = { item, group };
        break;
      }
    }
    return {
      groups,
      active: items.find((item) => item.isActive) ?? null,
      next,
      total: items.length,
    };
  }, [day, state, nowMinutes]);

  if (!day || !plan) return null;
  return { ...plan, nowMinutes, summary: core.getTempoSummary(day.day.id) };
}
