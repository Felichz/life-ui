import { setStateStorage } from "../../system/stateStorage";

/**
 * The desktop build runs inside Tauri (ADR-003). The same frontend also builds
 * for the web, where none of this exists: every desktop call checks first.
 */
export function isDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: call } = await import("@tauri-apps/api/core");
  return call<T>(command, args);
}

/** fetch that runs in Rust: no CORS for local runtimes or cloud providers. */
export async function desktopFetch(input: string, init?: RequestInit): Promise<Response> {
  // The dev stand-in for the shell has no Rust side: the browser's fetch answers
  if (
    (window as unknown as { __TAURI_INTERNALS__?: { mock?: boolean } }).__TAURI_INTERNALS__?.mock
  ) {
    return fetch(input, init);
  }
  const { fetch: rustFetch } = await import("@tauri-apps/plugin-http");
  return rustFetch(input, init);
}

/**
 * Moves the persisted state to a file in the app's data folder. The file is
 * read once before the core starts; afterwards the core reads the in-memory
 * copy and every save is written through to the file (coalesced, in order).
 */
export async function enableFileStorage(): Promise<void> {
  let memory = new Map<string, string>();
  const saved = await invoke<string | null>("read_state");
  // The core's single key is the only thing stored in the file
  let key: string | null = null;
  let pending: string | null = null;
  let writing: Promise<void> | null = null;

  const flush = async () => {
    while (pending !== null) {
      const json = pending;
      pending = null;
      try {
        await invoke("write_state", { json });
      } catch (error) {
        console.error("Could not write the state file", error);
      }
    }
    writing = null;
  };

  setStateStorage({
    getItem: (name) => {
      if (key === null && saved !== null) {
        key = name;
        memory = new Map([[name, saved]]);
      }
      return memory.get(name) ?? null;
    },
    setItem: (name, value) => {
      key = name;
      memory.set(name, value);
      pending = value;
      writing ??= flush();
    },
    removeItem: (name) => {
      memory.delete(name);
      pending = null;
      void invoke("clear_state").catch((error) =>
        console.error("Could not clear the state file", error)
      );
    },
  });
}
