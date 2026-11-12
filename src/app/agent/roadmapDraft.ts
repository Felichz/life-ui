import type { ISystemCore, Roadmap, UUID } from "../../types";
import { t } from "../i18n";

/**
 * A working copy of the person's roadmaps (ADR-010). The roadmap planner
 * edits it with its tools; nothing reaches the core until the person has seen
 * the result and said yes. Every edit is checked here, and a wrong one comes
 * back as an error the planner can read and fix.
 */

export class DraftError extends Error {
  constructor(
    readonly code: string,
    detail: string
  ) {
    super(`${code}: ${detail}`);
  }
}

interface DraftStep {
  /** The library activity's title, as the library (or a new activity of this draft) has it. */
  activity: string;
  unit: "times" | "minutes";
  amount: number;
}

interface DraftMilestone {
  title: string;
  note?: string;
  steps: DraftStep[];
}

interface DraftRoadmap {
  /** Set for a roadmap that already exists in the core. */
  id?: UUID;
  title: string;
  why?: string;
  targetDate?: string;
  status: Roadmap["status"];
  milestones: DraftMilestone[];
}

type Fields = Record<string, unknown>;

const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const same = (a: string, b: string) => a.toLocaleLowerCase() === b.toLocaleLowerCase();
const whole = (value: unknown): number | undefined => {
  const n = typeof value === "string" && value.trim() ? Number(value) : value;
  return typeof n === "number" && Number.isFinite(n) ? Math.round(n) : undefined;
};

export class RoadmapDraft {
  private roadmaps: DraftRoadmap[];
  private readonly before: string;
  private readonly deleted: Array<{ id: UUID; title: string }> = [];
  /** Activities the plan needs that the library does not have yet: title -> minutes a session. */
  private readonly newActivities = new Map<string, { title: string; minutes: number }>();
  private readonly library: string[];
  /** Each stored roadmap as it was when the draft began, to tell what changed. */
  private readonly original = new Map<UUID, string>();

  constructor(private readonly core: ISystemCore) {
    const titles = new Map(core.getActivityTemplates().map((tpl) => [tpl.id, tpl.title]));
    this.library = [...titles.values()];
    this.roadmaps = core.getRoadmaps().map((roadmap) => ({
      id: roadmap.id,
      title: roadmap.title,
      why: roadmap.why,
      targetDate: roadmap.targetDate,
      status: roadmap.status,
      milestones: roadmap.milestones.map((milestone) => ({
        title: milestone.title,
        note: milestone.note,
        steps: milestone.steps.map((step) => ({
          activity: titles.get(step.templateId) ?? step.title,
          unit: step.unit,
          amount: step.amount,
        })),
      })),
    }));
    // (a step's own title in the core is its activity's: see `step` below)
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
    return JSON.stringify([this.roadmaps, this.deleted, [...this.newActivities.values()]]);
  }

  get changed(): boolean {
    return this.fingerprint() !== this.before;
  }

  get deletes(): boolean {
    return this.deleted.length > 0;
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
    if (!title) {
      const session = whole(fields.session_minutes ?? fields.new_activity_minutes);
      if (session === undefined || session < 1 || session > 600) {
        throw new DraftError(
          "activity-not-found",
          `${where}: "${activity}" is not in the person's library. Library: ${
            this.library.map((item) => `"${item}"`).join(", ") || "empty"
          }. Use one of those, or create it by adding session_minutes (how long one session lasts).`
        );
      }
      this.newActivities.set(activity.toLocaleLowerCase(), { title: activity, minutes: session });
      title = activity;
    }
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
    // A step is named after its activity: the row on the Goals page is one line
    return {
      activity: title,
      unit: times !== undefined ? "times" : "minutes",
      amount,
    };
  }

  private date(value: unknown): string | undefined {
    const date = text(value);
    if (!date) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new DraftError("invalid-date", `target_date must be YYYY-MM-DD, got "${date}"`);
    }
    return date;
  }

  // ---------------------------------------------------------------- the planner's tools

  /** Creates a roadmap, or rewrites the one with that title, whole. */
  saveRoadmap(fields: Fields) {
    const title = text(fields.title);
    if (!title)
      throw new DraftError("roadmap-needs-title", 'give "title": the goal, in a few words');
    const list = Array.isArray(fields.milestones) ? (fields.milestones as Fields[]) : [];
    if (list.length === 0) {
      throw new DraftError("roadmap-needs-milestones", 'give "milestones": at least one, in order');
    }
    const milestones = list.map((milestone, index): DraftMilestone => {
      const where = `milestone ${index + 1}`;
      if (!text(milestone.title)) throw new DraftError("milestone-needs-title", where);
      const steps = Array.isArray(milestone.steps) ? (milestone.steps as Fields[]) : [];
      if (steps.length === 0) {
        throw new DraftError(
          "milestone-needs-steps",
          `${where} ("${text(milestone.title)}"): give "steps", each one an activity and an amount`
        );
      }
      return {
        title: text(milestone.title),
        ...(text(milestone.note) ? { note: text(milestone.note) } : {}),
        steps: steps.map((step, i) => this.step(step, `${where}, step ${i + 1}`)),
      };
    });
    const existing = this.roadmaps.find((roadmap) => same(roadmap.title, title));
    const roadmap: DraftRoadmap = {
      id: existing?.id,
      title,
      why: text(fields.why) || existing?.why,
      targetDate: this.date(fields.target_date) ?? existing?.targetDate,
      status: existing?.status ?? "active",
      milestones,
    };
    this.roadmaps = existing
      ? this.roadmaps.map((item) => (item === existing ? roadmap : item))
      : [...this.roadmaps, roadmap];
    return this.outline(roadmap);
  }

  setRoadmap(fields: Fields) {
    const roadmap = this.roadmap(fields.roadmap);
    const title = text(fields.new_title);
    if (title) roadmap.title = title;
    if (text(fields.why)) roadmap.why = text(fields.why);
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
  }

  deleteRoadmap(fields: Fields) {
    const roadmap = this.roadmap(fields.roadmap);
    this.roadmaps = this.roadmaps.filter((item) => item !== roadmap);
    if (roadmap.id) this.deleted.push({ id: roadmap.id, title: roadmap.title });
    return { deleted: roadmap.title };
  }

  addMilestone(fields: Fields) {
    const roadmap = this.roadmap(fields.roadmap);
    if (!text(fields.title)) throw new DraftError("milestone-needs-title", 'give "title"');
    const steps = Array.isArray(fields.steps) ? (fields.steps as Fields[]) : [];
    if (steps.length === 0) {
      throw new DraftError(
        "milestone-needs-steps",
        'give "steps": at least one, each an activity and an amount'
      );
    }
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
  }

  removeMilestone(fields: Fields) {
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
  }

  addStep(fields: Fields) {
    const roadmap = this.roadmap(fields.roadmap);
    const milestone = this.milestone(roadmap, fields.milestone);
    milestone.steps.push(this.step(fields, "the step"));
    return this.outline(roadmap);
  }

  /** Changes a step's amount (and, if given, its activity or title). */
  setStep(fields: Fields) {
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
        ...(amountGiven
          ? {}
          : { [current.unit === "times" ? "sessions" : "total_minutes"]: current.amount }),
      },
      "the step"
    );
    return this.outline(roadmap);
  }

  removeStep(fields: Fields) {
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
  }

  // ---------------------------------------------------------------- reading it back

  /** The roadmap as the planner sees it after an edit: numbers to refer to, nothing more. */
  private outline(roadmap: DraftRoadmap) {
    return {
      ok: true,
      roadmap: roadmap.title,
      status: roadmap.status,
      milestones: roadmap.milestones.map((milestone, index) => ({
        n: index + 1,
        title: milestone.title,
        steps: milestone.steps.map(
          (step, i) => `${i + 1}. ${step.activity}: ${step.amount} ${step.unit}`
        ),
      })),
    };
  }

  /** What the person is shown before saying yes, in their language. */
  describe(): { text: string; details: string[] } {
    const touched = this.touched();
    const details: string[] = [];
    for (const roadmap of touched) {
      if (touched.length > 1) details.push(`«${roadmap.title}»`);
      roadmap.milestones.forEach((milestone, index) => {
        details.push(
          `${index + 1}. ${milestone.title}: ${milestone.steps
            .map((step) =>
              t(step.unit === "times" ? "roadmap.step.times" : "roadmap.step.minutes", {
                activity: step.activity,
                amount: step.amount,
              })
            )
            .join("; ")}`
        );
      });
    }
    for (const gone of this.deleted) details.push(t("roadmap.card.deleted", { title: gone.title }));
    for (const activity of this.newActivities.values()) {
      details.push(t("roadmap.card.newActivity", { ...activity }));
    }
    const first = touched[0];
    const text = !first
      ? t("roadmap.card.delete", { title: this.deleted[0]?.title ?? "" })
      : t(first.id ? "roadmap.card.update" : "roadmap.card.create", { title: first.title });
    return { text, details: details.slice(0, 14) };
  }

  // ---------------------------------------------------------------- saving it

  /** Writes the draft to the core: new activities first, then each roadmap, whole. */
  commit(): { saved: string[]; deleted: string[]; created: string[] } {
    const created: string[] = [];
    for (const activity of this.newActivities.values()) {
      const used = this.roadmaps.some((roadmap) =>
        roadmap.milestones.some((m) => m.steps.some((step) => same(step.activity, activity.title)))
      );
      if (!used) continue;
      this.core.createActivityTemplate({
        title: activity.title,
        description: "",
        type: "clear-objective",
        isSystemActivity: false,
        clearObjectiveSettings: { estimatedDurationMinutes: activity.minutes },
      });
      created.push(activity.title);
    }
    const ids = new Map(
      this.core.getActivityTemplates().map((tpl) => [tpl.title.toLocaleLowerCase(), tpl.id])
    );
    for (const gone of this.deleted) this.core.deleteRoadmap(gone.id);
    const saved = this.touched().map((roadmap) => {
      this.core.saveRoadmap({
        id: roadmap.id,
        title: roadmap.title,
        why: roadmap.why,
        targetDate: roadmap.targetDate,
        status: roadmap.status,
        milestones: roadmap.milestones.map((milestone) => ({
          title: milestone.title,
          note: milestone.note,
          steps: milestone.steps.map((step) => ({
            templateId: ids.get(step.activity.toLocaleLowerCase()) ?? "",
            unit: step.unit,
            amount: step.amount,
          })),
        })),
      });
      return roadmap.title;
    });
    return { saved, deleted: this.deleted.map((gone) => gone.title), created };
  }
}
