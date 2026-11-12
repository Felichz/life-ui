import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import type { ChatMessage, ChatOptions, ModelReply } from "../agent/llm";
import { RoadmapDraft } from "../agent/roadmapDraft";
import { addNote } from "../agent/tools";

/**
 * Where the person is going, through the chat (ADR-010): the agent notes
 * their ideal life as they talk and always has it in front of it, and a
 * second agent, the roadmap planner, builds roadmaps on a draft that the
 * person confirms before it is saved.
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
const isPlanner = (messages: ChatMessage[]) =>
  String(messages[0].content).startsWith("You are the roadmap planner");

function setup() {
  const core = new SystemCore();
  core.clearState();
  core.createActivityTemplate({
    title: "Entrenar: base",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 20 },
  });
  return core;
}

/** One model plays both parts: the coach's replies and the planner's are scripted apart. */
function agentWith(core: SystemCore, coach: ModelReply[], planner: Array<ModelReply | Error> = []) {
  const seen = { coach: [] as ChatMessage[][], planner: [] as ChatMessage[][] };
  /** How each call to the planner was made: forced to act or free, and its limit. */
  const asked: ChatOptions[] = [];
  const agent = new Agent({
    core,
    prompt: "p",
    chat: async (messages, _tools, _signal, options) => {
      const who = isPlanner(messages) ? "planner" : "coach";
      seen[who].push(messages);
      if (who === "planner") asked.push(options ?? {});
      const reply = (who === "planner" ? planner : coach).shift();
      if (!reply) throw new Error(`${who} script ran out`);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  });
  return { agent, seen, asked };
}

const ROADMAP = {
  title: "Entrenar en casa",
  why: "Sentirme fuerte",
  milestones: [
    { title: "Crear el hábito", steps: [{ activity: "Entrenar: base", sessions: 6 }] },
    {
      title: "Subir la carga",
      steps: [{ activity: "Entrenar: con carga", sessions: 12, session_minutes: 40 }],
    },
  ],
};

describe("notes in the ideal life", () => {
  it("go under their heading, which is created when it is missing", () => {
    expect(addNote("", "Quiero sentirme fuerte", "Cuerpo")).toBe(
      "## Cuerpo\n\n- Quiero sentirme fuerte"
    );
    const text = "Lo que quiero.\n\n## Cuerpo\n\n- Dormir bien\n\n## Trabajo\n\n- Menos reuniones";
    expect(addNote(text, "Entrenar tres veces", "cuerpo")).toBe(
      "Lo que quiero.\n\n## Cuerpo\n\n- Dormir bien\n- Entrenar tres veces\n\n## Trabajo\n\n- Menos reuniones"
    );
  });
});

describe("the ideal life in the chat", () => {
  it("is noted in the person's words after their yes, and travels with every request", async () => {
    const core = setup();
    const { agent, seen } = agentWith(core, [
      call("note_ideal_life", { text: "Quiero sentirme fuerte a los 60", section: "Cuerpo" }),
      say("Anotado."),
      say("ok"),
    ]);
    const turn = agent.send("quiero sentirme fuerte a los 60");
    await new Promise((resolve) => setTimeout(resolve, 0));
    const card = agent.entries.at(-1)!;
    expect(card).toMatchObject({ kind: "tool", status: "pending" });
    expect(core.getIdealLife()).toBeNull();
    agent.decide(card.id, true);
    await turn;
    expect(core.getIdealLife()?.text).toBe("## Cuerpo\n\n- Quiero sentirme fuerte a los 60");

    await agent.send("¿y ahora?");
    expect(String(seen.coach.at(-1)![0].content)).toContain("Quiero sentirme fuerte a los 60");
  });

  it("refuses to edit a passage that is not there, so the model reads before it writes", async () => {
    const core = setup();
    core.setIdealLife("## Cuerpo\n\n- Dormir bien");
    const { agent, seen } = agentWith(core, [
      call("edit_ideal_life", { find: "Dormir ocho horas", replace: "Dormir siete horas" }),
      say("No lo encontré."),
    ]);
    agent.mode = "auto";
    await agent.send("cambia lo de dormir");
    expect(JSON.stringify(seen.coach[1].at(-1))).toContain("text-not-found");
    expect(core.getIdealLife()?.text).toBe("## Cuerpo\n\n- Dormir bien");
  });
});

describe("the roadmap draft", () => {
  it("refuses a step whose activity is not real, and says how to fix it", () => {
    const draft = new RoadmapDraft(setup());
    expect(() =>
      draft.saveRoadmap({
        title: "Meta",
        milestones: [{ title: "Fase", steps: [{ activity: "Nadar", times: 3 }] }],
      })
    ).toThrow(/activity-not-found.*"Entrenar: base".*session_minutes/);
    expect(() =>
      draft.saveRoadmap({
        title: "Meta",
        milestones: [{ title: "Fase", steps: [{ activity: "Entrenar: base" }] }],
      })
    ).toThrow(/step-needs-amount/);
    expect(() => draft.saveRoadmap({ title: "Meta", milestones: [] })).toThrow(
      /roadmap-needs-milestones/
    );
    expect(() => draft.addStep({ milestone: 1, activity: "Entrenar: base", times: 2 })).toThrow(
      /roadmap-not-found/
    );
    expect(draft.changed).toBe(false);
  });

  it("is edited by number or by title, and never left with an empty milestone", () => {
    const core = setup();
    const draft = new RoadmapDraft(core);
    draft.saveRoadmap(ROADMAP);
    draft.setStep({ milestone: 1, step: 1, times: 8 });
    draft.addStep({ milestone: "Subir la carga", activity: "Entrenar: base", total_minutes: 120 });
    expect(() => draft.removeStep({ milestone: 1, step: "Entrenar: base" })).toThrow(/last-step/);
    expect(() => draft.setStep({ milestone: 3, step: 1, times: 2 })).toThrow(
      /milestone-not-found.*1\. "Crear el hábito"/
    );
    draft.commit();
    const [saved] = core.getRoadmaps();
    expect(saved.milestones[0].steps[0]).toMatchObject({ unit: "times", amount: 8 });
    expect(saved.milestones[1].steps).toHaveLength(2);
    // The activity the plan needed was created in the library, with its session length
    expect(core.getActivityTemplates().map((tpl) => tpl.title)).toContain("Entrenar: con carga");
  });
});

describe("the roadmap planner", () => {
  it("drafts on its own conversation, the person confirms, and the coach gets a few lines back", async () => {
    const core = setup();
    const { agent, seen } = agentWith(
      core,
      [
        call("plan_roadmap", {
          request: "Meta: entrenar en casa para sentirse fuerte. Fase 1: 6 sesiones de base…",
        }),
        say("Tu hoja de ruta está lista."),
      ],
      [call("save_roadmap", ROADMAP), say("Creé la hoja de ruta con dos etapas.")]
    );
    const turn = agent.send("hazme una hoja de ruta para entrenar en casa");
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Drafted, shown, not saved
    const card = agent.entries.at(-1)!;
    expect(card).toMatchObject({ kind: "tool", status: "pending" });
    if (card.kind === "tool") {
      expect(card.summary).toContain("Entrenar en casa");
      expect(card.details?.[0]).toContain("Crear el hábito");
    }
    expect(core.getRoadmaps()).toEqual([]);

    agent.decide(card.id, true);
    await turn;
    expect(core.getRoadmaps()).toHaveLength(1);
    expect(core.getRoadmapProgress()[0]).toMatchObject({ totalSteps: 2, fraction: 0 });

    // The planner saw the real library; the coach only got the outcome
    expect(String(seen.planner[0][0].content)).toContain("Entrenar: base");
    const result = String(seen.coach[1].at(-1)!.content);
    expect(result).toContain("Creé la hoja de ruta con dos etapas.");
    expect(result).toContain("No sessions are planned yet");
    expect(result.length).toBeLessThan(700);

    // One undo takes back the roadmap and the activity it created
    agent.undo(card.id);
    expect(core.getRoadmaps()).toEqual([]);
    expect(core.getActivityTemplates()).toHaveLength(1);
  });

  it("gets its own mistakes back as errors, fixes them, and nothing wrong is saved", async () => {
    const core = setup();
    const { agent, seen, asked } = agentWith(
      core,
      [
        call("plan_roadmap", { request: "Meta: nadar. Fase 1: 4 sesiones de natación." }),
        say("Listo."),
      ],
      [
        call("save_roadmap", {
          title: "Nadar",
          milestones: [{ title: "Empezar", steps: [{ activity: "Nadar", times: 4 }] }],
        }),
        call("save_roadmap", {
          title: "Nadar",
          milestones: [
            {
              title: "Empezar",
              steps: [{ activity: "Nadar", times: 4, session_minutes: 30 }],
            },
          ],
        }),
        call("finish", { message: "Creé «Nadar»; elegí 30 minutos por sesión." }),
      ]
    );
    agent.mode = "auto";
    await agent.send("quiero aprender a nadar");
    // The planner's whole conversation, as it stood at its last call
    expect(JSON.stringify(seen.planner.at(-1))).toContain("activity-not-found");
    expect(core.getRoadmaps().map((roadmap) => roadmap.title)).toEqual(["Nadar"]);
    // Every move has to be a tool call, and none may run on without a limit
    expect(asked.map((options) => options.toolChoice)).toEqual([
      "required",
      "required",
      "required",
    ]);
    expect(asked.every((options) => (options.maxTokens ?? 0) > 0)).toBe(true);
    // What it said on finishing reaches the coach
    expect(String(seen.coach[1].at(-1)!.content)).toContain("elegí 30 minutos por sesión");
  });

  it("is not believed when it says it is done and has done nothing", async () => {
    const core = setup();
    const { agent, seen } = agentWith(
      core,
      [call("plan_roadmap", { request: "Meta: entrenar. Fase 1: 6 sesiones." }), say("Listo.")],
      [
        // The claim Qwen3.5 9B made in words, now made as a call
        call("finish", { message: "He creado la hoja de ruta." }),
        call("save_roadmap", {
          title: "Entrenar",
          milestones: [{ title: "Fase 1", steps: [{ activity: "Entrenar: base", sessions: 6 }] }],
        }),
        call("finish", { message: "Creé «Entrenar» con una fase de 6 sesiones." }),
      ]
    );
    agent.mode = "auto";
    await agent.send("armame la hoja de ruta");
    expect(JSON.stringify(seen.planner[1])).toContain("nothing-to-finish");
    expect(core.getRoadmaps().map((roadmap) => roadmap.title)).toEqual(["Entrenar"]);
  });

  it("asks once more when a call to the model fails, and keeps what it had done", async () => {
    const core = setup();
    const { agent } = agentWith(
      core,
      [call("plan_roadmap", { request: "Meta: entrenar. Fase 1: 6 sesiones." }), say("Listo.")],
      [
        call("save_roadmap", {
          title: "Entrenar",
          why: "",
          milestones: [{ title: "Fase 1", steps: [{ activity: "Entrenar: base", sessions: 6 }] }],
        }),
        new Error("The model stopped with an error: slot unavailable"),
        call("finish", { message: "Creé «Entrenar»." }),
      ]
    );
    agent.mode = "auto";
    await agent.send("armame la hoja de ruta");
    expect(core.getRoadmaps().map((roadmap) => roadmap.title)).toEqual(["Entrenar"]);
  });

  it("can say that a request cannot be carried out, and nothing is saved", async () => {
    const core = setup();
    const { agent, seen } = agentWith(
      core,
      [call("plan_roadmap", { request: "hazle una hoja de ruta" }), say("Me falta la meta.")],
      [call("cannot_do", { missing: "La petición no dice cuál es la meta ni las fases." })]
    );
    agent.mode = "auto";
    await agent.send("hazme una hoja de ruta");
    expect(core.getRoadmaps()).toEqual([]);
    const result = String(seen.coach[1].at(-1)!.content);
    expect(result).toContain("nothing-saved");
    expect(result).toContain("no dice cuál es la meta");
  });

  it("saves nothing and says so when the planner could not build it", async () => {
    const core = setup();
    const { agent, seen, asked } = agentWith(
      core,
      [call("plan_roadmap", { request: "algo" }), say("No pude armarla.")],
      // A server that holds the model to nothing: it talks instead of acting, is told
      // that nothing exists, twice, and still only talks
      [say("He creado la hoja de ruta."), say("Ya está creada."), say("Me falta saber la meta.")]
    );
    agent.mode = "auto";
    await agent.send("hazme una hoja de ruta");
    expect(core.getRoadmaps()).toEqual([]);
    expect(agent.entries.some((entry) => entry.kind === "tool")).toBe(false);
    expect(JSON.stringify(seen.planner.at(-1))).toContain("Nothing exists yet");
    // Each time it is told that words change nothing, the next move is forced again
    expect(asked.map((options) => options.toolChoice)).toEqual([
      "required",
      "required",
      "required",
    ]);
    // The coach is told as an error, so it does not repeat the planner's claim
    const result = String(seen.coach[1].at(-1)!.content);
    expect(result).toContain("nothing-saved");
    expect(result).toContain("Do NOT tell the person it was");
  });

  it("asks before deleting a roadmap even in auto mode", async () => {
    const core = setup();
    const base = core.getActivityTemplates()[0];
    core.saveRoadmap({
      title: "Entrenar en casa",
      milestones: [{ title: "Fase", steps: [{ templateId: base.id, unit: "times", amount: 3 }] }],
    });
    const { agent } = agentWith(
      core,
      [
        call("plan_roadmap", { request: "Borra la hoja de ruta Entrenar en casa" }),
        say("Borrada."),
      ],
      [call("delete_roadmap", { roadmap: "Entrenar en casa" }), say("La borré.")]
    );
    agent.mode = "auto";
    const turn = agent.send("borra mi hoja de ruta");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(agent.entries.at(-1)).toMatchObject({ kind: "tool", status: "pending" });
    expect(core.getRoadmaps()).toHaveLength(1);
    agent.decide(agent.entries.at(-1)!.id, true);
    await turn;
    expect(core.getRoadmaps()).toEqual([]);
  });
});
