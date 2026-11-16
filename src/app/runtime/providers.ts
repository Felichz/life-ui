import type { ModelEndpoint } from "../agent/llm";
import { desktopFetch, isDesktop } from "../platform/desktop";

/**
 * Models through an API (ADR-005): the providers that speak the chat
 * completions API with tools. Each one was checked to accept requests from a
 * browser (CORS), so the web build talks to it directly: the key and the
 * conversation go from the browser to the provider and nowhere else.
 */
export interface Provider {
  id: string;
  name: string;
  /** Empty for the custom endpoint, where the person writes it. */
  baseUrl: string;
  /** Where to get a key. */
  keyUrl?: string;
  /** Headers the provider needs besides the key. */
  headers?: Record<string, string>;
  /** The key can be left out (a local server). */
  keyOptional?: boolean;
}

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "anthropic",
    name: "Anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    keyUrl: "https://console.anthropic.com/settings/keys",
    // Anthropic answers a browser only when it says it knows the key is in the browser
    headers: { "anthropic-dangerous-direct-browser-access": "true" },
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    keyUrl: "https://console.groq.com/keys",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    keyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    keyUrl: "https://console.mistral.ai/api-keys",
  },
  { id: "xai", name: "xAI", baseUrl: "https://api.x.ai/v1", keyUrl: "https://console.x.ai" },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    keyUrl: "https://api.together.ai/settings/api-keys",
  },
  {
    id: "fireworks",
    name: "Fireworks AI",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    keyUrl: "https://fireworks.ai/account/api-keys",
  },
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    keyUrl: "https://cloud.cerebras.ai",
  },
  {
    id: "minimax",
    name: "MiniMax",
    baseUrl: "https://api.minimax.io/v1",
    keyUrl: "https://platform.minimax.io",
  },
  { id: "custom", name: "", baseUrl: "", keyOptional: true },
];

export const providerById = (id: string) => PROVIDERS.find((one) => one.id === id);

/** A model through an API, as it is kept between launches. */
export interface RemoteModel {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Tokens of the conversation the model reads in each message. */
  context: number;
}

/** What a message may hold: more is more tokens, and more cost, on every message. */
export const REMOTE_CONTEXTS = [16384, 32768, 65536, 131072];
export const DEFAULT_REMOTE_CONTEXT = 32768;

const KEY = "lifeui.remoteModel";

export function savedRemote(): RemoteModel | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<RemoteModel>;
    if (!saved.provider || !saved.baseUrl || !saved.model) return null;
    return {
      provider: saved.provider,
      baseUrl: saved.baseUrl,
      apiKey: saved.apiKey ?? "",
      model: saved.model,
      context: saved.context ?? DEFAULT_REMOTE_CONTEXT,
    };
  } catch {
    return null;
  }
}

export function saveRemote(remote: RemoteModel | null) {
  try {
    if (remote) localStorage.setItem(KEY, JSON.stringify(remote));
    else localStorage.removeItem(KEY);
  } catch {
    // storage is off in this browser: the choice lasts until the page closes
  }
}

/** The name shown for a remote model's provider: the custom one shows its host. */
export function providerName(remote: Pick<RemoteModel, "provider" | "baseUrl">): string {
  const known = providerById(remote.provider);
  if (known?.name) return known.name;
  try {
    return new URL(remote.baseUrl).host;
  } catch {
    return remote.baseUrl;
  }
}

export function remoteEndpoint(remote: RemoteModel): ModelEndpoint {
  const headers = providerById(remote.provider)?.headers;
  return {
    baseUrl: remote.baseUrl,
    model: remote.model,
    context: remote.context,
    hosted: true,
    ...(remote.apiKey ? { apiKey: remote.apiKey } : {}),
    ...(headers ? { headers } : {}),
  };
}

const send = (url: string, init: RequestInit) =>
  isDesktop() ? desktopFetch(url, init) : fetch(url, init);

const headersFor = (provider: string, apiKey: string): Record<string, string> => ({
  ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  ...providerById(provider)?.headers,
});

export interface RemoteModelInfo {
  id: string;
  /** Tokens of context, when the provider says. */
  context?: number;
  /** Whether the provider says the model takes tools; unknown when it does not say. */
  tools?: boolean;
}

/** The provider's models, when it lists them (GET /models). */
export async function listRemoteModels(
  provider: string,
  baseUrl: string,
  apiKey: string,
  signal?: AbortSignal
): Promise<RemoteModelInfo[]> {
  const response = await send(`${baseUrl.replace(/\/$/, "")}/models`, {
    headers: headersFor(provider, apiKey),
    signal,
  });
  if (!response.ok) throw new Error(await problem(response));
  const body = (await response.json()) as { data?: unknown; models?: unknown };
  const list = Array.isArray(body.data) ? body.data : Array.isArray(body.models) ? body.models : [];
  return list
    .map((raw): RemoteModelInfo | null => {
      if (!raw || typeof raw !== "object") return null;
      const one = raw as Record<string, unknown>;
      const id = typeof one.id === "string" ? one.id : typeof one.name === "string" ? one.name : "";
      if (!id) return null;
      const context = [one.context_length, one.context_window, one.max_context_length].find(
        (value): value is number => typeof value === "number" && value > 0
      );
      const parameters = Array.isArray(one.supported_parameters) ? one.supported_parameters : null;
      return {
        // Gemini names its models "models/gemini-…": the chat call takes them without the prefix
        id: id.replace(/^models\//, ""),
        ...(context ? { context } : {}),
        ...(parameters ? { tools: parameters.includes("tools") } : {}),
      };
    })
    .filter((one): one is RemoteModelInfo => one !== null)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * One short request before the choice is kept: a wrong key, a model name with
 * a typo or a provider that refuses the browser shows here, not in the chat.
 */
export async function testRemote(remote: RemoteModel, signal?: AbortSignal): Promise<void> {
  const ask = (limit: Record<string, number>) =>
    send(`${remote.baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headersFor(remote.provider, remote.apiKey),
      },
      body: JSON.stringify({
        model: remote.model,
        messages: [{ role: "user", content: "Say OK." }],
        ...limit,
      }),
      signal,
    });
  // A refused connection and a provider that does not answer browsers look the same from here
  let response = await ask({ max_tokens: 16 });
  if (response.status === 400 && /max_tokens/.test(await response.clone().text())) {
    // OpenAI's reasoning models take the limit under another name, and think before the "OK"
    response = await ask({ max_completion_tokens: 512 });
  }
  if (!response.ok) throw new Error(await problem(response));
}

/** The provider's own words for an error, short. */
async function problem(response: Response): Promise<string> {
  let detail = "";
  try {
    const text = await response.text();
    try {
      const body = JSON.parse(text) as { error?: { message?: string } | string; message?: string };
      detail =
        (typeof body.error === "string" ? body.error : body.error?.message) ?? body.message ?? text;
    } catch {
      detail = text;
    }
  } catch {
    // no body
  }
  return `${response.status}${detail ? ` · ${detail.trim().slice(0, 200)}` : ""}`;
}
