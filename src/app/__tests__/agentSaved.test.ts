import { describeFacts, disagreements, savedFacts } from "../agent/saved";
import type { ChatMessage } from "../agent/llm";

const history = (answer: object): ChatMessage[] => [
  { role: "user", content: "si dale" },
  { role: "assistant", content: null, tool_calls: [] },
  { role: "tool", tool_call_id: "1", content: JSON.stringify(answer) },
];

const SAVED = {
  saved: ["Entrenar"],
  sessions: [
    {
      roadmap: "Entrenar",
      total: 21,
      first: "vie 13 nov",
      last: "mié 30 dic",
      milestones: [
        { milestone: "Uno", sessions: 6, from: "vie 13 nov", to: "mié 25 nov" },
        { milestone: "Dos", sessions: 15, from: "vie 27 nov", to: "mié 30 dic" },
      ],
    },
  ],
};

describe("what a reply says about a saved roadmap", () => {
  it("is checked against the tool's answer", () => {
    const facts = savedFacts(history(SAVED))!;
    expect([...facts.counts].sort()).toEqual([15, 21, 6]);
    expect(facts.dates.has("13-nov")).toBe(true);
    // Right: nothing to say
    expect(
      disagreements("Son 21 sesiones, del viernes 13 de noviembre al 30 de diciembre.", facts)
    ).toEqual([]);
    // The reply of the gym run: 20 sessions from the 16th
    expect(
      disagreements("Se programaron 20 sesiones desde el lunes 16 de noviembre.", facts)
    ).toEqual(["20 sessions", "16 nov"]);
    // Days a week are not session counts
    expect(disagreements("Son 3 sesiones por semana.", facts)).toEqual([]);
    expect(describeFacts(facts)).toContain("session counts 21, 6, 15");
  });

  it("checks the days a week the reply says", () => {
    const daily = savedFacts(
      history({ sessions: [{ total: 91, days: "todos los días", first: "lun 16 nov" }] })
    )!;
    // A roadmap of every day said to be three days a week
    expect(
      disagreements("Son 91 sesiones, tres días a la semana, desde el lunes 16 nov.", daily)
    ).toEqual(["3 days a week"]);
    const three = savedFacts(
      history({ sessions: [{ total: 21, days: "lun, mié, vie", first: "lun 16 nov" }] })
    )!;
    expect(disagreements("Tres días a la semana: 21 sesiones.", three)).toEqual([]);
  });

  it("has nothing to check when no roadmap was saved in the turn", () => {
    expect(savedFacts(history({ ok: true }))).toBeNull();
    // A roadmap saved before the person's last message is not this turn's
    expect(savedFacts([...history(SAVED), { role: "user", content: "gracias" }])).toBeNull();
  });
});
