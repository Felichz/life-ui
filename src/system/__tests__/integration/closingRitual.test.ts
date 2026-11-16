import { SystemCore } from "../../index";

/**
 * Closing a task (ADR-015): the request freezes the end, the completion uses
 * it, and the day's summary only counts the current day, done and not done.
 */
describe("Closing ritual", () => {
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

  test("the estimate adjusted on the instance wins, and the frozen end sets the duration", () => {
    system.startDay();
    const template = createObjective(30);
    const instance = system.createActivityInstance(template.id, todoBlockId(), {
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
    });
    system.activateActivity(instance.id);
    jest.advanceTimersByTime(40 * 60 * 1000);

    const request = system.requestCompletion(instance.id);
    expect(request.estimatedMinutes).toBe(60);

    jest.advanceTimersByTime(5 * 60 * 1000);
    const result = system.completeActivity(instance.id, { endTime: request.requestedAt });
    expect(result.record.state).toBe("completed");
    expect(result.record.durationMinutes).toBe(40);
    expect(result.record.clearObjectiveSettings?.estimatedDurationMinutes).toBe(60);
  });

  test("the day's summary only counts the current day, done and not done", () => {
    const template = createObjective(30);

    system.startDay();
    const first = system.createActivityInstance(template.id, todoBlockId());
    system.activateActivity(first.id);
    system.completeActivity(first.id);
    system.endDay();

    jest.setSystemTime(new Date("2026-03-03T09:00:00"));
    system.startDay();
    const second = system.createActivityInstance(template.id, todoBlockId());
    system.activateActivity(second.id);
    jest.advanceTimersByTime(30 * 60 * 1000);
    system.completeActivity(second.id);
    const third = system.createActivityInstance(template.id, todoBlockId());
    system.activateActivity(third.id);
    system.interruptActivity(third.id, { note: "no llegué" });

    expect(system.getDaySummary(system.getCurrentDay()!.id)).toEqual({
      completed: 1,
      notCompleted: 1,
      minutesDone: 30,
    });
  });
});
