import { SystemCore } from "../../system";
import { Agent, isContextOverflow, type ChatFn } from "../agent/agent";
import { visibleSoFar, type ChatMessage, type ModelReply } from "../agent/llm";

/**
 * One turn of the model, as the person lives it: the answer shows while it is
 * written, can be stopped or asked for again, and a request the runtime
 * refuses as too long is compacted and retried.
 */

const say = (content: string, extra: Partial<ModelReply> = {}): ModelReply => ({
  content,
  toolCalls: [],
  ...extra,
});

function newCore() {
  const core = new SystemCore();
  core.clearState();
  return core;
}

describe("visibleSoFar", () => {
  it("hides the thinking of a reply still being written", () => {
    expect(visibleSoFar("<think>déjame pen")).toBe("");
    expect(visibleSoFar("<think>listo</think>Hola")).toBe("Hola");
    expect(visibleSoFar("Hola <thi")).toBe("Hola ");
  });
});

describe("an answer as it is written", () => {
  it("shows while it grows and ends as one settled message with its speed", async () => {
    const texts: string[] = [];
    const chat: ChatFn = async (_messages, _tools, _signal, options) => {
      options?.onText?.("Hola");
      options?.onText?.("Hola, ¿qué");
      return say("Hola, ¿qué hacemos hoy?", {
        usage: { prompt: 3000, completion: 12 },
        speed: 48,
      });
    };
    const agent = new Agent({ core: newCore(), prompt: "p", chat });
    agent.subscribe(() => {
      const last = agent.entries.at(-1);
      if (last?.kind === "assistant") texts.push(`${last.text}|${last.writing ? "w" : "done"}`);
    });
    await agent.send("hola");

    expect(texts[0]).toBe("Hola|w");
    const answers = agent.entries.filter((entry) => entry.kind === "assistant");
    expect(answers).toHaveLength(1);
    expect(answers[0]).toMatchObject({
      text: "Hola, ¿qué hacemos hoy?",
      writing: false,
      stats: { tokens: 12, speed: 48 },
    });
  });

  it("keeps what was written when the person stops it, and the model knows it said it", async () => {
    const seen: ChatMessage[][] = [];
    let call = 0;
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: (messages, _tools, signal, options) => {
        seen.push(messages);
        if (call++ > 0) return Promise.resolve(say("sigo"));
        options?.onText?.("Primero vamos a");
        return new Promise<ModelReply>((_resolve, reject) => {
          signal?.addEventListener("abort", () => reject(new Error("aborted")));
        });
      },
    });
    const turn = agent.send("explícame");
    await new Promise((resolve) => setTimeout(resolve, 0));
    agent.stop();
    await turn;

    expect(agent.entries.at(-1)).toMatchObject({ text: "Primero vamos a", writing: false });
    await agent.send("sigue");
    expect(JSON.stringify(seen[1])).toContain("Primero vamos a");
  });

  it("does not leave a streamed answer on screen when it recited tool names", async () => {
    const replies = [say("Usa add_to_plan con tiempo."), say("Te ayudo.")];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async (_messages, _tools, _signal, options) => {
        const reply = replies.shift()!;
        options?.onText?.(reply.content);
        return reply;
      },
    });
    await agent.send("tú qué opinas");
    expect(agent.entries.filter((entry) => entry.kind === "assistant")).toEqual([
      expect.objectContaining({ text: "Te ayudo." }),
    ]);
  });
});

describe("asking again", () => {
  it("replaces the last answer and sends the same message, without doubling it", async () => {
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async (messages) => {
        seen.push(messages);
        return say(`respuesta ${seen.length}`);
      },
    });
    await agent.send("dame una idea");
    const first = agent.entries.at(-1)!;
    expect(agent.canRegenerate(first.id)).toBe(true);
    await agent.regenerate(first.id);

    expect(agent.entries.map((entry) => entry.kind)).toEqual(["user", "assistant"]);
    expect(agent.entries.at(-1)).toMatchObject({ text: "respuesta 2" });
    expect(seen[1].filter((message) => message.role === "user")).toHaveLength(1);
    expect(seen[1].some((message) => message.role === "assistant")).toBe(false);
  });

  it("is not offered for an answer that came with a change to the day", async () => {
    const core = newCore();
    const replies: ModelReply[] = [
      {
        content: "",
        toolCalls: [
          { id: "c1", type: "function", function: { name: "start_day", arguments: "{}" } },
        ],
      },
      say("Día empezado."),
    ];
    const agent = new Agent({ core, prompt: "p", chat: async () => replies.shift()! });
    agent.mode = "auto";
    await agent.send("empiezo el día");
    expect(agent.canRegenerate(agent.entries.at(-1)!.id)).toBe(false);
  });
});

describe("a request the runtime refuses as too long", () => {
  it("recognizes the refusal in the runtimes' own words", () => {
    expect(isContextOverflow(new Error("The model answered 400: context length exceeded"))).toBe(
      true
    );
    expect(isContextOverflow(new Error("prompt is too long for n_ctx 8192"))).toBe(true);
    expect(isContextOverflow(new Error("The model answered 500: out of memory"))).toBe(false);
  });

  it("compacts and asks once more instead of showing the error", async () => {
    let refused = false;
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async (messages) => {
        if (String(messages[0].content).startsWith("You are compacting")) return say("Notas.");
        if (String(messages[0].content).startsWith("These are notes")) return say("Notas.");
        if (messages.length > 6 && !refused) {
          refused = true;
          throw new Error("The model answered 400: the request exceeds the context window");
        }
        return say("ok");
      },
    });
    for (let turn = 0; turn < 4; turn++) await agent.send(`mensaje ${turn}`);

    expect(refused).toBe(true);
    expect(agent.entries.some((entry) => entry.kind === "error")).toBe(false);
    expect(agent.entries.some((entry) => entry.kind === "compact")).toBe(true);
    expect(agent.entries.at(-1)).toMatchObject({ kind: "assistant", text: "ok" });
  });
});

describe("what the next request takes", () => {
  it("is the runtime's own count after a reply, plus an estimate of what came after", async () => {
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async () => say("ok", { usage: { prompt: 5000, completion: 20 } }),
    });
    await agent.send("hola");
    expect(agent.usage().used).toBe(5020);
  });
});

describe("a model that cannot see", () => {
  it("is told there was an image instead of being sent one", async () => {
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      vision: () => false,
      chat: async (messages) => {
        seen.push(messages);
        return say("ok");
      },
    });
    await agent.send("mira", [
      { kind: "image", name: "foto.jpg", data: "data:image/jpeg;base64,A" },
    ]);
    const sent = seen[0].find((message) => message.role === "user")!;
    expect(typeof sent.content).toBe("string");
    expect(String(sent.content)).toContain("image the loaded model cannot read");
  });
});

describe("a tool that keeps failing", () => {
  it("is not run a third time in the same turn, and the model is told to stop", async () => {
    const core = newCore();
    core.startDay();
    const seen: ChatMessage[][] = [];
    const again = (): ModelReply => ({
      content: "",
      toolCalls: [
        {
          id: `c-${Math.random()}`,
          type: "function",
          function: {
            name: "schedule",
            arguments: JSON.stringify({ item: "nada", time: "15:00" }),
          },
        },
      ],
    });
    const replies = [again(), again(), again(), say("No pude moverlo.")];
    const agent = new Agent({
      core,
      prompt: "p",
      chat: async (messages) => {
        seen.push(messages);
        return replies.shift()!;
      },
    });
    agent.mode = "auto";
    await agent.send("mueve eso a las 15");
    const results = seen
      .at(-1)!
      .filter((message) => message.role === "tool")
      .map((message) => String(message.content));
    expect(results).toHaveLength(3);
    expect(results[0]).toContain("item-not-found");
    expect(results[1]).toContain("item-not-found");
    // The third call never reached the tool
    expect(results[2]).toContain("stop-trying");
    expect(results[2]).toContain("without naming tools");

    // A new message starts the count again
    replies.push(again(), say("Sigue sin estar."));
    await agent.send("prueba otra vez");
    expect(String(seen.at(-1)!.at(-1)!.content)).toContain("item-not-found");
  });
});
