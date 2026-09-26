import { SystemCore } from "../../index";

/**
 * Ritual de cierre: la vista previa (requestCompletion) y el cierre final
 * (completeActivity) deben usar la misma base, y el total diario solo cuenta
 * el día actual.
 */
describe("Ritual de cierre", () => {
  let system: SystemCore;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-03-02T09:00:00"));
    system = new SystemCore();
    system.clearState();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const createObjective = (estimate: number) =>
    system.createActivityTemplate({
      title: "Escribir informe",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: estimate },
    });

  const todoBlockId = () => system.getTimeBlocks().find((b) => b.isDefault)!.id;

  test("el estimado ajustado en la instancia manda en la vista previa y en el cierre", () => {
    system.startDay();
    const template = createObjective(30);
    const instance = system.createActivityInstance(template.id, todoBlockId(), {
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
    });
    system.activateActivity(instance.id);
    jest.advanceTimersByTime(40 * 60 * 1000);

    const request = system.requestCompletion(instance.id);
    expect(request.estimatedMinutes).toBe(60);

    const result = system.completeActivity(instance.id, {
      satisfactionScore: 7,
      endTime: request.requestedAt,
    });
    // base = 60 (estimado de la instancia) × 7/7
    expect(result.temposAwarded).toBe(60);
    expect(result.record.durationMinutes).toBe(40);
  });

  test("dailyTempoTotal solo suma los tempos del día actual", () => {
    const template = createObjective(30);

    system.startDay();
    const first = system.createActivityInstance(template.id, todoBlockId());
    system.activateActivity(first.id);
    system.completeActivity(first.id, { satisfactionScore: 7 });
    system.endDay();

    jest.setSystemTime(new Date("2026-03-03T09:00:00"));
    system.startDay();
    const second = system.createActivityInstance(template.id, todoBlockId());
    system.activateActivity(second.id);
    const result = system.completeActivity(second.id, { satisfactionScore: 7 });

    expect(result.temposAwarded).toBe(30);
    expect(result.dailyTempoTotal).toBe(30);
    expect(result.targetProgress).toBeCloseTo(0.3);
    expect(system.getTempoSummary(system.getCurrentDay()!.id).totalTempos).toBe(30);
  });
});
