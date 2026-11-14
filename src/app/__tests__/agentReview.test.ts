import { SystemCore } from "../../system";
import { Agent, type ChatFn } from "../agent/agent";
import type { ModelReply } from "../agent/llm";
import { confirmed, inventedLinks, quoted, type Problem } from "../agent/review";

/**
 * The second reading (ADR-012, 4e): what the reviewer claims stands only when
 * the code finds the sentence it copies, and checks what it can.
 */

const REPLY =
  "Para el codo: haz 3 series de 15 extensiones de muñeca con 1 o 2 kg, todos los días. Como me dijiste que tienes una banda elástica, úsala también. Guía: https://www.nhs.uk/tennis-elbow y https://example.com/inventado";
const LAST = "me duele el codo derecho. ¿cuánto tiempo tarda en mejorar?";
const CONTEXT = { reply: REPLY, last: LAST, theirs: LAST, tools: "" };

describe("what the reviewer claims", () => {
  it("is kept only when its sentence is where it says", () => {
    expect(quoted("haz 3 series de 15 extensiones de muñeca", REPLY)).toBe(true);
    // Marks and accents do not matter; a made-up sentence does
    expect(quoted("Haz 3 series de 15 extensiones de **muneca**", REPLY)).toBe(true);
    expect(quoted("haz 5 series de 20 flexiones", REPLY)).toBe(false);
    expect(quoted("codo", REPLY)).toBe(false);
  });

  it("is checked where the code can check it", () => {
    const found: Problem[] = [
      // A choice of loads, really there
      { kind: "open_choice", quote: "extensiones de muñeca con 1 o 2 kg", fix: "1 kg" },
      // Words put in their mouth: they never spoke of a band
      { kind: "not_their_words", quote: "me dijiste que tienes una banda elástica", fix: "" },
      // Their question, never answered
      { kind: "missed_question", quote: "¿cuánto tiempo tarda en mejorar?", fix: "semanas" },
      // A number with no tool to differ from
      { kind: "contradicts_tool", quote: "haz 3 series de 15 extensiones", fix: "" },
      // A question that is not theirs
      { kind: "missed_question", quote: "¿cuántas series hago?", fix: "" },
      // Not a choice of loads
      { kind: "open_choice", quote: "haz 3 series de 15 extensiones de muñeca", fix: "" },
    ];
    expect(confirmed(found, CONTEXT).map((one) => one.kind)).toEqual([
      "open_choice",
      "not_their_words",
      "missed_question",
    ]);
    // What they did say is not put in their mouth
    expect(
      confirmed([{ kind: "not_their_words", quote: "me duele el codo derecho", fix: "" }], {
        ...CONTEXT,
        reply: `Dijiste: me duele el codo derecho. ${REPLY}`,
      })
    ).toEqual([]);
  });

  it("finds links no search returned by itself", () => {
    expect(inventedLinks(REPLY, ["https://www.nhs.uk/tennis-elbow/"])).toEqual([
      "https://example.com/inventado",
    ]);
  });
});

function newCore() {
  const core = new SystemCore();
  core.clearState();
  return core;
}

const say = (content: string, extra: Partial<ModelReply> = {}): ModelReply => ({
  content,
  toolCalls: [],
  ...extra,
});

/** A coach that answers REPLY, a reviewer that finds `problems`, a correction. */
function model(problems: Problem[], calls: string[]): ChatFn {
  return async (messages) => {
    const system = String(messages[0].content);
    if (system.startsWith("You check a coach's reply")) {
      calls.push("review");
      return say("", {
        toolCalls: [
          {
            id: "r",
            type: "function",
            function: { name: "review_reply", arguments: JSON.stringify({ problems }) },
          },
        ],
      });
    }
    if (system.startsWith("You are the coach. You just sent")) {
      calls.push("correction");
      return say("Una corrección: usa 1 kg, no 2.");
    }
    calls.push("coach");
    return say(REPLY);
  };
}

describe("the second reading in a conversation", () => {
  it("adds a correction after the answer when a mistake stands", async () => {
    const calls: string[] = [];
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      review: () => true,
      chat: model([{ kind: "open_choice", quote: "con 1 o 2 kg", fix: "1 kg" }], calls),
    });
    await agent.send(LAST);
    await agent.settled();
    const answers = agent.entries.filter((entry) => entry.kind === "assistant");
    expect(answers).toHaveLength(2);
    expect(answers[1]).toMatchObject({ text: "Una corrección: usa 1 kg, no 2.", correction: true });
    expect(calls).toEqual(["coach", "review", "correction"]);
  });

  it("adds nothing when what the reviewer claims does not stand", async () => {
    const calls: string[] = [];
    // A reply with no links, and a quote that is not in it
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      review: () => true,
      chat: async (messages, tools, signal, options) => {
        const reply = await model(
          [{ kind: "unsafe", quote: "toma ibuprofeno 600 mg", fix: "" }],
          calls
        )(messages, tools, signal, options);
        return calls.at(-1) === "coach"
          ? say(
              `${REPLY.replace(/Guía:.*/, "")} Para la espalda, levántate cada hora y camina un poco.`
            )
          : reply;
      },
    });
    await agent.send(LAST);
    await agent.settled();
    expect(agent.entries.filter((entry) => entry.kind === "assistant")).toHaveLength(1);
    expect(calls).toEqual(["coach", "review"]);
  });

  it("is not run when it is off", async () => {
    const calls: string[] = [];
    const agent = new Agent({ core: newCore(), prompt: "p", chat: model([], calls) });
    await agent.send(LAST);
    await agent.settled();
    expect(calls).toEqual(["coach"]);
  });

  it("stops when the person writes again", async () => {
    const calls: string[] = [];
    let release: (() => void) | null = null;
    const agent = new Agent({
      core: newCore(),
      prompt: "p",
      review: () => true,
      chat: async (messages, tools, signal, options) => {
        if (
          String(messages[0].content).startsWith("You check a coach's reply") &&
          !calls.includes("review")
        ) {
          calls.push("review");
          await new Promise<void>((resolve) => {
            release = resolve;
            signal?.addEventListener("abort", () => resolve());
          });
          return say("", {
            toolCalls: [
              {
                id: "r",
                type: "function",
                function: {
                  name: "review_reply",
                  arguments: JSON.stringify({
                    problems: [{ kind: "open_choice", quote: "con 1 o 2 kg", fix: "1 kg" }],
                  }),
                },
              },
            ],
          });
        }
        // The second answer's reading finds nothing
        return model([], calls)(messages, tools, signal, options);
      },
    });
    await agent.send(LAST);
    expect(release).not.toBeNull();
    await agent.send("gracias");
    await agent.settled();
    // The first answer's correction never came: the person had moved on. The
    // second answer's reading ran whole (its made-up link), after it
    const kinds = agent.entries.map((entry) =>
      entry.kind === "assistant" && entry.correction ? "correction" : entry.kind
    );
    expect(kinds).toEqual(["user", "assistant", "user", "assistant", "correction"]);
  });
});

describe("the findings of a real run", () => {
  const TOOLS =
    '{"saved":["De Escucha a Acción"],"sessions":[{"days":"lun, mar, mié, jue, vie","time":"12:00","total":65,"first":"lun 16 nov"}]} {"results":[{"title":"Cómo empezar a tocar guitarra desde cero | Blog Rockshop"},{"title":"NHS Couch to 5K: 9 weeks, 30 minutes, 5 km"}]}';
  const reply = (text: string) => ({ reply: text, last: "dale", theirs: "dale", tools: TOOLS });

  it("drops what the tools themselves say, and what is not put in their mouth", () => {
    // The 16th is in the tool's answer: "corrected" to the 20th, a Friday
    expect(
      confirmed(
        [{ kind: "contradicts_tool", quote: "Comienza el lunes 16 de noviembre", fix: "20" }],
        reply("Listo. Comienza el lunes 16 de noviembre a las 12:00.")
      )
    ).toEqual([]);
    // No number to differ: "the plan is already created" is not the reviewer's to deny
    expect(
      confirmed(
        [{ kind: "contradicts_tool", quote: "El plan ya está creado en tu agenda", fix: "" }],
        reply("El plan ya está creado en tu agenda.")
      )
    ).toEqual([]);
    // Every number of the sentence is the source's
    expect(
      confirmed(
        [
          {
            kind: "contradicts_tool",
            quote: "El NHS confirma que 9 semanas bastan para correr 30 minutos (~5 km).",
            fix: "",
          },
        ],
        reply("El NHS confirma que 9 semanas bastan para correr 30 minutos (~5 km).")
      )
    ).toEqual([]);
    // Something the coach did, not something said to be theirs
    expect(
      confirmed(
        [{ kind: "not_their_words", quote: "He guardado tu nota en la vida ideal.", fix: "" }],
        reply("He guardado tu nota en la vida ideal.")
      )
    ).toEqual([]);
  });

  it("keeps a number no tool gave, and a source no search returned", () => {
    expect(
      confirmed(
        [{ kind: "contradicts_tool", quote: "Son 60 sesiones en total", fix: "65" }],
        reply("Son 60 sesiones en total.")
      )
    ).toHaveLength(1);
    const blogs =
      "Los blogs de Rockshop y SixStrings coinciden: el error número uno es presionar con el dedo acostado.";
    expect(
      confirmed([{ kind: "unknown_source", quote: blogs, fix: "" }], reply(blogs))
    ).toHaveLength(1);
    // Both found: nothing to say
    expect(
      confirmed(
        [{ kind: "unknown_source", quote: "Según el Blog Rockshop, empieza despacio.", fix: "" }],
        reply("Según el Blog Rockshop, empieza despacio.")
      )
    ).toEqual([]);
  });
});
