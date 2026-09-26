import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { SystemCore } from "../../system";
import type { AppState, ISystemCore } from "../../types";
import { t } from "../i18n";

interface SystemContextValue {
  core: ISystemCore;
  state: AppState;
}

const SystemContext = createContext<SystemContextValue | null>(null);

/**
 * Expone el core y su estado. La UI lee `state` para renderizar y llama a
 * `core.*` para cualquier cambio; el core notifica y el estado se refresca.
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
    // Solo en local: acceso al core desde la consola para depurar
    if (window.location.hostname === "localhost")
      (window as unknown as { __lifeui?: ISystemCore }).__lifeui = core;
    return core.onStateChange(setState);
  }, [core]);

  const value = useMemo(() => ({ core, state }), [core, state]);
  return <SystemContext.Provider value={value}>{children}</SystemContext.Provider>;
}

export function useSystem(): SystemContextValue {
  const context = useContext(SystemContext);
  if (!context) throw new Error("useSystem debe usarse dentro de <SystemProvider>");
  return context;
}

export function errorMessage(error: unknown, fallback = t("error.generic")): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
