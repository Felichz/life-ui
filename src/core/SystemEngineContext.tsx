import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import { systemApi } from "./SystemAPI";
import type { UiState } from "./types";
import { useSystemEngine } from "./useSystemEngine";

const SystemEngineContext = createContext<ReturnType<typeof useSystemEngine> | null>(null);

export const SystemEngineProvider = ({
  children,
  uiState,
  setUiState,
}: {
  children: ReactNode;
  uiState: UiState;
  setUiState: (state: UiState | ((currentState: UiState) => UiState)) => void;
}) => {
  const systemEngine = useSystemEngine({
    uiState,
    setUiState,
    systemApi,
  });

  return (
    <SystemEngineContext.Provider value={systemEngine}>{children}</SystemEngineContext.Provider>
  );
};

export const useSystemEngineContext = () => {
  const context = useContext(SystemEngineContext);
  if (!context) {
    throw new Error("useSystemEngineContext debe ser usado dentro de SystemEngineProvider");
  }
  return context;
};
