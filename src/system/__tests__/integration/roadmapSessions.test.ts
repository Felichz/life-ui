import { SystemCore } from "../../index";

/**
 * A roadmap owns its sessions (ADR-011): saved with a schedule, it puts every
 * session that is left on its days, phase after phase, and keeps them there
 * as the person closes them, pauses it, changes it or deletes it.
 */

// A Thursday, in the morning
const NOW = new Date("2026-11-12T10:00:00");

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
});
afterEach(() => jest.useRealTimers());

function setup() {
  const core = new SystemCore();
  core.clearState();
  const train = core.createActivityTemplate({
    title: "Entrenar",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 15 },
  });
  return { core, train };
}

const MON_WED_FRI = [1, 3, 5];

const program = (templateId: string, start = "2026-11-12") => ({
  title: "Volver a entrenar",
  rules: "- Día malo: una serie de cada ejercicio",
  schedule: { weekdays: MON_WED_FRI, time: 19 * 60, start },
  milestones: [
    {
      title: "Arrancar",
      steps: [{ templateId, unit: "times" as const, amount: 3, notes: "- Sentadilla 2x10" }],
    },
    {
      title: "Progresar",
      steps: [
        {
          templateId,
          unit: "times" as const,
          amount: 2,
          notes: "- Sentadilla 3x10",
          sessionMinutes: 20,
        },
      ],
    },
  ],
});

/** Does the first waiting session of today's plan, for real. */
function doToday(core: SystemCore, minutes = 15) {
  const instance = core.getState().currentDay!.activityInstances[0];
  core.activateActivity(instance.id);
  core.completeActivity(instance.id, {
    satisfactionScore: 7,
    endTime: new Date(Date.now() + minutes * 60000).toISOString(),
  });
}

describe("a roadmap with a schedule", () => {
  it("puts every session on its days, one phase after the other, with what a session contains", () => {
    const { core, train } = setup();
    const roadmap = core.saveRoadmap(program(train.id));
    const planned = core.getPlannedActivities();

    expect(planned.map((item) => item.date)).toEqual([
      "2026-11-13", // Friday: the first of its days from the start
      "2026-11-16",
      "2026-11-18",
      "2026-11-20", // the second phase starts after the last session of the first
      "2026-11-23",
    ]);
    expect(planned.every((item) => item.time === 19 * 60)).toBe(true);
    // Each session says what its phase's session consists of, then what always holds
    expect(planned[0].notes).toBe("- Sentadilla 2x10\n\n- Día malo: una serie de cada ejercicio");
    expect(planned[3].notes).toContain("- Sentadilla 3x10");
    // A phase whose sessions last longer says so on each of them
    expect(planned[3].minutes).toBe(20);
    expect(planned[0].minutes).toBeUndefined();

    expect(core.getRoadmapSessions(roadmap.id)).toEqual([
      { milestone: "Arrancar", sessions: 3, first: "2026-11-13", last: "2026-11-18" },
      { milestone: "Progresar", sessions: 2, first: "2026-11-20", last: "2026-11-23" },
    ]);
    // Each step sees its own sessions, though both are the same activity
    const [first, second] = core.getRoadmapProgress()[0].milestones;
    expect(first.steps[0]).toMatchObject({ plannedAhead: 3, next: { date: "2026-11-13" } });
    expect(second.steps[0]).toMatchObject({ plannedAhead: 2, next: { date: "2026-11-20" } });
  });

  it("puts a session that falls today straight into today's plan, once", () => {
    const { core, train } = setup();
    core.startDay();
    core.saveRoadmap({ ...program(train.id), schedule: { weekdays: [4], start: "2026-11-12" } });

    const today = core.getState().currentDay!.activityInstances;
    expect(today).toHaveLength(1);
    expect(today[0].notes).toContain("- Sentadilla 2x10");
    // Four are left for the Thursdays after this one; today's is not planned again
    expect(core.getPlannedActivities().map((item) => item.date)).toEqual([
      "2026-11-19",
      "2026-11-26",
      "2026-12-03",
      "2026-12-10",
    ]);
    core.bringPlannedActivities();
    expect(core.getState().currentDay!.activityInstances).toHaveLength(1);
    expect(core.getPlannedActivities()).toHaveLength(4);
  });

  it("does not plan again what was done, and changes nothing when nothing changed", () => {
    const { core, train } = setup();
    core.startDay();
    core.saveRoadmap({ ...program(train.id), schedule: { weekdays: [4], start: "2026-11-12" } });
    const before = core.getPlannedActivities().map((item) => item.id);
    core.bringPlannedActivities();
    expect(core.getPlannedActivities().map((item) => item.id)).toEqual(before);

    doToday(core);
    core.bringPlannedActivities();
    // One of five is done: the four that are left stay where they were
    expect(core.getPlannedActivities().map((item) => item.id)).toEqual(before);
    expect(core.getRoadmapProgress()[0].milestones[0].steps[0]).toMatchObject({ done: 1 });
  });

  it("moves on when a session was dropped: the next one is simply the next", () => {
    const { core, train } = setup();
    core.startDay();
    core.saveRoadmap({ ...program(train.id), schedule: { weekdays: [4], start: "2026-11-12" } });
    // Today's session is taken out of the plan without being done
    core.deleteActivityInstance(core.getState().currentDay!.activityInstances[0].id);
    core.bringPlannedActivities(new Date("2026-11-12T22:00:00"));
    // Five are still to do, so there is one more Thursday at the end
    expect(core.getPlannedActivities()).toHaveLength(5);
    expect(core.getPlannedActivities().at(-1)!.date).toBe("2026-12-17");
  });

  it("has nothing planned while it is paused, and plans again when it resumes", () => {
    const { core, train } = setup();
    const roadmap = core.saveRoadmap(program(train.id));
    const { id, title, milestones } = roadmap;
    const steps = milestones.map((milestone) => ({
      title: milestone.title,
      steps: milestone.steps.map(({ templateId, unit, amount }) => ({ templateId, unit, amount })),
    }));

    core.saveRoadmap({ id, title, status: "paused", milestones: steps });
    expect(core.getPlannedActivities()).toEqual([]);
    core.saveRoadmap({ id, title, status: "active", milestones: steps });
    expect(core.getPlannedActivities()).toHaveLength(5);
  });

  it("takes its sessions with it when it is deleted, and leaves the rest of the agenda alone", () => {
    const { core, train } = setup();
    const roadmap = core.saveRoadmap(program(train.id));
    core.planActivity(train.id, ["2026-12-24"]);
    core.deleteRoadmap(roadmap.id);
    expect(core.getPlannedActivities().map((item) => item.date)).toEqual(["2026-12-24"]);
  });

  it("turns a total of minutes into sessions of the step's length", () => {
    const { core, train } = setup();
    core.saveRoadmap({
      title: "Leer",
      schedule: { weekdays: [0, 1, 2, 3, 4, 5, 6], start: "2026-11-13" },
      milestones: [
        { title: "Fase", steps: [{ templateId: train.id, unit: "minutes", amount: 50 }] },
      ],
    });
    // 50 minutes in sessions of 15: four sessions
    expect(core.getPlannedActivities().map((item) => item.date)).toEqual([
      "2026-11-13",
      "2026-11-14",
      "2026-11-15",
      "2026-11-16",
    ]);
  });

  it("refuses a schedule without days", () => {
    const { core, train } = setup();
    expect(() =>
      core.saveRoadmap({ ...program(train.id), schedule: { weekdays: [], start: "2026-11-12" } })
    ).toThrowCoreError("roadmap-invalid");
    expect(core.getRoadmaps()).toEqual([]);
  });

  it("keeps the length of a longer session when its day comes", () => {
    const { core, train } = setup();
    core.saveRoadmap({
      title: "Entrenar",
      schedule: { weekdays: [4], start: "2026-11-12" },
      milestones: [
        {
          title: "Fase",
          steps: [{ templateId: train.id, unit: "times", amount: 1, sessionMinutes: 25 }],
        },
      ],
    });
    core.startDay();
    const [instance] = core.getState().currentDay!.activityInstances;
    expect(instance.clearObjectiveSettings?.estimatedDurationMinutes).toBe(25);
  });
});
