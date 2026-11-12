import { localDate } from "../../system/agendaManager";
import type { AppState, ISystemCore, TimeBlock } from "../../types";
import {
  blockStatus,
  contractOf,
  dayStart,
  planItem,
  recordContract,
  sortBlocks,
  templateMap,
  type PlanItem,
} from "../lib/domain";
import { formatDayMinutes, minutesOfDay } from "../lib/format";

/**
 * What the agent knows about the day: a compact, model-friendly view of the
 * state, sent with every turn and returned by `get_day` (ADR-002). Items are
 * referred to by a short id (the first 8 characters of their UUID).
 */

export const shortId = (id: string) => id.slice(0, 8);

/** Minutes after its time before a scheduled activity counts as missed (ADR-006). */
export const MISSED_AFTER = 15;

function blockLabel(block: TimeBlock): string {
  return block.isDefault ? "To do" : block.name;
}

function itemStatus(item: PlanItem, block: TimeBlock, now: number): string {
  if (item.isActive) return "running";
  const scheduled = item.instance.scheduledStart;
  if (scheduled !== undefined && now > scheduled + MISSED_AFTER) return "missed";
  const status = blockStatus(block, now);
  if (status === "later") return "later";
  if (status === "past") return "past-block";
  return "can-start";
}

export function daySnapshot(core: ISystemCore, now = new Date()) {
  const state: AppState = core.getState();
  const minute = minutesOfDay(now);
  const current = state.currentDay;
  const blocks = sortBlocks(state.global.timeBlocks);
  const templates = templateMap(state);

  const base = {
    now: formatDayMinutes(minute),
    // The person's own calendar day and weekday: the model plans ahead from here
    date: localDate(now),
    weekday: WEEKDAY_NAMES[now.getDay()],
    planned_ahead: core.getPlannedActivities().length,
    // One line per roadmap: the detail is a tool call away
    ...(core.getRoadmaps().length > 0
      ? {
          roadmaps: core.getRoadmapProgress().map((progress) => ({
            title: progress.roadmap.title,
            percent: Math.round(progress.fraction * 100),
            ...(progress.complete
              ? { reached: true }
              : {
                  milestone: `${(progress.current ?? 0) + 1}/${progress.milestones.length} ${
                    progress.milestones[progress.current ?? 0]?.milestone.title ?? ""
                  }`,
                }),
            ...(progress.roadmap.status === "paused" ? { paused: true } : {}),
          })),
        }
      : {}),
    blocks: blocks.map((b) => ({
      name: blockLabel(b),
      ...(b.isDefault
        ? {}
        : { from: formatDayMinutes(b.startMinute), to: formatDayMinutes(b.endMinute) }),
      status: blockStatus(b, minute),
    })),
    library_size: state.global.activityTemplates.length,
  };

  if (!current) return { ...base, day: "not started" as const };

  const summary = core.getTempoSummary(current.day.id);
  const activeId = current.activeActivityInstanceId;
  const plan = current.activityInstances
    .slice()
    .sort(
      (a, b) => (a.scheduledStart ?? 10_000) - (b.scheduledStart ?? 10_000) || a.order - b.order
    )
    .map((instance) => {
      const item = planItem(instance, templates, activeId);
      const block =
        blocks.find((b) => b.id === instance.blockId) ?? blocks.find((b) => b.isDefault)!;
      return {
        id: shortId(instance.id),
        title: item.title,
        block: blockLabel(block),
        ...(instance.scheduledStart !== undefined
          ? { time: formatDayMinutes(instance.scheduledStart) }
          : {}),
        duration: item.contract?.label ?? "free",
        status: itemStatus(item, block, minute),
        ...(instance.notes ? { notes: instance.notes.slice(0, 300) } : {}),
      };
    });

  const active = activeId ? current.activityInstances.find((i) => i.id === activeId) : undefined;
  const running = active
    ? {
        id: shortId(active.id),
        title: templates.get(active.templateId)?.title ?? "Activity",
        minutes: active.startTime
          ? Math.max(0, Math.round((now.getTime() - new Date(active.startTime).getTime()) / 60000))
          : 0,
        duration:
          contractOf(
            templates.get(active.templateId)?.type ?? "clear-objective",
            active,
            templates.get(active.templateId)
          )?.label ?? "free",
      }
    : null;

  const closed = state.global.completedActivityRecords
    .filter((r) => r.dayId === current.day.id)
    .map((r) => ({
      title: r.templateTitle,
      at: formatDayMinutes(minutesOfDay(new Date(r.startTime))),
      minutes: r.durationMinutes,
      duration: recordContract(r)?.label ?? "free",
      result: r.state === "completed" ? `+${r.temposAwarded ?? 0} tempos` : "not finished",
    }));

  return {
    ...base,
    day: "started" as const,
    started_at: formatDayMinutes(minutesOfDay(new Date(dayStart(current.day)))),
    running,
    plan,
    closed_today: closed,
    tempos: {
      today: summary.totalTempos,
      percent_of_reference: summary.displayPercent,
      reference: summary.target,
    },
  };
}

const WEEKDAY_NAMES = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** What is planned for the days ahead, grouped by date. */
export function agendaSnapshot(core: ISystemCore, now = new Date(), days = 14) {
  const templates = templateMap(core.getState());
  const until = new Date(now);
  until.setDate(until.getDate() + Math.max(1, Math.min(190, days)));
  const all = core.getPlannedActivities();
  const shown = all.filter((item) => item.date <= localDate(until));
  const byDate = new Map<string, typeof shown>();
  for (const item of shown) byDate.set(item.date, [...(byDate.get(item.date) ?? []), item]);
  return {
    today: localDate(now),
    total_planned: all.length,
    ...(all.length > shown.length ? { later: all.length - shown.length } : {}),
    days: [...byDate.entries()].map(([date, items]) => ({
      date,
      weekday: WEEKDAY_NAMES[new Date(`${date}T12:00:00`).getDay()],
      items: items.map((item) => ({
        title: templates.get(item.templateId)?.title ?? "Activity",
        ...(item.time !== undefined ? { time: formatDayMinutes(item.time) } : {}),
        ...(item.notes ? { notes: item.notes.slice(0, 200) } : {}),
      })),
    })),
  };
}

export function librarySnapshot(core: ISystemCore) {
  const state = core.getState();
  return {
    activities: state.global.activityTemplates.map((t) => ({
      id: shortId(t.id),
      title: t.title,
      kind:
        t.type === "clear-objective"
          ? "goal"
          : t.type === "flexible-duration"
            ? "range"
            : "timebox",
      duration: contractOf(t.type, t)?.label ?? "free",
      ...(t.pinned ? { pinned: true } : {}),
    })),
    events: state.global.eventTemplates.map((e) => e.name),
  };
}

export function reviewSnapshot(core: ISystemCore, days = 7) {
  const state = core.getState();
  return state.global.days
    .slice()
    .sort((a, b) => dayStart(b).localeCompare(dayStart(a)))
    .slice(0, days)
    .map((day) => {
      const summary = core.getTempoSummary(day.id);
      const records = state.global.completedActivityRecords.filter((r) => r.dayId === day.id);
      return {
        date: dayStart(day).slice(0, 10),
        tempos: summary.totalTempos,
        percent_of_reference: summary.displayPercent,
        closed: records.filter((r) => r.state === "completed").map((r) => r.templateTitle),
        not_finished: records.filter((r) => r.state === "interrupted").map((r) => r.templateTitle),
      };
    });
}
