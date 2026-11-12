import { SystemCore } from "../../index";
import { localDate } from "../../agendaManager";

/**
 * Where the person is going (ADR-010): the ideal life in their words, and
 * roadmaps made only of real activities, whose progress is read from what was
 * actually closed.
 */

function setup() {
  const core = new SystemCore();
  core.clearState();
  const template = (title: string, minutes: number) =>
    core.createActivityTemplate({
      title,
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: minutes },
    });
  return { core, base: template("Entrenar: base", 20), load: template("Entrenar: con carga", 40) };
}

let tick = 0;

/** Does an activity once, for real: planned today, started and closed. */
function doOnce(core: SystemCore, templateId: string, minutes = 20) {
  if (!core.getCurrentDay()) core.startDay();
  const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
  const instance = core.createActivityInstance(templateId, todo.id);
  core.activateActivity(instance.id);
  const started = new Date(core.getActiveActivity()!.startTime!);
  // Each close ends a second after the one before, as real ones do
  core.completeActivity(instance.id, {
    satisfactionScore: 7,
    endTime: new Date(started.getTime() + minutes * 60000 + ++tick * 1000).toISOString(),
  });
}

describe("the ideal life", () => {
  it("is kept as the person wrote it and survives saving and loading", () => {
    const { core } = setup();
    expect(core.getIdealLife()).toBeNull();
    core.setIdealLife("  ## Cuerpo\nQuiero sentirme fuerte.\r\n");
    expect(core.getIdealLife()?.text).toBe("## Cuerpo\nQuiero sentirme fuerte.");
    const again = new SystemCore();
    again.importData(core.exportData());
    expect(again.getIdealLife()?.text).toContain("sentirme fuerte");
  });
});

describe("a roadmap", () => {
  const twoPhases = (base: string, load: string) => ({
    title: "Entrenar en casa",
    why: "Sentirme fuerte",
    milestones: [
      {
        title: "Crear el hábito",
        steps: [{ templateId: base, unit: "times" as const, amount: 3 }],
      },
      {
        title: "Subir la carga",
        steps: [
          { templateId: base, unit: "times" as const, amount: 2 },
          { templateId: load, unit: "minutes" as const, amount: 60 },
        ],
      },
    ],
  });

  it("is refused whole when a step is not anchored to a real activity", () => {
    const { core, base } = setup();
    expect(() =>
      core.saveRoadmap({
        title: "Meta",
        milestones: [{ title: "Fase", steps: [{ templateId: "nope", unit: "times", amount: 3 }] }],
      })
    ).toThrow(expect.objectContaining({ code: "activity-template-not-found" }));
    expect(() => core.saveRoadmap({ title: "Meta", milestones: [] })).toThrow(
      expect.objectContaining({ code: "roadmap-invalid" })
    );
    expect(() =>
      core.saveRoadmap({ title: "Meta", milestones: [{ title: "Vacía", steps: [] }] })
    ).toThrow(expect.objectContaining({ code: "roadmap-invalid" }));
    expect(() =>
      core.saveRoadmap({
        title: "Meta",
        milestones: [{ title: "Fase", steps: [{ templateId: base.id, unit: "times", amount: 0 }] }],
      })
    ).toThrow(expect.objectContaining({ code: "roadmap-invalid" }));
    expect(core.getRoadmaps()).toEqual([]);
  });

  it("starts at zero: what was done before it existed does not count", () => {
    const { core, base, load } = setup();
    doOnce(core, base.id, -1);
    core.saveRoadmap(twoPhases(base.id, load.id));
    const [progress] = core.getRoadmapProgress();
    expect(progress).toMatchObject({ fraction: 0, doneSteps: 0, totalSteps: 3, current: 0 });
    expect(progress.milestones.map((m) => m.status)).toEqual(["current", "upcoming"]);
  });

  it("moves forward only with what was really closed, one milestone after the other", () => {
    const { core, base, load } = setup();
    core.saveRoadmap(twoPhases(base.id, load.id));

    doOnce(core, base.id);
    doOnce(core, base.id);
    let [progress] = core.getRoadmapProgress();
    expect(progress.milestones[0].steps[0]).toMatchObject({ done: 2, complete: false });
    // The second milestone has the same activity: it counts nothing until the first is reached
    expect(progress.milestones[1].steps[0].done).toBe(0);

    doOnce(core, base.id);
    [progress] = core.getRoadmapProgress();
    expect(progress.milestones.map((m) => m.status)).toEqual(["done", "current"]);
    expect(progress.milestones[1].steps[0].done).toBe(0);

    doOnce(core, base.id);
    doOnce(core, base.id);
    doOnce(core, load.id, 40);
    [progress] = core.getRoadmapProgress();
    expect(progress.milestones[1].steps[0]).toMatchObject({ done: 2, complete: true });
    expect(progress.milestones[1].steps[1]).toMatchObject({ done: 40, complete: false });
    expect(progress.complete).toBe(false);

    doOnce(core, load.id, 40);
    [progress] = core.getRoadmapProgress();
    expect(progress).toMatchObject({ complete: true, fraction: 1, doneSteps: 3 });
  });

  it("an activity stopped without finishing does not count", () => {
    const { core, base, load } = setup();
    core.saveRoadmap(twoPhases(base.id, load.id));
    core.startDay();
    const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
    const instance = core.createActivityInstance(base.id, todo.id);
    core.activateActivity(instance.id);
    core.interruptActivity(instance.id);
    expect(core.getRoadmapProgress()[0].milestones[0].steps[0].done).toBe(0);
  });

  it("shows what is planned ahead for each step", () => {
    const { core, base, load } = setup();
    core.saveRoadmap(twoPhases(base.id, load.id));
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    core.planActivity(base.id, [localDate(tomorrow)], { time: 17 * 60 });
    const step = core.getRoadmapProgress()[0].milestones[0].steps[0];
    expect(step).toMatchObject({
      plannedAhead: 1,
      next: { date: localDate(tomorrow), time: 17 * 60 },
    });
  });

  it("keeps its starting point when it is edited, and holds on to its activities", () => {
    const { core, base, load } = setup();
    const first = core.saveRoadmap(twoPhases(base.id, load.id));
    doOnce(core, base.id);
    const edited = core.saveRoadmap({
      ...twoPhases(base.id, load.id),
      id: first.id,
      title: "Otra",
    });
    expect(edited).toMatchObject({ id: first.id, title: "Otra", createdAt: first.createdAt });
    expect(core.getRoadmapProgress()[0].milestones[0].steps[0].done).toBe(1);

    expect(() => core.deleteActivityTemplate(load.id)).toThrow(
      expect.objectContaining({ code: "activity-in-roadmap" })
    );
    core.deleteRoadmap(first.id);
    expect(core.getRoadmaps()).toEqual([]);
  });
});
