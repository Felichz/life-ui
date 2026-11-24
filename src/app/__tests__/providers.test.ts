import { GROUP_ORDER, PROVIDERS, offeredProviders } from "../runtime/catalog";
import {
  NO_CONNECTIONS,
  activeConnection,
  newConnectionId,
  savedConnections,
  saveConnections,
  withConnection,
  withoutConnection,
  type RemoteModel,
} from "../runtime/providers";

/**
 * The providers LifeUI can use through an API (as KnowGraph's catalog), and the
 * connections a person keeps of them: several, one in use.
 */

const one = (id: string, extra: Partial<RemoteModel> = {}): RemoteModel => ({
  id,
  label: `Connection ${id}`,
  provider: "openrouter",
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: `key-${id}`,
  model: "openai/gpt-4o-mini",
  context: 32768,
  ...extra,
});

describe("the catalog", () => {
  it("has every provider once, in a known group, with a line in both languages", () => {
    const ids = PROVIDERS.map((provider) => provider.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const provider of PROVIDERS) {
      expect(GROUP_ORDER).toContain(provider.group);
      expect(provider.description.en.length).toBeGreaterThan(5);
      expect(provider.description.es.length).toBeGreaterThan(5);
      if (provider.id !== "custom") expect(provider.baseUrl).toMatch(/^https?:\/\//);
    }
    // KnowGraph's providers are all here
    for (const id of [
      "openai",
      "groq",
      "mistral",
      "deepseek",
      "togetherai".replace("ai", ""),
      "nvidia",
      "huggingface",
      "perplexity",
      "deepinfra",
      "chutes",
      "baseten",
      "moonshotai",
      "zai",
      "stepfun",
      "alibaba",
      "ollama",
      "lmstudio",
      "openrouter",
      "minimax",
      "cerebras",
      "fireworks",
      "xai",
    ]) {
      expect(ids).toContain(id);
    }
  });

  it("marks the ones a web page cannot call, and keeps the local servers to the desktop", () => {
    const blocked = PROVIDERS.filter((provider) => !provider.browser).map(
      (provider) => provider.id
    );
    expect(blocked.sort()).toEqual(["nvidia", "opencode", "zai"]);
    expect(offeredProviders(true).some((provider) => provider.id === "ollama")).toBe(true);
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    try {
      expect(offeredProviders(false).some((provider) => provider.local)).toBe(false);
      expect(offeredProviders(true).some((provider) => provider.local)).toBe(true);
    } finally {
      process.env.NODE_ENV = previous;
    }
  });
});

describe("the connections", () => {
  beforeEach(() => localStorage.clear());

  it("keeps several and which one is in use, across a reload", () => {
    let connections = withConnection(NO_CONNECTIONS, one("a"));
    connections = withConnection(connections, one("b", { provider: "groq" }));
    expect(activeConnection(connections)?.id).toBe("b");
    saveConnections(connections);
    const again = savedConnections();
    expect(again.list.map((c) => c.id)).toEqual(["a", "b"]);
    expect(again.active).toBe("b");
    expect(again.list[0].apiKey).toBe("key-a");
  });

  it("changes one in place, and takes one out", () => {
    let connections = withConnection(withConnection(NO_CONNECTIONS, one("a")), one("b"));
    connections = withConnection(connections, one("a", { model: "other" }), false);
    expect(connections.list).toHaveLength(2);
    expect(connections.list[0].model).toBe("other");
    expect(connections.active).toBe("b");
    connections = withoutConnection(connections, "b");
    expect(connections.active).toBeNull();
    expect(connections.list.map((c) => c.id)).toEqual(["a"]);
  });

  it("carries over the single connection of before", () => {
    localStorage.setItem(
      "lifeui.remoteModel",
      JSON.stringify({
        provider: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: "sk-old",
        model: "gpt-4o-mini",
        context: 16384,
      })
    );
    const carried = savedConnections();
    expect(carried.list).toHaveLength(1);
    expect(carried.list[0]).toMatchObject({
      provider: "openai",
      apiKey: "sk-old",
      label: "OpenAI",
    });
    expect(carried.active).toBe(carried.list[0].id);
  });

  it("makes ids that differ", () => {
    expect(newConnectionId()).not.toBe(newConnectionId());
  });
});
