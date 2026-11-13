import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import {
  briefLines,
  clockIn,
  durationIn,
  missingFrom,
  needsFromNotes,
  nextMove,
  overfull,
  planNeeds,
  saidIn,
  timeIn,
  updateBrief,
  worthNoting,
  type Brief,
} from "../agent/brief";
import type { ChatMessage, ModelReply } from "../agent/llm";
import { daysStated, weekdaysIn, weeksUntil } from "../agent/when";

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

const isNeeds = (messages: ChatMessage[]) =>
  String(messages[0].content).startsWith("A coach is about to write");

const isCheck = (messages: ChatMessage[]) =>
  String(messages[0].content).startsWith("You compare a plan");

const gaps = (fields: Partial<Record<string, string[]>> = {}) =>
  call("check_plan", { not_used: [], not_given: [], breaks: [], ...fields });

describe("a duration and a time, read from the person's own words", () => {
  it("finds them however they are said", () => {
    expect(durationIn("y si 15 minutos me parece bien quiza a las 7pm por ahi")).toBe("15 min");
    expect(timeIn("y si 15 minutos me parece bien quiza a las 7pm por ahi")).toBe("19:00");
    expect(durationIn("I can do 1 hour")).toBe("1 h");
    expect(durationIn("tengo media hora al mediodia")).toBe("30 min");
    expect(durationIn("una hora y media los sábados")).toBe("90 min");
    expect(timeIn("at 6:30 before work")).toBe("06:30");
    expect(timeIn("sobre las 21")).toBe("21:00");
    expect(timeIn("a las 7 de la tarde")).toBe("19:00");
    expect(clockIn("tengo media hora al mediodia de lunes a viernes")).toEqual({
      time: "12:00",
      sure: true,
    });
    expect(clockIn("a las 7")).toEqual({ time: "07:00", sure: false });
    expect(clockIn("a las 7pm")).toEqual({ time: "19:00", sure: true });
    expect(durationIn("no tengo idea")).toBe("");
    expect(timeIn("peso 80kg y mido 180cm")).toBe("");
  });
});

describe("the parts of a session, added up", () => {
  it("finds the phase whose timed parts do not fit the session", () => {
    const plan = [
      "### Fase 1 (Semanas 1-2)",
      "**Sesión (15 min):**",
      "1. Calentamiento (3 min)",
      "2. Circuito A (10 min)",
      "3. Enfriamiento (2 min)",
      "### Fase 2 (Semanas 3-5)",
      "1. Calentamiento (3 min)",
      "2. Trabajo principal (12 min): 3 series",
      "3. Estiramientos (4 min)",
    ].join("\n");
    expect(overfull(plan, 15)).toEqual({ phase: "Fase 2 (Semanas 3-5)", sum: 19 });
    expect(overfull(plan, 30)).toBeNull();
    expect(overfull("Sin tiempos escritos", 15)).toBeNull();
  });
});

describe("what a plan's numbers depend on", () => {
  const wantsWeight = {
    wants: ["un plan con el peso de cada ejercicio"],
    has: ["mancuernas", "barra", "discos", "yo peso 80kg"],
    limits: [],
    unsure: [],
    plan: { length: "", days: "", time: "", start: "" },
  };

  it("is asked for once, with the days and the length", () => {
    const brief = {
      ...wantsWeight,
      needs: ["how heavy their dumbbells are"],
    };
    const move = nextMove(brief, false);
    expect(move).toContain("three things at most");
    expect(move).toContain(
      "how long one session can be; which days of the week; how heavy their dumbbells are"
    );
    // Asked already: the plan is given, with a rule where the number is unknown
    const later = nextMove({ ...brief, needs: [], asked: 2 }, false);
    expect(later).toContain("Give them the plan now");
    expect(later).not.toContain("dumbbells");
  });

  it("finds the load the plan needs even when the model answers with nothing", () => {
    // The person's own 80 kg is not the load of their equipment
    expect(needsFromNotes(wantsWeight)).toEqual(["how heavy their weights are"]);
    // They said how heavy it is: nothing is left to ask
    expect(needsFromNotes({ ...wantsWeight, has: ["mancuernas de 5 kg", "barra"] })).toEqual([]);
    // A plan that gives no weight has no load to ask for
    expect(needsFromNotes({ ...wantsWeight, wants: ["un plan para entrenar"] })).toEqual([]);
  });

  it("keeps what it found when the question call comes back empty", async () => {
    const facts = await planNeeds({
      brief: wantsWeight,
      chat: async () => call("what_to_ask", { facts: [] }),
    });
    expect(facts).toEqual(["how heavy their weights are"]);
  });
});

describe("notes with nothing in them", () => {
  it("ask for no coaching: the person is running their day", () => {
    const empty = { wants: [], has: [], limits: [], unsure: [], instruction: true };
    expect(nextMove(empty, false)).toBe("");
    expect(nextMove({ ...empty, has: ["mancuernas"] }, false)).toContain("do not give it yet");
  });
});

describe("what a message states about a plan's days and its end", () => {
  it("reads the days with the line that names them, and nothing from a 'no'", () => {
    expect(
      daysStated(
        "### Fase 1\n* **Frecuencia:** Lunes, Miércoles, Viernes (3 veces)\n* Flexiones: 8"
      )
    ).toEqual({ days: [1, 3, 5], quote: "Frecuencia: Lunes, Miércoles, Viernes (3 veces)" });
    expect(daysStated("mejor martes, jueves y sábado")?.days).toEqual([2, 4, 6]);
    // Friday is named, and it is the day they cannot
    expect(daysStated("los viernes no voy a poder")).toBeNull();
    expect(daysStated("quince minutos a las 7")).toBeNull();
  });

  it("keeps the days of the schedule when a later line says 'todos los días' of a session", () => {
    expect(
      daysStated(
        [
          "**Frecuencia:** Lunes, Miércoles y Viernes a las 19:00.",
          "**Estructura de la sesión (todos los días):** calentamiento, fuerza, core.",
        ].join("\n")
      )
    ).toEqual({
      days: [1, 3, 5],
      quote: "Frecuencia: Lunes, Miércoles y Viernes a las 19:00.",
    });
    // Alone, "todos los días" still means every day.
    expect(daysStated("todos los días a las 7")?.days).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(daysStated("de lunes a viernes\n(todos los días)")?.days).toEqual([1, 2, 3, 4, 5]);
  });

  it("counts an end named by the calendar from today", () => {
    const today = new Date(2026, 10, 12, 9);
    // To the last day of December: seven weeks, not the nine of two whole months
    expect(weeksUntil("un plan completo para este mes y el proximo", today)).toBe(7);
    expect(weeksUntil("a plan for this month and the next", today)).toBe(7);
    expect(weeksUntil("hasta fin de año", today)).toBe(7);
    expect(weeksUntil("dos meses", today)).toBe(0);
  });
});

describe("days of the week, as people say them", () => {
  it("are read one by one, as a stretch, or together", () => {
    expect(weekdaysIn("lunes, miércoles y viernes")).toEqual([1, 3, 5]);
    // A stretch is every day in it, not its two ends
    expect(weekdaysIn("media hora al mediodia de lunes a viernes")).toEqual([1, 2, 3, 4, 5]);
    expect(weekdaysIn("Mon-Fri at noon")).toEqual([1, 2, 3, 4, 5]);
    expect(weekdaysIn("de viernes a lunes")).toEqual([0, 1, 5, 6]);
    expect(weekdaysIn("todos los días")).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(weekdaysIn("los fines de semana")).toEqual([0, 6]);
    expect(weekdaysIn("entre semana y el sábado")).toEqual([1, 2, 3, 4, 5, 6]);
    // "a" after a weekday is not always a stretch
    expect(weekdaysIn("el lunes a las 7")).toEqual([1]);
    expect(weekdaysIn("cuando pueda")).toEqual([]);
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
    // The days are noted, and bind nothing (see below)
    expect(saidIn(brief)).toEqual({ minutes: 20, weeks: 8, time: 20 * 60 });
    expect(brief?.plan?.days).toBe("martes y jueves");

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
    const before = await update(empty, "sesiones de 15 minutos a las 7pm", {
      session_length: "15 minutos",
      time: "19:00",
    });
    expect(saidIn(before)).toEqual({ minutes: 15, time: 19 * 60 });

    // "15 is too little, better 30": the code reads 15, the model 30. Neither is trusted alone
    const length = await update(before, "15 minutos es poco, mejor 30", {
      session_length: "30 minutos",
    });
    expect(saidIn(length)).toEqual({ time: 19 * 60 });
    // "I finish work at 18:00, so 19:00": the code reads the first hour, the model the one meant
    const hour = await update(before, "salgo del trabajo a las 18:00, asi que mejor 20:00", {
      time: "20:00",
    });
    expect(saidIn(hour)).toEqual({ minutes: 15 });
  });

  it("never binds a roadmap to days of the week", async () => {
    // "Starting on Monday" is not "on Mondays", and both readings take it for that
    const brief = await update(empty, "dale armalo, empezando el lunes", {
      days: "lunes",
      start: "el lunes",
    });
    // The days bind nothing. The start does: one weekday, said of the start
    expect(saidIn(brief)).toEqual({ startOn: 1 });
    expect(brief?.plan).toMatchObject({ days: "lunes", start: "el lunes" });
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

  it("say what a message is even when it says nothing about the person", async () => {
    const brief = await updateBrief({
      brief: null,
      person: "agrega leer 20 minutos",
      language: "Spanish",
      chat: async () => notes({ instruction: true }),
    });
    expect(brief).toMatchObject({ instruction: true, wants: [] });
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
    expect(worthNoting("hola", null)).toBe(false);
    // Three words can ask for anything: they are read, so the right tools are offered
    expect(worthNoting("agrega leer a las 15", null)).toBe(true);
    expect(worthNoting("duermo mal, qué hago", null)).toBe(true);
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
    expect(move).toContain("is your proposal, not their word");
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
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
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
      // They told the app to do something: that is what lets it be done
      [notes({ wants: ["entrenar hoy"], instruction: true, plan: { ...NO_PLAN, wanted: true } })]
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
    const tools: unknown[][] = [];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages, offeredNow) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) return noted.shift() ?? notes({});
        if (isCheck(messages)) return gaps();
        if (String(messages[0].content).startsWith("You are the roadmap planner")) {
          planner++;
          return call("save_roadmap", roadmap);
        }
        seen.push(messages);
        tools.push(offeredNow);
        return coach.shift()!;
      },
    });
    agent.mode = "auto";
    const lastTool = () =>
      String([...seen.at(-1)!].reverse().find((message) => message.role === "tool")!.content);
    const reminder = () =>
      String([...seen.at(-1)!].reverse().find((message) => message.role === "user")!.content);

    // While the plan is being worked out nothing that changes anything is offered
    await agent.send("quiero un plan para volver a entrenar, puedo a las 7pm quince minutos");
    expect(lastTool()).toContain("not-yet");
    expect(planner).toBe(0);
    const offered = (index: number) =>
      (tools[index] as Array<{ function: { name: string } }>).map((tool) => tool.function.name);
    expect(offered(0)).toContain("get_day");
    expect(offered(0)).toContain("just_answer");
    expect(offered(0)).not.toContain("plan_roadmap");
    expect(offered(0)).not.toContain("plan_ahead");
    // A plan being shaped is not the day: nothing that changes it is offered
    expect(offered(0)).not.toContain("add_to_plan");
    expect(offered(0)).not.toContain("start_activity");
    expect(offered(0)).not.toContain("finish_activity");

    await agent.send("antes quiero que lo pienses mejor");
    expect(lastTool()).toContain("not-yet");
    expect(planner).toBe(0);
    expect(core.getRoadmaps()).toEqual([]);

    // Their yes: the roadmap's tool is offered, and planning loose sessions is not
    await agent.send("si dale");
    expect(offered(tools.length - 2)).toContain("plan_roadmap");
    expect(offered(tools.length - 2)).not.toContain("plan_ahead");
    expect(planner).toBe(1);
    expect(core.getRoadmaps().map((one) => one.title)).toEqual(["Volver a entrenar"]);

    // From here on the coach is told the plan is built, not to build it again
    await agent.send("gracias, y el roadmap?");
    expect(reminder()).toContain("The plan is DONE");
    expect(reminder()).toContain(
      'Roadmaps that exist already, with their sessions on the calendar: "Volver a entrenar"'
    );
  });

  it("refuse a roadmap for a plan that was agreed to before it was ever laid out", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const seen: ChatMessage[][] = [];
    const coach = [
      call("plan_roadmap", { request: "Arma la hoja de ruta." }),
      say("Te cuento el plan."),
    ];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) {
          return notes({ agrees: true, plan: { ...NO_PLAN, wanted: true } });
        }
        if (String(messages[0].content).startsWith("You are the roadmap planner")) {
          throw new Error("the planner must not be asked");
        }
        seen.push(messages);
        return coach.shift()!;
      },
    });
    agent.mode = "auto";
    await agent.send("dale, armame un plan para entrenar");
    const result = String(
      [...seen.at(-1)!].reverse().find((message) => message.role === "tool")!.content
    );
    expect(result).toContain("no-yes-yet");
    expect(result).toContain("has not seen a plan yet");
    expect(core.getRoadmaps()).toEqual([]);
  });

  it("hold the coach to searching when it was asked to look something up", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const sent: string[] = [];
    const http = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push(String(init?.body));
      const text =
        "Title: Guidelines\nURL: https://example.org/g\nPublished: N/A\nText:\nTwo to three days a week.";
      const body = `event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text }] } })}\n\n`;
      return { ok: true, status: 200, text: async () => body } as Response;
    }) as typeof fetch;
    const coach: ModelReply[] = [
      // It says it looked, and looked at nothing
      say("He investigado y la evidencia dice que tres días por semana es lo ideal."),
      call("web_search", { query: "resistance training frequency novices guidelines" }),
      say("Encontré una guía: dos o tres días por semana."),
    ];
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      web: { setting: () => "on", allow: () => {}, http },
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages))
          return notes({ wants: ["saber cuántos días entrenar"], research: true });
        seen.push(messages);
        return coach.shift()!;
      },
    });
    agent.mode = "auto";
    await agent.send("quiero que investigues en internet cuántos días conviene entrenar");

    // Told so next to the message, and held to it: the claim was never shown
    expect(String(seen[0].at(-1)!.content)).toContain("call web_search now");
    expect(
      agent.entries.some((entry) => entry.kind === "assistant" && /He investigado/.test(entry.text))
    ).toBe(false);
    expect(String(seen[1].at(-1)!.content)).toContain("you made no search");
    expect(sent).toHaveLength(1);
    expect(agent.entries.at(-1)).toMatchObject({
      text: "Encontré una guía: dos o tres días por semana.",
    });
  });

  it("offer the tools that plan, delete or write in the ideal life only for an instruction or a yes", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const offered: string[][] = [];
    const noted = [
      // Talking about a problem: nothing to change
      notes({ has: ["me quedo viendo videos en la cama"] }),
      // Telling the app to do something
      notes({ instruction: true }),
    ];
    const coach = [say("Te propongo dejar el celular fuera."), say("Hecho.")];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages, tools) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) return noted.shift()!;
        offered.push(
          (tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name)
        );
        return coach.shift()!;
      },
    });
    agent.mode = "auto";

    await agent.send("lo que mas me cuesta es dejar el celular, me quedo viendo videos en la cama");
    expect(offered[0]).toContain("get_day");
    expect(offered[0]).toContain("just_answer");
    expect(offered[0]).not.toContain("delete_from_library");
    expect(offered[0]).not.toContain("plan_ahead");
    // The tools of the day itself are always there
    expect(offered[0]).toContain("add_to_plan");
    expect(offered[0]).not.toContain("note_ideal_life");

    await agent.send("agrega una actividad para dejar el celular fuera a las 23");
    expect(offered[1]).toContain("add_to_plan");
    expect(offered[1]).toContain("delete_from_library");
  });

  it("keep a guess the person made about themselves out of a search", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const sent: string[] = [];
    const http = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push(String(init?.body));
      const body = `event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text: "Title: G\nURL: https://example.org/g\nPublished: N/A\nText:\nx" }] } })}\n\n`;
      return { ok: true, status: 200, text: async () => body } as Response;
    }) as typeof fetch;
    const seen: ChatMessage[][] = [];
    const coach = [
      // Their guess about themselves and their own measures, in the query
      call("web_search", { query: "home strength training 80kg beginners and TDAH guidelines" }),
      call("web_search", { query: "home strength training beginners guidelines" }),
      say("Esto encontré."),
    ];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      web: { setting: () => "on", allow: () => {}, http },
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) {
          return notes({
            unsure: ["quizá tengo TDAH o algo"],
            has: ["yo peso 80kg", "mido 180cm"],
            research: true,
          });
        }
        seen.push(messages);
        return coach.shift()!;
      },
    });
    agent.mode = "auto";
    await agent.send("quizá tengo tdah o algo, quiero que investigues cómo empezar a entrenar");
    const results = seen
      .at(-1)!
      .filter((message) => message.role === "tool")
      .map((message) => String(message.content));
    expect(results[0]).toContain("about-the-person");
    expect(results[0]).toContain("tdah");
    expect(results[0]).toContain("80kg");
    // Only the query about the topic left the machine
    expect(sent).toHaveLength(1);
    expect(sent[0]).not.toMatch(/tdah|80kg/i);
  });

  it("does not take a number inside another for a personal measure", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const sent: string[] = [];
    const http = (async (_url: RequestInfo | URL, init?: RequestInit) => {
      sent.push(String(init?.body));
      const body = `event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text: "Title: Warm-up\nURL: https://example.org/warmup\nPublished: N/A\nText:\nx" }] } })}\n\n`;
      return { ok: true, status: 200, text: async () => body } as Response;
    }) as typeof fetch;
    const seen: ChatMessage[][] = [];
    const coach = [call("web_search", { query: "15 minutes warmup guidelines" }), say("Listo.")];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      web: { setting: () => "on", allow: () => {}, http },
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) {
          return notes({
            has: ["discos de 5 kg", "barra"],
            research: true,
          });
        }
        seen.push(messages);
        return coach.shift()!;
      },
    });
    await agent.send("investigá cómo calentar antes de entrenar");

    // "5 kg" is their measure; the 5 inside "15 minutes" is not
    expect(sent).toHaveLength(1);
    const results = seen
      .at(-1)!
      .filter((message) => message.role === "tool")
      .map((message) => String(message.content));
    expect(results[0]).not.toContain("about-the-person");
  });

  it("send a first plan back once when it leaves out what the person has", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const first = `Plan de ocho semanas. ${"Sentadillas con la barra, tres series de diez. ".repeat(20)}`;
    const second = `Plan de ocho semanas. ${"Remo con mancuernas y sentadillas con la barra. ".repeat(20)}`;
    const coach = [say(first), say(second)];
    const checks: string[] = [];
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) {
          return notes({
            wants: ["un plan con repeticiones"],
            has: ["mancuernas", "una barra"],
            plan: {
              wanted: true,
              session_length: "15 minutos",
              days: "lunes y jueves",
              time: "19:00",
            },
          });
        }
        if (isCheck(messages)) {
          checks.push(String(messages[1].content));
          // The barbell is in the plan: the model's word alone does not send it back.
          // "kettlebell" is nothing they said they have.
          return gaps({ not_used: ["mancuernas", "una barra", "kettlebell"] });
        }
        seen.push(messages);
        return coach.shift()!;
      },
    });
    await agent.send(
      "quiero un plan con repeticiones, tengo mancuernas y una barra, lunes y jueves 15 minutos a las 19"
    );
    expect(checks).toHaveLength(1);
    expect(checks[0]).toContain("THEY HAVE:\n- mancuernas\n- una barra");
    const note = String(seen.at(-1)!.at(-1)!.content);
    expect(note).toContain("it never uses what they have: mancuernas.");
    expect(note).not.toContain("barra;");
    expect(note).not.toContain("kettlebell");
    // The person sees one plan, the second
    const shown = agent.entries.filter((entry) => entry.kind === "assistant");
    expect(shown).toHaveLength(1);
    expect(shown[0].kind === "assistant" && shown[0].text).toBe(second);
  });

  it("keep the ideal life in the person's own words", async () => {
    const core = new SystemCore();
    core.clearState();
    core.startDay();
    const seen: ChatMessage[][] = [];
    const coach = [
      // A nicer wish than the one they have
      call("note_ideal_life", {
        text: "Valoro mi voz y deseo crecer profesionalmente con seguridad y liderazgo.",
      }),
      call("note_ideal_life", {
        text: "Quiero participar en las reuniones del trabajo sin quedarme callado.",
      }),
      say("Anotado."),
    ];
    const agent = new Agent({
      core,
      prompt: "p",
      notes: () => true,
      chat: async (messages) => {
        if (isNeeds(messages)) return call("what_to_ask", { facts: [] });
        if (isNotes(messages)) return notes({ instruction: true });
        seen.push(messages);
        return coach.shift()!;
      },
    });
    agent.subscribe(() => {
      for (const entry of agent.entries) {
        if (entry.kind === "tool" && entry.status === "pending") {
          // The card is answered once it is up: a note in the ideal life always asks
          setTimeout(() => agent.decide(entry.id, true), 0);
        }
      }
    });
    await agent.send(
      "anota en mi vida ideal que quiero participar en las reuniones del trabajo sin quedarme callado"
    );
    const results = seen
      .at(-1)!
      .filter((message) => message.role === "tool")
      .map((message) => String(message.content));
    expect(results[0]).toContain("not-their-words");
    expect(core.getIdealLife()?.text).toContain(
      "Quiero participar en las reuniones del trabajo sin quedarme callado."
    );
    expect(core.getIdealLife()?.text).not.toContain("liderazgo");
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
