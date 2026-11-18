import { SystemCore } from "../../system";
import { Agent, type ChatFn } from "../agent/agent";
import type { ModelReply } from "../agent/llm";

/**
 * One message that names several things to add: one call adds them all. A 9B
 * model called the tool for the first and wrote "I added the others too".
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const call = (name: string, args: object): ModelReply => ({
  content: "",
  toolCalls: [
    { id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

describe("adding several things in one message", () => {
  it("adds every one of them with a single call", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const replies = [
      call("add_to_plan", {
        title: "meditar",
        minutes: 10,
        also: [{ title: "desayunar" }, { title: "revisar correos", minutes: 15 }],
      }),
      say("Agregué las tres."),
    ];
    const chat: ChatFn = async () => replies.shift()!;
    const agent = new Agent({ core, prompt: "p", chat });
    agent.mode = "auto";
    await agent.send("agrega meditar 10 minutos, desayunar y revisar correos");

    const titles = core
      .getState()
      .currentDay!.activityInstances.map(
        (instance) =>
          core.getActivityTemplates().find((template) => template.id === instance.templateId)!.title
      );
    expect(titles).toEqual(["meditar", "desayunar", "revisar correos"]);
    const card = agent.entries.find((entry) => entry.kind === "tool");
    expect(card).toMatchObject({ status: "done" });
    expect(card?.kind === "tool" && card.summary).toContain("desayunar");
  });

  it("records something already done on its goal, and not as an event", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const study = core.createActivityTemplate({
      title: "Estudio Cálculo",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
    });
    core.saveRoadmap({
      title: "Aprobar cálculo",
      milestones: [
        { title: "Derivadas", steps: [{ templateId: study.id, unit: "times", amount: 10 }] },
      ],
    });
    const replies = [
      call("record_done", {
        title: "Estudio Cálculo",
        minutes: 45,
        how_it_went: "estudié derivadas y entendí la regla de la cadena",
      }),
      say("Anotado."),
    ];
    const chat: ChatFn = async () => replies.shift()!;
    const agent = new Agent({ core, prompt: "p", chat });
    agent.mode = "auto";
    await agent.send("hoy estudié derivadas y entendí la regla de la cadena");

    const [record] = core.getState().global.completedActivityRecords;
    expect(record).toMatchObject({ state: "completed", templateTitle: "Estudio Cálculo" });
    expect(record.durationMinutes).toBeGreaterThanOrEqual(44);
    expect(record.closingNote).toContain("regla de la cadena");
    expect(core.getActiveActivity()).toBeNull();
    expect(core.getRoadmapProgress()[0].milestones[0].steps[0].done).toBe(1);
  });

  it("does not offer to record as done what the person only says they will do", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const offered: string[][] = [];
    const chat: ChatFn = async (_messages, tools) => {
      offered.push(
        (tools as Array<{ function: { name: string } }>).map((one) => one.function.name)
      );
      return say("Vale.");
    };
    const agent = new Agent({ core, prompt: "p", chat });
    await agent.send("igual voy a leer un rato, 20 minutos");
    await agent.send("hoy leí 20 minutos");
    expect(offered[0]).not.toContain("record_done");
    expect(offered[1]).toContain("record_done");
  });
});
