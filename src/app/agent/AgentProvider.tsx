import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useSystem } from "../state/system";
import { useModel } from "../runtime/ModelGate";
import {
  Agent,
  type ChatFn,
  type ChatStore,
  type Entry,
  type Mode,
  type SavedChat,
  type SavedChats,
} from "./agent";
import { DEFAULT_CONTEXT } from "./context";
import { desktopFetch, isDesktop } from "../platform/desktop";
import { getWebSetting, setWebSetting } from "./web";
import { getReasoning } from "./reasoning";
import { chat, type ChatMessage, type ModelEndpoint } from "./llm";
import prompt from "./prompt";
import { getLocale } from "../i18n";

const MODE_KEY = "lifeui.agentMode";

/**
 * Dev builds only: a model endpoint from localStorage ("lifeui.devModel"), so
 * the browser build and the end-to-end tests can talk to a model (a real one,
 * or Cypress's scripted stand-in) without the desktop shell.
 */
function devEndpoint(): ModelEndpoint | null {
  if (process.env.NODE_ENV === "production") return null;
  try {
    const raw = localStorage.getItem("lifeui.devModel");
    return raw ? (JSON.parse(raw) as ModelEndpoint) : null;
  } catch {
    return null;
  }
}

const CHATS_KEY = "lifeui.chats";
/** The single conversation of earlier versions, read once and moved over. */
const LEGACY_KEY = "lifeui.chat";

/** A change that waited for an answer when the app closed comes back as not done. */
const settle = (entries: Entry[]): Entry[] =>
  entries.map((entry) =>
    entry.kind === "tool" && (entry.status === "pending" || entry.status === "running")
      ? { ...entry, status: "rejected" }
      : entry
  );

/** Images are the heavy part: when storage is full the words are kept without them. */
const withoutImages = (all: SavedChats): SavedChats => ({
  ...all,
  chats: all.chats.map((saved) => ({
    ...saved,
    entries: saved.entries.map((entry) =>
      entry.kind === "user" && entry.attachments
        ? { ...entry, attachments: entry.attachments.map(({ url: _url, ...rest }) => rest) }
        : entry
    ),
    history: saved.history.map(
      (message): ChatMessage =>
        message.role === "user" && Array.isArray(message.content)
          ? {
              role: "user",
              content: message.content
                .map((part) => (part.type === "text" ? part.text : "[image]"))
                .join("\n"),
            }
          : message
    ),
  })),
});

/** The conversations survive a reload or closing the app. */
const chatStore: ChatStore = {
  load() {
    try {
      const raw = localStorage.getItem(CHATS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as SavedChats;
        if (!Array.isArray(saved.chats)) return null;
        return {
          activeId: saved.activeId,
          chats: saved.chats.map((one) => ({ ...one, entries: settle(one.entries) })),
        };
      }
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (!legacy) return null;
      const old = JSON.parse(legacy) as Pick<SavedChat, "entries" | "history">;
      if (!Array.isArray(old.entries) || old.entries.length === 0) return null;
      const first = old.entries.find((entry) => entry.kind === "user");
      const migrated: SavedChat = {
        id: "c-legacy",
        title: first?.kind === "user" ? first.text.slice(0, 60) : "",
        updatedAt: Date.now(),
        entries: settle(old.entries),
        history: old.history,
      };
      return { activeId: migrated.id, chats: [migrated] };
    } catch {
      return null;
    }
  },
  save(all) {
    try {
      localStorage.setItem(CHATS_KEY, JSON.stringify(all));
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      try {
        localStorage.setItem(CHATS_KEY, JSON.stringify(withoutImages(all)));
      } catch {
        // the conversations are kept for this session only
      }
    }
  },
};

const AgentContext = createContext<{ agent: Agent; available: boolean; vision: boolean } | null>(
  null
);

/** One agent per core, talking to whichever model is loaded (ADR-002). */
export function AgentProvider({
  children,
  chat: injected,
}: {
  children: ReactNode;
  chat?: ChatFn;
}) {
  const { core } = useSystem();
  const { endpoint: loaded, model } = useModel();
  const endpoint = useMemo(() => loaded ?? devEndpoint(), [loaded]);
  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;
  // Without the desktop shell nothing says what the model can see: assume it can
  const visionRef = useRef(true);
  visionRef.current = model ? Boolean(model.vision) : true;
  const loadedRef = useRef(false);
  loadedRef.current = Boolean(loaded);

  const agent = useMemo(() => {
    const created = new Agent({
      core,
      prompt,
      language: getLocale,
      context: () => endpointRef.current?.context ?? DEFAULT_CONTEXT,
      vision: () => visionRef.current,
      // A title costs one more call: only a model loaded for real is asked for it
      titles: () => loadedRef.current,
      // The coach's notes cost one more short call: as with titles, only with a real model
      notes: () => loadedRef.current,
      reasoning: getReasoning,
      web: {
        setting: getWebSetting,
        allow: () => setWebSetting("on"),
        // In the desktop app the request leaves from Rust: no CORS in the way
        http: (input, init) =>
          isDesktop() ? desktopFetch(String(input), init) : fetch(input, init),
      },
      // Tests inject their own model and start from an empty conversation
      store: injected ? undefined : chatStore,
      chat: (messages, tools, signal, options) => {
        if (injected) return injected(messages, tools, signal, options);
        const current = endpointRef.current;
        if (!current) throw new Error("no-model");
        return chat(current, messages, tools, signal, options);
      },
    });
    try {
      if (localStorage.getItem(MODE_KEY) === "auto") created.mode = "auto";
    } catch {
      // confirm mode by default
    }
    return created;
  }, [core, injected]);

  useEffect(
    () =>
      agent.subscribe(() => {
        try {
          localStorage.setItem(MODE_KEY, agent.mode);
        } catch {
          // the mode is kept for this session only
        }
      }),
    [agent]
  );

  const value = useMemo(
    () => ({
      agent,
      available: Boolean(injected || endpoint),
      // Without the desktop shell nothing says what the model can see
      vision: Boolean(model?.vision),
    }),
    [agent, injected, endpoint, model]
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) throw new Error("useAgent must be used inside <AgentProvider>");
  const { agent, available, vision } = context;
  const version = useSyncExternalStore(
    (listener) => agent.subscribe(listener),
    () => agent.entries
  );
  return {
    agent,
    entries: version,
    busy: agent.busy,
    mode: agent.mode as Mode,
    compacting: agent.compacting,
    available,
    vision,
  };
}
