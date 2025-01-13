import type { ReactNode } from "react";
import { createContext, useState } from "react";

import type { SystemState } from "./types";

// Estado inicial del sistema
const initialState: SystemState = {
  totalTempoBalance: 0,
  dayTempoBalance: 0,
  tempoHistory: [],
  dayStartMinute: undefined,
  lifecycleState: "dayNotStarted",
  selectedActivity: undefined,
  boards: [],
  activities: [],
};

export const SystemContext = createContext<{
  state: SystemState;
  setState: (state: SystemState) => void;
}>({
  state: initialState,
  setState: () => {},
});

export const SystemProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<SystemState>(initialState);

  return <SystemContext.Provider value={{ state, setState }}>{children}</SystemContext.Provider>;
};
