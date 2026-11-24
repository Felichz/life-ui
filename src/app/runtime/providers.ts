import type { ModelEndpoint } from "../agent/llm";
import { desktopFetch, invoke, isDesktop } from "../platform/desktop";
import { providerById } from "./catalog";

export { GROUP_ORDER, PROVIDERS, offeredProviders, providerById } from "./catalog";
export type { Provider, ProviderGroup } from "./catalog";

/**
 * Models through an API (ADR-005): the providers that speak the chat
 * completions API with tools (catalog.ts). A person keeps several connections
 * and one is in use: the key and the conversation go from this app to the
 * provider of the one in use and nowhere else.
 */

/** A connection to a model through an API, as it is kept between launches. */
export interface RemoteModel {
  id: string;
  /** How the person sees it in the list. */
  label: string;
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

/** The connections kept, and the one in use (null: none, or a local model). */
export interface Connections {
  active: string | null;
  list: RemoteModel[];
}

export const NO_CONNECTIONS: Connections = { active: null, list: [] };

const KEY = "lifeui.connections";
/** The single connection kept before there could be several. */
const LEGACY_KEY = "lifeui.remoteModel";
const LEGACY_ID = "c-first";
/** Where the desktop app kept that one's key in the credential store. */
const LEGACY_SECRET = "remote-api-key";

/** The desktop app with its Rust side (not the dev stand-in, which has none). */
function keyStore(): boolean {
  return (
    isDesktop() &&
    !(window as unknown as { __TAURI_INTERNALS__?: { mock?: boolean } }).__TAURI_INTERNALS__?.mock
  );
}

const secretName = (id: string) => `conn-${id}`;

export function newConnectionId(): string {
  return `c-${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

/** What the person calls a connection when they gave no name: its provider, or its host. */
export function providerName(remote: Pick<RemoteModel, "provider" | "baseUrl">): string {
  const known = providerById(remote.provider);
  if (known?.name) return known.name;
  try {
    return new URL(remote.baseUrl).host;
  } catch {
    return remote.baseUrl;
  }
}

function readOne(raw: unknown, fallbackId: string): RemoteModel | null {
  if (!raw || typeof raw !== "object") return null;
  const saved = raw as Partial<RemoteModel>;
  if (!saved.provider || !saved.baseUrl || !saved.model) return null;
  const connection = {
    id: saved.id || fallbackId,
    label: saved.label ?? "",
    provider: saved.provider,
    baseUrl: saved.baseUrl,
    apiKey: saved.apiKey ?? "",
    model: saved.model,
    context: saved.context ?? DEFAULT_REMOTE_CONTEXT,
  };
  return { ...connection, label: connection.label || providerName(connection) };
}

/**
 * The connections as they are kept. On the web the key is in this browser's
 * storage, with the rest; on the desktop it is not (loadConnections reads it
 * from the credential store). The single connection of before is carried over.
 */
export function savedConnections(): Connections {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const saved = JSON.parse(raw) as { active?: unknown; list?: unknown };
      const list = (Array.isArray(saved.list) ? saved.list : [])
        .map((one, index) => readOne(one, `c-${index}`))
        .filter((one): one is RemoteModel => one !== null);
      const active = typeof saved.active === "string" ? saved.active : null;
      return { active: list.some((one) => one.id === active) ? active : null, list };
    }
    const legacy = readOne(JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "null"), LEGACY_ID);
    if (legacy) return { active: legacy.id, list: [{ ...legacy, id: LEGACY_ID }] };
  } catch {
    // storage is off, or what is in it is not readable: there are no connections
  }
  return NO_CONNECTIONS;
}

/**
 * Keeps the connections. On the desktop each key goes to the operating system's
 * credential store and the stored list keeps everything but the keys.
 */
export function saveConnections(connections: Connections): void {
  const desktop = keyStore();
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify(
        desktop
          ? { ...connections, list: connections.list.map((one) => ({ ...one, apiKey: undefined })) }
          : connections
      )
    );
    localStorage.removeItem(LEGACY_KEY);
  } catch {
    // storage is off in this browser: the choice lasts until the page closes
  }
  if (desktop) {
    for (const one of connections.list) {
      const done = one.apiKey
        ? invoke("secret_set", { name: secretName(one.id), value: one.apiKey })
        : invoke("secret_delete", { name: secretName(one.id) });
      void done.catch(() => undefined);
    }
  }
}

/** The connections with their keys: on the desktop they are read from the credential store. */
export async function loadConnections(): Promise<Connections> {
  const saved = savedConnections();
  if (!keyStore()) return saved;
  const list = await Promise.all(
    saved.list.map(async (one) => {
      if (one.apiKey) return one;
      try {
        const key =
          (await invoke<string | null>("secret_get", { name: secretName(one.id) })) ??
          // 0.3.0 kept its one key under another name
          (one.id === LEGACY_ID
            ? await invoke<string | null>("secret_get", { name: LEGACY_SECRET })
            : null);
        return { ...one, apiKey: key ?? "" };
      } catch {
        return one;
      }
    })
  );
  const loaded = { ...saved, list };
  // A key found under the old name or left in storage moves to its own place
  if (
    list.some((one, index) => one.apiKey && !saved.list[index].apiKey) ||
    localStorage.getItem(LEGACY_KEY)
  ) {
    saveConnections(loaded);
  }
  return loaded;
}

export const activeConnection = (connections: Connections): RemoteModel | null =>
  connections.list.find((one) => one.id === connections.active) ?? null;

/** Adds a connection, or replaces the one with its id; in use from then on when asked. */
export function withConnection(
  connections: Connections,
  connection: RemoteModel,
  activate = true
): Connections {
  const exists = connections.list.some((one) => one.id === connection.id);
  return {
    active: activate ? connection.id : connections.active,
    list: exists
      ? connections.list.map((one) => (one.id === connection.id ? connection : one))
      : [...connections.list, connection],
  };
}

/** Takes a connection out, and its key with it. */
export function withoutConnection(connections: Connections, id: string): Connections {
  if (keyStore()) void invoke("secret_delete", { name: secretName(id) }).catch(() => undefined);
  return {
    active: connections.active === id ? null : connections.active,
    list: connections.list.filter((one) => one.id !== id),
  };
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
      // OpenCode says it as limit.context
      const limit = (one.limit as { context?: unknown } | undefined)?.context;
      const context = [one.context_length, one.context_window, one.max_context_length, limit].find(
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
