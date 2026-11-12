import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import type { ChatMessage, ChatOptions, ModelReply } from "../agent/llm";
import { RoadmapDraft } from "../agent/roadmapDraft";
import { addNote } from "../agent/tools";
import { setLocale } from "../i18n";

// What the person reads (the card, the dates) is checked as they read it
beforeAll(() => setLocale("es"));
afterAll(() => setLocale("en"));

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

const SCHEDULE = { weekdays: ["mon", "wed", "fri"], time: "19:00", start: "tomorrow" };

/** A roadmap as the planner gives it: one activity, its days, and phases counted in sessions. */
const ROADMAP = {
  title: "Entrenar en casa",
  why: "Sentirme fuerte",
  activity: "Entrenar: base",
  schedule: SCHEDULE,
  rules: "- Día malo: una serie de cada ejercicio",
  milestones: [
    { title: "Crear el hábito", sessions: 6, notes: "- Sentadilla 2x10\n- Remo 2x10" },
    {
      title: "Subir la carga",
      sessions: 12,
      notes: "- Sentadilla 3x10\n- Remo 3x10",
      activity: "Entrenar: con carga",
      session_minutes: 40,
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
        schedule: SCHEDULE,
        milestones: [{ title: "Fase", steps: [{ activity: "Nadar", times: 3 }] }],
      })
    ).toThrow(/activity-not-found.*"Entrenar: base".*session_minutes/);
    expect(() =>
      draft.saveRoadmap({
        title: "Meta",
        schedule: SCHEDULE,
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

  it("cannot be created without the days its sessions happen on", () => {
    const draft = new RoadmapDraft(setup());
    const { schedule: _schedule, ...withoutDays } = ROADMAP;
    expect(() => draft.saveRoadmap(withoutDays)).toThrow(/roadmap-needs-schedule.*cannot_do/);
    expect(() => draft.saveRoadmap({ ...ROADMAP, schedule: { start: "tomorrow" } })).toThrow(
      /schedule-needs-weekdays/
    );
    expect(() =>
      draft.saveRoadmap({ ...ROADMAP, schedule: { weekdays: ["mon"], start: "2020-01-01" } })
    ).toThrow(/date-in-the-past/);
    expect(draft.changed).toBe(false);
  });

  it("teaches that the parts of a session are not steps and not activities", () => {
    const core = setup();
    const draft = new RoadmapDraft(core);
    const parts = ["Sentadillas", "Flexiones", "Zancadas", "Remo", "Press"];
    // Five exercises given as five steps of one phase
    expect(() =>
      draft.saveRoadmap({
        title: "Fuerza",
        schedule: SCHEDULE,
        milestones: [
          {
            title: "Fase 1",
            steps: parts.map((activity) => ({ activity, sessions: 3, session_minutes: 2 })),
          },
        ],
      })
    ).toThrow(/too-many-steps.*goes in that step's "notes"/);
    // Or spread over phases: still four new activities for what is one session
    expect(() =>
      draft.saveRoadmap({
        title: "Fuerza",
        schedule: SCHEDULE,
        milestones: parts.slice(0, 4).map((activity) => ({
          title: `Fase ${activity}`,
          steps: [{ activity, sessions: 3, session_minutes: 2 }],
        })),
      })
    ).toThrow(/too-many-activities.*ONE activity for the session/);
    // A call that was refused leaves nothing of itself behind
    expect(draft.changed).toBe(false);
    expect(draft.describe().details).toEqual([]);
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
    // The amount changed; what a session consists of stayed
    expect(saved.milestones[0].steps[0]).toMatchObject({
      unit: "times",
      amount: 8,
      notes: "- Sentadilla 2x10\n- Remo 2x10",
    });
    expect(saved.milestones[1].steps).toHaveLength(2);
    // The activity the plan needed was created in the library, with its session length
    expect(core.getActivityTemplates().map((tpl) => tpl.title)).toContain("Entrenar: con carga");
  });

  it("puts every session on the calendar when it is saved, and says where they fell", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-12T10:00:00")); // a Thursday
    try {
      const core = setup();
      const draft = new RoadmapDraft(core, new Date());
      draft.saveRoadmap(ROADMAP);

      // The card shows the real dates before anything is saved
      const card = draft.describe();
      expect(card.details[0]).toBe(
        "lun, mié, vie · 19:00 · 18 sesiones, del vie 13 nov al mié 23 dic"
      );
      expect(card.details[1]).toContain(
        "Crear el hábito: Entrenar: base × 6 (vie 13 nov → mié 25 nov)"
      );
      expect(core.getPlannedActivities()).toEqual([]);

      const result = draft.commit();
      const planned = core.getPlannedActivities();
      expect(planned).toHaveLength(18);
      expect(planned[0]).toMatchObject({ date: "2026-11-13", time: 19 * 60 });
      expect(planned[0].notes).toBe(
        "- Sentadilla 2x10\n- Remo 2x10\n\n- Día malo: una serie de cada ejercicio"
      );
      // What the coach is given: dates with their weekday, ready to be said as they are
      expect(result.sessions).toEqual([
        {
          roadmap: "Entrenar en casa",
          days: "lun, mié, vie",
          time: "19:00",
          total: 18,
          first: "vie 13 nov",
          first_is: "tomorrow",
          last: "mié 23 dic",
          milestones: [
            { milestone: "Crear el hábito", sessions: 6, from: "vie 13 nov", to: "mié 25 nov" },
            { milestone: "Subir la carga", sessions: 12, from: "vie 27 nov", to: "mié 23 dic" },
          ],
        },
      ]);
    } finally {
      jest.useRealTimers();
    }
  });

  it("holds a new roadmap to what the person said", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-12T10:00:00"));
    try {
      const core = setup();
      // From the coach's notes: 20 minutes a session, at 19:00, for eight weeks
      const said = { minutes: 20, time: 19 * 60, weeks: 8 };
      const draft = new RoadmapDraft(core, new Date(), said);
      const theirs = { weekdays: ["martes", "jueves"], start: "tomorrow" };

      // Sessions three times as long as they said they had
      expect(() =>
        draft.saveRoadmap({
          title: "Otra",
          activity: "Sesión larga",
          session_minutes: 60,
          schedule: theirs,
          milestones: [{ title: "Fase", sessions: 4, notes: "- algo" }],
        })
      ).toThrow(/session-too-long.*20 minutes/);
      expect(draft.changed).toBe(false);

      // Much longer than the plan they asked for: sent back once, with the numbers
      const long = {
        ...ROADMAP,
        schedule: theirs,
        milestones: [{ title: "Fase", sessions: 40, notes: "- algo" }],
      };
      expect(() => draft.saveRoadmap(long)).toThrow(
        /longer-than-asked.*40 sessions on 2 days a week run 20 weeks.*8 weeks, 2 days a week is 16 sessions/
      );
      expect(draft.changed).toBe(false);
      // Sent again, it stands: the person is told on the card, and decides
      draft.saveRoadmap(long);
      expect(draft.warnings).toEqual(["Ojo: pediste unas 8 semanas y esta dura 20."]);
      expect(draft.describe().details[0]).toBe("Ojo: pediste unas 8 semanas y esta dura 20.");

      // Within what they said it goes through, at their time though none was written
      draft.saveRoadmap({
        ...ROADMAP,
        schedule: theirs,
        milestones: [{ title: "Fase", sessions: 16, notes: "- algo" }],
      });
      expect(draft.warnings).toEqual([]);
      draft.commit();
      const planned = core.getPlannedActivities();
      expect(planned).toHaveLength(16);
      expect(planned[0]).toMatchObject({ date: "2026-11-17", time: 19 * 60 });

      // "Starting on Monday": the first session is not before that Monday
      const core2 = setup();
      const later = new RoadmapDraft(core2, new Date(), { startOn: 1 });
      later.saveRoadmap({
        ...ROADMAP,
        schedule: { weekdays: ["mon", "wed", "fri"], start: "today" },
      });
      later.commit();
      expect(core2.getPlannedActivities()[0].date).toBe("2026-11-16");
    } finally {
      jest.useRealTimers();
    }
  });

  it("moves a roadmap's sessions to other days", () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-11-12T10:00:00"));
    try {
      const core = setup();
      const first = new RoadmapDraft(core, new Date());
      first.saveRoadmap(ROADMAP);
      first.commit();

      const draft = new RoadmapDraft(core, new Date());
      draft.setSchedule({ weekdays: ["tue", "thu"], start: "tomorrow" });
      draft.commit();
      const planned = core.getPlannedActivities();
      expect(planned).toHaveLength(18);
      expect(planned.slice(0, 2).map((item) => item.date)).toEqual(["2026-11-17", "2026-11-19"]);
      // The time was left out, so it stayed
      expect(planned[0].time).toBe(19 * 60);
    } finally {
      jest.useRealTimers();
    }
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
      // Its days and how many sessions, then each phase
      expect(card.details?.[0]).toMatch(/lun, mié, vie · 19:00 · 18 sesiones/);
      expect(card.details?.[1]).toContain("Crear el hábito");
    }
    expect(core.getRoadmaps()).toEqual([]);

    agent.decide(card.id, true);
    await turn;
    expect(core.getRoadmaps()).toHaveLength(1);
    expect(core.getRoadmapProgress()[0]).toMatchObject({ totalSteps: 2, fraction: 0 });
    // Saved, and on the calendar in the same go
    expect(core.getPlannedActivities()).toHaveLength(18);

    // The planner saw the real library; the coach only got the outcome
    expect(String(seen.planner[0][0].content)).toContain("Entrenar: base");
    const result = String(seen.coach[1].at(-1)!.content);
    expect(result).toContain("Creé la hoja de ruta con dos etapas.");
    // The coach is given the dates to say, and told not to plan them again
    expect(result).toContain('"total":18');
    expect(result).toContain("do not plan these sessions again");
    expect(result.length).toBeLessThan(1500);

    // One undo takes back the roadmap, the activity it created and every session it planned
    agent.undo(card.id);
    expect(core.getRoadmaps()).toEqual([]);
    expect(core.getActivityTemplates()).toHaveLength(1);
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("builds and finishes in one call, reading the plan from the conversation", async () => {
    const core = setup();
    const { agent, seen, asked } = agentWith(
      core,
      [
        say("Te propongo dos fases: seis sesiones de base y después doce con carga. ¿Te parece?"),
        call("plan_roadmap", { request: "Arma la hoja de ruta del plan de arriba." }),
        say("Lista."),
      ],
      [call("save_roadmap", { ...ROADMAP, message: "Creé la hoja de ruta.", then: "finish" })]
    );
    agent.mode = "auto";
    await agent.send("quiero volver a entrenar en casa");
    await agent.send("sí, dale");
    // One call to the planner, and it was not asked again
    expect(asked).toHaveLength(1);
    expect(core.getRoadmaps().map((roadmap) => roadmap.title)).toEqual(["Entrenar en casa"]);
    // It had the plan as the person read it, not only the coach's one-line request
    const system = String(seen.planner[0][0].content);
    expect(system).toContain("COACH: Te propongo dos fases: seis sesiones de base");
    expect(system).toContain("PERSON: sí, dale");
    expect(String(seen.coach.at(-1)!.at(-1)!.content)).toContain("Creé la hoja de ruta.");
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
          activity: "Nadar",
          schedule: SCHEDULE,
          milestones: [{ title: "Empezar", sessions: 4, notes: "- 10 largos" }],
        }),
        call("save_roadmap", {
          title: "Nadar",
          activity: "Nadar",
          session_minutes: 30,
          schedule: SCHEDULE,
          milestones: [{ title: "Empezar", sessions: 4, notes: "- 10 largos" }],
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
          activity: "Entrenar: base",
          schedule: SCHEDULE,
          milestones: [{ title: "Fase 1", sessions: 6, notes: "- Sentadilla 2x10" }],
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
          activity: "Entrenar: base",
          schedule: SCHEDULE,
          milestones: [{ title: "Fase 1", sessions: 6, notes: "- Sentadilla 2x10" }],
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
