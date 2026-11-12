import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import {
  briefLines,
  clockIn,
  durationIn,
  missingFrom,
  nextMove,
  saidIn,
  timeIn,
  updateBrief,
  worthNoting,
  type Brief,
} from "../agent/brief";
import type { ChatMessage, ModelReply } from "../agent/llm";

/**
 * The coach's notes on what the person has told it (ADR-012): kept by a short
 * call, never lost, and used to decide the coach's next move, so a small
 * model does not ask twice or walk past what it was told.
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
const NO_PLAN = { wanted: false, session_length: "", days: "", time: "", start: "" };
const notes = (fields: Partial<Record<string, unknown>>) =>
  call("keep_notes", { wants: [], has: [], limits: [], unsure: [], plan: NO_PLAN, ...fields });

const isNotes = (messages: ChatMessage[]) =>
  String(messages[0].content).startsWith("You keep a coach's notes");

describe("a duration and a time, read from the person's own words", () => {
  it("finds them however they are said", () => {
    expect(durationIn("y si 15 minutos me parece bien quiza a las 7pm por ahi")).toBe("15 min");
    expect(timeIn("y si 15 minutos me parece bien quiza a las 7pm por ahi")).toBe("19:00");
    expect(durationIn("I can do 1 hour")).toBe("1 h");
    expect(timeIn("at 6:30 before work")).toBe("06:30");
    expect(timeIn("sobre las 21")).toBe("21:00");
    expect(timeIn("a las 7 de la tarde")).toBe("19:00");
    expect(clockIn("a las 7")).toEqual({ time: "07:00", sure: false });
    expect(clockIn("a las 7pm")).toEqual({ time: "19:00", sure: true });
    expect(durationIn("no tengo idea")).toBe("");
    expect(timeIn("peso 80kg y mido 180cm")).toBe("");
  });
});

describe("what the person said, as numbers a roadmap is held to", () => {
  const empty: Brief = { wants: [], has: [], limits: [], unsure: [] };
  const wanted = { ...NO_PLAN, wanted: true };
  const update = (brief: Brief | null, person: string, plan: object, coach?: string) =>
    updateBrief({
      brief,
      coach,
      person,
      language: "Spanish",
      chat: async () => notes({ plan: { ...wanted, ...plan } }),
    });

  it("binds when their own words and the model's notes agree", async () => {
    const brief = await update(empty, "mejor martes y jueves a las 8pm, 20 minutos", {
      days: "martes y jueves",
      time: "8pm",
      session_length: "20 minutos",
      weeks: 8,
    });
    expect(saidIn(brief)).toEqual({ minutes: 20, weeks: 8, time: 20 * 60, weekdays: [2, 4] });

    // "A las 8", after "8pm", is the same hour: it does not become eight in the morning
    const again = await update(brief, "si, a las 8 esta bien, arrancamos", {});
    expect(saidIn(again).time).toBe(20 * 60);
    expect(saidIn(null)).toEqual({});
  });

  it("binds nothing the model took from the coach's question", async () => {
    // "¿empezamos el lunes a las 19:00?" "sí, esos días": the model noted Monday and 19:00
    const brief = await update(
      empty,
      "si, esos dias esta bien, y que sean 15 minutos",
      { days: "lunes", time: "19:00" },
      "¿Te parece empezar el lunes a las 19:00?"
    );
    expect(saidIn(brief)).toEqual({ minutes: 15 });
    // What the notes say was said still spares the question
    expect(brief?.plan).toMatchObject({ days: "lunes", time: "19:00" });
  });

  it("binds nothing when the two readings differ, and lets go of what it held", async () => {
    const before = await update(empty, "lunes, miércoles y viernes a las 7pm", {
      days: "lunes, miércoles y viernes",
      time: "19:00",
    });
    expect(saidIn(before)).toEqual({ time: 19 * 60, weekdays: [1, 3, 5] });

    // The code reads four days here; the model, the three they mean. Neither is trusted alone
    const after = await update(
      before,
      "los viernes no voy a poder, pasame las sesiones a lunes, miercoles y sabado",
      { days: "lunes, miércoles y sábado" }
    );
    expect(saidIn(after)).toEqual({ time: 19 * 60 });
    expect(after?.plan?.days).toBe("lunes, miércoles y sábado");

    // The same with a number: "15 is too little, better 30"
    const length = await update(after, "15 minutos es poco, mejor 30", {
      session_length: "30 minutos",
    });
    expect(saidIn(length).minutes).toBeUndefined();
  });
});

describe("the notes", () => {
  it("keep what was noted before and add what the person says now", async () => {
    const before: Brief = {
      wants: [],
      has: ["pesas", "mancuernas"],
      limits: [],
      unsure: ["quizá tengo TDAH"],
    };
    const seen: ChatMessage[][] = [];
    const brief = await updateBrief({
      brief: before,
      coach:
        "Te propongo empezar hoy antes de las 18:00 con cuatro ejercicios. ¿Cuánto tiempo tienes por sesión? ¿Qué días te vienen bien?",
      person: "y si 15 minutos me parece bien quiza a las 7pm por ahi",
      language: "Spanish",
      chat: async (messages) => {
        seen.push(messages);
        // The model files the duration under limits and leaves the plan empty
        return notes({
          has: ["Mancuernas"],
          limits: ["15 minutos"],
          plan: { ...NO_PLAN, wanted: true },
        });
      },
    });
    expect(brief).toEqual({
      wants: [],
      // The same thing said again is not noted twice
      has: ["pesas", "mancuernas"],
      limits: ["15 minutos"],
      // A guess of theirs noted earlier stays, though this call did not repeat it
      unsure: ["quizá tengo TDAH"],
      // Read from their own words where the model left it out
      plan: {
        length: "15 min",
        days: "",
        time: "19:00",
        start: "",
        // What binds a roadmap: only what their own words say
        exact: { minutes: 15, time: 19 * 60 },
      },
    });
    // Only the coach's questions travel: what it proposed must not be noted as theirs
    const sent = String(seen[0][1].content);
    expect(sent).toContain("Cuánto tiempo tienes por sesión?");
    expect(sent).not.toContain("antes de las 18:00");
  });

  it("take a yes for the message it was said in, and no longer", async () => {
    const plan = { ...NO_PLAN, wanted: true };
    const yes = await updateBrief({
      brief: { wants: ["un plan"], has: [], limits: [], unsure: [] },
      coach: "¿Te parece bien este plan?",
      person: "si dale",
      language: "Spanish",
      chat: async () => notes({ agrees: true, plan }),
    });
    expect(yes?.agreed).toBe(true);
    const next = await updateBrief({
      brief: yes,
      person: "antes quiero que investigues en internet",
      language: "Spanish",
      chat: async () => notes({ agrees: false, plan }),
    });
    expect(next?.agreed).toBeUndefined();
  });

  it("stay as they were when the call fails or brings nothing", async () => {
    const before: Brief = { wants: ["dormir mejor"], has: [], limits: [], unsure: [] };
    const failed = await updateBrief({
      brief: before,
      person: "me acuesto a las 2 casi siempre y me levanto cansado",
      language: "Spanish",
      chat: async () => {
        throw new Error("The model answered 500");
      },
    });
    expect(failed).toBe(before);
    const words = await updateBrief({
      brief: before,
      person: "me acuesto a las 2 casi siempre y me levanto cansado",
      language: "Spanish",
      chat: async () => say("No sé qué anotar."),
    });
    expect(words).toBe(before);
  });

  it("are not taken for a message too short to say anything", () => {
    expect(worthNoting("ok", null)).toBe(false);
    expect(worthNoting("ok", { wants: [], has: [], limits: [], unsure: [] })).toBe(false);
    // Once a plan is on the table, one word can be the yes
    expect(
      worthNoting("dale", {
        wants: [],
        has: [],
        limits: [],
        unsure: [],
        plan: { length: "", days: "", time: "", start: "" },
      })
    ).toBe(true);
    expect(worthNoting("agrega leer a las 15", null)).toBe(false);
    expect(worthNoting("quiero volver a entrenar pero nunca me organizo bien", null)).toBe(true);
    // Mid-conversation a short answer still says something
    expect(
      worthNoting("lunes, miércoles y viernes", { wants: [], has: [], limits: [], unsure: [] })
    ).toBe(true);
  });
});

describe("the coach's next move", () => {
  const brief: Brief = {
    wants: ["un plan para este mes y el próximo"],
    has: ["mancuernas"],
    limits: ["empezar de a poco"],
    unsure: ["quizá tengo TDAH"],
    plan: { length: "", days: "", time: "", start: "" },
  };

  it("is to ask for what a plan cannot be built without, and nothing else", () => {
    expect(missingFrom(brief)).toEqual([
      "how long one session can be",
      "which days of the week",
      "at what time of day, if they want a fixed one",
    ]);
    const move = nextMove(brief, false);
    expect(move).toContain("do not give it yet");
    expect(move).toContain("how long one session can be; which days of the week");
    expect(move).not.toContain("at what time");
  });

  it("is to recommend once it has asked twice, saying what it assumes", () => {
    const move = nextMove({ ...brief, asked: 2 }, false);
    expect(move).toContain("Give them the plan now");
    expect(move).toContain("say what you assume");
    expect(move).toContain("put nothing in the app before their yes");
    expect(move).not.toContain("do not give it yet");
  });

  it("is to recommend when nothing is missing", () => {
    const whole = {
      ...brief,
      plan: { length: "15 min", days: "lun, mié, vie", time: "19:00", start: "" },
    };
    expect(missingFrom(whole)).toEqual([]);
    expect(nextMove(whole, false)).toContain("Give them the plan now");
  });

  it("is to put the plan in the app only once they have said yes to it", () => {
    const given = { ...brief, asked: 2, plan: { ...brief.plan!, given: true } };
    // The plan is on the table and they asked for something else
    const waiting = nextMove(given, false);
    expect(waiting).toContain("Do not write it out again");
    expect(waiting).toContain("put nothing in the app in this reply");
    // They said yes
    const go = nextMove({ ...given, agreed: true }, false);
    expect(go).toContain("They have said yes: put the plan in the app now");
    expect(go).not.toContain("put nothing in the app");
  });

  it("puts a question of the person's first", () => {
    expect(nextMove(brief, true)).toMatch(/^They asked you something: answer it first/);
    expect(nextMove(brief, true)).not.toContain("do not give it yet");
  });

  it("is left to the model when there are no notes", () => {
    expect(nextMove(null, false)).toBe("");
    expect(briefLines(null)).toBe("");
  });

  it("is read with the notes: a guess is marked as a guess", () => {
    const lines = briefLines(brief);
    expect(lines).toContain("They want: un plan para este mes y el próximo");
    expect(lines).toContain("Said only as a guess, never state it as a fact: quizá tengo TDAH");
  });
});

describe("notes in the conversation", () => {
  function agentWith(coach: ModelReply[], noted: ModelReply[]) {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const seen = { coach: [] as ChatMessage[][], notes: 0 };
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages) => {
        if (isNotes(messages)) {
          seen.notes++;
          return noted.shift() ?? notes({});
        }
        seen.coach.push(messages);
        const reply = coach.shift();
        if (!reply) throw new Error("coach script ran out");
        return reply;
      },
    });
    agent.mode = "auto";
    return { agent, core, seen };
  }
  const lastUser = (messages: ChatMessage[]) =>
    String([...messages].reverse().find((message) => message.role === "user")!.content);

  it("ride next to the person's message, with the move, and are not kept in the history", async () => {
    const { agent, seen } = agentWith(
      [say("¿Cuánto tiempo tienes por sesión?"), say("ok")],
      [
        notes({
          wants: ["un plan para volver a entrenar"],
          has: ["mancuernas"],
          plan: { ...NO_PLAN, wanted: true },
        }),
      ]
    );
    await agent.send("quiero un plan para volver a entrenar, tengo mancuernas en casa");
    const sent = lastUser(seen.coach[0]);
    expect(sent).toContain("What they have told you so far");
    expect(sent).toContain("They want: un plan para volver a entrenar");
    expect(sent).toContain("ask only for what they have not told you");
    expect(sent.trim().endsWith("Reply in English.]")).toBe(true);

    // With a plan on the table every word is read: "ok" may be the yes it waits for
    await agent.send("ok");
    expect(seen.notes).toBe(2);
    const again = seen.coach[1];
    expect(lastUser(again)).toContain("They want: un plan para volver a entrenar");
    // What the person wrote is kept as they wrote it
    expect(String(again[1].content)).toBe(
      "quiero un plan para volver a entrenar, tengo mancuernas en casa"
    );
  });

  it("give way to saying what was done once a change is made in the turn", async () => {
    const { agent, seen } = agentWith(
      [call("add_to_plan", { title: "Entrenar", minutes: 15 }), say("Añadido.")],
      [notes({ wants: ["entrenar hoy"], plan: { ...NO_PLAN, wanted: true } })]
    );
    await agent.send("quiero entrenar hoy quince minutos, agrégalo a mi plan por favor");
    expect(lastUser(seen.coach[0])).toContain("ask only for what they have not told you");
    expect(lastUser(seen.coach[1])).toContain("The change is made");
    expect(lastUser(seen.coach[1])).not.toContain("ask only for what they have not told you");
  });

  it("keep a first roadmap from being built before the plan was seen and accepted", async () => {
    const plan = { ...NO_PLAN, wanted: true };
    const PLAN_TEXT = `Te propongo esto. ${"Fase 1: seis sesiones de quince minutos. ".repeat(20)}¿Te parece?`;
    const roadmap = {
      title: "Volver a entrenar",
      why: "",
      activity: "Entrenar",
      session_minutes: 15,
      schedule: { weekdays: ["lunes", "jueves"], start: "tomorrow" },
      rules: "",
      milestones: [{ title: "Fase 1", sessions: 6, notes: "- Sentadilla 2x10" }],
      message: "Creada.",
      then: "finish",
    };
    let planner = 0;
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const coach: ModelReply[] = [
      // Told a time of day, it goes straight to building
      call("plan_roadmap", { request: "Arma la hoja de ruta." }),
      say(PLAN_TEXT),
      // Asked to look something up, it tries again
      call("plan_roadmap", { request: "Arma la hoja de ruta." }),
      say("Antes necesito tu sí."),
      // They said yes
      call("plan_roadmap", { request: "Arma la hoja de ruta del plan de arriba." }),
      say("Lista."),
      say("Ya está en la app."),
    ];
    const noted = [
      notes({ wants: ["un plan"], plan }),
      notes({ plan }),
      notes({ agrees: true, plan }),
      notes({ plan }),
    ];
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages) => {
        if (isNotes(messages)) return noted.shift() ?? notes({});
        if (String(messages[0].content).startsWith("You are the roadmap planner")) {
          planner++;
          return call("save_roadmap", roadmap);
        }
        seen.push(messages);
        return coach.shift()!;
      },
    });
    agent.mode = "auto";
    const lastTool = () =>
      String([...seen.at(-1)!].reverse().find((message) => message.role === "tool")!.content);
    const reminder = () =>
      String([...seen.at(-1)!].reverse().find((message) => message.role === "user")!.content);

    await agent.send("quiero un plan para volver a entrenar, puedo a las 7pm quince minutos");
    expect(lastTool()).toContain("no-yes-yet");
    expect(lastTool()).toContain("has not seen a plan yet");
    expect(planner).toBe(0);

    await agent.send("antes quiero que lo pienses mejor");
    expect(lastTool()).toContain("has not said yes to the plan yet");
    expect(planner).toBe(0);
    expect(core.getRoadmaps()).toEqual([]);

    await agent.send("si dale");
    expect(planner).toBe(1);
    expect(core.getRoadmaps().map((one) => one.title)).toEqual(["Volver a entrenar"]);

    // From here on the coach is told the plan is built, not to build it again
    await agent.send("gracias, y el roadmap?");
    expect(reminder()).toContain("The plan is in the app already");
    expect(reminder()).toContain(
      'Roadmaps that exist already, with their sessions on the calendar: "Volver a entrenar"'
    );
  });

  it("are off unless asked for", async () => {
    const core = new SystemCore();
    core.clearState();
    let calls = 0;
    const agent = new Agent({
      core,
      prompt: "p",
      chat: async () => {
        calls++;
        return say("hola");
      },
    });
    await agent.send("quiero un plan para volver a entrenar, tengo mancuernas en casa");
    expect(calls).toBe(1);
  });
});
