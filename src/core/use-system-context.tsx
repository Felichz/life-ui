import { useContext } from "react";

import type { SystemState } from "./types";

import { SystemContext } from ".";

type SystemAPI = {
  updateBoards: (boards: SystemState["boards"]) => void;
  updateActivities: (activities: SystemState["activities"]) => void;
  updateSelectedActivity: (activity: SystemState["selectedActivity"]) => void;
  updateDayStartMinute: (minute: SystemState["dayStartMinute"]) => void;
  updateLifecycleState: (state: SystemState["lifecycleState"]) => void;
  updateTempoHistory: (tempoHistory: SystemState["tempoHistory"]) => void;
  updateTotalTempoBalance: (totalTempoBalance: SystemState["totalTempoBalance"]) => void;
  updateDayTempoBalance: (dayTempoBalance: SystemState["dayTempoBalance"]) => void;
};

export function useSystemContext(): SystemState & SystemAPI {
  const { state, setState } = useContext(SystemContext);

  const updateBoards = (boards: SystemState["boards"]) => {
    setState({ ...state, boards });
  };

  const updateActivities = (activities: SystemState["activities"]) => {
    setState({ ...state, activities });
  };

  const updateSelectedActivity = (activity: SystemState["selectedActivity"]) => {
    setState({ ...state, selectedActivity: activity });
  };

  const updateDayStartMinute = (minute: SystemState["dayStartMinute"]) => {
    setState({ ...state, dayStartMinute: minute });
  };

  const updateLifecycleState = (lifecycleState: SystemState["lifecycleState"]) => {
    setState({ ...state, lifecycleState });
  };

  const updateTempoHistory = (tempoHistory: SystemState["tempoHistory"]) => {
    setState({ ...state, tempoHistory });
  };

  const updateTotalTempoBalance = (totalTempoBalance: SystemState["totalTempoBalance"]) => {
    setState({ ...state, totalTempoBalance });
  };

  const updateDayTempoBalance = (dayTempoBalance: SystemState["dayTempoBalance"]) => {
    setState({ ...state, dayTempoBalance });
  };

  return {
    ...state,
    updateBoards,
    updateActivities,
    updateSelectedActivity,
    updateDayStartMinute,
    updateLifecycleState,
    updateTempoHistory,
    updateTotalTempoBalance,
    updateDayTempoBalance,
  };
}
