import { SystemCore } from "../../system";
import { Agent, mergeUserRuns, type SavedChats } from "../agent/agent";
import {
  chunkLines,
  estimateTokens,
  historyTokens,
  splitForCompaction,
  summarize,
} from "../agent/context";
import type { ChatMessage, ModelReply } from "../agent/llm";

/**
 * Conversations within the model's context (ADR-007): counted, compacted with
 * the model itself in as many parts as it takes, kept several at a time,
 * branched and edited.
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const user = (content: string): ChatMessage => ({ role: "user", content });
const reply = (content: string): ChatMessage => ({ role: "assistant", content });
const isSummaryCall = (messages: ChatMessage[]) =>
  String(messages[0].content).startsWith("You are compacting");

function newCore() {
  const core = new SystemCore();
  core.clearState();
  return core;
}

function memoryStore() {
  let saved: SavedChats | null = null;
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

describe("splitting a conversation to compact it", () => {
  const history = [user("a"), reply("b"), user("c"), reply("d"), user("e"), reply("f")];

  it("keeps the last turns that fit, starting on a message from the person", () => {
    const { old, tail } = splitForCompaction(history, historyTokens(history.slice(2)));
    expect(tail[0]).toEqual(user("c"));
    expect(old).toHaveLength(2);
  });

  it("always keeps the last turn, even when it alone is over the budget", () => {
    const { old, tail } = splitForCompaction(history, 1);
    expect(tail).toEqual([user("e"), reply("f")]);
    expect(old).toHaveLength(4);
  });

  it("has nothing to summarize in a single turn", () => {
    expect(splitForCompaction([user("a"), reply("b")], 1000).old).toEqual([]);
  });
});

describe("chunks", () => {
  it("packs lines up to the size and cuts a line that is too long on its own", () => {
    const chunks = chunkLines(["x".repeat(100), "y".repeat(100), "z".repeat(700)], 100);
    expect(chunks.length).toBeGreaterThanOrEqual(3);
    expect(chunks.join("").replace(/\n/g, "")).toHaveLength(900);
    for (const chunk of chunks) expect(estimateTokens(chunk)).toBeLessThanOrEqual(101);
  });
});

describe("summarize", () => {
  const long = Array.from({ length: 60 }, (_, i) => [
    user(`quiero hablar del tema ${i} ${"palabras ".repeat(60)}`),
    reply(`respuesta ${i} ${"texto ".repeat(60)}`),
  ]).flat();

  it("uses more parts for a smaller model, one call per part", async () => {
    const calls = { small: 0, large: 0 };
    const run = (context: number, key: "small" | "large") =>
      summarize(long, {
        context,
        language: "Spanish",
        chat: async () => {
          calls[key]++;
          return say("nota breve");
        },
      });
    const small = await run(4096, "small");
    const large = await run(32768, "large");
    expect(small.chunks).toBeGreaterThan(large.chunks);
    expect(calls.small).toBe(small.chunks);
    expect(calls.large).toBe(large.chunks);
  });

  it("summarizes the notes again when together they are still too long", async () => {
    let calls = 0;
    const result = await summarize(long, {
      context: 4096,
      language: "Spanish",
      // The first pass writes long notes; later passes write short ones
      chat: async (messages) => {
        calls++;
        const first = String((messages[1] as { content: string }).content).includes("Person:");
        return say(first ? "nota larga ".repeat(120) : "resumen final");
      },
    });
    expect(calls).toBeGreaterThan(result.chunks);
    expect(result.summary).toContain("resumen final");
  });

  it("refuses an empty summary instead of losing the conversation", async () => {
    await expect(
      summarize(long, { context: 8192, language: "Spanish", chat: async () => say("  ") })
    ).rejects.toThrow("empty-summary");
  });
});

describe("mergeUserRuns", () => {
  it("joins two messages in a row from the person, for strict chat templates", () => {
    const merged = mergeUserRuns([user("uno"), user("dos"), reply("ok"), user("tres")]);
    expect(merged).toEqual([user("uno\n\ndos"), reply("ok"), user("tres")]);
  });
});

describe("a conversation that outgrows the model", () => {
  const filler = "bla ".repeat(400);

  it("compacts itself before asking, keeps the summary for the model and shows it", async () => {
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      context: () => 4096,
      chat: async (messages) => {
        if (isSummaryCall(messages)) return say("La persona habló de varios temas.");
        seen.push(messages);
        return say(`ok ${filler}`);
      },
    });
    for (let turn = 0; turn < 6; turn++) await agent.send(`tema ${turn} ${filler}`);

    const note = agent.entries.find((entry) => entry.kind === "compact");
    if (note?.kind !== "compact") throw new Error("no compaction happened");
    // One note per part, joined
    expect(note.text).toContain("La persona habló de varios temas.");
    expect(note.after).toBeLessThan(note.before);
    // From then on the model reads the notes instead of the old messages
    expect(String(seen.at(-1)![0].content)).toContain("La persona habló de varios temas.");
    expect(seen.at(-1)!.length).toBeLessThan(13);
    expect(agent.usage().overflow).toBe(false);
  });

  it("says it has to be compacted when a smaller model is loaded, and does it on request", async () => {
    let context = 32768;
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      context: () => context,
      chat: async (messages) => (isSummaryCall(messages) ? say("Resumen.") : say(`ok ${filler}`)),
    });
    for (let turn = 0; turn < 8; turn++) await agent.send(`tema ${turn} ${filler}`);
    expect(agent.usage().overflow).toBe(false);

    context = 4096;
    expect(agent.usage()).toMatchObject({ overflow: true, canCompact: true });
    await agent.compact();
    expect(agent.usage().overflow).toBe(false);
    const note = agent.entries.at(-1);
    expect(note?.kind === "compact" && note.chunks > 1 && note.text.includes("Resumen.")).toBe(
      true
    );
  });

  it("follows the model's own token count once it reports one", async () => {
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async () => ({ content: "ok", toolCalls: [], usage: { prompt: 9000, completion: 5 } }),
    });
    const before = agent.usage().used;
    await agent.send("hola");
    // The estimate was far below 9000: it is pulled up (within the cap) by the real count
    expect(agent.usage().used).toBeGreaterThan(before * 1.5);
  });
});

describe("several conversations", () => {
  it("keeps each one, lists the latest first and reopens them", async () => {
    const store = memoryStore();
    const agent = new Agent({ core: newCore(), prompt: "p", store, chat: async () => say("ok") });
    await agent.send("primera conversación");
    agent.newChat();
    expect(agent.entries).toEqual([]);
    await agent.send("segunda conversación");

    expect(agent.list().map((chat) => chat.title)).toEqual([
      "segunda conversación",
      "primera conversación",
    ]);
    const first = agent.list()[1];
    agent.openChat(first.id);
    expect(agent.entries[0]).toMatchObject({ kind: "user", text: "primera conversación" });

    // And they come back after a restart, with the open one open
    const again = new Agent({ core: newCore(), prompt: "p", store, chat: async () => say("ok") });
    expect(again.list()).toHaveLength(2);
    expect(again.entries[0]).toMatchObject({ text: "primera conversación" });
  });

  it("deletes one without touching the others", async () => {
    const agent = new Agent({ core: newCore(), prompt: "p", chat: async () => say("ok") });
    await agent.send("uno");
    agent.newChat();
    await agent.send("dos");
    agent.deleteChat(agent.list()[1].id);
    expect(agent.list().map((chat) => chat.title)).toEqual(["dos"]);
  });

  it("branches from an answer: the original stays, the branch goes on from there", async () => {
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async (messages) => {
        seen.push(messages);
        return say(`respuesta ${seen.length}`);
      },
    });
    await agent.send("uno");
    await agent.send("dos");
    const firstAnswer = agent.entries.find((entry) => entry.kind === "assistant")!;
    agent.branchFrom(firstAnswer.id);

    expect(agent.entries.map((entry) => entry.kind)).toEqual(["user", "assistant"]);
    expect(agent.list()).toHaveLength(2);
    await agent.send("otro camino");
    const sent = seen.at(-1)!.filter((message) => message.role === "user");
    expect(sent.map((message) => String(message.content))).toEqual([
      "uno",
      expect.stringContaining("otro camino"),
    ]);
  });

  it("edits a message: goes back to right before it and hands its text back", async () => {
    const agent = new Agent({ core: newCore(), prompt: "p", chat: async () => say("ok") });
    await agent.send("uno");
    await agent.send("dso");
    const typo = agent.entries.filter((entry) => entry.kind === "user")[1];
    expect(agent.editFrom(typo.id)).toBe("dso");
    expect(agent.entries.map((entry) => entry.kind)).toEqual(["user", "assistant"]);
    // The conversation with the typo is still in the list
    expect(agent.list()).toHaveLength(2);
  });
});

describe("attachments", () => {
  it("sends a text file inside the message and an image as a part a vision model reads", async () => {
    const seen: ChatMessage[][] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      chat: async (messages) => {
        seen.push(messages);
        return say("ok");
      },
    });
    await agent.send("mira esto", [
      { kind: "text", name: "notas.md", data: "# Rutina\n3 series" },
      { kind: "image", name: "foto.jpg", data: "data:image/jpeg;base64,AAAA" },
    ]);
    const message = seen[0].find((m) => m.role === "user")!;
    expect(Array.isArray(message.content)).toBe(true);
    const parts = message.content as Array<{ type: string; text?: string }>;
    expect(parts[0].text).toContain("[File: notas.md]\n# Rutina");
    expect(parts.some((part) => part.type === "image_url")).toBe(true);
    expect(agent.entries[0]).toMatchObject({
      attachments: [
        { kind: "text", name: "notas.md" },
        { kind: "image", name: "foto.jpg", url: "data:image/jpeg;base64,AAAA" },
      ],
    });
  });
});
