import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SystemCore, isCoreError, type CoreErrorCode } from "../../system";
import type { AppState, ISystemCore } from "../../types";
import { t, type MessageKey } from "../i18n";

interface SystemContextValue {
  core: ISystemCore;
  state: AppState;
}

const SystemContext = createContext<SystemContextValue | null>(null);

/**
 * Exposes the core and its state. The UI reads `state` to render and calls
 * `core.*` for any change; the core notifies and the state refreshes.
 */
export function SystemProvider({
  children,
  core: injected,
}: {
  children: ReactNode;
  core?: ISystemCore;
}) {
  const [core] = useState<ISystemCore>(() => injected ?? new SystemCore());
  const [state, setState] = useState<AppState>(() => core.getState());

  useEffect(() => {
    setState(core.getState());
    // Local only: access the core from the console for debugging
    if (window.location.hostname === "localhost")
      (window as unknown as { __lifeui?: ISystemCore }).__lifeui = core;
    return core.onStateChange(setState);
  }, [core]);

  const value = useMemo(() => ({ core, state }), [core, state]);
  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem(): SystemContextValue {
  const context = useContext(SystemContext);
  if (!context) throw new Error("useSystem must be used inside <SystemProvider>");
  return context;
}

/** One user-facing message per core error code; TypeScript flags a missing one. */
const CORE_ERROR_KEYS: Record<CoreErrorCode, MessageKey> = {
  "no-active-day": "coreError.no-active-day",
  "day-already-active": "coreError.day-already-active",
  "activity-template-not-found": "coreError.activity-template-not-found",
  "activity-template-in-use": "coreError.activity-template-in-use",
  "activity-instance-not-found": "coreError.activity-instance-not-found",
  "activity-is-active": "coreError.activity-is-active",
  "activity-already-running": "coreError.activity-already-running",
  "not-the-active-activity": "coreError.not-the-active-activity",
  "invalid-state-change": "coreError.invalid-state-change",
  "invalid-satisfaction-score": "coreError.invalid-satisfaction-score",
  "event-template-not-found": "coreError.event-template-not-found",
  "event-template-in-use": "coreError.event-template-in-use",
  "block-name-empty": "coreError.block-name-empty",
  "minutes-out-of-range": "coreError.minutes-out-of-range",
  "block-start-after-end": "coreError.block-start-after-end",
  "block-overlap": "coreError.block-overlap",
  "block-not-found": "coreError.block-not-found",
  "default-block-protected": "coreError.default-block-protected",
  "invalid-daily-target": "coreError.invalid-daily-target",
  "invalid-minutes": "coreError.invalid-minutes",
  "invalid-time-format": "coreError.invalid-time-format",
  "invalid-state-json": "coreError.invalid-state-json",
  "invalid-state-shape": "coreError.invalid-state-shape",
  internal: "coreError.internal",
};

/**
 * Localized message for anything the core (or the UI around it) throws.
 * Core errors are translated by `code`; anything else is unexpected and gets
 * the fallback instead of leaking a technical message to the user.
 */
export function errorMessage(error: unknown, fallback = t("error.generic")): string {
  if (isCoreError(error)) return t(CORE_ERROR_KEYS[error.code]);
  if (error instanceof Error) console.error(error);
  return fallback;
}
