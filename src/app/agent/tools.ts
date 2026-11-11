import type { ActivityTemplate, ActivityType, ISystemCore, TimeBlock } from "../../types";
import { UtilityService } from "../../system/utilityService";
import { formatDayMinutes, parseDayMinutes } from "../lib/format";
import { t } from "../i18n";
import { daySnapshot, librarySnapshot, reviewSnapshot, shortId } from "./snapshot";
import { GUIDES, type GuideName } from "./guides";

/**
 * The agent's tools (ADR-002): each one is a call into the domain core with a
 * strict schema. Reads never change anything; mutations show as a card in the
 * chat (confirmed first in confirm mode) and can be undone. The core still
 * validates everything: a bad call fails with a code and changes nothing.
 */

export interface ToolContext {
  core: ISystemCore;
  now: () => Date;
}

type Args = Record<string, unknown>;

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  /** Changes state: shown as a card, confirmed in confirm mode, undoable. */
  mutates: boolean;
  /** Asks even in auto mode (ADR-002): deleting, ending the day. */
  alwaysConfirm?: boolean;
  run: (ctx: ToolContext, args: Args) => unknown;
  /** One line for the card, in the person's language. */
  describe?: (ctx: ToolContext, args: Args) => string;
}

/** A refusal the model can read and recover from, like the core's codes. */
export class ToolError extends Error {
  constructor(
    readonly code: string,
    detail?: string
  ) {
    super(detail ? `${code}: ${detail}` : code);
  }
}

const str = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const num = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" && value.trim() && !Number.isNaN(Number(value))
      ? Number(value)
      : undefined;
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();

/** "15:00", "15", "9:30" -> minutes of the day. */
function parseTime(value: unknown): number | null {
  const text = str(value);
  if (!text) return null;
  const minutes = parseDayMinutes(/^\d{1,2}$/.test(text) ? `${text}:00` : text);
  if (minutes === null) throw new ToolError("invalid-time", `use HH:MM, got "${text}"`);
  return minutes;
}

function findBlock(core: ISystemCore, name: unknown): TimeBlock {
  const wanted = str(name);
  const blocks = core.getTimeBlocks();
  const todo = blocks.find((b) => b.isDefault)!;
  if (!wanted || ["todo", "to do", "por hacer"].some((n) => same(n, wanted))) return todo;
  const hit = blocks.find((b) => same(b.name, wanted));
  if (!hit) {
    throw new ToolError(
      "block-not-found",
      `blocks are: ${blocks.map((b) => (b.isDefault ? "To do" : b.name)).join(", ")}`
    );
  }
  return hit;
}

/** A plan item by its short id or its title. */
function findItem(core: ISystemCore, ref: unknown) {
  const wanted = str(ref);
  const items = core.getState().currentDay?.activityInstances ?? [];
  const templates = core.getActivityTemplates();
  const title = (templateId: string) => templates.find((t) => t.id === templateId)?.title ?? "";
  const hit =
    items.find((i) => wanted && i.id.startsWith(wanted)) ??
    items.find((i) => wanted && same(title(i.templateId), wanted));
  if (!hit) throw new ToolError("item-not-found", `no plan item "${wanted}"; read get_day`);
  return { instance: hit, title: title(hit.templateId) };
}

type Kind = "goal" | "range" | "timebox";

/** Duration settings from the model's simple fields. */
function settingsFrom(
  args: Args
): { type: ActivityType; settings: Partial<ActivityTemplate> } | null {
  const minutes = num(args.minutes);
  const min = num(args.min_minutes);
  const max = num(args.max_minutes);
  const kind = str(args.kind) as Kind | "";
  if (kind === "timebox" || (!kind && (min !== undefined) !== (max !== undefined))) {
    const both = min !== undefined && max !== undefined;
    return {
      type: "timeboxing",
      settings: {
        timeboxingSettings: {
          type: both ? "both" : max !== undefined ? "maximum-time" : "minimum-time",
          ...(min !== undefined ? { minimumDurationMinutes: min } : {}),
          ...(max !== undefined ? { maximumDurationMinutes: max } : {}),
          ...(min === undefined && max === undefined
            ? { minimumDurationMinutes: minutes ?? 20 }
            : {}),
        },
      },
    };
  }
  if (kind === "range" || (min !== undefined && max !== undefined)) {
    return {
      type: "flexible-duration",
      settings: {
        flexibleDurationSettings: {
          minimumDurationMinutes: min ?? Math.max(5, Math.round((minutes ?? 30) * 0.7)),
          maximumDurationMinutes: max ?? Math.round((minutes ?? 30) * 1.3),
        },
      },
    };
  }
  if (kind === "goal" || minutes !== undefined) {
    return {
      type: "clear-objective",
      settings: { clearObjectiveSettings: { estimatedDurationMinutes: minutes ?? 30 } },
    };
  }
  return null;
}

/** The library activity with this title, created when it doesn't exist yet. */
function templateFor(core: ISystemCore, args: Args) {
  const title = str(args.title);
  if (!title) throw new ToolError("missing-title");
  const existing = core.getActivityTemplates().find((tpl) => same(tpl.title, title));
  const wanted = settingsFrom(args);
  if (existing)
    return {
      template: existing,
      override: wanted?.type === existing.type ? wanted.settings : undefined,
    };
  const base = wanted ?? {
    type: "clear-objective" as const,
    settings: { clearObjectiveSettings: { estimatedDurationMinutes: 30 } },
  };
  const template = core.createActivityTemplate({
    title,
    description: "",
    type: base.type,
    isSystemActivity: false,
    ...base.settings,
  });
  return { template, override: undefined };
}

const where = (block: TimeBlock, time: number | null) =>
  [block.isDefault ? t("block.todo") : block.name, time !== null ? formatDayMinutes(time) : ""]
    .filter(Boolean)
    .join(" · ");

/** Tempos the close would earn, with the same function as the core. */
function previewTempos(core: ISystemCore, score: number, now: Date): number {
  const active = core.getActiveActivity();
  if (!active) return 0;
  const template = core.getActivityTemplates().find((tpl) => tpl.id === active.templateId);
  const estimate =
    active.clearObjectiveSettings?.estimatedDurationMinutes ??
    template?.clearObjectiveSettings?.estimatedDurationMinutes;
  const minutes = active.startTime
    ? Math.max(0, Math.round((now.getTime() - new Date(active.startTime).getTime()) / 60000))
    : 0;
  return UtilityService.calculatePreviewTempos(
    score,
    UtilityService.resolveBaseMinutes(estimate, minutes)
  );
}

const runningTitle = (core: ISystemCore) => {
  const active = core.getActiveActivity();
  return active
    ? (core.getActivityTemplates().find((tpl) => tpl.id === active.templateId)?.title ?? "")
    : "";
};

const DURATION = {
  kind: {
    type: "string",
    enum: ["goal", "range", "timebox"],
    description: "goal: one estimate; range: usual min-max; timebox: a minimum and/or maximum",
  },
  minutes: { type: "integer", description: "Estimate in minutes (goal)" },
  min_minutes: { type: "integer", description: "Minimum minutes (range or timebox)" },
  max_minutes: { type: "integer", description: "Maximum minutes (range or timebox)" },
};

export const TOOLS: Tool[] = [
  {
    name: "get_day",
    description:
      "Read today: the time, blocks, the plan (with ids), what is running, what was closed and the tempos.",
    parameters: { type: "object", properties: {} },
    mutates: false,
    run: ({ core, now }) => daySnapshot(core, now()),
  },
  {
    name: "get_library",
    description: "Read the library of reusable activities and event names.",
    parameters: { type: "object", properties: {} },
    mutates: false,
    run: ({ core }) => librarySnapshot(core),
  },
  {
    name: "get_review",
    description: "Read recent days: tempos, what was closed and what was not finished.",
    parameters: {
      type: "object",
      properties: { days: { type: "integer", description: "How many days, default 7" } },
    },
    mutates: false,
    run: ({ core }, args) => reviewSnapshot(core, num(args.days) ?? 7),
  },
  {
    name: "get_guide",
    description:
      "Read a playbook before a task: plan-day, missed-commitment, closing-rubric, end-day.",
    parameters: {
      type: "object",
      properties: { topic: { type: "string", enum: Object.keys(GUIDES) } },
      required: ["topic"],
    },
    mutates: false,
    run: (_ctx, args) => {
      const guide = GUIDES[str(args.topic) as GuideName];
      if (!guide) throw new ToolError("guide-not-found", Object.keys(GUIDES).join(", "));
      return guide;
    },
  },
  {
    name: "start_day",
    description: "Start the day. Unfinished activities from the last day come back into the plan.",
    parameters: { type: "object", properties: {} },
    mutates: true,
    run: ({ core }) => ({ started: shortId(core.startDay().id) }),
    describe: () => t("agent.tool.startDay"),
  },
  {
    name: "end_day",
    description:
      "End the day. Always confirmed by the person. Whatever is running must be closed first.",
    parameters: { type: "object", properties: {} },
    mutates: true,
    alwaysConfirm: true,
    run: ({ core }) => {
      if (core.getActiveActivity())
        throw new ToolError(
          "activity-running",
          "close it with finish_activity or stop_activity first"
        );
      const summary = core.getTempoSummary(core.getCurrentDay()!.id);
      core.endDay();
      return { ended: true, tempos: summary.totalTempos };
    },
    describe: () => t("agent.tool.endDay"),
  },
  {
    name: "add_to_plan",
    description:
      "Add an activity to today's plan, in a block and optionally at a time. Uses the library activity with that title, or creates it with the given duration.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string" },
        block: { type: "string", description: 'Block name, or "To do" (default)' },
        time: {
          type: "string",
          description: "Start time HH:MM; it picks the block that contains it",
        },
        ...DURATION,
      },
      required: ["title"],
    },
    mutates: true,
    run: ({ core }, args) => {
      const time = parseTime(args.time);
      const { template, override } = templateFor(core, args);
      const block = findBlock(core, args.block);
      const instance = core.createActivityInstance(template.id, block.id, override as never);
      const placed = time !== null ? core.scheduleActivityInstance(instance.id, time) : instance;
      return {
        id: shortId(placed.id),
        title: template.title,
        time: time !== null ? formatDayMinutes(time) : undefined,
      };
    },
    describe: ({ core }, args) => {
      const time = (() => {
        try {
          return parseTime(args.time);
        } catch {
          return null;
        }
      })();
      let block: TimeBlock;
      try {
        block = findBlock(core, args.block);
      } catch {
        block = core.getTimeBlocks().find((b) => b.isDefault)!;
      }
      return t("agent.tool.add", { title: str(args.title), where: where(block, time) });
    },
  },
  {
    name: "schedule",
    description:
      "Set or clear the start time of a plan item. Moves it to the block that contains the time.",
    parameters: {
      type: "object",
      properties: {
        item: { type: "string", description: "Plan item id or title" },
        time: { type: "string", description: "HH:MM, or empty to clear" },
      },
      required: ["item"],
    },
    mutates: true,
    run: ({ core }, args) => {
      const { instance } = findItem(core, args.item);
      const placed = core.scheduleActivityInstance(instance.id, parseTime(args.time));
      return {
        id: shortId(placed.id),
        time: placed.scheduledStart !== undefined ? formatDayMinutes(placed.scheduledStart) : null,
      };
    },
    describe: ({ core }, args) => {
      const title = findItem(core, args.item).title;
      const time = str(args.time);
      return time
        ? t("agent.tool.schedule", { title, time })
        : t("agent.tool.unschedule", { title });
    },
  },
  {
    name: "move_to_block",
    description: 'Move a plan item to another block (or "To do"). Clears its time.',
    parameters: {
      type: "object",
      properties: { item: { type: "string" }, block: { type: "string" } },
      required: ["item", "block"],
    },
    mutates: true,
    run: ({ core }, args) => {
      const { instance } = findItem(core, args.item);
      const block = findBlock(core, args.block);
      if (instance.scheduledStart !== undefined) core.scheduleActivityInstance(instance.id, null);
      core.moveActivityInstance(instance.id, block.id);
      return { moved: shortId(instance.id), block: block.isDefault ? "To do" : block.name };
    },
    describe: ({ core }, args) =>
      t("agent.tool.move", {
        title: findItem(core, args.item).title,
        block: where(findBlock(core, args.block), null),
      }),
  },
  {
    name: "remove_from_plan",
    description: "Take an activity out of today's plan. It stays in the library.",
    parameters: { type: "object", properties: { item: { type: "string" } }, required: ["item"] },
    mutates: true,
    run: ({ core }, args) => {
      const { instance } = findItem(core, args.item);
      core.deleteActivityInstance(instance.id);
      return { removed: shortId(instance.id) };
    },
    describe: ({ core }, args) =>
      t("agent.tool.remove", { title: findItem(core, args.item).title }),
  },
  {
    name: "start_activity",
    description:
      "Start a plan item, or a library activity by title (it is added to the plan). Only one runs at a time: close the running one first.",
    parameters: {
      type: "object",
      properties: { item: { type: "string", description: "Plan item id or title" } },
      required: ["item"],
    },
    mutates: true,
    run: ({ core }, args) => {
      let found;
      try {
        found = findItem(core, args.item);
      } catch {
        const { template } = templateFor(core, { title: args.item });
        const block = core.getCurrentTimeBlock() ?? core.getTimeBlocks().find((b) => b.isDefault)!;
        const instance = core.createActivityInstance(template.id, block.id);
        found = { instance, title: template.title };
      }
      core.activateActivity(found.instance.id);
      return { running: found.title };
    },
    describe: ({ core }, args) => {
      let title = str(args.item);
      try {
        title = findItem(core, args.item).title;
      } catch {
        // a new activity, named as the model wrote it
      }
      return t("agent.tool.start", { title });
    },
  },
  {
    name: "finish_activity",
    description:
      "Close the running activity as done. Infer satisfaction 0-10 from the person's own words with the closing-rubric guide; never ask them for a number and never mention it. If they have not said how it went, ask first.",
    parameters: {
      type: "object",
      properties: {
        how_it_went: { type: "string", description: "The person's own words about how it went" },
        satisfaction: {
          type: "integer",
          minimum: 0,
          maximum: 10,
          description: "Inferred from their words",
        },
      },
      required: ["how_it_went", "satisfaction"],
    },
    mutates: true,
    run: ({ core }, args) => {
      const active = core.getActiveActivity();
      if (!active) throw new ToolError("nothing-running");
      const score = Math.round(num(args.satisfaction) ?? Number.NaN);
      const request = core.requestCompletion(active.id);
      const result = core.completeActivity(active.id, {
        satisfactionScore: score,
        endTime: request.requestedAt,
        note: str(args.how_it_went),
      });
      return {
        closed: request.activityTitle,
        tempos_earned: result.temposAwarded,
        tempos_today: result.dailyTempoTotal,
      };
    },
    describe: ({ core, now }, args) =>
      t("agent.tool.finish", {
        title: runningTitle(core),
        tempos: previewTempos(core, Math.round(num(args.satisfaction) ?? 0), now()),
      }),
  },
  {
    name: "stop_activity",
    description:
      "Stop the running activity as not finished. No tempos, no judgment. It can be added to the plan again later.",
    parameters: { type: "object", properties: {} },
    mutates: true,
    run: ({ core }) => {
      const active = core.getActiveActivity();
      if (!active) throw new ToolError("nothing-running");
      const record = core.interruptActivity(active.id);
      return { stopped: record.templateTitle };
    },
    describe: ({ core }) => t("agent.tool.stop", { title: runningTitle(core) }),
  },
  {
    name: "log_event",
    description: 'Log a one-off event now, like "Coffee". Creates the event name if it is new.',
    parameters: { type: "object", properties: { name: { type: "string" } }, required: ["name"] },
    mutates: true,
    run: ({ core }, args) => {
      const name = str(args.name);
      if (!name) throw new ToolError("missing-name");
      const template =
        core.getState().global.eventTemplates.find((e) => same(e.name, name)) ??
        core.createEventTemplate(name);
      core.createEventInstance(template.id);
      return { logged: template.name };
    },
    describe: (_ctx, args) => t("agent.tool.event", { name: str(args.name) }),
  },
  {
    name: "delete_from_library",
    description: "Delete an activity from the library for good. Always confirmed by the person.",
    parameters: { type: "object", properties: { title: { type: "string" } }, required: ["title"] },
    mutates: true,
    alwaysConfirm: true,
    run: ({ core }, args) => {
      const template = core.getActivityTemplates().find((tpl) => same(tpl.title, str(args.title)));
      if (!template) throw new ToolError("activity-not-found");
      core.deleteActivityTemplate(template.id);
      return { deleted: template.title };
    },
    describe: (_ctx, args) => t("agent.tool.delete", { title: str(args.title) }),
  },
];

export const toolByName = (name: string) => TOOLS.find((tool) => tool.name === name);

/** The tools in the chat completions format. */
export const toolSchemas = () =>
  TOOLS.map((tool) => ({
    type: "function" as const,
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
