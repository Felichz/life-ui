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
import { Agent, type ChatFn, type ChatStore, type Mode, type SavedChat } from "./agent";
import { chat, type ModelEndpoint } from "./llm";
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

const CHAT_KEY = "lifeui.chat";

/** The conversation survives a reload or closing the app; a pending question does not. */
const chatStore: ChatStore = {
  load() {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as SavedChat;
      if (!Array.isArray(saved.entries) || !Array.isArray(saved.history)) return null;
      return {
        history: saved.history,
        entries: saved.entries.map((entry) =>
          entry.kind === "tool" && (entry.status === "pending" || entry.status === "running")
            ? { ...entry, status: "rejected" }
            : entry
        ),
      };
    } catch {
      return null;
    }
  },
  save(chat) {
    try {
      localStorage.setItem(CHAT_KEY, JSON.stringify(chat));
    } catch {
      // the conversation is kept for this session only
    }
  },
};

const AgentContext = createContext<{ agent: Agent; available: boolean } | null>(null);

/** One agent per core, talking to whichever model is loaded (ADR-002). */
export function AgentProvider({
  children,
  chat: injected,
}: {
  children: ReactNode;
  chat?: ChatFn;
}) {
  const { core } = useSystem();
  const { endpoint: loaded } = useModel();
  const endpoint = useMemo(() => loaded ?? devEndpoint(), [loaded]);
  const endpointRef = useRef(endpoint);
  endpointRef.current = endpoint;

  const agent = useMemo(() => {
    const created = new Agent({
      core,
      prompt,
      language: getLocale,
      // Tests inject their own model and start from an empty conversation
      store: injected ? undefined : chatStore,
      chat: (messages, tools, signal) => {
        if (injected) return injected(messages, tools, signal);
        const current = endpointRef.current;
        if (!current) throw new Error("no-model");
        return chat(current, messages, tools, signal);
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
    () => ({ agent, available: Boolean(injected || endpoint) }),
    [agent, injected, endpoint]
  );
  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (!context) throw new Error("useAgent must be used inside <AgentProvider>");
  const { agent, available } = context;
  const version = useSyncExternalStore(
    (listener) => agent.subscribe(listener),
    () => agent.entries
  );
  return {
    agent,
    entries: version,
    busy: agent.busy,
    mode: agent.mode as Mode,
    available,
  };
}
