import { invoke, isDesktop } from "./desktop";

/**
 * Updates of the desktop app (ADR-014). The app asks once whether it may
 * update itself; with a yes it looks for a new version when it opens and
 * installs it, and while it runs it only says one is ready. The answer can be
 * changed in Settings. Every update is checked against the app's public key
 * before it is installed. A portable copy is never updated in place.
 */

export type AutoUpdate = "on" | "off";

const KEY = "lifeui.autoUpdate";
const listeners = new Set<() => void>();

/** The person's answer, or null while they have not been asked. */
export function getAutoUpdate(): AutoUpdate | null {
  try {
    const saved = localStorage.getItem(KEY);
    return saved === "on" || saved === "off" ? saved : null;
  } catch {
    return null;
  }
}

export function setAutoUpdate(value: AutoUpdate): void {
  try {
    localStorage.setItem(KEY, value);
  } catch {
    // kept for this session only
  }
  listeners.forEach((listener) => listener());
}

export function onAutoUpdate(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The dev stand-in for the shell has no Rust side, and nothing to update. */
function realShell(): boolean {
  return (
    isDesktop() &&
    !(window as unknown as { __TAURI_INTERNALS__?: { mock?: boolean } }).__TAURI_INTERNALS__?.mock
  );
}

/** Whether this copy can update itself: the installed desktop app, not the portable one. */
export async function canUpdate(): Promise<boolean> {
  if (!realShell()) return false;
  try {
    return !(await invoke<boolean>("is_portable"));
  } catch {
    return false;
  }
}

export async function appVersion(): Promise<string | null> {
  if (!realShell()) return null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}

/** A new version, ready to install. */
export interface Available {
  version: string;
  install: (onProgress?: (share: number) => void) => Promise<void>;
}

/** Looks for a new version on the latest release. Null when this one is the latest. */
export async function findUpdate(): Promise<Available | null> {
  if (!realShell()) return null;
  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();
  if (!update) return null;
  return {
    version: update.version,
    install: async (onProgress) => {
      let total = 0;
      let done = 0;
      await update.downloadAndInstall((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") {
          done += event.data.chunkLength;
          if (total > 0) onProgress?.(Math.min(1, done / total));
        }
      });
      // On Windows the installer closes the app itself; elsewhere it starts again here
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    },
  };
}
