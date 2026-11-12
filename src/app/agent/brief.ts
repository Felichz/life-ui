import type { ChatMessage, ChatOptions, ModelReply } from "./llm";
import { weekdaysIn } from "./when";

/**
 * The coach's notes on what the person has told it (ADR-012).
 *
 * A small model that answers without thinking first loses track of the
 * conversation: it asks again what it was told, proposes an hour a day to
 * someone who said "fifteen minutes", and states a guess of the person's as a
 * fact. Thinking fixes that and costs a minute or two per answer. These notes
 * cost a few seconds: one short call, held to a schema, that keeps what the
 * person said. They ride next to every message, where a small model reads
 * them, they survive a compaction, and they tell the coach its next move:
 * what is still worth asking, or that it is time to recommend.
 */
export interface Brief {
  /** What they want to reach, and what they asked to be made. */
  wants: string[];
  /** What is true of them and what they have to work with. */
  has: string[];
  /** What a plan has to respect. */
  limits: string[];
  /** What they said as a guess or a doubt about themselves. */
  unsure: string[];
  /**
   * Set once they want something set up to do again and again (a plan, a
   * routine, a habit): what such a plan cannot be built without, each as
   * they said it, empty until they do.
   */
  plan?: {
    length: string;
    days: string;
    time: string;
    start: string;
    weeks?: number;
    /**
     * Read from the person's own words and nowhere else: only these bind a
     * roadmap. A day the model picked out of the coach's question does not.
     */
    exact?: { minutes?: number; time?: number; weekdays?: number[] };
    /** The coach has laid a plan out for them already. */
    given?: boolean;
    /** The plan is in the app: a roadmap was saved for it in this conversation. */
    built?: boolean;
  };
  /**
   * Whether their latest message says yes to what the coach proposed. Nothing
   * goes into the app on the coach's own reading of the mood.
   */
  agreed?: boolean;
  /**
   * Replies in which the coach has asked them questions. Kept here, not
   * counted from the conversation, so a compaction does not start it over.
   */
  asked?: number;
}

const LISTS = ["wants", "has", "limits", "unsure"] as const;
const MAX_ITEMS = 10;

const PROMPT = (language: string) =>
  `You keep a coach's notes about one person. You are given the newest message the person wrote, and the questions the coach had asked before it. Write down what the person says in that message.

Rules:
- Note only what the PERSON says. Nothing the coach said or proposed.
- Short phrases, close to their own words, in ${language}. Keep every number, time and name exactly. One idea per phrase.
- No advice, no opinions, no guesses of your own.
- When the message is only an instruction about today's plan (add, move, start or finish something), every list is empty.
- When the person agrees to what the coach asked ("yes", "those days are fine"), note what they agreed to, taken from the coach's question, as if they had said it themselves.

The lists:
- wants: what they want to reach, why, and what they ask the coach to make (a plan, how long it should run, what it must contain).
- has: what is true of them and what they have to work with (experience, equipment, place, body, people, how they tend to act).
- limits: what any plan has to respect (the time they have, pace, what they will or will not do, the smallest version they named).
- unsure: a guess or a doubt about themselves: a condition, a diagnosis, a trait ("maybe I have…"). A tentative preference ("maybe at 7") is not this: it belongs in limits and in the plan.

agrees: true only when this message says yes to what the coach proposed, or tells the coach to go ahead ("sí", "dale", "ok, hazlo", "sounds good, do it"). Asking for something else, or answering a question, is not a yes.

The plan:
- wanted: true when they want something set up to do again and again or over weeks (a plan, a routine, a habit, a programme of study or training).
- session_length: how long one session can be, as they say it ("15 minutos"). Fill it whenever the message gives or accepts a duration, even if it is also a limit. Empty otherwise.
- days: which days of the week, or how many days a week ("lunes, miércoles y viernes"). Fill it whenever the message gives or accepts days. Empty otherwise.
- time: the time of day ("19:00"). Fill it whenever the message gives or accepts a time. Empty otherwise.
- start: when they want to start, as they say it. Empty unless they say.
- months and weeks: for how long the plan should run, as they say it. "This month and the next" is months 2; "three months" is months 3; "six weeks" is weeks 6. Both 0 unless they say.`;

const list = { type: "array", items: { type: "string" }, maxItems: 6 };
const said = (description: string) => ({ type: "string", description });

/** One tool, so the notes come back held to a schema (see `moveSchema` in llm.ts). */
const KEEP_NOTES = {
  type: "function" as const,
  function: {
    name: "keep_notes",
    description: "What the person says in their newest message.",
    parameters: {
      type: "object",
      properties: {
        wants: list,
        has: list,
        limits: list,
        unsure: list,
        agrees: { type: "boolean" },
        plan: {
          type: "object",
          properties: {
            wanted: { type: "boolean" },
            session_length: said("As they say it, or empty"),
            days: said("As they say it, or empty"),
            time: said("As they say it, or empty"),
            start: said("As they say it, or empty"),
            months: { type: "integer", description: "Months the plan should run, or 0" },
            weeks: { type: "integer", description: "Weeks the plan should run, or 0" },
          },
          required: ["wanted", "session_length", "days", "time", "start", "months", "weeks"],
          additionalProperties: false,
        },
      },
      required: [...LISTS, "agrees", "plan"],
      additionalProperties: false,
    },
  },
};

type Chat = (
  messages: ChatMessage[],
  tools: unknown[],
  signal?: AbortSignal,
  options?: ChatOptions
) => Promise<ModelReply>;

const text = (value: unknown) => (typeof value === "string" ? value.trim().slice(0, 200) : "");
const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];
const key = (phrase: string) =>
  phrase
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();

/** What was noted before stays: the new phrases are added, never swapped in. */
function merge(before: string[], now: string[]): string[] {
  const seen = new Set(before.map(key));
  const added = now.filter((phrase) => !seen.has(key(phrase)) && seen.add(key(phrase)));
  return [...before, ...added].slice(-MAX_ITEMS);
}

/**
 * A duration and a time of day, read from the person's own words. The model
 * files them under "limits" as often as where they belong, and the coach's
 * next move hangs on them.
 */
export function durationIn(message: string): string {
  const minutes = /(\d{1,3})\s*(?:min\b|mins\b|minutos?\b|minutes?\b)/i.exec(message);
  if (minutes) return `${minutes[1]} min`;
  const hours = /(\d(?:[.,]\d)?)\s*(?:h\b|hs\b|horas?\b|hours?\b)/i.exec(message);
  return hours ? `${hours[1]} h` : "";
}

/**
 * The hour a message gives, and whether it can be read only one way: "7pm",
 * "19:00" and "7 de la tarde" can; "a las 7" cannot.
 */
export function clockIn(message: string): { time: string; sure: boolean } | null {
  const half =
    "(am|pm|a\\.m\\.|p\\.m\\.|de la (?:mañana|manana|tarde|noche)|in the (?:morning|afternoon|evening)|at night)";
  const clock =
    new RegExp(`\\b(\\d{1,2})(?::(\\d{2}))?\\s*${half}`, "i").exec(message) ??
    /\b(?:a las?|at|around|sobre las?)\s+(\d{1,2})(?::(\d{2}))?\b()/i.exec(message) ??
    /\b(\d{1,2}):(\d{2})\b()/.exec(message);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const suffix = (clock[3] ?? "").toLowerCase();
  const morning = /^a|mañana|manana|morning/.test(suffix);
  const later = /^p|tarde|noche|afternoon|evening|night/.test(suffix);
  if (later && hour < 12) hour += 12;
  if (morning && hour === 12) hour = 0;
  if (hour > 23) return null;
  return {
    time: `${String(hour).padStart(2, "0")}:${clock[2] ?? "00"}`,
    sure: Boolean(suffix) || hour >= 13 || hour === 0,
  };
}

export function timeIn(message: string): string {
  return clockIn(message)?.time ?? "";
}

/** Months and weeks, as the model noted them, in weeks. */
const weeksOf = (months: unknown, weeks: unknown) => {
  const whole = (value: unknown) =>
    typeof value === "number" && Number.isFinite(value) && value >= 1 && value <= 104
      ? Math.round(value)
      : 0;
  return Math.round(whole(months) * 4.35) + whole(weeks);
};

/**
 * What the person said that a roadmap has to keep to, as numbers (ADR-011):
 * read from the notes, so it is their word and not the coach's retelling.
 */
export interface Said {
  /** Minutes one session can be. */
  minutes?: number;
  /** Weeks the plan should run. */
  weeks?: number;
  /** Minutes of the day the sessions start. */
  time?: number;
  /** The days of the week, 0 for Sunday. */
  weekdays?: number[];
}

export function saidIn(brief: Brief | null): Said {
  const plan = brief?.plan;
  if (!plan) return {};
  return { ...plan.exact, ...(plan.weeks ? { weeks: plan.weeks } : {}) };
}

type Exact = NonNullable<NonNullable<Brief["plan"]>["exact"]>;

const minutesOf = (said: string): number => {
  const length = durationIn(said);
  const amount = Number.parseFloat(length.replace(",", "."));
  return !length ? 0 : Math.round(length.endsWith("h") ? amount * 60 : amount);
};

const clockOf = (said: string): { minutes: number; sure: boolean } | null => {
  const bare = /^\s*(\d{1,2})\s*$/.exec(said);
  const clock =
    clockIn(said) ??
    (bare && Number(bare[1]) <= 23
      ? { time: `${bare[1].padStart(2, "0")}:00`, sure: Number(bare[1]) >= 13 }
      : null);
  return clock
    ? {
        minutes: Number(clock.time.slice(0, 2)) * 60 + Number(clock.time.slice(3)),
        sure: clock.sure,
      }
    : null;
};

const sameDays = (a: number[], b: number[]) =>
  a.length === b.length && a.every((day, index) => day === b[index]);

/**
 * What binds a roadmap after this message (ADR-011, section 5).
 *
 * There are two readings of what the person said: their own words, read by
 * the code, and what the model noted. Each is wrong often enough alone. The
 * code reads "los viernes no voy a poder" as Friday; the model takes a day
 * from a question of the coach's. So a number binds when the two agree, and
 * when the message speaks of it and they do not, nothing binds: the planner
 * then works from the conversation, and the person sees the result on the card.
 */
function bind(
  previous: Exact,
  person: string,
  noted: { length: string; days: string; time: string }
): Exact {
  const exact: Exact = { ...previous };

  const wrote = minutesOf(person);
  const model = minutesOf(noted.length);
  if (wrote || model) {
    if (wrote && (!model || model === wrote)) exact.minutes = wrote;
    else if (!(model && !wrote && exact.minutes === model)) delete exact.minutes;
  }

  const wroteDays = weekdaysIn(person);
  const modelDays = weekdaysIn(noted.days);
  if (wroteDays.length > 0 || modelDays.length > 0) {
    if (wroteDays.length > 0 && sameDays(wroteDays, modelDays)) exact.weekdays = wroteDays;
    else if (!(wroteDays.length === 0 && exact.weekdays && sameDays(exact.weekdays, modelDays))) {
      delete exact.weekdays;
    }
  }

  // An hour written without "am" or "pm" is the same hour as one already
  // given ("a las 7", after "7pm"), or the one the model read it as
  const half = (minutes: number) => minutes % 720;
  const wroteClock = clockOf(person);
  const modelClock = clockOf(noted.time);
  if (wroteClock || modelClock) {
    if (
      wroteClock?.sure &&
      (!modelClock || half(modelClock.minutes) === half(wroteClock.minutes))
    ) {
      exact.time = wroteClock.minutes;
    } else if (wroteClock && !wroteClock.sure) {
      if (exact.time !== undefined && half(exact.time) === half(wroteClock.minutes)) {
        // said again: it stays
      } else if (modelClock?.sure && half(modelClock.minutes) === half(wroteClock.minutes)) {
        exact.time = modelClock.minutes;
      } else delete exact.time;
    } else if (!(modelClock && !wroteClock && exact.time === modelClock.minutes)) {
      delete exact.time;
    }
  }
  return exact;
}

const clockText = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

/** A yes belongs to the message it was said in: it does not carry over to the next. */
export function unagreed(brief: Brief | null): Brief | null {
  if (!brief?.agreed) return brief;
  const { agreed: _agreed, ...rest } = brief;
  return rest;
}

/**
 * Whether a message is worth a call. One that says something about the
 * person is. So is any word at all once a plan is on the table: "sí" is what
 * decides whether it goes into the app.
 */
export function worthNoting(message: string, brief: Brief | null): boolean {
  const words = message.trim().split(/\s+/).filter(Boolean).length;
  if (brief?.plan) return words >= 1;
  return words >= 8 || (brief !== null && words >= 4);
}

/** The questions in a reply: what the person's next message answers. */
function questionsIn(reply: string): string {
  return (reply.match(/[^.!?¿\n]*\?/g) ?? [])
    .map((question) => question.replace(/[*_#>-]/g, "").trim())
    .filter((question) => question.length > 8)
    .slice(-4)
    .join("\n");
}

/**
 * The notes after the person's newest message. Any failure leaves them as
 * they were: they help the answer, they are not needed for it.
 */
export async function updateBrief(options: {
  chat: Chat;
  brief: Brief | null;
  /** The coach's last reply, when there is one: only its questions are passed on. */
  coach?: string;
  person: string;
  language: string;
  signal?: AbortSignal;
}): Promise<Brief | null> {
  const { brief } = options;
  try {
    const asked = options.coach ? questionsIn(options.coach) : "";
    const reply = await options.chat(
      [
        { role: "system", content: PROMPT(options.language) },
        {
          role: "user",
          content: `${
            asked ? `The coach had asked:\n"""\n${asked}\n"""\n\n` : ""
          }The person says:\n"""\n${options.person.slice(0, 4000)}\n"""`,
        },
      ],
      [KEEP_NOTES],
      options.signal,
      { reasoning: false, maxTokens: 600, toolChoice: "required" }
    );
    const call = reply.toolCalls.find((one) => one.function.name === "keep_notes");
    if (!call) return unagreed(brief);
    const notes = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    const plan = (notes.plan && typeof notes.plan === "object" ? notes.plan : {}) as Record<
      string,
      unknown
    >;
    const wanted = Boolean(brief?.plan) || plan.wanted === true;
    const noted = {
      length: text(plan.session_length),
      days: text(plan.days),
      time: text(plan.time),
    };
    const exact = bind(brief?.plan?.exact ?? {}, options.person, noted);
    const next: Brief = {
      wants: merge(brief?.wants ?? [], strings(notes.wants)),
      has: merge(brief?.has ?? [], strings(notes.has)),
      limits: merge(brief?.limits ?? [], strings(notes.limits)),
      unsure: merge(brief?.unsure ?? [], strings(notes.unsure)),
      ...(wanted
        ? {
            plan: {
              // What they said later replaces what they said before
              length: noted.length || durationIn(options.person) || brief?.plan?.length || "",
              days: noted.days || brief?.plan?.days || "",
              time:
                (exact.time !== undefined ? clockText(exact.time) : "") ||
                noted.time ||
                brief?.plan?.time ||
                timeIn(options.person),
              start: text(plan.start) || brief?.plan?.start || "",
              ...(weeksOf(plan.months, plan.weeks) || brief?.plan?.weeks
                ? { weeks: weeksOf(plan.months, plan.weeks) || brief?.plan?.weeks }
                : {}),
              exact,
              ...(brief?.plan?.given ? { given: true } : {}),
              ...(brief?.plan?.built ? { built: true } : {}),
            },
          }
        : {}),
    };
    if (brief?.asked) next.asked = brief.asked;
    if (notes.agrees === true) next.agreed = true;
    const total = LISTS.reduce((sum, name) => sum + next[name].length, 0);
    return total === 0 && !next.plan ? unagreed(brief) : next;
  } catch {
    return unagreed(brief);
  }
}

/**
 * What exact advice still needs and the person has not said. Worked out here,
 * not by the model: a plan cannot be built without knowing how long a session
 * can be and on which days.
 */
export function missingFrom(brief: Brief): string[] {
  const missing: string[] = [];
  if (brief.wants.length === 0) missing.push("what they want out of it");
  if (brief.plan) {
    if (!brief.plan.length) missing.push("how long one session can be");
    if (!brief.plan.days) missing.push("which days of the week");
    if (!brief.plan.time) missing.push("at what time of day, if they want a fixed one");
  } else if (brief.has.length === 0) {
    missing.push("what they have to work with");
  }
  return missing;
}

/** The notes as the coach reads them, next to the person's message. Empty when there are none. */
export function briefLines(brief: Brief | null): string {
  if (!brief) return "";
  const line = (label: string, items: string[]) =>
    items.length > 0 ? `\n- ${label}: ${items.join("; ")}` : "";
  const plan = brief.plan
    ? [
        brief.plan.length && `one session: ${brief.plan.length}`,
        brief.plan.days && `days: ${brief.plan.days}`,
        brief.plan.time && `time: ${brief.plan.time}`,
        brief.plan.start && `start: ${brief.plan.start}`,
        brief.plan.weeks && `the plan runs ${brief.plan.weeks} weeks`,
      ].filter((item): item is string => Boolean(item))
    : [];
  const lines =
    line("They want", brief.wants) +
    line("They have / they are", brief.has) +
    line("Any plan has to respect", [...brief.limits, ...plan]) +
    line("Said only as a guess, never state it as a fact", brief.unsure);
  if (!lines) return "";
  return `What they have told you so far, in their words. Build on it and never ask for any of it again:${lines}`;
}

/**
 * The coach's move this turn, decided from the notes and not left to the
 * model: ask for what is missing (in two replies at most), or recommend.
 * A question of the person's always comes first.
 */
export function nextMove(brief: Brief | null, personAsked: boolean): string {
  if (!brief) return "";
  const missing = missingFrom(brief);
  const answer = personAsked
    ? "They asked you something: answer it first, directly, with the number if it has one. "
    : "";
  if (missing.length > 0 && (brief.asked ?? 0) < 2 && !personAsked) {
    return `If they want advice or a plan: do not give it yet. In one short message, ask only for what they have not told you, two things at most: ${missing
      .slice(0, 2)
      .join("; ")}. Ask nothing else.`;
  }
  if (!brief.plan) return answer;
  if (brief.plan.built) {
    return `${answer}The plan is in the app already, as a roadmap with its sessions on the calendar. Do not build it again and do not ask for a yes to it. If they ask to change something in it (the days, the time, how many sessions, what a session contains), hand the planner only that change; otherwise answer what they say.`;
  }
  if (brief.plan.given) {
    const keep =
      "You have already given them the plan: it is in the conversation. Do not write it out again, and do not change its length, its days or its phases unless they ask for that; if they ask for a change, say only what changes.";
    return brief.agreed
      ? `${answer}${keep} They have said yes: put the plan in the app now, in this reply. Read the roadmap guide, then call the tool before you say anything about it; never say something is saved before the tool has answered.`
      : `${answer}${keep} They have not said yes to it yet: put nothing in the app in this reply, and end by asking for their yes.`;
  }
  const open =
    missing.length > 0
      ? ` If they still have not said ${missing.join(" or ")}, say what you assume and ask them to confirm it; never ask again for something that is in the notes or in the conversation.`
      : "";
  return `${answer}Give them the plan now, whole, built on the notes above.${open} Close it with two or three lines on how it fits the time and the limits they gave (add up the minutes of what a session contains), and ask for their yes. Do not read these notes back to them, and put nothing in the app before their yes.`;
}
