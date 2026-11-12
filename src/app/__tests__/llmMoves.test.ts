import { chat, moveSchema, type ChatMessage } from "../agent/llm";

/**
 * A call that has to be a tool call (the roadmap planner's, ADR-010) is held
 * to a JSON schema, because that is what local servers enforce. And a 400
 * does not say what it refuses, so nothing is concluded from one alone.
 */

const TOOLS = [
  {
    type: "function",
    function: {
      name: "save_roadmap",
      description: "Creates a roadmap",
      parameters: { type: "object", properties: { title: { type: "string" } } },
    },
  },
  {
    type: "function",
    function: {
      name: "finish",
      description: "Done",
      parameters: { type: "object", properties: { message: { type: "string" } } },
    },
  },
];
const MESSAGES: ChatMessage[] = [{ role: "user", content: "hola" }];

type Body = Record<string, unknown>;

/** A server scripted by status: each request is recorded and answered in turn. */
function server(answers: Array<{ status: number; content?: string }>) {
  const bodies: Body[] = [];
  const fetchMock = jest.fn(async (_url: string, init: { body: string }) => {
    bodies.push(JSON.parse(init.body) as Body);
    const answer = answers.shift() ?? { status: 500 };
    return {
      status: answer.status,
      ok: answer.status === 200,
      headers: { get: () => "application/json" },
      body: null,
      text: async () => "refused",
      json: async () => ({ choices: [{ message: { content: answer.content ?? "" } }] }),
    };
  });
  Object.assign(globalThis, { fetch: fetchMock });
  return bodies;
}

let n = 0;
/** A fresh endpoint each time: what a server refused is remembered per endpoint. */
const endpoint = () => ({ baseUrl: `http://local-${++n}/v1`, model: "m" });

describe("a call that has to be a tool call", () => {
  it("is held to a schema of the tools, and read back as the call it is", async () => {
    const bodies = server([
      { status: 200, content: '{"name":"save_roadmap","arguments":{"title":"Nadar"}}' },
    ]);
    const reply = await chat(endpoint(), MESSAGES, TOOLS, undefined, { toolChoice: "required" });

    expect(reply.content).toBe("");
    expect(reply.toolCalls).toHaveLength(1);
    expect(reply.toolCalls[0].function).toEqual({
      name: "save_roadmap",
      arguments: '{"title":"Nadar"}',
    });
    const format = bodies[0].response_format as { json_schema: { schema: unknown } };
    expect(format.json_schema.schema).toEqual(moveSchema(TOOLS));
    // The tools still go in the request: it is how the model reads what they are for
    expect(bodies[0].tools).toEqual(TOOLS);
    expect(JSON.stringify(moveSchema(TOOLS))).toContain('"const":"finish"');
  });

  it("gives back as text a move that was cut short", async () => {
    server([{ status: 200, content: '{"name":"save_roadmap","arguments":{"title":"Na' }]);
    const reply = await chat(endpoint(), MESSAGES, TOOLS, undefined, { toolChoice: "required" });
    expect(reply.toolCalls).toEqual([]);
    expect(reply.content).toContain("save_roadmap");
  });

  it("falls back to tool_choice on a server without schemas, and remembers it", async () => {
    const at = endpoint();
    const bodies = server([{ status: 400 }, { status: 200, content: "ok" }, { status: 200 }]);
    await chat(at, MESSAGES, TOOLS, undefined, { toolChoice: "required" });
    expect(bodies[0].response_format).toBeDefined();
    expect(bodies[1].response_format).toBeUndefined();
    expect(bodies[1].tool_choice).toBe("required");

    await chat(at, MESSAGES, TOOLS, undefined, { toolChoice: "required" });
    expect(bodies[2].response_format).toBeUndefined();
    expect(bodies[2].tool_choice).toBe("required");
  });

  it("leaves an ordinary call alone", async () => {
    const bodies = server([{ status: 200, content: "hola" }]);
    const reply = await chat(endpoint(), MESSAGES, TOOLS);
    expect(reply.content).toBe("hola");
    expect(bodies[0].response_format).toBeUndefined();
    expect(bodies[0].tool_choice).toBe("auto");
  });
});

describe("a 400 from the server", () => {
  it("does not turn thinking back on when the request was refused for another reason", async () => {
    const at = endpoint();
    // Too long for the context: refused with the switch and without it
    const bodies = server([{ status: 400 }, { status: 400 }, { status: 200, content: "ok" }]);
    await expect(chat(at, MESSAGES, [], undefined, { reasoning: false })).rejects.toThrow(/400/);
    expect(bodies).toHaveLength(2);

    await chat(at, MESSAGES, [], undefined, { reasoning: false });
    expect(bodies[2].reasoning_effort).toBe("none");
  });

  it("stops offering the switch to a server that took the request without it", async () => {
    const at = endpoint();
    const bodies = server([{ status: 400 }, { status: 200, content: "ok" }, { status: 200 }]);
    await chat(at, MESSAGES, [], undefined, { reasoning: false });
    expect(bodies[1].reasoning_effort).toBeUndefined();

    await chat(at, MESSAGES, [], undefined, { reasoning: false });
    expect(bodies[2].reasoning_effort).toBeUndefined();
  });
});

describe("a server that fails half way through a stream", () => {
  /** A streamed answer: the lines arrive as the server would send them. */
  function streaming(lines: string[]) {
    const chunks = lines.map((line) =>
      new TextEncoder().encode(`data: ${line}

`)
    );
    Object.assign(globalThis, {
      fetch: jest.fn(async () => ({
        status: 200,
        ok: true,
        headers: { get: () => "text/event-stream" },
        body: {
          getReader: () => ({
            read: async () =>
              chunks.length > 0 ? { done: false, value: chunks.shift() } : { done: true },
          }),
        },
      })),
    });
  }

  it("says so, where it used to read as a model that answered nothing", async () => {
    streaming(['{"error":{"message":"Failed to process the prompt"}}']);
    await expect(chat(endpoint(), MESSAGES, [])).rejects.toThrow(/Failed to process the prompt/);
  });

  it("keeps what was written before the failure", async () => {
    streaming(['{"choices":[{"delta":{"content":"Hola"}}]}', '{"error":"cut"}']);
    const reply = await chat(endpoint(), MESSAGES, []);
    expect(reply.content).toBe("Hola");
  });
});
