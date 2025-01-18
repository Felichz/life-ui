import { useCallback, useEffect } from "react";

import type { UiStateContextValue } from "src/ui/system-context/UiStateContext";

import { systemAPI } from "./systemAPI";
import type {
  Activity,
  Board,
  ChallengeActivity,
  InvestedTimeRecord,
  TempoModificationRecord,
} from "./types";

/**
 * @param systemState - El estado del sistema que se mantiene en la ui, se mantiene en el SystemContext, sincronizado con el SystemAPI
 * @param systemAPI - La api para interacutar con la base de datos o local storage, persistencia
 * @param persistedState - El estado del sistema que se mantiene en la base de datos o local storage
 */
type SystemEngineProps = UiStateContextValue;

/**
 * Este hook gestiona la lógica del sistema.
 * - Expone SOLO las acciones que la UI (usuario) necesita (crear board, completar challenge, etc.).
 * - Mantiene internas las funciones que corren en el loop 1-min o que no son disparadas por el usuario directamente.
 */
export const useSystemEngine = ({ uiState, setUiState }: SystemEngineProps) => {
  /**
   * PRIMER BLOQUE: Efectos de inicialización y sincronización
   */
  useEffect(() => {
    // Al montar el hook, sincronizamos la UI con el estado persistido
    const persistedState = systemAPI.getPersistedState();
    const boards = Object.values(persistedState.boards);
    const activities = Object.values(persistedState.activities);

    setUiState((currentUiState) => ({
      ...currentUiState,
      ...persistedState.currentDay,
      lifecycleState: persistedState.lifecycleState,
      totalTempoBalance: persistedState.totalTempoBalance,
      investedTimeHistory: persistedState.investedTimeHistory,
      selectedActivity: persistedState.selectedActivity,
      boards,
      activities,
      usefulMetrics: persistedState.usefulMetrics,
      systemParams: persistedState.systemParams,
    }));
  }, []);

  // Ejecuta la lógica de evaluación base cada un minuto
  // En caso de no tener ninguna actividad seleccionada, se aplica el consumo default y se actualiza InvestedTimeHistory
  // En caso de tener una actividad seleccionada, se aplica el consumo de la actividad y se actualiza InvestedTimeHistory.
  // Para actualizar el InvestedTimeHistory se debe analizar si el ultimo registro es de la misma actividad, si es así,
  // se suma el tiempo, si no, se crea un nuevo registro.
  useEffect(() => {
    const interval = setInterval(() => {
      const currentActivity = uiState.selectedActivity;

      // Si no hay actividad seleccionada, aplicamos consumo pasivo
      if (!currentActivity) {
        _applyIdlePassiveConsumption();

        _syncUiStateFromPersisted();

        return;
      }

      // Lógica según el tipo de actividad
      switch (currentActivity.type) {
        case "challenge": {
          _applyChallengeMinuteGeneration(currentActivity);
          break;
        }
        case "neutral": {
          _applyNeutralTimeRecord(currentActivity);
          break;
        }
        case "discount": {
          _applyDiscountedConsumption(currentActivity, 1);
          break;
        }
      }

      // Actualizar minutesActive de la actividad
      systemAPI.updateActivity({
        ...currentActivity,
        minutesActive: currentActivity.minutesActive + 1,
      });

      _syncUiStateFromPersisted();
    }, 60000);

    return () => clearInterval(interval);
  }, [uiState.selectedActivity, uiState.systemParams]);

  /**
   * Función privada para re-sincronizar el UiState tras cada modificación en systemAPI.
   */
  const _syncUiStateFromPersisted = useCallback(() => {
    const persistedState = systemAPI.getPersistedState();

    setUiState((current) => ({
      ...current,
      lifecycleState: persistedState.lifecycleState,
      currentDay: persistedState.currentDay,
      totalTempoBalance: persistedState.totalTempoBalance,
      investedTimeHistory: persistedState.investedTimeHistory,
      selectedActivity: persistedState.selectedActivity,
      boards: Object.values(persistedState.boards),
      activities: Object.values(persistedState.activities),
      usefulMetrics: persistedState.usefulMetrics,
      systemParams: persistedState.systemParams,
    }));
  }, [setUiState]);

  /**
   * SEGUNDO BLOQUE: LÓGICA PRIVADA (core) - NO se expone
   * Estas funciones podrían llamarse en un setInterval (bucle de 1 minuto) o en otras partes
   * internas del sistema. Ejemplo: aplicar consumos pasivos, generar tempo, etc.
   */
  const _applyChallengeMinuteGeneration = useCallback((activity: ChallengeActivity) => {
    const now = Date.now();
    const isWithinEstimatedTime = activity.minutesActive < activity.totalTempoReward;

    // Si estamos dentro del tiempo estimado, generamos tempo
    if (isWithinEstimatedTime) {
      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: now,
        tempoModification: 1,
        minutesInvested: 1,
      };

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: now,
        reason: "challengeMinuteGeneration",
        tempoModification: 1,
      };

      systemAPI.updateTempoBalance({
        investedTimeRecord,
        tempoModificationRecord,
      });
    } else {
      // Si excedimos el tiempo estimado, aplicamos consumo pasivo
      _applyIdlePassiveConsumption();
    }
  }, []);

  const _applyNeutralTimeRecord = useCallback((activity: Activity) => {
    const now = Date.now();

    const investedTimeRecord: InvestedTimeRecord = {
      status: "activity",
      activityId: activity.id,
      type: "neutral",
      timestamp: now,
      tempoModification: 0,
      minutesInvested: 1,
    };

    systemAPI.pushToInvestedTimeHistory(investedTimeRecord);
  }, []);

  const _applyDiscountedConsumption = useCallback((activity: Activity, minutes: number) => {
    if (activity.type !== "discount") return;

    const now = Date.now();
    const discountedConsumption = -activity.tempoConsumptionRate * minutes;

    const investedTimeRecord: InvestedTimeRecord = {
      status: "activity",
      activityId: activity.id,
      type: "discount",
      timestamp: now,
      tempoModification: discountedConsumption,
      minutesInvested: minutes,
    };

    const tempoModificationRecord: TempoModificationRecord = {
      status: "activity",
      activityId: activity.id,
      type: "discount",
      timestamp: now,
      reason: "discountedPassiveConsumption",
      tempoModification: discountedConsumption,
    };

    systemAPI.updateTempoBalance({
      investedTimeRecord,
      tempoModificationRecord,
    });
  }, []);

  const _applyIdlePassiveConsumption = useCallback(() => {
    const now = Date.now();

    const passiveConsumption = 0 - systemAPI.getSystemParams().passiveTempoConsumptionRate;

    const investedTimeRecord: InvestedTimeRecord = {
      status: "idle",
      timestamp: now,
      tempoModification: passiveConsumption,
      minutesInvested: 1,
    };

    const tempoModificationRecord: TempoModificationRecord = {
      status: "idle",
      timestamp: now,
      reason: "passiveConsumption",
      tempoModification: passiveConsumption,
    };

    systemAPI.updateTempoBalance({
      investedTimeRecord,
      tempoModificationRecord,
    });
  }, [uiState.systemParams]);

  const _applyNeutralActivityEarlyCompletionCompensation = (
    activity: Activity,
    compensation: number
  ) => {
    // Lógica reason="earlyNeutralActivityCompletionCompensation"
    // Debe calcular una compensacion en tempos segun el tiempo que faltaba para completar la actividad
  };

  const _applyDiscountActivityEarlyCompletionCompensation = (
    activity: Activity,
    compensation: number
  ) => {
    // Lógica reason="earlyCompletionCompensation"
    // Debe calcular una compensacion en tempos segun el tiempo que faltaba para completar la actividad y su descuento por minuto
  };

  const _applyChallengeCriteriaFailed = (activity: Activity, penaltyAmount: number) => {
    // Lógica reason="challengeCriteriaFailed"
    // ...
  };

  // etc. (Otras funciones "privadas" para la lógica core minuto a minuto o cálculos internos)

  /**
   * TERCER BLOQUE: LÓGICA PÚBLICA - ACCIONES DEL USUARIO
   * Este es el set de métodos que SÍ retornaremos. Tienen sentido en la UI.
   */

  // ===========================
  //     ACCIONES: Día
  // ===========================
  const startDay = () => {
    /**
     * 1. Crear un nuevo dayState (p.ej., con date=now, dayStartMinute=0, dayTempoBalance=0).
     * 2. systemAPI.startDay(...)
     * 3. _syncUiStateFromPersisted()
     */
  };

  const endDay = () => {
    /**
     * 1. systemAPI.endDay()
     * 2. _syncUiStateFromPersisted()
     */
  };

  // ===========================
  //   ACCIONES: Boards
  // ===========================
  const createBoard = (board: Board) => {
    /**
     * 1. systemAPI.createBoard(board)
     * 2. _syncUiStateFromPersisted()
     */
  };

  const updateBoard = (board: Board) => {
    /**
     * 1. systemAPI.updateBoard(board)
     * 2. _syncUiStateFromPersisted()
     */
  };

  const removeBoard = (board: Board) => {
    /**
     * 1. systemAPI.removeBoard(board)
     * 2. _syncUiStateFromPersisted()
     */
  };

  // ===========================
  //   ACCIONES: Activities
  // ===========================
  const createActivity = (activity: Activity) => {
    /**
     * 1. systemAPI.createActivity(activity)
     * 2. _syncUiStateFromPersisted()
     */
  };

  const updateActivity = (activity: Activity) => {
    /**
     * 1. systemAPI.updateActivity(activity)
     * 2. _syncUiStateFromPersisted()
     */
  };

  const removeActivity = (activity: Activity) => {
    /**
     * 1. systemAPI.removeActivity(activity)
     * 2. _syncUiStateFromPersisted()
     */
  };

  /**
   * Seleccionar o quitar selección de actividad:
   */
  const selectActivity = (activity: Activity) => {
    /**
     * 1. systemAPI.setSelectedActivity(activity)
     * 2. _syncUiStateFromPersisted()
     */
  };

  const unselectActivity = () => {
    /**
     * 1. systemAPI.setSelectedActivity(undefined)
     * 2. _syncUiStateFromPersisted()
     */
  };

  /**
   * Completar un challenge manualmente (acción del usuario).
   * Por ejemplo, aplicamos la recompensa (reason="challengeCompletionReward").
   */
  const completeChallenge = (activity: Activity, reward: number) => {
    /**
     * Lógica:
     * 1. Construir tempoModificationRecord con reason="challengeCompletionReward", tempoModification=reward, status="activity", ...
     * 2. systemAPI.updateTempoBalance({ tempoModificationRecord, ... })
     * 3. Mark activity as "completed" => systemAPI.updateActivity({ ... })
     * 4. Des-seleccionar la actividad => systemAPI.setSelectedActivity(undefined)
     * 5. _syncUiStateFromPersisted()
     */
  };

  // ===========================
  // DEVOLVEMOS SOLO LAS FUNCIONES "PÚBLICAS"
  // ===========================
  return {
    // DÍA
    day: {
      startDay,
      endDay,
    },
    // BOARDS
    board: {
      createBoard,
      updateBoard,
      removeBoard,
    },
    // ACTIVITIES
    activity: {
      createActivity,
      updateActivity,
      removeActivity,
      selectActivity,
      unselectActivity,
      completeChallenge,
      // ... otras si la UI las necesita
    },
    // NO exponemos "tempo" con applyChallengeMinuteGeneration, etc.
    // porque esas funciones son internas al bucle de 1 min o a la lógica core
    // y no se llaman directamente desde la UI.
  };
};
