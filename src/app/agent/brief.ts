import type { ChatMessage, ChatOptions, ModelReply } from "./llm";
import { daysStated, phaseWeeks, weekdayNames, weekdaysIn, weeksUntil } from "./when";
import { t } from "../i18n";

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
    exact?: { minutes?: number; time?: number };
    /** The coach has laid a plan out for them already. */
    given?: boolean;
    /** The plan is in the app: a roadmap was saved for it in this conversation. */
    built?: boolean;
    /**
     * The days and the weeks of each phase as the conversation stated them,
     * kept when they were said: a compaction replaces the messages they were
     * read from, and a roadmap saved after it lost them (a plan for every day
     * was saved on Mondays only, read from "starting on Monday").
     */
    stated?: {
      days?: number[];
      daysQuote?: string;
      daysBy?: "person" | "coach";
      /** The days the person named themselves, whatever the coach said after. */
      personDays?: number[];
      phaseWeeks?: number[];
    };
  };
  /**
   * Whether their latest message says yes to what the coach proposed. Nothing
   * goes into the app on the coach's own reading of the mood.
   */
  agreed?: boolean;
  /**
   * What their yes came with: a wish or a limit said in the same message
   * ("yes, and I also want…"). It goes into the plan before it is saved.
   */
  added?: string[];
  /**
   * Facts the numbers of the plan depend on and the person has not given
   * ("how heavy the dumbbells are"), worked out once when a plan is first
   * wanted. Asked for once, with the rest; emptied when they have been.
   */
  needs?: string[];
  /**
   * What they have that a plan can use (equipment, a place, a skill), read
   * once with the needs. The roadmap has to use it somewhere.
   */
  use?: string[];
  /** Whether their latest message asks for something to be looked up. */
  research?: boolean;
  /** Whether their latest message tells the app to do something now. */
  instruction?: boolean;
  /**
   * Replies in which the coach has asked them questions. Kept here, not
   * counted from the conversation, so a compaction does not start it over.
   */
  asked?: number;
}

const LISTS = ["wants", "has", "limits", "unsure"] as const;

/** Words that ask the coach to do something, not words about the person or the life wanted. */
const REQUEST_TO_COACH =
  /\b(roadmap|hoja de ruta|anota|anotalo|agrega|agregalo|investiga|investigues|busca|haz el|hacer el|tendrias que|tambien tendrias|si dale|dale|arma|armalo|armarlo|armar|empezando|empieza|guarda|guardalo|guardarlo|hazlo)\b/;

/** Whether a phrase is a request to the coach (to note, to build, to start on a day), not something about the person. */
export function isRequestToCoach(phrase: string): boolean {
  return REQUEST_TO_COACH.test(
    phrase
      .toLocaleLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  );
}
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

instruction: true when this message tells the app to do or change something (add, move, schedule, delete, write down; "move my sessions to Saturday"), or reports something the app has to record: that they started, finished or stopped something. Wanting a plan made, or agreeing to one, is not an instruction.

research: true only when this message asks the coach to look something up, search the internet or check what is known about it.

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
        research: { type: "boolean" },
        instruction: { type: "boolean" },
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
      required: [...LISTS, "agrees", "research", "instruction", "plan"],
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
  if (hours) return `${hours[1]} h`;
  // Said in words, as people do
  if (/\b(hora y media|an hour and a half)\b/i.test(message)) return "90 min";
  if (/\b(media hora|half an hour)\b/i.test(message)) return "30 min";
  if (/\b(un cuarto de hora|a quarter of an hour)\b/i.test(message)) return "15 min";
  if (/\b(una hora|an hour|one hour)\b/i.test(message)) return "60 min";
  return "";
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
  if (!clock) {
    // An hour said by its name
    if (/\b(mediod[ií]a|noon|midday)\b/i.test(message)) return { time: "12:00", sure: true };
    if (/\b(medianoche|midnight)\b/i.test(message)) return { time: "00:00", sure: true };
    return null;
  }
  let hour = Number(clock[1]);
  let suffix = (clock[3] ?? "").toLowerCase();
  // "Por la mañana a las 7": the part of the day is said apart from the hour
  if (!suffix) {
    if (/\b(por|en|de) la (ma[ñn]ana)\b|\bin the morning\b/i.test(message)) suffix = "mañana";
    else if (
      /\b(por|en|de) la (tarde|noche)\b|\bin the (afternoon|evening)\b|\bat night\b/i.test(message)
    ) {
      suffix = "tarde";
    }
  }
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
  /** The weekday they said it starts on ("empezando el lunes"), 0 for Sunday. */
  startOn?: number;
  /** What their yes came with: the roadmap has to carry it. */
  added?: string[];
  /** The links that may be written in a roadmap: from the searches and the person. */
  links?: string[];
  /** What they have that the roadmap's sessions can use. */
  use?: string[];
  /**
   * The days of the week as the conversation last stated them, with the line
   * that does. They bind nothing: a roadmap on other days is sent back once.
   */
  days?: number[];
  daysQuote?: string;
  /** Who named them: the person's own words, or a plan the coach proposed. */
  daysBy?: "person" | "coach";
  /** The weeks of each phase of the plan they agreed to, when it names them. */
  phaseWeeks?: number[];
}

export function saidIn(brief: Brief | null): Said {
  const plan = brief?.plan;
  if (!plan) return {};
  // "Starting on Monday": one weekday in what they said of the start, and nothing else to mistake
  const start = weekdaysIn(plan.start);
  return {
    ...plan.exact,
    ...(plan.weeks ? { weeks: plan.weeks } : {}),
    ...(start.length === 1 ? { startOn: start[0] } : {}),
    ...(brief?.added?.length ? { added: brief.added } : {}),
    ...(brief?.use?.length ? { use: brief.use } : {}),
  };
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

/**
 * What binds a roadmap after this message (ADR-011, section 5).
 *
 * There are two readings of what the person said: their own words, read by
 * the code, and what the model noted. Each is wrong often enough alone. The
 * code reads "los viernes no voy a poder" as Friday; the model takes a day
 * from a question of the coach's. So a number binds when the two agree, and
 * when the message speaks of it and they do not, nothing binds: the planner
 * then works from the conversation, and the person sees the result on the card.
 *
 * Days of the week bind nothing at all. Both readings take "empezando el
 * lunes" for a plan on Mondays; no rule tried here told the days of a plan
 * from the day it starts, so the planner copies them from the conversation.
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

/**
 * A yes, and a request to look something up, belong to the message they were
 * said in: they do not carry over to the next.
 */
export function unagreed(brief: Brief | null): Brief | null {
  if (!brief?.agreed && !brief?.research && !brief?.instruction && !brief?.added) return brief;
  const {
    agreed: _agreed,
    research: _research,
    instruction: _instruction,
    added: _added,
    ...rest
  } = brief;
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
  // Three words can ask for anything; one or two ("hola", "terminé") are read by the model alone
  return words >= 3;
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
 * Whether the person speaks of pain or an injury: then the coach says once
 * that it is not a doctor, what is safe to change now, and when to see one.
 */
export function speaksOfPain(text: string): boolean {
  const plain = text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(dolor(es)?|duele|me duelen?|lesion|lastim\w*|molestia|hurts?|pain(ful)?|injur\w*|sore)\b/.test(
    plain
  );
}

/**
 * Whether a message asks for a plan, a routine or a programme: "¿qué me
 * recomiendas como plan a corto y largo plazo?" was noted by a 9B model as
 * no plan wanted, and the coach never got to one. Read here as well.
 */
export function asksForPlan(message: string): boolean {
  const text = message
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(plan(es)?|rutina|programa de|roadmap|hoja de ruta|routine|training plan|programme|program)\b/.test(
    text
  );
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
  /** Today, to count the weeks to an end named by the calendar. */
  now?: Date;
  /** Called when the message was read: the notes now speak of it. */
  onRead?: () => void;
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
    const wanted = Boolean(brief?.plan) || plan.wanted === true || asksForPlan(options.person);
    const noted = {
      length: text(plan.session_length),
      days: text(plan.days),
      time: text(plan.time),
    };
    const exact = bind(brief?.plan?.exact ?? {}, options.person, noted);
    // An instruction about the day ("add reading, 20 minutes") says nothing lasting
    // about the person: whatever the model listed for it is not kept
    const lasting = notes.instruction === true && plan.wanted !== true ? {} : notes;
    // An end named by the calendar is counted from today, not from whole months
    const weeks =
      weeksUntil(options.person, options.now ?? new Date()) ||
      weeksOf(plan.months, plan.weeks) ||
      brief?.plan?.weeks;
    const known = new Set(
      [...(brief?.wants ?? []), ...(brief?.limits ?? [])].map((phrase) =>
        phrase.toLocaleLowerCase()
      )
    );
    const added = [...strings(lasting.wants), ...strings(lasting.limits)].filter(
      // "Armarlo así, empezando el sábado" is what their yes asks for, not something they added
      (phrase) => !known.has(phrase.toLocaleLowerCase()) && !isRequestToCoach(phrase)
    );
    const next: Brief = {
      wants: merge(brief?.wants ?? [], strings(lasting.wants)),
      has: merge(brief?.has ?? [], strings(lasting.has)),
      limits: merge(brief?.limits ?? [], strings(lasting.limits)),
      unsure: merge(brief?.unsure ?? [], strings(lasting.unsure)),
      ...(wanted
        ? {
            plan: {
              // What they said later replaces what they said before
              length: noted.length || durationIn(options.person) || brief?.plan?.length || "",
              // The days they gave, even when the model did not note them as days ("todos los días")
              days:
                noted.days ||
                (() => {
                  const given = daysStated(options.person);
                  return given ? weekdayNames(given.days) : "";
                })() ||
                brief?.plan?.days ||
                "",
              time:
                (exact.time !== undefined ? clockText(exact.time) : "") ||
                noted.time ||
                brief?.plan?.time ||
                timeIn(options.person),
              start: text(plan.start) || brief?.plan?.start || "",
              ...(weeks ? { weeks } : {}),
              exact,
              ...(brief?.plan?.given ? { given: true } : {}),
              ...(brief?.plan?.built ? { built: true } : {}),
              ...(brief?.plan?.stated ? { stated: brief.plan.stated } : {}),
            },
          }
        : {}),
    };
    if (brief?.asked) next.asked = brief.asked;
    if (brief?.needs) next.needs = brief.needs;
    if (brief?.use) next.use = brief.use;
    // (agreed and research are of this message alone: they are set below, never carried)
    if (notes.agrees === true) next.agreed = true;
    // A yes that comes with something new: the plan takes it in before it is saved
    if (next.agreed && brief?.plan?.given && !brief.plan.built && added.length > 0) {
      next.added = added.slice(0, 4);
    }
    if (notes.research === true) next.research = true;
    if (notes.instruction === true) next.instruction = true;
    options.onRead?.();
    const total = LISTS.reduce((sum, name) => sum + next[name].length, 0);
    // Empty notes still say what this message is: an instruction, a yes, a request to look something up
    const speaks = next.agreed || next.research || next.instruction;
    return total === 0 && !next.plan && !speaks ? unagreed(brief) : next;
  } catch {
    return unagreed(brief);
  }
}

const CHECK_PLAN = {
  type: "function" as const,
  function: {
    name: "check_plan",
    description: "What a plan leaves out of what the person said.",
    parameters: {
      type: "object",
      properties: {
        not_used: {
          type: "array",
          maxItems: 4,
          items: said(
            "A thing from THEY HAVE (equipment, a tool, a place, a skill) that the plan could use and never mentions. Copied as it is written there."
          ),
        },
        not_given: {
          type: "array",
          maxItems: 4,
          items: said(
            "A thing from THEY ASKED FOR that the plan does not give: a part they asked every session to have, a number they asked for. Copied as it is written there."
          ),
        },
        breaks: {
          type: "array",
          maxItems: 3,
          items: said(
            "A limit from IT HAS TO RESPECT that a line of the plan goes against, with that line."
          ),
        },
        out_of_reach: {
          type: "array",
          maxItems: 1,
          items: said(
            "A goal the plan says it reaches that its own numbers do not reach (a distance, an amount or a level that does not fit in the time the plan gives), with the numbers. Empty when the plan's numbers reach what it promises."
          ),
        },
      },
      required: ["not_used", "not_given", "breaks", "out_of_reach"],
    },
  },
};

const bare = (words: string) =>
  words
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

/** Whether the plan names this thing: one of its longer words, or its stem, is in it. */
function named(thing: string, plan: string): boolean {
  const words = bare(thing)
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 5);
  if (words.length === 0) return true;
  return words.some((word) => plan.includes(word.slice(0, Math.max(5, word.length - 2))));
}

/**
 * What a plan the coach has just written leaves out of the notes (ADR-012):
 * something they have and it never uses, something they asked it to contain
 * and it does not. A 9B model writes a plan with the notes in front of it and
 * still forgets the dumbbells it was told about; asked afterwards to compare
 * the two, it sees it. Two readings again: a thing "not used" counts only if
 * the code does not find it in the plan either. Empty when nothing is missing,
 * and on any failure: the check improves a plan, it is not needed for one.
 */
/** The links in a text, without what closes a sentence or a Markdown link around them. */
export function linksIn(text: string): string[] {
  return [...text.matchAll(/https?:\/\/[^\s)\]>"']+/g)].map((found) =>
    found[0].replace(/[.,;:!?]+$/, "")
  );
}

/** The same page, written with or without its last slash or its case. */
export const samePage = (one: string, other: string) =>
  one.replace(/\/+$/, "").toLocaleLowerCase() === other.replace(/\/+$/, "").toLocaleLowerCase();

export async function planGaps(options: {
  chat: Chat;
  brief: Brief;
  plan: string;
  signal?: AbortSignal;
  /** The links the plan may give: what the searches returned and what the person wrote. */
  links?: string[];
}): Promise<string[]> {
  const { brief, plan } = options;
  // Counted here, not asked of a model: a session written longer than the one they have
  const theirs = brief.plan?.exact?.minutes;
  const longest = Math.max(
    0,
    ...[...plan.matchAll(/(\d{1,3})\s*(?:min\b|minutos?\b|minutes?\b)/gi)].map((found) =>
      Number(found[1])
    )
  );
  const over =
    theirs && longest > theirs * 1.1
      ? [
          `it names ${longest} minutes, and one session is ${theirs} minutes in every phase unless they asked for longer ones`,
        ]
      : [];
  const choice = openChoice(plan);
  if (choice) {
    over.push(
      `it leaves a number as a choice ("${choice}"): give one value for each phase, the one they start with, and say what goes up in the next phase and by how much`
    );
  }
  // The phases' weeks add up to how long they asked for: three months is about 13, not 9
  const asked = brief.plan?.weeks;
  const phases = phaseWeeks(plan);
  if (asked && phases) {
    const runs = phases.reduce((sum, weeks) => sum + weeks, 0);
    if (Math.abs(runs - asked) > Math.max(1, Math.round(asked * 0.15))) {
      over.push(
        `its phases run ${runs} weeks (${phases.join(" + ")}), and they asked for about ${asked}: make the phases add up to ${asked} weeks`
      );
    }
  }
  // A link nobody found is made up: "youtube.com/watch?v=example_stretch"
  if (options.links) {
    const known = options.links;
    const invented = linksIn(plan).filter((link) => !known.some((one) => samePage(one, link)));
    if (invented.length > 0) {
      over.push(
        `it links to pages no search of yours returned (${invented.slice(0, 3).join(", ")}): a link you did not find does not exist. Use only these, each for what it shows: ${
          known.slice(0, 8).join(", ") || "none, so write no link"
        }`
      );
    }
  }
  const totals = wrongTotals(plan);
  if (totals.length > 0) {
    over.push(
      `its arithmetic is wrong: ${totals.join("; ")}. Change the numbers so each line adds up to the total it states, within the minutes of a session`
    );
  }
  const count = miscounted(plan, brief.plan?.weeks);
  if (count) {
    over.push(
      `it says ${count.said} sessions, and ${count.weeks} weeks on ${count.perWeek} day${count.perWeek === 1 ? "" : "s"} a week are ${count.expected}`
    );
  }
  const full = theirs ? overfull(plan, theirs) : null;
  if (full) {
    over.push(
      `in "${full.phase}" the timed parts of one session add up to ${full.sum} minutes, and a session is ${theirs}`
    );
  }
  // Timed while the comparison is made: one more short call, not one more wait
  const session = theirs ?? minutesOf(brief.plan?.length ?? "");
  const timing = session
    ? sessionTakes({ chat: options.chat, plan, minutes: session, signal: options.signal }).then(
        (takes) => {
          if (takes) {
            over.push(
              `done as written, with every set and every rest, one session of the first phase takes about ${takes} minutes, and a session is ${session}: cut exercises, sets or rounds in every phase until one session really fits, and give each part its minutes`
            );
          }
        }
      )
    : Promise.resolve();
  if (brief.has.length + brief.wants.length + brief.limits.length === 0) {
    await timing;
    return over;
  }
  try {
    const reply = await options.chat(
      [
        {
          role: "system",
          content:
            "You compare a plan with what a person said, and list only what is plainly left out. Most plans leave out little: empty lists are a good answer. Copy each thing as it is written; add nothing of your own.",
        },
        {
          role: "user",
          content: `THEY HAVE:\n${brief.has.map((one) => `- ${one}`).join("\n") || "-"}\n\nTHEY ASKED FOR:\n${
            brief.wants.map((one) => `- ${one}`).join("\n") || "-"
          }\n\nIT HAS TO RESPECT:\n${
            [...brief.limits, brief.plan?.length ? `one session: ${brief.plan.length}` : ""]
              .filter(Boolean)
              .map((one) => `- ${one}`)
              .join("\n") || "-"
          }\n\nTHE PLAN:\n"""\n${plan.slice(0, 5000)}\n"""`,
        },
      ],
      [CHECK_PLAN],
      options.signal,
      { reasoning: false, maxTokens: 300, toolChoice: "required" }
    );
    const call = reply.toolCalls.find((one) => one.function.name === "check_plan");
    await timing;
    if (!call) return over;
    const found = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    const text = bare(plan);
    const theirs = (list: string[], from: string[]) =>
      list.filter((one) =>
        from.some((item) => bare(item).includes(bare(one)) || bare(one).includes(bare(item)))
      );
    const unused = theirs(strings(found.not_used), brief.has).filter(
      (thing) => !named(thing, text)
    );
    const missing = theirs(strings(found.not_given), brief.wants);
    const breaks = strings(found.breaks);
    const unreachable = strings(found.out_of_reach).slice(0, 1);
    return [
      ...over,
      ...(unused.length ? [`it never uses what they have: ${unused.join("; ")}`] : []),
      ...(missing.length ? [`it does not give what they asked for: ${missing.join("; ")}`] : []),
      ...(breaks.length ? [`it goes against a limit: ${breaks.join("; ")}`] : []),
      ...(unreachable.length
        ? [
            `it promises what its numbers do not reach (${unreachable[0]}): say so plainly before the plan, with the numbers, and offer the two ways out (more time per session, or a goal that fits); do not promise it`,
          ]
        : []),
    ];
  } catch {
    await timing;
    return over;
  }
}

/** How many of the things they have are looked at: the latest, which are the ones a plan is about. */
const MAX_THINGS = 8;

/** One yes-or-no pair per thing they have, and room for one fact that is none of them. */
const whatToAsk = (things: string[]) => ({
  type: "function" as const,
  function: {
    name: "what_to_ask",
    description: "For each thing the person has: does the plan need its measure, and was it said.",
    parameters: {
      type: "object",
      properties: {
        ...Object.fromEntries(
          things.map((thing, index) => [
            `thing_${index + 1}`,
            {
              type: "object",
              description: thing,
              properties: {
                plan_needs_its_measure: { type: "boolean" },
                measure_was_said: { type: "boolean" },
                plan_could_use: { type: "boolean" },
              },
              required: ["plan_needs_its_measure", "measure_was_said", "plan_could_use"],
            },
          ])
        ),
        other: {
          type: "array",
          maxItems: 1,
          items: said(
            "One more fact a number of the plan depends on, that is none of the things above and that they did not say. Written as what to ask for, in a few words. Never the days, the time of day or the length of a session."
          ),
        },
      },
      required: [...things.map((_, index) => `thing_${index + 1}`), "other"],
    },
  },
});

/**
 * What the numbers of a plan depend on and the person has not said (ADR-012):
 * asked for a plan "with the weight for each exercise" by someone who has
 * "dumbbells", a coach has to know how heavy they are, and a 9B model writing
 * the plan does not stop to ask.
 *
 * Asked in the open ("what is missing?") the same model answered "nothing"
 * for that case, two times out of two. Asked thing by thing, yes or no, it
 * got it right both times, and right again once the weights had been said.
 * So the question is put thing by thing, about whatever they have: nothing
 * here knows what a dumbbell is. Two readings, as with the notes: a thing
 * written with a number in it has its measure, whatever the model says.
 *
 * Worked out once, when a plan is first wanted; empty on any failure.
 */
export async function planNeeds(options: {
  chat: Chat;
  brief: Brief;
  signal?: AbortSignal;
}): Promise<{ needs: string[]; use: string[] }> {
  const { brief } = options;
  const things = brief.has.slice(-MAX_THINGS);
  try {
    const reply = await options.chat(
      [
        {
          role: "system",
          content:
            "A coach is about to write a plan for a person, with the numbers they asked for. For each thing listed under THEY HAVE, answer two questions. plan_needs_its_measure: would the coach need to know how much of it, how big, how heavy or how advanced it is, to set a number in the plan? measure_was_said: did the person already give that measure, as a number, anywhere in their words? plan_could_use: is it something a plan can use in what it asks the person to do (equipment, a tool, a place, a skill they have)? Their body measures, their past and the time they have are not. Then, under other, at most one more fact a number of the plan depends on and they did not give, in any words: 'I have never run' already says how much they run. Leave it empty when there is none.",
        },
        {
          role: "user",
          content: `THEY ASKED FOR:\n${brief.wants.map((one) => `- ${one}`).join("\n") || "-"}\n\nTHEY HAVE:\n${
            things.map((thing, index) => `thing_${index + 1}: ${thing}`).join("\n") || "-"
          }\n\nLIMITS:\n${brief.limits.map((one) => `- ${one}`).join("\n") || "-"}`,
        },
      ],
      [whatToAsk(things)],
      options.signal,
      { reasoning: false, maxTokens: 300, toolChoice: "required" }
    );
    const call = reply.toolCalls.find((one) => one.function.name === "what_to_ask");
    if (!call) return { needs: [], use: [] };
    const found = JSON.parse(call.function.arguments || "{}") as Record<string, unknown>;
    const use = things.filter(
      (_, index) =>
        (found[`thing_${index + 1}`] as Record<string, unknown> | undefined)?.plan_could_use ===
        true
    );
    const unmeasured = things.filter((thing, index) => {
      const answer = found[`thing_${index + 1}`] as Record<string, unknown> | undefined;
      return (
        answer?.plan_needs_its_measure === true &&
        answer.measure_was_said !== true &&
        // Written with a number: the measure is there
        !/\d/.test(thing)
      );
    });
    const other = strings(found.other)
      .map((fact) => fact.trim())
      .filter((fact) => fact.length > 0 && fact.length <= 120)
      .slice(0, 1);
    return {
      needs: [
        ...(unmeasured.length > 0
          ? [
              `the measure of what they have, if they know it (how much, how heavy, what size or what level): ${unmeasured.join("; ")}`,
            ]
          : []),
        ...other,
      ],
      use,
    };
  } catch {
    return { needs: [], use: [] };
  }
}

const TIME_SESSION = {
  type: "function" as const,
  function: {
    name: "time_session",
    description:
      "The parts of one session of the first phase, each with the minutes it really takes.",
    parameters: {
      type: "object",
      properties: {
        parts: {
          type: "array",
          maxItems: 14,
          items: {
            type: "object",
            properties: {
              part: { type: "string" },
              sets_or_rounds: { type: "number" },
              minutes: { type: "number" },
            },
            required: ["part", "sets_or_rounds", "minutes"],
          },
        },
      },
      required: ["parts"],
    },
  },
};

/** How far over the session an estimate has to be before it is said: the estimate is rough. */
const OVER = 1.1;

/**
 * The minutes one session of the first phase really takes, done as written
 * (ADR-012). A 9B model fits eight exercises of three sets into "15 minutes"
 * and says it adds up. Asked to time the same session part by part, sets and
 * rests included, it comes to thirty or forty; a session that does fit, it
 * times at or under its length. The parts are the model's, the sum is the
 * code's. Null when it fits, when nothing was timed, and on any failure.
 */
export async function sessionTakes(options: {
  chat: Chat;
  plan: string;
  minutes: number;
  signal?: AbortSignal;
}): Promise<number | null> {
  try {
    const reply = await options.chat(
      [
        {
          role: "system",
          content:
            "You time one session of a plan as a person would really do it. List every part of ONE session of the FIRST phase, in order, and for each the minutes it really takes when done as written: every repetition, every set or round, and the rests between them. Do not copy the minutes the plan claims: work them out from what has to be done.",
        },
        { role: "user", content: `THE PLAN:\n"""\n${options.plan.slice(0, 5000)}\n"""` },
      ],
      [TIME_SESSION],
      options.signal,
      { reasoning: false, maxTokens: 1000, toolChoice: "required" }
    );
    const call = reply.toolCalls.find((one) => one.function.name === "time_session");
    if (!call) return null;
    const found = JSON.parse(call.function.arguments || "{}") as { parts?: unknown };
    const parts = Array.isArray(found.parts) ? found.parts : [];
    const sum = parts.reduce((total: number, part) => {
      const minutes = (part as { minutes?: unknown } | null)?.minutes;
      return total + (typeof minutes === "number" && minutes > 0 && minutes < 600 ? minutes : 0);
    }, 0);
    return parts.length >= 2 && sum > options.minutes * OVER ? Math.round(sum) : null;
  } catch {
    return null;
  }
}

/**
 * A quantity the plan leaves as a choice between two values ("5 kg o 10 kg",
 * "20 or 30 min"): the person asked for the number, and a plan that gives
 * two gives none. Written with the same unit, or the unit after the second.
 */
export function openChoice(plan: string): string | null {
  const found =
    /(\d+(?:[.,]\d+)?)\s*(kg|kilos?|lbs?|libras?|min|minutos?|minutes?|seg|segundos?|km)?\s+(?:o|or)\s+(\d+(?:[.,]\d+)?)\s*(kg|kilos?|lbs?|libras?|min|minutos?|minutes?|seg|segundos?|km|reps?|repeticiones|series)\b/i.exec(
      plan
    );
  if (!found) return null;
  // "10 o 12 repeticiones" is a range people write for reps; the weight and the time are the ones to settle
  if (/^(reps?|repeticiones|series)$/i.test(found[4])) return null;
  return `${found[1]}${found[2] ? ` ${found[2]}` : ""} or ${found[3]} ${found[4]}`;
}

/**
 * Lines of a plan that repeat a block a number of times and state the total
 * ("run 5 min, walk 2 min, repeat 3 times + 5 min = 30 min") when the numbers
 * do not give that total: 3 x (5 + 2) + 5 is 26. Each found line is given back
 * with what it really adds up to. Lines that do not state both are left alone.
 */
export function wrongTotals(plan: string): string[] {
  const found: string[] = [];
  for (const line of plan.split("\n")) {
    const stated = /=\s*(\d{1,3})\s*min/i.exec(line);
    const times =
      /(?:repet\w*|repeat\w*|x|×)\s*(\d{1,2})\s*(?:veces|times|rondas|rounds)?|(\d{1,2})\s*(?:veces|times|rondas|rounds)/i.exec(
        line
      );
    if (!stated || !times) continue;
    const before = line.slice(0, times.index);
    const after = line.slice(times.index + times[0].length, stated.index);
    const block = [...before.matchAll(/(\d{1,3})\s*(?:min|minutos?|minutes?)\b/gi)].map((m) =>
      Number(m[1])
    );
    const extra = [...after.matchAll(/(\d{1,3})\s*(?:min|minutos?|minutes?)\b/gi)].map((m) =>
      Number(m[1])
    );
    if (block.length === 0) continue;
    const count = Number(times[1] ?? times[2]);
    const total = block.reduce((a, b) => a + b, 0) * count + extra.reduce((a, b) => a + b, 0);
    const claimed = Number(stated[1]);
    if (Math.abs(total - claimed) > Math.max(1, claimed * 0.05)) {
      found.push(
        `"${line.replace(/[*_#]/g, "").trim().slice(0, 90)}" says ${claimed} min and adds up to ${total}`
      );
    }
  }
  return found.slice(0, 3);
}

/**
 * A total of sessions a plan states that its own weeks and days do not give:
 * seven weeks on three days a week, and a 9B model wrote "49 sessions". The
 * days are the ones the plan names; with none named there is nothing to count.
 */
export function miscounted(
  plan: string,
  weeks: number | undefined
): { said: number; weeks: number; perWeek: number; expected: number } | null {
  const perWeek = daysStated(plan)?.days.length;
  if (!weeks || !perWeek) return null;
  const expected = weeks * perWeek;
  const said = Math.max(
    0,
    ...[...plan.matchAll(/(\d{1,3})\s*(?:sesiones|sessions)\b/gi)].map((found) => Number(found[1]))
  );
  return said > expected * 1.15 ? { said, weeks, perWeek, expected } : null;
}

/**
 * The parts of a session as a plan times them ("warm-up (3 min)", "20 min of
 * free talk"), added up phase by phase: the first phase whose parts come to
 * more than the session has. A label with the whole session's minutes is not
 * a part, and neither is a line that speaks of progress or of a goal ("by
 * week 4, talk for 3-4 minutes").
 */
export function overfull(plan: string, minutes: number): { phase: string; sum: number } | null {
  const blocks = plan.split(/\n(?=[#*\s]*(?:fase|phase|etapa|stage|semanas?|weeks?)\b)/i);
  for (const block of blocks) {
    const parts = block
      .split("\n")
      .filter((line) => !/^[\s*#>\-\d.)]*(progres|objetiv|meta\b|goal|nota\b|note\b)/i.test(line))
      .flatMap((line) => [...line.matchAll(/(\d{1,3})\s*(?:min|minutos?|minutes?)\b/gi)])
      .map((found) => Number(found[1]));
    const whole = parts.indexOf(minutes);
    if (whole >= 0) parts.splice(whole, 1);
    const sum = parts.reduce((total, part) => total + part, 0);
    if (parts.length >= 2 && sum > minutes * 1.1) {
      return { phase: block.split("\n")[0].replace(/[#*_]/g, "").trim().slice(0, 60), sum };
    }
  }
  return null;
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
    missing.push(...(brief.needs ?? []));
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
const COUNT_WORDS =
  "un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce|quince|veinte|cien|mil|one|two|three|four|five|six|seven|eight|nine|ten|twelve|twenty|hundred|thousand";

/**
 * A result the person wants that can be measured: a distance, a weight, a
 * count of pages, songs, words or things, with its number ("correr 5 km",
 * "tocar tres canciones", "leer 12 libros"). Such a goal can be out of reach
 * of the time they have, and a 9B model promised "5 km without stopping" from
 * 22 minutes of jogging without noticing. Null when no such goal was said.
 */
export function measuredGoal(brief: Brief): string | null {
  const unit =
    "km|kil[oó]metros?|millas?|miles?|metros?|kg|kilos?|libras?|pounds?|p[aá]ginas?|pages?|libros?|books?|canciones?|songs?|palabras?|words?|cap[ií]tulos?|chapters?|repeticiones|reps|flexiones|lagartijas|push-?ups|dominadas|pull-?ups|niveles?|levels?|notas?|grades?";
  const found = new RegExp(
    `(\\d+(?:[.,]\\d+)?|\\b(?:${COUNT_WORDS}))\\s+(?:\\w+\\s+){0,2}?(?:${unit})\\b`,
    "i"
  );
  for (const want of brief.wants) {
    if (found.test(want)) return want;
  }
  return null;
}

export function nextMove(brief: Brief | null, personAsked: boolean): string {
  if (!brief) return "";
  // Notes with nothing in them are of someone running their day ("I have
  // started reading"): there is no advice to prepare, and nothing to ask for
  if (!brief.plan && LISTS.every((name) => brief[name].length === 0)) return "";
  const missing = missingFrom(brief);
  const answer = personAsked
    ? "They asked you something: answer it first, directly, with the number if it has one. "
    : "";
  if (missing.length > 0 && (brief.asked ?? 0) < 2 && !personAsked) {
    // A plan is asked about in one message: when, how long, and what its numbers hang on
    const most = brief.plan && brief.needs?.length ? 3 : 2;
    // Asked to look it up: what was found is theirs now, the questions come after
    const found = brief.research
      ? "They asked you to look it up: first, in a few lines, say what you found that they can use now, with its source. Then "
      : "";
    return `If they want advice or a plan: do not give the whole plan yet. ${found}${found ? "in" : "In"} one short message, ask only for what they have not told you, ${most === 3 ? "three" : "two"} things at most: ${missing
      .slice(0, most)
      .join("; ")}. Ask nothing else.`;
  }
  if (!brief.plan) {
    // No plan was asked for. If the coach is about to propose one anyway, it
    // does not make up the time the person has: told only "I never use my
    // weights", a 9B model laid out 45 minutes, three days a week, at 19:00.
    return `${answer}If you are about to propose a routine or a plan, do not lay it out yet unless the notes say how long a session can be and on which days: ask for those first, two questions at most. Never give a duration, days or an hour of your own as if they were theirs.`;
  }
  if (brief.plan.built) {
    return `${answer}The plan is DONE: it is in the app as a roadmap, with every session on the calendar. If they ask for the roadmap or the plan, tell them it is already made and that they can see it on the page called "${t("nav.goals")}" (use that name as it is). Do not build it again, do not ask for a yes to it, and ask them nothing more about it. Every session already carries what to do in it: never offer to add tasks, activities or days for it. If they ask to change something in it (the days, the time, how many sessions, what a session contains), hand the planner only that change.`;
  }
  if (brief.plan.given) {
    const keep =
      "You have already given them the plan: it is in the conversation. Do not write it out again, and do not change its length, its days or its phases unless they ask for that; if they ask for a change, say only what changes.";
    const more = brief.added?.length
      ? ` With their yes they added: ${brief.added.join("; ")}. The plan in the conversation does not have it yet: in your request to the planner say in words how the plan takes it in (what changes, in which phase, with its numbers), and after it is saved tell them in one or two lines what changed for it.`
      : "";
    return brief.agreed
      ? `${answer}${keep} They have said yes: put the plan in the app now, in this reply. Read the roadmap guide, then call the tool before you say anything about it; never say something is saved before the tool has answered.${more}`
      : `${answer}${keep} They have not said yes to it yet: put nothing in the app in this reply, and end by asking for their yes.`;
  }
  const open =
    missing.length > 0
      ? ` They have NOT told you ${missing.join(
          " or "
        )}: whatever the plan shows for it is your proposal, not their word. So the last line of your reply says which one you chose yourself and asks whether it works for them or which they prefer, together with the yes. Never ask again for something that is in the notes or in the conversation.`
      : "";
  // A measured goal is checked against the time before it is promised
  const goal = measuredGoal(brief);
  const reach = goal
    ? ` Their goal is a measured result ("${goal}"). Before you promise it, work out what reaching it takes for someone at their level, and whether that fits in ${
        brief.plan.length || "the time of a session"
      }${
        brief.plan.weeks ? ` over ${brief.plan.weeks} weeks` : ""
      }: if you are not sure of the number, look it up first. If it does not fit, the first lines of your reply say so with the numbers and offer the two ways out (more time, or a goal that fits), and the plan does not promise it.`
    : "";
  return `${answer}${reach.trim() ? `${reach.trim()} ` : ""}Give them the plan now, whole, built on the notes above, in 350 words at most: the phases, what one session contains in each, how it progresses. Everything they asked the plan to contain (the "They want" line) is there for every phase, with its number. A number that depends on something they have not told you is not left out and not invented: give the rule they use to choose it on the day, in one line. Close it with two or three lines on how it fits the time and the limits they gave (add up the minutes of what a session contains, rests included), and ask for their yes. Do not read these notes back to them, and put nothing in the app before their yes.${open}`;
}
