import { useEffect } from "react";

import type { UiStateContextValue } from "src/ui/system-context/UiStateContext";
import { systemAPI } from "./systemAPI";
import type { Board, InvestedTimeRecord } from "./types";

/**
 * @param systemState - El estado del sistema que se mantiene en la ui, se mantiene en el SystemContext, sincronizado con el SystemAPI
 * @param systemAPI - La api para interacutar con la base de datos o local storage, persistencia
 * @param persistedState - El estado del sistema que se mantiene en la base de datos o local storage
 */
type SystemEngineProps = UiStateContextValue;

/**
 * Se encarga de ejecutar la lógica core del sistema y lógica de negocio
 */
export const useSystemEngine = ({ uiState, setUiState }: SystemEngineProps) => {
  // Esto podria ser una funcion async si se usa una base de datos en lugar de local storage
  useEffect(() => {
    const persistedState = systemAPI.getPersistedState();

    const boards = Object.values(persistedState.boards);
    const activities = Object.values(persistedState.activities);

    setUiState((currentUiState) => ({
      ...currentUiState,
      totalTempoBalance: persistedState.totalTempoBalance,
      investedTimeHistory: persistedState.investedTimeHistory,
      dayStartMinute: persistedState.dayStartMinute,
      lifecycleState: persistedState.lifecycleState,
      selectedActivity: persistedState.selectedActivity,
      boards,
      activities,
      usefulMetrics: persistedState.usefulMetrics,
      systemParams: persistedState.systemParams,
    }));
  }, []);

  // Usado tanto para actividades completadas como para multas y para consumos pasivos
  const updateTempoBalance = ({
    tempoModification,
    minutes,
    reason,
  }: Pick<InvestedTimeRecord, "tempoModification" | "minutes" | "reason">) => {
    systemAPI.updateTotalTempoBalance({
      amount: systemAPI.getTotalTempoBalance() + tempoModification,
      investedTimeRecord: {
        minutes,
        reason,
        tempoModification,
        timestamp: new Date().getTime(),
      },
    });

    setUiState((currentState) => ({
      ...currentState,
      dayTempoBalance: currentState.dayTempoBalance + tempoModification,
    }));
  };

  // Ejecuta la lógica de evaluación base cada un minuto
  // En caso de no tener ninguna actividad seleccionada, se aplica el consumo default y se actualiza InvestedTimeHistory
  useEffect(() => {
    const interval = setInterval(() => {
      // Evaluar el estado del sistema
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const onCreateBoard = (board: Board) => {
    systemAPI.createBoard(board);
  };
};
