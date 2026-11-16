import { SystemCore } from "../../system";
import { Agent, type ChatFn } from "../agent/agent";
import { answerText, askedQuestions } from "../agent/tools";
import type { ChatMessage, ModelReply } from "../agent/llm";

/**
 * Questions with choices: the coach asks on a card, the turn ends there, and
 * what the person picks or writes comes back as their next message.
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const call = (name: string, args: object = {}): ModelReply => ({
  content: "",
  toolCalls: [
    { id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

function newCore() {
  const core = new SystemCore();
  core.clearState();
  return core;
}

const QUESTIONS = {
  questions: [
    {
      question: "¿Cuánto tiempo tienes por sesión?",
      header: "Tiempo",
      options: [{ label: "10 minutos" }, { label: "15 minutos" }, { label: "Otro" }],
    },
    {
      question: "¿Qué días?",
      options: ["Lunes", "Miércoles", "Viernes"],
      multiple: true,
    },
  ],
};

describe("questions with choices", () => {
  it("ends the turn with a card, and the answers are the person's next message", async () => {
    const seen: ChatMessage[][] = [];
    const replies = [call("ask_choices", QUESTIONS), say("Hecho: 15 minutos, lunes y viernes.")];
    const chat: ChatFn = async (messages) => {
      seen.push(messages);
      return replies.shift()!;
    };
    const agent = new Agent({ core: newCore(), prompt: "p", chat });
    await agent.send("quiero un plan de progresión");

    const card = agent.entries.at(-1);
    expect(card).toMatchObject({ kind: "ask", status: "open" });
    expect(agent.entries.some((entry) => entry.kind === "assistant")).toBe(false);
    expect(agent.busy).toBe(false);
    // The model's own "Other" is dropped: the card has its own place to write
    if (card?.kind !== "ask") throw new Error("no card");
    expect(card.questions[0].options.map((option) => option.label)).toEqual([
      "10 minutos",
      "15 minutos",
    ]);

    await agent.answer(card.id, [
      { picked: ["15 minutos"] },
      { picked: ["Lunes"], own: "y viernes" },
    ]);

    expect(agent.entries.find((entry) => entry.id === card.id)).toMatchObject({
      status: "answered",
    });
    const last = seen.at(-1)!;
    const answer = String(last.filter((message) => message.role === "user").at(-1)?.content);
    expect(answer).toMatch(
      /^Cuánto tiempo tienes por sesión: 15 minutos\nQué días: Lunes, y viernes/
    );
    // An answer is not a question: the coach is not told to answer one
    expect(answer).not.toContain("They asked you something");
    // What it asked is in its history, in words, before their answer
    expect(
      last.some(
        (message) => message.role === "assistant" && String(message.content).includes("¿Qué días?")
      )
    ).toBe(true);
    expect(agent.entries.at(-1)).toMatchObject({ kind: "assistant" });
  });

  it("steps back when the person writes in the chat instead", async () => {
    const replies = [call("ask_choices", QUESTIONS), say("Vale.")];
    const agent = new Agent({ core: newCore(), prompt: "p", chat: async () => replies.shift()! });
    await agent.send("un plan");
    const card = agent.entries.at(-1)!;
    await agent.send("prefiero hablarlo");
    expect(agent.entries.find((entry) => entry.id === card.id)).toMatchObject({
      status: "skipped",
    });
    await agent.answer(card.id, [{ picked: ["10 minutos"] }, { picked: ["Lunes"] }]);
    expect(agent.entries.filter((entry) => entry.kind === "assistant")).toHaveLength(1);
  });

  it("refuses a question without real options, so the model asks in words", () => {
    expect(() =>
      askedQuestions({
        questions: [{ question: "¿Algo?", options: [{ label: "Sí" }, { label: "Otra" }] }],
      })
    ).toThrow("invalid-questions");
    expect(
      answerText(
        [{ question: "¿Cuándo?", options: [{ label: "a" }, { label: "b" }] }],
        [{ picked: [] }]
      )
    ).toBe("");
  });
});
