import type { ISystemCore, Roadmap, UUID } from "../../types";
import { localDate } from "../../system/agendaManager";
import { dayAfter, sessionDates, sessionMinutes } from "../../system/directionManager";
import { formatDayMinutes } from "../lib/format";
import { t } from "../i18n";
import { WEEKDAYS, dayLabel, startDate, timeOfDay, weekdayNames, weekdayNumbers } from "./when";
import type { Said } from "./brief";

/**
 * A working copy of the person's roadmaps (ADR-010, ADR-011). The roadmap
 * planner edits it with its tools; nothing reaches the core until the person
 * has seen the result and said yes. Every edit is checked here, and a wrong
 * one comes back as an error the planner can read and fix.
 *
 * A roadmap is made of real sessions on real days: it cannot be created
 * without saying when its sessions happen, and saving it plans them.
 */

export class DraftError extends Error {
  constructor(
    readonly code: string,
    detail: string
  ) {
    super(`${code}: ${detail}`);
  }
}

/** A step is one kind of session, not one part of it. */
const MAX_STEPS = 3;
/** Activities one request may add to the library: a session is one activity, its parts are not. */
const MAX_NEW_ACTIVITIES = 3;
const MAX_SESSIONS = 200;

interface DraftStep {
  /** The library activity's title, as the library (or a new activity of this draft) has it. */
  activity: string;
  unit: "times" | "minutes";
  amount: number;
  /** What one session of this step consists of. */
  notes?: string;
  /** How long one session of this step lasts, when not the activity's usual length. */
  minutes?: number;
}

interface DraftMilestone {
  title: string;
  note?: string;
  steps: DraftStep[];
}

interface DraftSchedule {
  weekdays: number[];
  time?: number;
  start: string;
}

interface DraftRoadmap {
  /** Set for a roadmap that already exists in the core. */
  id?: UUID;
  title: string;
  why?: string;
  targetDate?: string;
  status: Roadmap["status"];
  schedule?: DraftSchedule;
  /** What holds in every session of every phase. */
  rules?: string;
  milestones: DraftMilestone[];
}

type Fields = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
const whole = (value: unknown): number | undefined => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : undefined;
};

/** What saving a roadmap put on the calendar, in words the coach can repeat as they are. */
export interface PlannedSessions {
  roadmap: string;
  days: string;
  time?: string;
  total: number;
  first?: string;
  /** "today", "tomorrow" or "in 4 days": how far the first session is. */
  first_is?: string;
  last?: string;
  milestones: Array<{ milestone: string; sessions: number; from?: string; to?: string }>;
  /** Sessions that went straight into today's plan. */
  in_todays_plan?: string[];
}

export class RoadmapDraft {
  private roadmaps: DraftRoadmap[];
  private readonly before: string;
  private deleted: Array<{ id: UUID; title: string }> = [];
  /** Activities the plan needs that the library does not have yet: title -> minutes a session. */
  private newActivities = new Map<string, { title: string; minutes: number }>();
  private readonly library: string[];
  /** Minutes one session of each library activity lasts. */
  private readonly lengths = new Map<string, number>();
  /** A roadmap longer than asked was sent back to the planner already. */
  private sentBack = false;
  /** A roadmap on other days than the conversation names was sent back already. */
  private daysSentBack = false;
  /** A roadmap whose phases do not hold their weeks' sessions was sent back already. */
  private phasesSentBack = false;
  /** A roadmap without what the person added with their yes was sent back already. */
  private addedSentBack = false;
  /** Each stored roadmap as it was when the draft began, to tell what changed. */
  private readonly original = new Map<UUID, string>();

  constructor(
    private readonly core: ISystemCore,
    private readonly now = new Date(),
    /** What the person said that a roadmap has to keep to (ADR-011). */
    private readonly said: Said = {}
  ) {
    const templates = core.getActivityTemplates();
    const titles = new Map(templates.map((tpl) => [tpl.id, tpl.title]));
    this.library = [...titles.values()];
    for (const tpl of templates) {
      this.lengths.set(tpl.title.toLocaleLowerCase(), sessionMinutes(tpl));
    }
    this.roadmaps = core.getRoadmaps().map((roadmap) => ({
      id: roadmap.id,
      title: roadmap.title,
      why: roadmap.why,
      targetDate: roadmap.targetDate,
      status: roadmap.status,
      schedule: roadmap.schedule,
      rules: roadmap.rules,
      milestones: roadmap.milestones.map((milestone) => ({
        title: milestone.title,
        note: milestone.note,
        steps: milestone.steps.map((step) => ({
          activity: titles.get(step.templateId) ?? step.title,
          unit: step.unit,
          amount: step.amount,
          notes: step.notes,
          minutes: step.sessionMinutes,
        })),
      })),
    }));
    this.before = this.fingerprint();
    for (const roadmap of this.roadmaps) {
      if (roadmap.id) this.original.set(roadmap.id, JSON.stringify(roadmap));
    }
  }

  /** The roadmaps this draft created or changed: the only ones that are written. */
  private touched(): DraftRoadmap[] {
    return this.roadmaps.filter(
      (roadmap) => !roadmap.id || this.original.get(roadmap.id) !== JSON.stringify(roadmap)
    );
  }

  private fingerprint(): string {
    return JSON.stringify([this.roadmaps, this.deleted]);
  }

  get changed(): boolean {
    return this.fingerprint() !== this.before;
  }

  get deletes(): boolean {
    return this.deleted.length > 0;
  }

  /**
   * An edit either goes in whole or leaves the draft as it was: a call that is
   * refused half way must not leave a piece of itself behind.
   */
  private edit<T>(change: () => T): T {
    const roadmaps = JSON.stringify(this.roadmaps);
    const deleted = [...this.deleted];
    const activities = new Map(this.newActivities);
    try {
      const result = change();
      this.check();
      return result;
    } catch (caught) {
      this.roadmaps = JSON.parse(roadmaps) as DraftRoadmap[];
      this.deleted = deleted;
      this.newActivities = activities;
      throw caught;
    }
  }

  // ---------------------------------------------------------------- finding things

  private roadmap(ref: unknown): DraftRoadmap {
    const wanted = text(ref);
    const hit = wanted
      ? this.roadmaps.find((roadmap) => same(roadmap.title, wanted))
      : this.roadmaps.length === 1
        ? this.roadmaps[0]
        : undefined;
    if (!hit) {
      throw new DraftError(
        "roadmap-not-found",
        this.roadmaps.length === 0
          ? "there are no roadmaps yet; create one with save_roadmap"
          : `no roadmap "${wanted}". Roadmaps: ${this.roadmaps.map((r) => `"${r.title}"`).join(", ")}`
      );
    }
    return hit;
  }

  /** By its number (1 is the first) or its title. */
  private milestone(roadmap: DraftRoadmap, ref: unknown): DraftMilestone {
    const number = whole(ref);
    const hit =
      number !== undefined && String(ref).trim() === String(number)
        ? roadmap.milestones[number - 1]
        : roadmap.milestones.find((milestone) => same(milestone.title, text(ref)));
    if (!hit) {
      throw new DraftError(
        "milestone-not-found",
        `"${roadmap.title}" has these milestones: ${
          roadmap.milestones.map((m, i) => `${i + 1}. "${m.title}"`).join(", ") || "none"
        }`
      );
    }
    return hit;
  }

  private stepIndex(milestone: DraftMilestone, ref: unknown): number {
    const number = whole(ref);
    const index =
      number !== undefined && String(ref).trim() === String(number)
        ? number - 1
        : milestone.steps.findIndex((step) => same(step.activity, text(ref)));
    if (index < 0 || index >= milestone.steps.length) {
      throw new DraftError(
        "step-not-found",
        `"${milestone.title}" has these steps: ${
          milestone.steps.map((s, i) => `${i + 1}. "${s.activity}"`).join(", ") || "none"
        }`
      );
    }
    return index;
  }

  /**
   * A step is an amount of one real activity. The activity has to be in the
   * person's library, or be created here by saying how long a session lasts.
   */
  private step(fields: Fields, where: string): DraftStep {
    const activity = text(fields.activity);
    if (!activity) throw new DraftError("step-needs-activity", `${where}: give "activity"`);
    const known =
      this.library.find((title) => same(title, activity)) ??
      this.newActivities.get(activity.toLocaleLowerCase())?.title;
    let title = known;
    const session = whole(fields.session_minutes ?? fields.new_activity_minutes);
    if (session !== undefined && (session < 1 || session > 600)) {
      throw new DraftError("invalid-minutes", `${where}: session_minutes is 1 to 600`);
    }
    if (!title) {
      if (session === undefined) {
        throw new DraftError(
          "activity-not-found",
          `${where}: "${activity}" is not in the person's library. Library: ${
            this.library.map((item) => `"${item}"`).join(", ") || "empty"
          }. Use one of those, or create "${activity}" by giving session_minutes: how long one session lasts.`
        );
      }
      this.newActivities.set(activity.toLocaleLowerCase(), { title: activity, minutes: session });
      title = activity;
    }
    // A phase whose sessions last longer or shorter than the activity's usual keeps its own length
    const own = session !== undefined && session !== this.length(title) ? session : undefined;
    const times = whole(fields.sessions ?? fields.times);
    const minutes = whole(fields.total_minutes ?? fields.minutes);
    if ((times === undefined) === (minutes === undefined)) {
      throw new DraftError(
        "step-needs-amount",
        `${where}: give exactly one of "sessions" (how many) or "total_minutes" (minutes over all sessions), not both and not neither. The length of one session is session_minutes.`
      );
    }
    const amount = times ?? minutes!;
    if (amount < 1)
      throw new DraftError("step-needs-amount", `${where}: the amount must be 1 or more`);
    const notes = text(fields.notes).slice(0, 4000);
    // A step is named after its activity: the row on the Goals page is one line
    return {
      activity: title,
      unit: times !== undefined ? "times" : "minutes",
      amount,
      ...(notes ? { notes } : {}),
      ...(own ? { minutes: own } : {}),
    };
  }

  /**
   * The steps of a milestone as it is given. The usual shape is a phase: so
   * many sessions (or minutes) of the roadmap's one activity, with what a
   * session consists of. A list of steps is also read, for a phase that
   * really has more than one kind of session.
   */
  private stepsOf(milestone: Fields, roadmap: Fields): Fields[] {
    if (Array.isArray(milestone.steps) && milestone.steps.length > 0) {
      return milestone.steps as Fields[];
    }
    const own = text(milestone.activity);
    const usual = text(roadmap.activity);
    const activity = own || usual;
    if (!activity) {
      throw new DraftError(
        "roadmap-needs-activity",
        'give "activity": the one thing the person does in every session of this roadmap'
      );
    }
    // A phase that repeats the roadmap's activity keeps the roadmap's session
    // length: a 9B model named it in every phase and left session_minutes at
    // the top, and the new activity was never created.
    const different = Boolean(own && usual && !same(own, usual));
    return [
      {
        activity,
        session_minutes:
          milestone.session_minutes ?? (different ? undefined : roadmap.session_minutes),
        sessions: milestone.sessions,
        total_minutes: milestone.total_minutes,
        notes: milestone.notes,
      },
    ];
  }

  private date(value: unknown): string | undefined {
    const date = text(value);
    if (!date) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new DraftError("invalid-date", `target_date must be YYYY-MM-DD, got "${date}"`);
    }
    return date;
  }

  /** When a roadmap's sessions happen: the weekdays, a time if there is one, and from when. */
  private schedule(value: unknown): DraftSchedule {
    const fields = (value && typeof value === "object" ? value : {}) as Fields;
    const weekdays = weekdayNumbers(fields.weekdays);
    if (!weekdays) {
      throw new DraftError(
        "schedule-needs-weekdays",
        `give "weekdays": the days the sessions happen on, from ${WEEKDAYS.join(", ")}. If the request does not say which days, call cannot_do: the coach has to ask the person.`
      );
    }
    const time = text(fields.time) ? timeOfDay(fields.time) : undefined;
    if (time === null)
      throw new DraftError("invalid-time", `"time" is HH:MM, got "${fields.time}"`);
    const start = startDate(fields.start, this.now);
    if (!start) {
      throw new DraftError("invalid-date", '"start" is "today", "tomorrow" or YYYY-MM-DD');
    }
    if (start < localDate(this.now)) {
      throw new DraftError("date-in-the-past", `"start" ${start} is before today`);
    }
    // The time is the person's: theirs is used, whatever was written here
    const at = this.said.time ?? time;
    return {
      weekdays,
      ...(at !== undefined ? { time: at } : {}),
      start: this.said.startOn !== undefined ? this.next(this.said.startOn) : start,
    };
  }

  /** The next day that is this weekday, today included. */
  private next(weekday: number): string {
    const day = new Date(`${localDate(this.now)}T12:00:00`);
    while (day.getDay() !== weekday) day.setDate(day.getDate() + 1);
    return localDate(day);
  }

  /**
   * The days of a new roadmap are the ones the conversation last stated. Not
   * bound: the reading of a sentence is wrong often enough. Sent back once,
   * with the line they were read from, and the planner decides.
   */
  private onTheirDays(roadmap: DraftRoadmap) {
    const { days, daysQuote } = this.said;
    const mine = roadmap.schedule?.weekdays;
    if (!days?.length || !mine || this.daysSentBack) return;
    if (days.length === mine.length && days.every((day) => mine.includes(day))) return;
    this.daysSentBack = true;
    throw new DraftError(
      "other-days",
      `your schedule is on ${mine.map((day) => WEEKDAYS[day]).join(", ")}; the conversation last named the days in this line: "${daysQuote ?? ""}" (read as ${days
        .map((day) => WEEKDAYS[day])
        .join(
          ", "
        )}). Use the days the person agreed to. If your days are what they agreed to, send the same call again.`
    );
  }

  /**
   * The phases of a new roadmap hold the sessions their weeks give: a plan of
   * phases of 2, 2, 2, 2 and 5 weeks at five days a week is 10, 10, 10, 10 and
   * 25 sessions, and a 9B model wrote 26 for the last. Sent back once, with the
   * count; a second time it stands.
   */
  private onTheirPhases(roadmap: DraftRoadmap) {
    const weeks = this.said.phaseWeeks;
    const perWeek = roadmap.schedule?.weekdays.length;
    if (!weeks || !perWeek || this.phasesSentBack) return;
    if (weeks.length !== roadmap.milestones.length) return;
    const expected = weeks.map((each) => each * perWeek);
    const mine = roadmap.milestones.map((milestone) =>
      milestone.steps.reduce((sum, step) => sum + this.sessionsOf(step), 0)
    );
    if (expected.every((count, index) => count === mine[index])) return;
    this.phasesSentBack = true;
    throw new DraftError(
      "phases-off-count",
      `the plan the person agreed to has phases of ${weeks.join(", ")} weeks; at ${perWeek} sessions a week that is ${expected.join(", ")} sessions, in that order, and yours are ${mine.join(", ")}. Use those counts. If the plan they agreed to really has these, send the same call again.`
    );
  }

  /**
   * What the person added with their yes is somewhere in the roadmap: in a
   * session's notes or in the rules. Sent back once when no word of it is.
   */
  private carriesWhatWasAdded(roadmap: DraftRoadmap) {
    const added = this.said.added ?? [];
    if (added.length === 0 || this.addedSentBack) return;
    const bare = (words: string) =>
      words
        .toLocaleLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
    const written = bare(
      [
        roadmap.rules ?? "",
        ...roadmap.milestones.flatMap((milestone) => [
          milestone.title,
          ...milestone.steps.map((step) => `${step.activity} ${step.notes ?? ""}`),
        ]),
      ].join(" ")
    );
    const absent = added.filter((thing) => {
      const words = bare(thing)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= 6);
      return (
        words.length > 0 &&
        !words.some((word) => written.includes(word.slice(0, Math.max(5, word.length - 2))))
      );
    });
    if (absent.length === 0) return;
    this.addedSentBack = true;
    throw new DraftError(
      "left-out",
      `with their yes the person added: ${absent.join("; ")}. Nothing in the sessions' notes or in the rules says it. Put it where it belongs (in the notes of the phases it touches, with its numbers, or in the rules) and send the call again.`
    );
  }

  /** A new roadmap keeps to what the person said: how long a session is, how long the plan runs. */
  private keepsTo(roadmap: DraftRoadmap) {
    const first = roadmap.milestones[0]?.steps[0];
    const length = first ? (first.minutes ?? this.length(first.activity)) : 0;
    if (this.said.minutes && length > this.said.minutes * 1.1) {
      throw new DraftError(
        "session-too-long",
        `the person said a session can be ${this.said.minutes} minutes; the sessions of the first phase last ${length}. Start with ${this.said.minutes}; a later phase may be longer only if the plan they agreed to says so.`
      );
    }
  }

  /**
   * A roadmap that runs clearly longer than the person asked for. Said to
   * them on the card, not refused: how many weeks they meant is the model's
   * reading of their words, and they are the one to decide.
   */
  private longerThanAsked(roadmap: DraftRoadmap): { weeks: number; until: string } | null {
    if (roadmap.id || !this.said.weeks) return null;
    const layout = this.layout(roadmap).filter((entry) => entry.last);
    if (layout.length === 0) return null;
    const until = layout[layout.length - 1].last;
    const days =
      (new Date(`${until}T12:00:00`).getTime() -
        new Date(`${layout[0].first}T12:00:00`).getTime()) /
      86_400_000;
    const weeks = Math.ceil((days + 1) / 7);
    return weeks > this.said.weeks + Math.max(1, Math.round(this.said.weeks * 0.2))
      ? { weeks, until }
      : null;
  }

  /**
   * The weeks a new roadmap runs and the sessions it still owes when it is
   * short of what the person asked for. Counted, not read from the calendar:
   * "weeks 5-7" at three days a week is nine sessions, and a 9B model wrote
   * six. The count it owes goes back to it once.
   */
  private shorterThanAsked(roadmap: DraftRoadmap): { weeks: number; expected: number } | null {
    if (roadmap.id || !this.said.weeks) return null;
    const layout = this.layout(roadmap).filter((entry) => entry.last);
    if (layout.length === 0) return null;
    const perWeek = roadmap.schedule?.weekdays.length ?? 1;
    const expected = this.said.weeks * perWeek;
    const total = roadmap.milestones
      .flatMap((milestone) => milestone.steps)
      .reduce((sum, step) => sum + this.sessionsOf(step), 0);
    // Less than a week of sessions short is rounding of the phases; a whole week or more is a miscount
    if (expected - total < perWeek) return null;
    const days =
      (new Date(`${layout[layout.length - 1].last}T12:00:00`).getTime() -
        new Date(`${layout[0].first}T12:00:00`).getTime()) /
      86_400_000;
    return { weeks: Math.ceil((days + 1) / 7), expected };
  }

  /** What the person should look at before saying yes. */
  get warnings(): string[] {
    return this.touched().flatMap((roadmap) => {
      const longer = this.longerThanAsked(roadmap);
      return longer
        ? [t("roadmap.card.longer", { asked: this.said.weeks!, weeks: longer.weeks })]
        : [];
    });
  }

  /** How far a date is from today, in words a model cannot get wrong. */
  private howFar(date: string): string {
    const days = Math.round(
      (new Date(`${date}T12:00:00`).getTime() -
        new Date(`${localDate(this.now)}T12:00:00`).getTime()) /
        86_400_000
    );
    return days <= 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  }

  private length(activity: string): number {
    const key = activity.toLocaleLowerCase();
    return this.newActivities.get(key)?.minutes ?? this.lengths.get(key) ?? 30;
  }

  private sessionsOf(step: DraftStep): number {
    return step.unit === "times"
      ? step.amount
      : Math.ceil(step.amount / (step.minutes ?? this.length(step.activity)));
  }

  /** What holds for the whole draft after any edit. */
  private check() {
    for (const roadmap of this.roadmaps) {
      roadmap.milestones.forEach((milestone, index) => {
        if (milestone.steps.length > MAX_STEPS) {
          throw new DraftError(
            "too-many-steps",
            `milestone ${index + 1} ("${milestone.title}") has ${milestone.steps.length} steps; a milestone has 1 to ${MAX_STEPS}. A step is one kind of session the person sits down to do, not one part of it: what a session contains (its exercises, chapters, sub-tasks) goes in that step's "notes".`
          );
        }
      });
      const total = roadmap.milestones
        .flatMap((milestone) => milestone.steps)
        .reduce((sum, step) => sum + this.sessionsOf(step), 0);
      if (total > MAX_SESSIONS) {
        throw new DraftError(
          "too-many-sessions",
          `"${roadmap.title}" adds up to ${total} sessions; a roadmap plans at most ${MAX_SESSIONS}. Make it shorter, or cover a first stretch now.`
        );
      }
    }
    const used = [...this.newActivities.values()].filter((activity) => this.uses(activity.title));
    if (used.length > MAX_NEW_ACTIVITIES) {
      throw new DraftError(
        "too-many-activities",
        `this would add ${used.length} activities to the person's library (${used
          .map((activity) => `"${activity.title}"`)
          .join(
            ", "
          )}); at most ${MAX_NEW_ACTIVITIES}. An activity is something the person sits down to do as one session. The parts of a session are not activities: use ONE activity for the session and write its parts in the step's "notes".`
      );
    }
  }

  private uses(activity: string): boolean {
    return this.roadmaps.some((roadmap) =>
      roadmap.milestones.some((m) => m.steps.some((step) => same(step.activity, activity)))
    );
  }

  // ---------------------------------------------------------------- the planner's tools

  /** Creates a roadmap, or rewrites the one with that title, whole. */
  saveRoadmap(fields: Fields) {
    return this.edit(() => {
      const title = text(fields.title);
      if (!title)
        throw new DraftError("roadmap-needs-title", 'give "title": the goal, in a few words');
      const list = Array.isArray(fields.milestones) ? (fields.milestones as Fields[]) : [];
      if (list.length === 0) {
        throw new DraftError(
          "roadmap-needs-milestones",
          'give "milestones": at least one, in order'
        );
      }
      const milestones = list.map((milestone, index): DraftMilestone => {
        const where = `milestone ${index + 1}`;
        if (!text(milestone.title)) throw new DraftError("milestone-needs-title", where);
        const steps = this.stepsOf(milestone, fields);
        return {
          title: text(milestone.title),
          ...(text(milestone.note) ? { note: text(milestone.note) } : {}),
          steps: steps.map((step, i) => this.step(step, `${where}, step ${i + 1}`)),
        };
      });
      const existing = this.roadmaps.find((roadmap) => same(roadmap.title, title));
      const schedule =
        fields.schedule !== undefined && fields.schedule !== null
          ? this.schedule(fields.schedule)
          : existing?.schedule;
      if (!schedule) {
        throw new DraftError(
          "roadmap-needs-schedule",
          'a roadmap is made of real sessions on real days. Give "schedule": {"weekdays": [...], "time": "HH:MM" (only if the request gives one), "start": "today", "tomorrow" or a date}. If the request does not say which days, call cannot_do: the coach has to ask the person.'
        );
      }
      const roadmap: DraftRoadmap = {
        id: existing?.id,
        title,
        why: text(fields.why) || existing?.why,
        targetDate: this.date(fields.target_date) ?? existing?.targetDate,
        status: existing?.status ?? "active",
        schedule,
        rules: text(fields.rules).slice(0, 2000) || existing?.rules,
        milestones,
      };
      if (!existing) {
        this.keepsTo(roadmap);
        this.onTheirDays(roadmap);
        this.onTheirPhases(roadmap);
        this.carriesWhatWasAdded(roadmap);
        // Sent back once: most often the days or a count were copied wrong, and
        // the numbers show which. A second time it stands, and the card says so.
        const shorter = this.shorterThanAsked(roadmap);
        if (shorter && !this.sentBack) {
          this.sentBack = true;
          const total = roadmap.milestones
            .flatMap((milestone) => milestone.steps)
            .reduce((sum, step) => sum + this.sessionsOf(step), 0);
          const perWeek = roadmap.schedule?.weekdays.length ?? 1;
          throw new DraftError(
            "shorter-than-asked",
            `the person asked for about ${this.said.weeks} weeks; ${total} sessions on ${perWeek} day${perWeek === 1 ? "" : "s"} a week run only ${shorter.weeks}. ${this.said.weeks} weeks are ${shorter.expected} in all. Count the sessions of each phase again from the plan in the conversation: a phase of N weeks is N x ${perWeek} sessions. If the plan they agreed to really is this short, send the same call again.`
          );
        }
        const longer = this.longerThanAsked(roadmap);
        if (longer && !this.sentBack) {
          this.sentBack = true;
          const total = roadmap.milestones
            .flatMap((milestone) => milestone.steps)
            .reduce((sum, step) => sum + this.sessionsOf(step), 0);
          const perWeek = roadmap.schedule?.weekdays.length ?? 1;
          throw new DraftError(
            "longer-than-asked",
            `the person asked for about ${this.said.weeks} weeks; ${total} sessions on ${perWeek} day${perWeek === 1 ? "" : "s"} a week run ${longer.weeks} weeks, to ${longer.until}. Check the days of the week and the number of sessions against the plan in the conversation: in ${this.said.weeks} weeks, ${perWeek} day${perWeek === 1 ? "" : "s"} a week is ${this.said.weeks! * perWeek} sessions. If the plan they agreed to really is this long, send the same call again.`
          );
        }
      }
      this.roadmaps = existing
        ? this.roadmaps.map((item) => (item === existing ? roadmap : item))
        : [...this.roadmaps, roadmap];
      return this.outline(roadmap);
    });
  }

  setRoadmap(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      const title = text(fields.new_title);
      if (title) roadmap.title = title;
      if (text(fields.why)) roadmap.why = text(fields.why);
      if (fields.rules !== undefined)
        roadmap.rules = text(fields.rules).slice(0, 2000) || undefined;
      const date = this.date(fields.target_date);
      if (date) roadmap.targetDate = date;
      const status = text(fields.status);
      if (status) {
        if (status !== "active" && status !== "paused") {
          throw new DraftError("invalid-status", 'status is "active" or "paused"');
        }
        roadmap.status = status;
      }
      return this.outline(roadmap);
    });
  }

  /** Moves a roadmap's sessions to other days, another time or another start. */
  setSchedule(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      roadmap.schedule = this.schedule({
        // What is left out stays as it was
        weekdays: fields.weekdays ?? roadmap.schedule?.weekdays.map((weekday) => WEEKDAYS[weekday]),
        time:
          fields.time ??
          (roadmap.schedule?.time !== undefined ? formatDayMinutes(roadmap.schedule.time) : ""),
        start: fields.start ?? "today",
      });
      return this.outline(roadmap);
    });
  }

  deleteRoadmap(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      this.roadmaps = this.roadmaps.filter((item) => item !== roadmap);
      if (roadmap.id) this.deleted.push({ id: roadmap.id, title: roadmap.title });
      return { deleted: roadmap.title };
    });
  }

  addMilestone(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      if (!text(fields.title)) throw new DraftError("milestone-needs-title", 'give "title"');
      // A phase added later runs on the roadmap's own activity unless it names another
      const steps = this.stepsOf(fields, {
        activity: roadmap.milestones[0]?.steps[0]?.activity,
      });
      const milestone: DraftMilestone = {
        title: text(fields.title),
        ...(text(fields.note) ? { note: text(fields.note) } : {}),
        steps: steps.map((step, i) => this.step(step, `step ${i + 1}`)),
      };
      const position = whole(fields.position);
      const at =
        position !== undefined && position >= 1 && position <= roadmap.milestones.length + 1
          ? position - 1
          : roadmap.milestones.length;
      roadmap.milestones.splice(at, 0, milestone);
      return this.outline(roadmap);
    });
  }

  removeMilestone(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      const milestone = this.milestone(roadmap, fields.milestone);
      if (roadmap.milestones.length === 1) {
        throw new DraftError(
          "last-milestone",
          "a roadmap needs at least one milestone; delete the roadmap instead, or add another first"
        );
      }
      roadmap.milestones = roadmap.milestones.filter((item) => item !== milestone);
      return this.outline(roadmap);
    });
  }

  addStep(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      const milestone = this.milestone(roadmap, fields.milestone);
      milestone.steps.push(this.step(fields, "the step"));
      return this.outline(roadmap);
    });
  }

  /** Changes a step: its amount, its activity, or what a session of it consists of. */
  setStep(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      const milestone = this.milestone(roadmap, fields.milestone);
      const index = this.stepIndex(milestone, fields.step);
      const current = milestone.steps[index];
      const amountGiven = ["sessions", "times", "total_minutes", "minutes"].some(
        (name) => fields[name] !== undefined
      );
      milestone.steps[index] = this.step(
        {
          ...fields,
          activity: text(fields.activity) || current.activity,
          notes: fields.notes ?? current.notes,
          session_minutes: fields.session_minutes ?? current.minutes,
          ...(amountGiven
            ? {}
            : { [current.unit === "times" ? "sessions" : "total_minutes"]: current.amount }),
        },
        "the step"
      );
      return this.outline(roadmap);
    });
  }

  removeStep(fields: Fields) {
    return this.edit(() => {
      const roadmap = this.roadmap(fields.roadmap);
      const milestone = this.milestone(roadmap, fields.milestone);
      const index = this.stepIndex(milestone, fields.step);
      if (milestone.steps.length === 1) {
        throw new DraftError(
          "last-step",
          "a milestone needs at least one step; remove the milestone instead, or add another step first"
        );
      }
      milestone.steps.splice(index, 1);
      return this.outline(roadmap);
    });
  }

  // ---------------------------------------------------------------- reading it back

  /**
   * Where the sessions of a roadmap that starts from nothing would fall:
   * milestone after milestone, on its days. (The core lays out the real ones
   * when it is saved, counting what was already done.)
   */
  private layout(roadmap: DraftRoadmap) {
    const schedule = roadmap.schedule;
    if (!schedule) return [];
    const today = localDate(this.now);
    let cursor = schedule.start > today ? schedule.start : today;
    return roadmap.milestones.map((milestone) => {
      let first = "";
      let last = "";
      let sessions = 0;
      for (const step of milestone.steps) {
        const dates = sessionDates(schedule.weekdays, cursor, this.sessionsOf(step));
        sessions += dates.length;
        if (dates.length === 0) continue;
        if (!first || dates[0] < first) first = dates[0];
        if (dates[dates.length - 1] > last) last = dates[dates.length - 1];
      }
      if (last) cursor = dayAfter(last);
      return { sessions, first, last };
    });
  }

  /** The roadmap as the planner sees it after an edit: numbers to refer to, nothing more. */
  private outline(roadmap: DraftRoadmap) {
    const layout = roadmap.id ? [] : this.layout(roadmap);
    return {
      ok: true,
      next: "Done, in the draft. If nothing else has to change, call finish now; do not send this call again.",
      roadmap: roadmap.title,
      status: roadmap.status,
      rules: roadmap.rules ? "yes" : "none",
      schedule: roadmap.schedule
        ? `${roadmap.schedule.weekdays.map((weekday) => WEEKDAYS[weekday]).join(", ")}${
            roadmap.schedule.time !== undefined
              ? ` at ${formatDayMinutes(roadmap.schedule.time)}`
              : ""
          }, from ${roadmap.schedule.start}`
        : "none",
      milestones: roadmap.milestones.map((milestone, index) => ({
        n: index + 1,
        title: milestone.title,
        steps: milestone.steps.map(
          (step, i) =>
            `${i + 1}. ${step.activity}: ${step.amount} ${step.unit}${step.notes ? "" : " (no notes)"}`
        ),
        ...(layout[index]?.last ? { ends: layout[index].last } : {}),
      })),
    };
  }

  /** What the person is shown before saying yes, in their language. */
  describe(): { text: string; details: string[] } {
    const touched = this.touched();
    const details: string[] = [...this.warnings];
    for (const roadmap of touched) {
      if (touched.length > 1) details.push(`«${roadmap.title}»`);
      // A new roadmap starts from nothing, so its dates can be shown before it exists
      const layout = roadmap.id ? [] : this.layout(roadmap);
      if (roadmap.schedule && roadmap.status !== "paused") {
        const when = `${weekdayNames(roadmap.schedule.weekdays)}${
          roadmap.schedule.time !== undefined ? ` · ${formatDayMinutes(roadmap.schedule.time)}` : ""
        }`;
        const dated = layout.filter((entry) => entry.last);
        details.push(
          dated.length > 0
            ? t("roadmap.card.sessions", {
                when,
                count: layout.reduce((sum, entry) => sum + entry.sessions, 0),
                from: dayLabel(dated[0].first),
                to: dayLabel(dated[dated.length - 1].last),
              })
            : t("roadmap.card.when", { when })
        );
      }
      roadmap.milestones.forEach((milestone, index) => {
        const dates = layout[index]?.last
          ? ` (${dayLabel(layout[index].first)} → ${dayLabel(layout[index].last)})`
          : "";
        details.push(
          `${index + 1}. ${milestone.title}: ${milestone.steps
            .map(
              (step) =>
                t(step.unit === "times" ? "roadmap.step.times" : "roadmap.step.minutes", {
                  activity: step.activity,
                  amount: step.amount,
                }) + (step.minutes ? ` (~${step.minutes} min)` : "")
            )
            .join("; ")}${dates}`
        );
      });
    }
    for (const gone of this.deleted) details.push(t("roadmap.card.deleted", { title: gone.title }));
    for (const activity of this.newActivities.values()) {
      if (this.uses(activity.title)) details.push(t("roadmap.card.newActivity", { ...activity }));
    }
    const first = touched[0];
    const text = !first
      ? t("roadmap.card.delete", { title: this.deleted[0]?.title ?? "" })
      : t(first.id ? "roadmap.card.update" : "roadmap.card.create", { title: first.title });
    return { text, details: details.slice(0, 16) };
  }

  // ---------------------------------------------------------------- saving it

  /**
   * Writes the draft to the core: new activities first, then each roadmap,
   * whole. The core plans each roadmap's sessions as it is saved; what it
   * planned comes back in words the coach can say as they are.
   */
  commit(): { saved: string[]; deleted: string[]; created: string[]; sessions: PlannedSessions[] } {
    const created: string[] = [];
    for (const activity of this.newActivities.values()) {
      if (!this.uses(activity.title)) continue;
      this.core.createActivityTemplate({
        title: activity.title,
        description: "",
        type: "clear-objective",
        isSystemActivity: false,
        clearObjectiveSettings: { estimatedDurationMinutes: activity.minutes },
      });
      created.push(activity.title);
    }
    const templates = this.core.getActivityTemplates();
    const ids = new Map(templates.map((tpl) => [tpl.title.toLocaleLowerCase(), tpl.id]));
    for (const gone of this.deleted) this.core.deleteRoadmap(gone.id);
    const sessions: PlannedSessions[] = [];
    const saved = this.touched().map((roadmap) => {
      const stored = this.core.saveRoadmap({
        id: roadmap.id,
        title: roadmap.title,
        why: roadmap.why,
        targetDate: roadmap.targetDate,
        status: roadmap.status,
        schedule: roadmap.schedule ?? null,
        rules: roadmap.rules ?? "",
        milestones: roadmap.milestones.map((milestone) => ({
          title: milestone.title,
          note: milestone.note,
          steps: milestone.steps.map((step) => ({
            templateId: ids.get(step.activity.toLocaleLowerCase()) ?? "",
            unit: step.unit,
            amount: step.amount,
            notes: step.notes,
            sessionMinutes: step.minutes,
          })),
        })),
      });
      if (stored.schedule && stored.status !== "paused") {
        const planned = this.core.getRoadmapSessions(stored.id);
        const mine = new Set(stored.milestones.flatMap((m) => m.steps.map((s) => s.templateId)));
        const todays = (this.core.getState().currentDay?.activityInstances ?? []).filter(
          (instance) => mine.has(instance.templateId)
        );
        const today = todays.map(
          (instance) => templates.find((tpl) => tpl.id === instance.templateId)?.title ?? ""
        );
        // A session that went into today's plan is a session of the roadmap too: the
        // count, the first day and its phase include it (a coach told "23, from Monday"
        // for 24 starting today said exactly that)
        const todayDate = localDate(this.now);
        const phases = planned.map((entry) => ({ ...entry }));
        for (const instance of todays) {
          const owner = stored.milestones.findIndex((milestone) =>
            milestone.steps.some((step) => step.templateId === instance.templateId)
          );
          const phase = owner >= 0 ? phases[owner] : undefined;
          if (!phase) continue;
          phase.sessions += 1;
          if (!phase.first || todayDate < phase.first) phase.first = todayDate;
          if (!phase.last) phase.last = todayDate;
        }
        const withToday = phases.filter((entry) => entry.first);
        sessions.push({
          roadmap: stored.title,
          days: weekdayNames(stored.schedule.weekdays),
          ...(stored.schedule.time !== undefined
            ? { time: formatDayMinutes(stored.schedule.time) }
            : {}),
          total: phases.reduce((sum, entry) => sum + entry.sessions, 0),
          ...(withToday.length > 0
            ? {
                first: dayLabel(withToday[0].first!),
                first_is: this.howFar(withToday[0].first!),
                last: dayLabel(withToday[withToday.length - 1].last!),
              }
            : {}),
          milestones: phases.map((entry) => ({
            milestone: entry.milestone,
            sessions: entry.sessions,
            ...(entry.first ? { from: dayLabel(entry.first), to: dayLabel(entry.last!) } : {}),
          })),
          ...(today.length > 0 ? { in_todays_plan: [...new Set(today)] } : {}),
        });
      }
      return roadmap.title;
    });
    return { saved, deleted: this.deleted.map((gone) => gone.title), created, sessions };
  }
}
