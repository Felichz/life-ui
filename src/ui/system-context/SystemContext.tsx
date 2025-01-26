import { createContext, useContext, useState } from "react";

import { systemApi } from "@/core/SystemAPI";
import type { UiState } from "@/core/types";

type SystemContextValue = {
  uiState: UiState;
  setUiState: React.Dispatch<React.SetStateAction<UiState>>;
  systemApi: typeof systemApi;
};

const SystemContext = createContext<SystemContextValue | undefined>(undefined);

export const useSystemContext = () => {
  const context = useContext(SystemContext);
  if (!context) {
    throw new Error("useSystemContext debe usarse dentro de un SystemContextProvider");
  }
  return context;
};

const defaultUiState: UiState = {
  updatingSystemState: false,
  currentDay: undefined,
  lifecycleState: "dayNotStarted",
  totalTempoBalance: 0,
  investedTimeHistory: [],
  tempoModificationHistory: [],
  selectedActivity: undefined,
  boards: [],
  activities: [],
  usefulMetrics: {
    totalGeneratedTemposEver: 0,
    totalMinutesInvested: {
      intrinsicProductivity: 0,
      challenges: 0,
      hobbies: 0,
      rest: 0,
      other: 0,
    },
  },
  systemParams: {
    passiveTempoConsumptionRate: 1,
    isTestMode: false,
  },
};

export const SystemContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [uiState, setUiState] = useState<UiState>(defaultUiState);

  return (
    <SystemContext.Provider
      value={{
        uiState,
        setUiState,
        systemApi,
      }}
    >
      {children}
    </SystemContext.Provider>
  );
};
