import type { ReactNode } from "react";
import { createContext, useState } from "react";

import type { UiState } from "../../core/types";

// Estado inicial del sistema
const initialState: UiState = {
  updatingSystemState: false,
  totalTempoBalance: 0,
  currentDay: undefined,
  investedTimeHistory: [],
  lifecycleState: "dayNotStarted",
  selectedActivity: undefined,
  boards: [],
  activities: [],
  usefulMetrics: {
    totalMinutesInvested: {
      intrinsecProductivity: 0,
      challenges: 0,
      hobbies: 0,
      rest: 0,
      other: 0,
    },
    totalGeneratedTemposEver: 0,
  },
  systemParams: {
    passiveTempoConsumptionRate: 0,
  },
};

export type UiStateContextValue = {
  uiState: UiState;
  setUiState: (state: UiState | ((currentState: UiState) => UiState)) => void;
};

export const UiStateContext = createContext<UiStateContextValue>({
  uiState: initialState,
  setUiState: () => {},
});

export const UiStateProvider = ({ children }: { children: ReactNode }) => {
  const [uiState, setUiState] = useState<UiState>(initialState);

  return (
    <UiStateContext.Provider value={{ uiState, setUiState }}>{children}</UiStateContext.Provider>
  );
};
