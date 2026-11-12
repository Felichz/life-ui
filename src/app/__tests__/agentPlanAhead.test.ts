import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import type { ChatMessage, ModelReply } from "../agent/llm";
import { setLocale } from "../i18n";

/**
 * Planning ahead what is not a roadmap (ADR-008, ADR-011): the answer gives
 * dates a model can repeat as they are, says when a day got fuller than a
 * person would mean, and leaves a roadmap's sessions to the roadmap.
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const call = (name: string, args: object): ModelReply => ({
  content: "",
  toolCalls: [
    {
      id: `c-${name}-${Math.random()}`,
      type: "function",
      function: { name, arguments: JSON.stringify(args) },
    },
  ],
});

// A Thursday
const NOW = new Date("2026-11-12T10:00:00");

beforeAll(() => setLocale("es"));
afterAll(() => setLocale("en"));

function agentWith(replies: ModelReply[]) {
  const core = new SystemCore();
  core.clearState();
  const seen: ChatMessage[][] = [];
  const agent = new Agent({
    core,
    prompt: "p",
    now: () => NOW,
    chat: async (messages) => {
      seen.push(messages);
      const reply = replies.shift();
      if (!reply) throw new Error("script ran out");
      return reply;
    },
  });
  agent.mode = "auto";
  const results = () =>
    seen
      .at(-1)!
      .filter((message) => message.role === "tool")
      .map((message) => JSON.parse(String(message.content)) as Record<string, unknown>);
  return { agent, core, results };
}

describe("planning ahead", () => {
  it("repeats a number of times and gives its dates with their weekdays", async () => {
    const { agent, core, results } = agentWith([
      call("plan_ahead", {
        title: "Leer",
        minutes: 20,
        weekdays: ["tue", "thu"],
        sessions: 4,
        start: "tomorrow",
      }),
      say("Listo."),
    ]);
    await agent.send("quiero leer martes y jueves, cuatro veces");
    expect(core.getPlannedActivities().map((item) => item.date)).toEqual([
      "2026-11-17",
      "2026-11-19",
      "2026-11-24",
      "2026-11-26",
    ]);
    expect(results()[0]).toMatchObject({
      planned: 4,
      first: "mar 17 nov",
      last: "jue 26 nov",
      dates: "mar 17 nov, jue 19 nov, mar 24 nov, jue 26 nov",
    });
    // The card says the same to the person
    expect(agent.entries.find((entry) => entry.kind === "tool")).toMatchObject({
      summary: "Programar «Leer» · mar, jue · 4 veces, del mar 17 nov al jue 26 nov",
    });
  });

  it("says so when a day ahead got fuller than a person would mean", async () => {
    const parts = ["Sentadillas", "Flexiones", "Zancadas", "Remo"];
    const { agent, results } = agentWith([
      ...parts.map((title) => call("plan_ahead", { title, minutes: 20, start: "tomorrow" })),
      say("Listo."),
    ]);
    await agent.send("ponme los ejercicios de mañana");
    const last = results().at(-1)!;
    expect(String(last.note)).toMatch(/vie 13 nov now has 4 planned activities, about 80 minutes/);
    expect(String(last.note)).toContain("one activity with notes");
    // Three were fine
    expect(results()[2].note).toBeUndefined();
  });

  it("leaves a roadmap's sessions to the roadmap", async () => {
    const { agent, core, results } = agentWith([
      call("plan_ahead", { title: "Entrenar", weekdays: ["mon"], weeks: 4 }),
      say("No pude."),
    ]);
    const train = core.createActivityTemplate({
      title: "Entrenar",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 15 },
    });
    core.saveRoadmap({
      title: "Volver a entrenar",
      schedule: { weekdays: [1, 3, 5], start: "2099-01-01" },
      milestones: [{ title: "Fase", steps: [{ templateId: train.id, unit: "times", amount: 3 }] }],
    });
    const before = core.getPlannedActivities().length;
    await agent.send("programa entrenar los lunes");
    expect(results()[0]).toMatchObject({ error: "planned-by-roadmap" });
    expect(String(results()[0].detail)).toContain('"Volver a entrenar"');
    expect(core.getPlannedActivities()).toHaveLength(before);
  });
});
