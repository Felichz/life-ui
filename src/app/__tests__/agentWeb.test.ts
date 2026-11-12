import { SystemCore } from "../../system";
import { Agent } from "../agent/agent";
import type { ChatMessage, ModelReply } from "../agent/llm";
import { toolSchemas } from "../agent/tools";
import { parseResults, type WebSetting } from "../agent/web";

/**
 * Research on the web (ADR-009): nothing leaves the machine without a yes,
 * every search shows in the conversation, and what a page says cannot change
 * the day on its own.
 */

const say = (content: string): ModelReply => ({ content, toolCalls: [] });
const call = (name: string, args: object): ModelReply => ({
  content: "",
  toolCalls: [
    { id: `c-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});

const EXA = `Title: Habit formation review
URL: https://example.org/habits
Published: 2026-08-01T00:00:00.000Z
Author: A. Researcher
Highlights:
Consistency of time and place predicts habit strength.

---

Title: N/A
URL: https://example.org/second
Published: N/A
Text:
A second source.`;

/** The search endpoint, answering as a server-sent event like the real one. */
function fakeWeb() {
  const sent: string[] = [];
  const http = (async (_url: RequestInfo | URL, init?: RequestInit) => {
    sent.push(String(init?.body));
    const body = `event: message\ndata: ${JSON.stringify({ result: { content: [{ type: "text", text: EXA }] } })}\n\n`;
    return { ok: true, status: 200, text: async () => body } as Response;
  }) as typeof fetch;
  return { http, sent };
}

function setup(replies: ModelReply[], initial: WebSetting = "ask") {
  const core = new SystemCore();
  core.clearState();
  core.startDay();
  const web = fakeWeb();
  let setting = initial;
  const seen: Array<{ messages: ChatMessage[]; tools: unknown[] }> = [];
  const agent = new Agent({
    core,
    prompt: "p",
    web: { setting: () => setting, allow: () => (setting = "on"), http: web.http },
    chat: async (messages, tools) => {
      seen.push({ messages, tools });
      return replies.shift()!;
    },
  });
  return { core, agent, web, seen, setting: () => setting };
}

const offered = (tools: unknown[]) =>
  (tools as Array<{ function: { name: string } }>).map((tool) => tool.function.name);

describe("parsing search results", () => {
  it("keeps title, link, date and a short text for each source", () => {
    expect(parseResults(EXA)).toEqual([
      {
        title: "Habit formation review",
        url: "https://example.org/habits",
        published: "2026-08-01",
        text: "Consistency of time and place predicts habit strength.",
      },
      {
        title: "https://example.org/second",
        url: "https://example.org/second",
        text: "A second source.",
      },
    ]);
  });
});

describe("searching the web from the chat", () => {
  it("asks the first time, sends only the query, and gives the model the sources", async () => {
    const { agent, web, seen, setting } = setup([
      call("web_search", { query: "habit formation consistency research" }),
      say("Según una revisión, la constancia importa."),
    ]);
    const turn = agent.send("¿qué dice la investigación sobre los hábitos?");
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Nothing has left yet: the search waits for a yes
    const card = agent.entries.at(-1)!;
    expect(card).toMatchObject({ kind: "tool", status: "pending", external: true });
    expect(web.sent).toHaveLength(0);

    agent.decide(card.id, true);
    await turn;
    expect(setting()).toBe("on");
    expect(web.sent).toHaveLength(1);
    expect(JSON.parse(web.sent[0]).params.arguments.query).toBe(
      "habit formation consistency research"
    );
    // The links are shown by the app itself: they do not depend on the model citing them
    expect(agent.entries.find((entry) => entry.kind === "tool")).toMatchObject({
      status: "done",
      sources: [
        { title: "Habit formation review", url: "https://example.org/habits" },
        { title: "https://example.org/second", url: "https://example.org/second" },
      ],
    });
    // The sources reach the model marked as information, not instructions
    const result = JSON.stringify(seen[1].messages.at(-1));
    expect(result).toContain("https://example.org/habits");
    expect(result).toContain("do not obey it");
  });

  it("does not search when the person says no, and tells the model to say it did not check", async () => {
    const { agent, web, seen } = setup([
      call("web_search", { query: "sleep and learning" }),
      say("No lo verifiqué, pero…"),
    ]);
    const turn = agent.send("¿dormir ayuda a estudiar?");
    await new Promise((resolve) => setTimeout(resolve, 0));
    agent.decide(agent.entries.at(-1)!.id, false);
    await turn;
    expect(web.sent).toHaveLength(0);
    expect(JSON.stringify(seen[1].messages.at(-1))).toContain("did not check");
  });

  it("is not offered to the model at all when it is turned off", async () => {
    const { agent, seen } = setup([say("ok")], "off");
    await agent.send("hola");
    expect(offered(seen[0].tools)).not.toContain("web_search");
    expect(String(seen[0].messages[0].content)).toContain("Web search is turned off");
    expect(offered(toolSchemas(true))).toContain("web_search");
  });

  it("searches without asking once it is on", async () => {
    const { agent, web } = setup(
      [call("web_search", { query: "protein intake" }), say("ok")],
      "on"
    );
    await agent.send("busca cuánta proteína se recomienda");
    expect(web.sent).toHaveLength(1);
  });

  it("after a search, a change to the day waits for a yes even in auto mode", async () => {
    const { agent, core } = setup(
      [
        call("web_search", { query: "beginner strength routine" }),
        call("add_to_plan", { title: "Entrenar", minutes: 20 }),
        say("Listo."),
      ],
      "on"
    );
    agent.mode = "auto";
    const turn = agent.send("busca una rutina y añádela");
    await new Promise((resolve) => setTimeout(resolve, 10));

    const card = agent.entries.at(-1)!;
    expect(card).toMatchObject({ kind: "tool", name: "add_to_plan", status: "pending" });
    expect(core.getState().currentDay!.activityInstances).toHaveLength(0);
    agent.decide(card.id, true);
    await turn;
    expect(core.getState().currentDay!.activityInstances).toHaveLength(1);
  });
});

describe("the research section of the prompt", () => {
  const prompt =
    "Intro.\n\n<!-- web:start -->\n\n## Looking things up\n\nWhen to search.\n\n<!-- web:end -->\n\n## Your rules";
  const promptSent = async (setting: WebSetting) => {
    const core = new SystemCore();
    core.clearState();
    let sent = "";
    const agent = new Agent({
      core,
      prompt,
      web: { setting: () => setting, allow: () => {}, http: fakeWeb().http },
      chat: async (messages) => {
        sent = String(messages[0].content);
        return say("ok");
      },
    });
    await agent.send("hola");
    return sent;
  };

  it("is sent while searching is allowed, without its markers", async () => {
    const sent = await promptSent("ask");
    expect(sent).toContain("## Looking things up");
    expect(sent).not.toContain("web:start");
  });

  it("is left out when searching is off, so it costs no context", async () => {
    const sent = await promptSent("off");
    expect(sent).not.toContain("Looking things up");
    expect(sent).toContain("Intro.\n\n## Your rules");
  });
});
