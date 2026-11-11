import { SystemCore } from "../../index";
import { localDate } from "../../agendaManager";

/**
 * Activities planned for days ahead (ADR-008): they wait outside any day and
 * join the plan when their date comes, with their time and their notes.
 */

const day = (offset: number) => {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return localDate(date);
};

function setup() {
  const core = new SystemCore();
  core.clearState();
  const gym = core.createActivityTemplate({
    title: "Entrenar",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 20 },
  });
  return { core, gym };
}

describe("planning ahead", () => {
  it("keeps planned items in date order and shares a series between the dates of one call", () => {
    const { core, gym } = setup();
    const planned = core.planActivity(gym.id, [day(3), day(1), day(2)], { time: 17 * 60 });
    expect(planned.map((item) => item.date)).toEqual([day(1), day(2), day(3)]);
    expect(new Set(planned.map((item) => item.seriesId)).size).toBe(1);
    expect(core.getPlannedActivities()).toHaveLength(3);
    // Nothing is in a day's plan yet
    expect(core.getState().currentDay).toBeNull();
  });

  it("brings today's items into the plan when the day starts, with time and notes", () => {
    const { core, gym } = setup();
    core.createTimeBlock("Tarde", 12 * 60, 18 * 60);
    core.planActivity(gym.id, [day(0), day(1)], {
      time: 17 * 60,
      notes: "Sentadillas 3 x 15\nFlexiones 3 x 10",
    });

    core.startDay();
    const plan = core.getState().currentDay!.activityInstances;
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({
      templateId: gym.id,
      scheduledStart: 17 * 60,
      notes: "Sentadillas 3 x 15\nFlexiones 3 x 10",
    });
    // The time puts it in the block that holds it
    const block = core.getTimeBlocks().find((b) => b.id === plan[0].blockId);
    expect(block?.name).toBe("Tarde");
    // Tomorrow's stays waiting
    expect(core.getPlannedActivities().map((item) => item.date)).toEqual([day(1)]);
  });

  it("a date that went by without a day comes along with the next one, without its time", () => {
    const { core, gym } = setup();
    core.planActivity(gym.id, [day(-2)], { time: 9 * 60 });
    core.startDay();
    const plan = core.getState().currentDay!.activityInstances;
    expect(plan).toHaveLength(1);
    expect(plan[0].scheduledStart).toBeUndefined();
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("planning something for today while the day runs puts it in the plan at once", () => {
    const { core, gym } = setup();
    core.startDay();
    core.planActivity(gym.id, [day(0)]);
    expect(core.getState().currentDay!.activityInstances).toHaveLength(1);
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("cancels planned items and forgets those of a deleted activity", () => {
    const { core, gym } = setup();
    const [first] = core.planActivity(gym.id, [day(1), day(2), day(3)]);
    expect(core.cancelPlannedActivities([first.id])).toBe(1);
    expect(core.getPlannedActivities()).toHaveLength(2);
    core.deleteActivityTemplate(gym.id);
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("refuses dates that are not dates and an unknown activity", () => {
    const { core, gym } = setup();
    expect(() => core.planActivity(gym.id, ["mañana"])).toThrow(
      expect.objectContaining({ code: "invalid-date" })
    );
    expect(() => core.planActivity("nope", [day(1)])).toThrow(
      expect.objectContaining({ code: "activity-template-not-found" })
    );
  });

  it("survives saving and loading", () => {
    const { core, gym } = setup();
    core.planActivity(gym.id, [day(5)], { notes: "Remo 3 x 12" });
    const again = new SystemCore();
    again.importData(core.exportData());
    expect(again.getPlannedActivities()).toMatchObject([{ date: day(5), notes: "Remo 3 x 12" }]);
  });
});

describe("notes on an activity of the day", () => {
  it("stay with it when it carries over to the next day", () => {
    const { core, gym } = setup();
    core.startDay();
    const todo = core.getTimeBlocks().find((b) => b.isDefault)!;
    const instance = core.createActivityInstance(gym.id, todo.id);
    core.updateActivityInstance(instance.id, { notes: "Plancha 3 x 20 s" });
    core.endDay();
    core.startDay();
    expect(core.getState().currentDay!.activityInstances[0].notes).toBe("Plancha 3 x 20 s");
  });
});
