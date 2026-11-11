import { SystemCore } from "../../index";

/** Scheduled times (ADR-006) and the words behind a close (ADR-002). */
describe("Scheduling and closing notes", () => {
  let system: SystemCore;
  let reportId: string;
  let afternoon: string;
  let todo: string;

  beforeEach(() => {
    system = new SystemCore();
    system.clearState();
    system.createTimeBlock("Morning", 360, 720);
    afternoon = system.createTimeBlock("Afternoon", 720, 1080).id;
    system.startDay();
    // "To do" exists once the day has started
    todo = system.getTimeBlocks().find((b) => b.isDefault)!.id;
    const template = system.createActivityTemplate({
      title: "Write report",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 45 },
    });
    reportId = system.createActivityInstance(template.id, todo).id;
  });

  test("a time moves the activity to the block that contains it", () => {
    const scheduled = system.scheduleActivityInstance(reportId, 15 * 60);
    expect(scheduled.scheduledStart).toBe(900);
    expect(scheduled.blockId).toBe(afternoon);
  });

  test("a time outside every block goes to To do", () => {
    system.scheduleActivityInstance(reportId, 15 * 60);
    const late = system.scheduleActivityInstance(reportId, 22 * 60);
    expect(late.scheduledStart).toBe(1320);
    expect(late.blockId).toBe(todo);
  });

  test("the time can be cleared, and must be a minute of the day", () => {
    system.scheduleActivityInstance(reportId, 600);
    expect(system.scheduleActivityInstance(reportId, null).scheduledStart).toBeUndefined();
    expect(() => system.scheduleActivityInstance(reportId, 1440)).toThrowCoreError(
      "minutes-out-of-range"
    );
  });

  test("a planned time does not carry over to the next day", () => {
    system.scheduleActivityInstance(reportId, 600);
    system.endDay();
    system.startDay();
    const carried = system.getState().currentDay!.activityInstances[0];
    expect(carried.id).toBe(reportId);
    expect(carried.scheduledStart).toBeUndefined();
  });

  test("the person's words are kept with the close", () => {
    system.activateActivity(reportId);
    system.requestCompletion(reportId);
    const { record } = system.completeActivity(reportId, {
      satisfactionScore: 8,
      note: "  Went well, finished the draft.  ",
    });
    expect(record.closingNote).toBe("Went well, finished the draft.");
  });
});
