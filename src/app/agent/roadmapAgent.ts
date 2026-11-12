import type { ISystemCore } from "../../types";
import { localDate } from "../../system/agendaManager";
import { contractOf } from "../lib/domain";
import type { ChatMessage, ChatOptions, ModelReply, ToolCall } from "./llm";
import { DraftError, RoadmapDraft } from "./roadmapDraft";

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

- A roadmap leads to one goal of the person. It has a title (the goal), a why, and milestones in order.
- A milestone is a phase the person passes before the next one. It has steps.
- A step is an amount of ONE activity of the person's library: a number of sessions, or a total of minutes. Never both.
- Progress is never written by you. The app counts it from the sessions the person really closes, milestone after milestone.

## How to build one

- Use what the coach's request says: the goal, the phases, the activities, the numbers. Do not add a programme nobody asked for.
- 2 to 5 milestones. The first one small: reachable in a week or two, so the person starts by winning.
- 1 to 3 steps per milestone. Amounts a real person would finish.
- Every step needs an activity. Use one from the library below when it fits. When the plan needs a new one, give it a short name that can be told apart ("Train: base phase") and session_minutes: how long one session lasts.
- What a phase is for goes in the milestone's note, in one line. A step has no text of its own.
- When the request leaves a number out, choose a modest one and say so when you finish.
- Create or rewrite a whole roadmap with save_roadmap, in one call. Use the small tools only for small changes to a roadmap that exists.
- Titles, notes and the why are written in ${language}.

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
};
const { activity, sessions, total_minutes, session_minutes } = STEP_FIELDS;
// A step is one of two shapes, so a move held to this schema cannot carry
// both amounts or neither: counted in sessions, or in minutes
const STEP = {
  anyOf: [
    {
      type: "object",
      properties: { activity, sessions, session_minutes },
      required: ["activity", "sessions"],
      additionalProperties: false,
    },
    {
      type: "object",
      properties: { activity, total_minutes, session_minutes },
      required: ["activity", "total_minutes"],
      additionalProperties: false,
    },
  ],
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
      "Create a roadmap, or rewrite the one with the same title, whole: its milestones in order, each with its steps.",
    parameters: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "The goal alone, in a few words. The reason goes in why",
        },
        why: {
          type: "string",
          description:
            "Why it matters to the person, as the request says it. Empty when it does not say",
        },
        target_date: { type: "string", description: "YYYY-MM-DD, only if the person gave one" },
        milestones: {
          type: "array",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              note: { type: "string", description: "One line on what this phase is for" },
              steps: { type: "array", items: STEP },
            },
            required: ["title", "steps"],
          },
        },
      },
      required: ["title", "why", "milestones"],
    },
    run: (draft, args) => draft.saveRoadmap(args),
  },
  {
    name: "set_roadmap",
    description: "Rename a roadmap, change its why or its target date, or pause or resume it.",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        new_title: { type: "string" },
        why: { type: "string" },
        target_date: { type: "string", description: "YYYY-MM-DD" },
        status: { type: "string", enum: ["active", "paused"] },
      },
    },
    run: (draft, args) => draft.setRoadmap(args),
  },
  {
    name: "delete_roadmap",
    description: "Delete a roadmap. Only when the coach's request says so.",
    parameters: { type: "object", properties: { roadmap: ROADMAP } },
    run: (draft, args) => draft.deleteRoadmap(args),
  },
  {
    name: "add_milestone",
    description: "Add a milestone with its steps to a roadmap, at the end or at a position.",
    parameters: {
      type: "object",
      properties: {
        roadmap: ROADMAP,
        title: { type: "string" },
        note: { type: "string" },
        steps: { type: "array", items: STEP },
        position: { type: "integer", description: "1 puts it first. Left out: at the end" },
      },
      required: ["title", "steps"],
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
    description: "Add a step to a milestone.",
    parameters: {
      type: "object",
      properties: { roadmap: ROADMAP, milestone: MILESTONE, ...STEP_FIELDS },
      required: ["milestone", "activity"],
    },
    run: (draft, args) => draft.addStep(args),
  },
  {
    name: "set_step",
    description: "Change a step: its amount or its activity.",
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
    today: localDate(now),
    ideal_life: core.getIdealLife()?.text.slice(0, 2500) || "(nothing written yet)",
    roadmaps: core.getRoadmapProgress().map((progress) => ({
      title: progress.roadmap.title,
      why: progress.roadmap.why,
      status: progress.roadmap.status,
      percent: Math.round(progress.fraction * 100),
      milestones: progress.milestones.map((entry, index) => ({
        n: index + 1,
        title: entry.milestone.title,
        status: entry.status,
        steps: entry.steps.map(
          (step, i) =>
            `${i + 1}. ${title(step.step.templateId)}: ${step.done}/${step.step.amount} ${step.step.unit}`
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
}): Promise<PlannerRun> {
  const { core, chat, signal } = options;
  const draft = new RoadmapDraft(core);
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: `${PROMPT(options.language)}\n\n## What exists now\n\n${JSON.stringify(plannerState(core, options.now))}`,
    },
    { role: "user", content: options.request },
  ];
  let reply = "";
  let lastError: string | undefined;
  let nudges = 0;
  let failures = 0;

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
    }
  }
  return { draft, reply, ...(lastError ? { lastError } : {}) };
}

/** What a closing call says, whatever the argument was called. */
function wordsOf(call: ToolCall): string {
  try {
    const args = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    const said = args.message ?? args.missing ?? Object.values(args)[0];
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
