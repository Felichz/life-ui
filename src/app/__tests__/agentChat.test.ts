import { SystemCore } from "../../system";
import { Agent, type ChatFn, type SavedChats } from "../agent/agent";
import type { ChatMessage, ModelReply } from "../agent/llm";

/**
 * The conversation itself: it is kept between launches, it can be stopped and
 * started over, and what is sent to the model is always a whole exchange.
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const call = (name: string, args: object = {}): ModelReply => ({
  content: "",
  toolCalls: [
    { id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

function memoryStore(initial: SavedChats | null = null) {
  let saved = initial;
  return {
    load: () => saved,
    save: (all: SavedChats) => {
      saved = JSON.parse(JSON.stringify(all)) as SavedChats;
    },
    get saved() {
      return saved;
    },
  };
}

function newCore() {
  const core = new SystemCore();
  core.clearState();
  return core;
}

describe("the conversation", () => {
  it("is kept between launches", async () => {
    const store = memoryStore();
    const core = newCore();
    const first = new Agent({ core, prompt: "p", store, chat: async () => say("Hola.") });
    await first.send("hola");

    const second = new Agent({ core, prompt: "p", store, chat: async () => say("…") });
    expect(second.entries.map((entry) => entry.kind)).toEqual(["user", "assistant"]);

    // The model also gets what was said before
    const seen: ChatMessage[][] = [];
    const third = new Agent({
      core,
      prompt: "p",
      store,
      chat: async (messages) => {
        seen.push(messages);
        return say("Sigo aquí.");
      },
    });
    await third.send("¿sigues ahí?");
    expect(seen[0].filter((message) => message.role === "user")).toHaveLength(2);
  });

  it("starts over with clear, leaving the day as it is", async () => {
    const store = memoryStore();
    const core = newCore();
    const agent = new Agent({
      core,
      prompt: "p",
      store,
      chat: (() => {
        const replies = [call("start_day"), say("Día empezado.")];
        return (async () => replies.shift()!) as ChatFn;
      })(),
    });
    agent.mode = "auto";
    await agent.send("empiezo el día");
    expect(core.getCurrentDay()).not.toBeNull();

    agent.clear();
    expect(agent.entries).toEqual([]);
    expect(store.saved?.chats).toEqual([]);
    expect(core.getCurrentDay()).not.toBeNull();
  });

  it("stops a turn without reporting an error", async () => {
    const core = newCore();
    const agent = new Agent({
      core,
      prompt: "p",
      chat: (_messages, _tools, signal) =>
        new Promise<ModelReply>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        }),
    });
    const turn = agent.send("hola");
    agent.stop();
    await turn;
    expect(agent.busy).toBe(false);
    expect(agent.entries.map((entry) => entry.kind)).toEqual(["user"]);
  });

  it("a stop while a change waits for an answer counts as a no", async () => {
    const core = newCore();
    const replies = [call("start_day"), say("…")];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    const turn = agent.send("empiezo el día");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(agent.entries.at(-1)).toMatchObject({ kind: "tool", status: "pending" });

    agent.stop();
    await turn;
    expect(agent.entries.at(-1)).toMatchObject({ kind: "tool", status: "rejected" });
    expect(core.getCurrentDay()).toBeNull();
  });
});

describe("a change that fails", () => {
  it("leaves nothing behind", async () => {
    const core = newCore();
    core.startDay();
    const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
    const mail = core.createActivityTemplate({
      title: "Correo",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 10 },
    });
    core.activateActivity(core.createActivityInstance(mail.id, todo.id).id);

    // Starting something new creates it first; the core then refuses the start
    const replies = [call("start_activity", { item: "Leer" }), say("Ya hay algo en marcha.")];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("empiezo a leer");

    expect(agent.entries.find((entry) => entry.kind === "tool")).toMatchObject({ status: "error" });
    expect(core.getActivityTemplates().map((template) => template.title)).toEqual(["Correo"]);
  });
});

describe("the language of the replies", () => {
  it("follows the interface language of each message, whatever was said before", async () => {
    let language = "en";
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      language: () => language,
      chat: async (messages) => {
        seen.push(messages);
        return say("ok");
      },
    });
    await agent.send("hello");
    language = "es";
    await agent.send("hola");

    const last = seen[1];
    expect(String(last[0].content)).toContain("Spanish");
    // The reminder rides on the newest message the person wrote, not on the older ones
    const users = last.filter((m) => m.role === "user").map((m) => String(m.content));
    expect(users[0]).not.toContain("[Reply in");
    expect(users[1]).toContain("[Reply in Spanish.]");
    // And it is not kept in the history
    await agent.send("otra");
    expect(JSON.stringify(seen[2])).not.toContain("[Reply in English");
  });
});

describe("guards for a small model", () => {
  it("refuses a time the person never said, without showing a card", async () => {
    const core = newCore();
    core.startDay();
    const seen: ChatMessage[][] = [];
    const replies = [
      call("add_to_plan", { title: "Gym", minutes: 30, time: "16:00" }),
      say("¿A qué hora te viene bien?"),
    ];
    const agent = new Agent({
      core,
      prompt: "p",
      chat: async (messages) => {
        seen.push(messages);
        return replies.shift()!;
      },
    });
    await agent.send("hace tiempo quiero hacer gym en casa");

    expect(agent.entries.some((entry) => entry.kind === "tool")).toBe(false);
    expect(JSON.stringify(seen[1])).toContain("time-not-said");
    expect(core.getActivityTemplates()).toHaveLength(0);
  });

  it("accepts a time the person did say", async () => {
    const core = newCore();
    core.startDay();
    const replies = [call("add_to_plan", { title: "Gym", minutes: 30, time: "16:00" }), say("ok")];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("pon gym a las 16");
    expect(agent.entries.find((entry) => entry.kind === "tool")).toMatchObject({ status: "done" });
  });

  it("does not show a reply that recites tool names, and asks once for a real answer", async () => {
    const replies = [
      say("1. Revisa con get_library. 2. Usa add_to_plan."),
      say("Te ayudo a planear."),
    ];
    const agent = new Agent({ core: newCore(), prompt: "p", chat: async () => replies.shift()! });
    await agent.send("tú qué opinas");

    const shown = agent.entries.filter((entry) => entry.kind === "assistant");
    expect(shown).toHaveLength(1);
    expect(shown[0]).toMatchObject({ text: "Te ayudo a planear." });
  });
});

describe("planning days ahead through the chat", () => {
  const toolCall = (name: string, args: object): ModelReply => ({
    content: "",
    toolCalls: [
      { id: `c-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
    ],
  });

  it("plans a routine on chosen weekdays for some weeks, with its notes, as one change", async () => {
    const core = newCore();
    const replies = [
      toolCall("plan_ahead", {
        title: "Entrenar",
        minutes: 20,
        weekdays: ["mon", "wed", "fri"],
        weeks: 2,
        time: "17:00",
        notes: "- Sentadillas 3 x 15\n- Flexiones 3 x 10",
      }),
      say("Listo."),
    ];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("prográmame entrenar lunes, miércoles y viernes a las 17 por dos semanas");

    const planned = core.getPlannedActivities();
    expect(planned).toHaveLength(6);
    expect(
      planned.every((item) => item.time === 17 * 60 && item.notes?.includes("Sentadillas"))
    ).toBe(true);
    expect(new Set(planned.map((item) => new Date(`${item.date}T12:00:00`).getDay()))).toEqual(
      new Set([1, 3, 5])
    );
    const card = agent.entries.find((entry) => entry.kind === "tool");
    expect(card).toMatchObject({ status: "done" });
    expect(card?.kind === "tool" && card.summary).toContain("(6 times)");

    // One undo takes the whole series back
    agent.undo(card!.id);
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("refuses a time for the days ahead that the person never said", async () => {
    const core = newCore();
    const replies = [
      toolCall("plan_ahead", { title: "Entrenar", weeks: 1, time: "07:00" }),
      say("¿A qué hora?"),
    ];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("quiero entrenar todos los días esta semana");
    expect(core.getPlannedActivities()).toEqual([]);
  });

  it("writes what to do inside an activity of today", async () => {
    const core = newCore();
    core.startDay();
    const replies = [
      toolCall("add_to_plan", { title: "Entrenar", minutes: 20, notes: "- Plancha 3 x 20 s" }),
      say("Añadido."),
    ];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("añade entrenar con la rutina");
    expect(core.getState().currentDay!.activityInstances[0].notes).toBe("- Plancha 3 x 20 s");
  });
});
