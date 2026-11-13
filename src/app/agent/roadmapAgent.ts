import type { ISystemCore } from "../../types";
import { localDate } from "../../system/agendaManager";
import { contractOf } from "../lib/domain";
import type { ChatMessage, ChatOptions, ModelReply, ToolCall } from "./llm";
import { DraftError, RoadmapDraft } from "./roadmapDraft";
import { formatDayMinutes } from "../lib/format";
import { WEEKDAYS, WEEKDAY_NAMES, weekdayNames } from "./when";
import type { Said } from "./brief";

/**
 * The roadmap planner (ADR-010): a second agent, with its own prompt, its own
 * tools and its own short conversation, that owns the person's roadmaps. The
 * coach hands it a request in words and gets back a few lines; everything the
 * planner needs to know about roadmaps stays out of the coach's context, which
 * on a small model is the scarce thing.
 *
 * It works on a draft. What it leaves there is shown to the person before it
 * is saved.
 */

const PROMPT = (language: string) =>
  `You are the roadmap planner inside LifeUI, an app where a person plans and runs their days. You own their roadmaps. You never talk to the person: their coach sends you a request and you carry it out with your tools. Every move you make is one tool call, and the last one is finish.

## What a roadmap is

- A roadmap leads to one goal of the person. It has a title (the goal), a why, ONE activity, a schedule, and milestones in order.
- The activity is what the person sits down to do in every session: a workout, a study session, a writing session. One session is one sitting, whatever it contains.
- A milestone is a phase the person passes before the next one. It says how many sessions it takes (or how many minutes in all) and, in "notes", what ONE session of that phase consists of.
- What happens inside a session (its exercises, its pages, its sub-tasks, how many of each) is never an activity and never a count of sessions. It is the text of "notes", a short Markdown list the person reads while they do the session.
- "rules" is what holds in every session of every phase: how to progress, what counts on a bad day. The app shows them under each session's notes, so do not repeat them in the notes. Never put days, hours or how to schedule in them: the schedule has those, and a rule that names other days contradicts the calendar.
- The schedule says which weekdays the sessions happen on, at what time if the person gave one, and from when. The app itself puts every session on the calendar, milestone after milestone, and counts progress from the sessions the person really closes. You never write dates or progress.

## How to build one

- Use what the request says: the goal, the phases, the days, the numbers, what a session contains. Do not add a programme nobody asked for, and do not leave out any part of a session the request lists: all of it goes in that phase's notes.
- Use an activity of the library when one fits. For a new one, give a short plain name for the whole session and session_minutes: how long one session lasts.
- "sessions" is how many times the person does the whole session during that phase: three days a week for four weeks is 12 sessions. It is never a number from inside a session.
- 2 to 5 milestones. The first one small: a week or two.
- When the request leaves a number out, choose a modest one and say so when you finish. When it does not say which days of the week, do not choose them: call cannot_do and say that the days are missing.
- When the roadmap the request asks for already exists as asked (see "What exists now"), change nothing: call cannot_do and say that it exists already.
- Create or rewrite a whole roadmap with save_roadmap, in one call, and end it with then: "finish". Use the small tools only for small changes to a roadmap that exists.
- Copy the days of the week as they are written. Take the plan from the coach's conversation when it is given below: its phases, what each session contains, how long it runs.
- Every word you write for the person (titles, notes, rules, the why) is in ${language}. The why is the person's reason, in a sentence, as the request gives it.

## When a tool answers with an error

Read it: it says what is wrong and how to fix it. Fix the call. Never send the same call twice.

## When you are done

Call finish with one or two sentences for the coach: what you created or changed and any number you had to choose yourself. finish only reports: it creates nothing, so the roadmap has to be saved first. When the request cannot be carried out at all, call cannot_do and say exactly what is missing.`;

// The names say what each number is: with "times" and "minutes" a 9B model
// gave both, reading "minutes" as the length of a session
const STEP_FIELDS = {
  activity: { type: "string", description: "Title of the library activity" },
  sessions: { type: "integer", description: "How many sessions to close. This OR total_minutes" },
  total_minutes: {
    type: "integer",
    description: "Minutes to add up over all sessions. This OR sessions, never both",
  },
  session_minutes: {
    type: "integer",
    description: "Only for an activity that is not in the library yet: how long one session lasts",
  },
  notes: {
    type: "string",
    description:
      "What ONE session consists of, as a short Markdown list (its parts, how many of each). The person reads it when they do the session",
  },
};
const PHASE_FIELDS = {
  title: { type: "string", description: "The phase, in a few words" },
  note: { type: "string", description: "One line on what this phase is for" },
  sessions: {
    type: "integer",
    description:
      "How many times the person does the whole session in this phase. This OR total_minutes",
  },
  total_minutes: {
    type: "integer",
    description: "Minutes to add up over all the sessions of this phase. This OR sessions",
  },
  notes: {
    type: "string",
    description:
      "What ONE session of this phase consists of, as a short Markdown list: every part the request gives, how many of each, how to progress",
  },
  activity: {
    type: "string",
    description: "Only when this phase uses a different activity from the roadmap's",
  },
  session_minutes: {
    type: "integer",
    description: "Only when a session of this phase lasts a different time from the roadmap's",
  },
};
// Two shapes, so a phase held to this schema is counted in sessions or in
// minutes, never both; and it always says what a session consists of
const PHASE = {
  anyOf: [
    {
      type: "object",
      properties: (({ title, note, sessions, notes, activity, session_minutes }) => ({
        title,
        note,
        sessions,
        notes,
        activity,
        session_minutes,
      }))(PHASE_FIELDS),
      required: ["title", "sessions", "notes"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: (({ title, note, total_minutes, notes, activity, session_minutes }) => ({
        title,
        note,
        total_minutes,
        notes,
        activity,
        session_minutes,
      }))(PHASE_FIELDS),
      required: ["title", "total_minutes", "notes"],
      additionalProperties: false,
    },
  ],
};
const SCHEDULE_FIELDS = {
  weekdays: {
    type: "array",
    // In the words they were said in: nothing to translate, nothing to get wrong
    items: { type: "string", enum: WEEKDAY_NAMES },
    description: "The days of the week the sessions happen on, copied as they were said",
  },
  time: { type: "string", description: "HH:MM, only if the request gives a time" },
  start: {
    type: "string",
    description: '"today", "tomorrow" or YYYY-MM-DD: the first day a session may fall on',
  },
};
const ROADMAP = {
  type: "string",
  description: "The roadmap's title. May be left out when there is only one",
};
const MILESTONE = {
  type: "string",
  description: "The milestone's number (1 is the first) or its title",
};

const TOOLS: Array<{
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  run: (draft: RoadmapDraft, args: Record<string, unknown>) => unknown;
}> = [
  {
    name: "save_roadmap",
    description:
      "Create a roadmap, or rewrite the one with the same title, whole: its activity, its schedule and its milestones in order. Saving it puts every session on the calendar.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "The goal alone, in a few words" },
        why: {
          type: "string",
          description: "The person's reason, in a sentence, as the request gives it",
        },
        activity: {
          type: "string",
          description:
            "The ONE thing the person does in every session: a library activity, or a short plain name for a new one. Never a part of a session",
        },
        session_minutes: {
          type: "integer",
          description: "How long one whole session lasts, in minutes",
        },
        schedule: {
          type: "object",
          description: "When the sessions happen",
          properties: SCHEDULE_FIELDS,
          required: ["weekdays", "start"],
        },
        rules: {
          type: "string",
          description:
            "What holds in EVERY session of every phase, when the request gives any: how to progress, what to do on a bad day, what never to do. A short Markdown list. Empty when the request gives none",
        },
        target_date: { type: "string", description: "YYYY-MM-DD, only if the person gave one" },
        milestones: { type: "array", items: PHASE },
        message: {
          type: "string",
          description:
            "One or two sentences for the coach: what you built, and any number you had to choose yourself",
        },
        then: {
          type: "string",
          enum: ["finish", "continue"],
          description:
            "finish: the request is carried out. continue: another change is still needed",
        },
      },
      required: [
        "title",
        "why",
        "activity",
        "session_minutes",
        "schedule",
        "rules",
        "milestones",
        "message",
        "then",
      ],
    },
    run: (draft, args) => draft.saveRoadmap(args),
  },
  {
    name: "set_roadmap",
    description:
      "Rename a roadmap, change its why, its rules or its target date, or pause or resume it.",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        new_title: { type: "string" },
        why: { type: "string" },
        rules: { type: "string", description: "What holds in every session. Empty clears it" },
        target_date: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string", enum: ["active", "paused"] },
      },
    },
    run: (draft, args) => draft.setRoadmap(args),
  },
  {
    name: "set_schedule",
    description:
      "Move a roadmap's sessions: other days of the week, another time, or starting again from a date. What you leave out stays as it is. The sessions still to do are planned again.",
    parameters: {
      type: "object",
      properties: { roadmap: ROADMAP, ...SCHEDULE_FIELDS },
    },
    run: (draft, args) => draft.setSchedule(args),
  },
  {
    name: "delete_roadmap",
    description:
      "Delete a roadmap, and the sessions it had planned. Only when the coach's request says so.",
    parameters: { type: "object", properties: { roadmap: ROADMAP } },
    run: (draft, args) => draft.deleteRoadmap(args),
  },
  {
    name: "add_milestone",
    description:
      "Add a phase to a roadmap, at the end or at a position: how many sessions and what one session consists of.",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        ...PHASE_FIELDS,
        position: { type: "integer", description: "1 puts it first. Left out: at the end" },
      },
      required: ["title", "notes"],
    },
    run: (draft, args) => draft.addMilestone(args),
  },
  {
    name: "remove_milestone",
    description: "Remove a milestone from a roadmap.",
    parameters: {
      type: "object",
      properties: { roadmap: ROADMAP, milestone: MILESTONE },
      required: ["milestone"],
    },
    run: (draft, args) => draft.removeMilestone(args),
  },
  {
    name: "add_step",
    description:
      "Add a second activity to a milestone, when a phase really has two kinds of session. Rare.",
    parameters: {
      type: "object",
      properties: { roadmap: ROADMAP, milestone: MILESTONE, ...STEP_FIELDS },
      required: ["milestone", "activity"],
    },
    run: (draft, args) => draft.addStep(args),
  },
  {
    name: "set_step",
    description: "Change a step: its amount, its activity, or what a session consists of (notes).",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        milestone: MILESTONE,
        step: { type: "string", description: "The step's number or its activity" },
        ...STEP_FIELDS,
      },
      required: ["milestone", "step"],
    },
    run: (draft, args) => draft.setStep(args),
  },
  {
    name: "remove_step",
    description: "Remove a step from a milestone.",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        milestone: MILESTONE,
        step: { type: "string", description: "The step's number or its activity" },
      },
      required: ["milestone", "step"],
    },
    run: (draft, args) => draft.removeStep(args),
  },
];

/**
 * The two ways out. Every move of the planner is a tool call, so ending is one
 * too: a model held to a schema has no other way to say it is done.
 */
const FINISH = "finish";
const CANNOT = "cannot_do";
const ENDINGS = [
  {
    name: FINISH,
    description:
      "You are done: the roadmap is saved as the coach asked. It creates nothing by itself.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "One or two sentences for the coach: what changed, any number you chose",
        },
      },
      required: ["message"],
    },
  },
  {
    name: CANNOT,
    description: "The request cannot be carried out at all. Nothing is created or changed.",
    parameters: {
      type: "object",
      properties: {
        missing: { type: "string", description: "Exactly what is missing or wrong, in a sentence" },
      },
      required: ["missing"],
    },
  },
];

const schemas = [...TOOLS, ...ENDINGS].map((tool) => ({
  type: "function" as const,
  function: { name: tool.name, description: tool.description, parameters: tool.parameters },
}));

/** What the planner has in front of it: the ideal life, every roadmap as it stands, the real activities. */
export function plannerState(core: ISystemCore, now: Date) {
  const templates = core.getActivityTemplates();
  const title = (id: string) => templates.find((tpl) => tpl.id === id)?.title ?? "?";
  const planned = new Map<string, { sessions: number; next: string }>();
  for (const item of core.getPlannedActivities()) {
    const entry = planned.get(item.templateId);
    if (entry) entry.sessions++;
    else planned.set(item.templateId, { sessions: 1, next: item.date });
  }
  return {
    today: `${localDate(now)} (${WEEKDAYS[now.getDay()]})`,
    ideal_life: core.getIdealLife()?.text.slice(0, 2500) || "(nothing written yet)",
    roadmaps: core.getRoadmapProgress().map((progress) => ({
      title: progress.roadmap.title,
      why: progress.roadmap.why,
      status: progress.roadmap.status,
      schedule: progress.roadmap.schedule
        ? `${progress.roadmap.schedule.weekdays.map((weekday) => WEEKDAYS[weekday]).join(", ")}${
            progress.roadmap.schedule.time !== undefined
              ? ` at ${formatDayMinutes(progress.roadmap.schedule.time)}`
              : ""
          }`
        : "none",
      percent: Math.round(progress.fraction * 100),
      milestones: progress.milestones.map((entry, index) => ({
        n: index + 1,
        title: entry.milestone.title,
        status: entry.status,
        steps: entry.steps.map(
          (step, i) =>
            `${i + 1}. ${title(step.step.templateId)}: ${step.done}/${step.step.amount} ${step.step.unit}, ${step.plannedAhead} planned${
              step.step.notes ? `. Notes: ${step.step.notes.slice(0, 240)}` : ""
            }`
        ),
      })),
    })),
    library: templates.map((tpl) => ({
      title: tpl.title,
      session: contractOf(tpl.type, tpl)?.label ?? "free",
    })),
    planned_ahead: [...planned.entries()].map(([id, entry]) => ({ activity: title(id), ...entry })),
  };
}

type Chat = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options?: ChatOptions
) => Promise<ModelReply>;

export interface PlannerRun {
  draft: RoadmapDraft;
  /** The planner's own words for the coach. */
  reply: string;
  /** Tool calls that failed and were not followed by one that worked. */
  lastError?: string;
}

/** Tool calls before the planner is stopped: a small model can go in circles. */
const MAX_STEPS = 8;
/** A whole roadmap in one call is about 400 tokens; this leaves room and bounds a runaway. */
const MAX_CALL_TOKENS = 1500;
/** Calls refused one after another before the planner is stopped. */
const MAX_REFUSALS = 3;
/** Times the planner is told that nothing exists yet before its word is taken as it is. */
const MAX_NUDGES = 2;

/**
 * Runs the planner on one request. It ends when the planner calls finish or
 * cannot_do, or when it runs out of steps.
 */
export async function runRoadmapPlanner(options: {
  core: ISystemCore;
  chat: Chat;
  request: string;
  language: string;
  now: Date;
  signal?: AbortSignal;
  reasoning?: boolean;
  /** What the person said that a roadmap has to keep to. The draft enforces it. */
  said?: Said;
  /** The latest of the coach's conversation with the person: the plan they agreed to is in it. */
  conversation?: string;
}): Promise<PlannerRun> {
  const { core, chat, signal } = options;
  const said = options.said ?? {};
  const draft = new RoadmapDraft(core, options.now, said);
  const perWeek = said.days?.length;
  const theirs = [
    said.minutes && `one session can be ${said.minutes} minutes`,
    said.time !== undefined && `the time is ${formatDayMinutes(said.time)}`,
    said.weeks && `the plan runs about ${said.weeks} weeks`,
    perWeek && `the sessions happen on ${weekdayNames(said.days!)} (${perWeek} a week)`,
    said.weeks &&
      perWeek &&
      `the count is already made: one week is ${perWeek} sessions, ${said.weeks} weeks are ${
        said.weeks * perWeek
      } in all, and a phase of N weeks is N x ${perWeek} sessions`,
    perWeek &&
      said.phaseWeeks &&
      `the phases of the plan they agreed to run ${said.phaseWeeks.join(", ")} weeks, which are ${said.phaseWeeks
        .map((weeks) => weeks * perWeek)
        .join(", ")} sessions in the same order: use exactly those counts`,
  ].filter(Boolean);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${PROMPT(options.language)}\n\n## What exists now\n\n${JSON.stringify(plannerState(core, options.now))}${
        theirs.length > 0
          ? `\n\n## What the person said\n\nThe roadmap has to keep to it: ${theirs.join("; ")}.`
          : ""
      }${
        options.conversation
          ? `\n\n## The coach's conversation with the person\n\nThe plan they agreed to is here: build that plan, with its phases and what each session contains, and nothing it does not have.\n\n${options.conversation}`
          : ""
      }`,
    },
    { role: "user", content: options.request },
  ];
  let reply = "";
  let lastError: string | undefined;
  let nudges = 0;
  let failures = 0;
  let refused = 0;

  run: for (let step = 0; step < MAX_STEPS; step++) {
    // Every move has to be a tool call: a planner that only talks has planned
    // nothing, and with Qwen3.5 9B it did just that ("I have created the
    // roadmap", or the call written out as prose until the limit)
    let answer: ModelReply;
    try {
      answer = await chat(messages, schemas, signal, {
        reasoning: options.reasoning,
        // A whole roadmap fits several times over; a runaway answer does not
        maxTokens: MAX_CALL_TOKENS,
        toolChoice: "required",
      });
    } catch (caught) {
      // One call that fails does not throw away the moves already made: it is
      // asked once more. A second failure is the server's, and is said as it is.
      if (signal?.aborted || failures++ > 0) throw caught;
      continue;
    }
    if (signal?.aborted) throw new Error("aborted");
    if (answer.toolCalls.length === 0) {
      // A server that holds the model to nothing, or a move cut short by the
      // limit. Words change nothing, so it is told so and asked again.
      if (!draft.changed && nudges < MAX_NUDGES) {
        nudges++;
        messages.push(
          // Cut short: a runaway answer must not fill the context of the next try
          { role: "assistant", content: (answer.content || "…").slice(0, 300) },
          {
            role: "user",
            content:
              "Nothing exists yet: you answered in words and called no tool. Call the save_roadmap tool now with the whole roadmap. If the request truly cannot be carried out, call cannot_do.",
          }
        );
        continue;
      }
      reply = answer.content;
      break;
    }
    messages.push({
      role: "assistant",
      content: answer.content || null,
      tool_calls: answer.toolCalls,
    });
    for (const call of answer.toolCalls) {
      const name = call.function.name;
      if (name === FINISH || name === CANNOT) {
        const said = wordsOf(call);
        // "Done", with nothing done: the same claim as before, now as a call.
        // It gets the error a tool gives, and another move.
        if (name === FINISH && !draft.changed && nudges < MAX_NUDGES) {
          nudges++;
          const result = {
            error: "nothing-to-finish",
            detail:
              "No tool has created or changed anything yet, so there is nothing to report. Call save_roadmap now with the whole roadmap, or call cannot_do and say what is missing.",
          };
          lastError = `${result.error}: ${result.detail}`;
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
          continue;
        }
        reply = said;
        break run;
      }
      const result = runOne(draft, call);
      lastError = "error" in result ? `${result.error}: ${result.detail}` : undefined;
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      // Three refusals in a row: it is not going to get there, and each try
      // writes the whole roadmap again. The coach is told what stood in the way.
      refused = lastError ? refused + 1 : 0;
      if (refused >= MAX_REFUSALS) break run;
      // A roadmap saved with "finish" closes the run in that same call: asked
      // again, the model sent the whole roadmap a second time
      if (!lastError && closes(call)) {
        reply = wordsOf(call);
        break run;
      }
    }
  }
  return { draft, reply, ...(lastError ? { lastError } : {}) };
}

/** Whether a call says the request is carried out with it. */
function closes(call: ToolCall): boolean {
  try {
    return (JSON.parse(call.function.arguments || "{}") as { then?: unknown }).then === "finish";
  } catch {
    return false;
  }
}

/** What a closing call says, whatever the argument was called. */
function wordsOf(call: ToolCall): string {
  try {
    const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    const said = args.message ?? args.missing ?? "";
    return typeof said === "string" ? said.trim() : "";
  } catch {
    return "";
  }
}

function runOne(draft: RoadmapDraft, call: ToolCall): Record<string, unknown> {
  const tool = TOOLS.find((candidate) => candidate.name === call.function.name);
  if (!tool) {
    return {
      error: "unknown-tool",
      detail: `tools are: ${TOOLS.map((candidate) => candidate.name).join(", ")}`,
    };
  }
  let args: Record<string, unknown>;
  try {
    args = call.function.arguments ? JSON.parse(call.function.arguments) : {};
  } catch {
    return { error: "invalid-arguments", detail: "arguments must be a JSON object" };
  }
  try {
    return tool.run(draft, args) as Record<string, unknown>;
  } catch (caught) {
    if (caught instanceof DraftError) {
      return { error: caught.code, detail: caught.message.slice(caught.code.length + 2) };
    }
    return { error: "failed", detail: caught instanceof Error ? caught.message : String(caught) };
  }
}
