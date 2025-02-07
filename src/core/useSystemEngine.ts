import { useCallback, useEffect, useMemo, useRef } from "react";

import { TimeSimulator } from "./TimeSimulator";
import { updateTimeState, evaluateConstraints } from "./timeStateLogic";
import type {
  Activity,
  ActivityId,
  Board,
  BoardId,
  ChallengeActivity,
  HobbyActivity,
  TempoModificationRecord,
  DayState,
  NeutralActivity,
  SystemAPIType,
  UiState,
  CreateBoardInput,
  CreateActivityInput,
  SystemParams,
} from "./types";

import { formatLog } from "@/lib/utils/logger";
import type { UiStateContextValue } from "@/ui/system-context/UiStateContext";

/**
 * @param systemState - El estado del sistema que se mantiene en la ui, se mantiene en el SystemContext, sincronizado con el SystemAPI
 * @param systemApi - La api para interacutar con la base de datos o local storage, persistencia
 * @param persistedState - El estado del sistema que se mantiene en la base de datos o local storage
 */
type SystemEngineProps = {
  uiState: UiState;
  setUiState: UiStateContextValue["setUiState"];
  systemApi: SystemAPIType;
};

let instances = 0;

/**
 * Este hook gestiona la lógica del sistema.
 * - Expone SOLO las acciones que la UI (usuario) necesita (crear board, completar challenge, etc.).
 * - Mantiene internas las funciones que corren en el loop 1-min o que no son disparadas por el usuario directamente.
 */
export const useSystemEngine = ({ uiState, setUiState, systemApi }: SystemEngineProps) => {
  const instance = useRef(instances++);

  const timeSimulator = useMemo(() => TimeSimulator.getInstance(), []);

  useEffect(() => {
    instances++;
    instance.current = instances;
    console.log("new instance", instance.current);
  }, []);

  /**
   * Función privada para re-sincronizar el UiState tras cada modificación en systemApi.
   */
  const _syncUiStateFromPersisted = useCallback(async () => {
    formatLog("_syncUiStateFromPersisted", null);
    const persistedState = await systemApi.getPersistedState();
    console.log("= _syncUiStateFromPersisted = ");

    timeSimulator.setTimeMultiplier(persistedState.systemParams.timeMultiplier);

    setUiState((current) => ({
      ...current,
      lifecycleState: persistedState.lifecycleState,
      currentDay: persistedState.currentDay,
      totalTempoBalance: persistedState.totalTempoBalance,
      investedTimeHistory: persistedState.investedTimeHistory,
      tempoModificationHistory: persistedState.tempoModificationHistory,
      selectedActivity: persistedState.selectedActivity
        ? persistedState.activities[persistedState.selectedActivity]
        : undefined,
      boards: Object.values(persistedState.boards),
      activities: Object.values(persistedState.activities),
      usefulMetrics: persistedState.usefulMetrics,
      systemParams: persistedState.systemParams,
      lastUpdateTimestamp: persistedState.lastUpdateTimestamp,
    }));
  }, [setUiState]);

  // ===========================
  //            Día
  // ===========================
  const startDay = useCallback(async () => {
    const now = timeSimulator.now(); // Valor actual de la simulación
    const dayState: DayState = {
      date: now, // Se asigna el timestamp actual
      dayStartMinute: _getMinutesFromTimestamp(now), // Y el minuto correspondiente
      dayTempoBalance: 0,
    };

    await systemApi.startDay(dayState);
    await systemApi.updateLastUpdateTimestamp(now);
    await _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  const endDay = useCallback(async () => {
    await systemApi.endDay();
    await _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  /**
   * PRIMER BLOQUE: Efectos de inicialización y sincronización
   */
  useEffect(() => {
    // Al montar el hook, sincronizamos la UI con el estado persistido
    _syncUiStateFromPersisted();

    // Al iniciar, actualizamos el estado del sistema según el tiempo transcurrido
    _updateSystemState();
  }, []);

  // Efecto para sincronizar el modo de prueba
  useEffect(() => {
    timeSimulator.setTestMode(uiState.systemParams.isTestMode);
  }, [uiState.systemParams.isTestMode]);

  // Efecto para sincronizar el multiplicador de tiempo
  useEffect(() => {
    if (uiState.systemParams.isTestMode) {
      timeSimulator.setTimeMultiplier(uiState.systemParams.timeMultiplier);
    }
  }, [uiState.systemParams.timeMultiplier, uiState.systemParams.isTestMode]);

  // Ejecuta la lógica de evaluación base cada un minuto (o cada segundo en modo prueba)
  useEffect(() => {
    console.log(`start new minute useEffect for an ${timeSimulator.getUpdateInterval()} interval`);

    const startUpdate = async () => {
      setUiState((current) => ({
        ...current,
        updatingSystemState: true,
      }));

      await _updateSystemState();

      setUiState((current) => ({
        ...current,
        updatingSystemState: false,
      }));
    };

    console.log(`we're setting the interval at ${timeSimulator.getUpdateInterval()}ms`);

    const interval = setInterval(() => {
      console.log("  interval iteration");

      setUiState((current) => {
        if (current.updatingSystemState === false) {
          console.log("    starting update because not updating");
          startUpdate();
        } else {
          console.log("    already updating system state?");
        }

        return current;
      });
    }, timeSimulator.getUpdateInterval());

    return () => clearInterval(interval);
  }, [timeSimulator.getUpdateInterval()]);

  const _getMinutesFromTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).getHours() * 60 + new Date(timestamp).getMinutes();
  }, []);

  const _applyChallengeCriteriaFailed = useCallback(
    async ({ activity, penaltyAmount }: { activity: ChallengeActivity; penaltyAmount: number }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      const tempoModificationRecord: TempoModificationRecord = {
        activityId: activity.id,
        type: "challenge",
        timestamp: lastUpdateTimestamp,
        reason: "challengeCriteriaFailed",
        tempoModification: -penaltyAmount,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _getAllActivityConstraints = useCallback(async () => {
    const activities = await systemApi.getActivities();
    const challengeActivities = activities.filter(
      (activity): activity is ChallengeActivity => activity.type === "challenge"
    );

    return challengeActivities.map((activity) => ({
      activity,
      constraints: activity.constraintList,
    }));
  }, [systemApi]);

  const _evaluateAllChallengeConstraints = useCallback(async () => {
    const challengeActivitiesWithConstraints = await _getAllActivityConstraints();
    const currentMinutes = _getMinutesFromTimestamp(timeSimulator.now());

    for (const { activity } of challengeActivitiesWithConstraints) {
      const { updatedConstraints, failedConstraints } = evaluateConstraints({
        constraints: activity.constraintList,
        currentMinutes,
        totalTempoReward: activity.totalTempoReward,
      });

      // Creamos una copia actualizada de la actividad con los nuevos constraints
      const updatedActivity = {
        ...activity,
        constraintList: updatedConstraints,
      };

      // Aplicamos las penalizaciones para los constraints que fallaron
      for (const { penaltyAmount } of failedConstraints) {
        await _applyChallengeCriteriaFailed({ activity: updatedActivity, penaltyAmount });
      }

      // Se actualiza la actividad en el sistema para persistir los cambios en los constraints
      await systemApi.updateActivity(updatedActivity);
    }
  }, [
    _getAllActivityConstraints,
    _getMinutesFromTimestamp,
    timeSimulator,
    _applyChallengeCriteriaFailed,
    systemApi,
  ]);

  /**
   * Función privada para actualizar el estado del sistema según el tiempo transcurrido
   */
  const _updateSystemState = useCallback(async () => {
    formatLog("START _updateSystemState", null);
    const persistedState = await systemApi.getPersistedState();
    const {
      currentDay,
      lastUpdateTimestamp,
      activities,
      systemParams,
      totalTempoBalance,
      selectedActivity,
    } = persistedState;

    const currentActivity = selectedActivity ? activities[selectedActivity] : undefined;
    const { shouldEndDay, timeRecords, updatedTimestamp, updatedActivity } = updateTimeState({
      currentDay,
      lastUpdateTimestamp,
      currentActivity,
      systemParams,
      totalTempoBalance,
      timeSimulator,
    });

    // Primero actualizamos la actividad si existe, para que se persistan los cambios en minutesActive
    if (updatedActivity) {
      await systemApi.updateActivity(updatedActivity);

      // Procesar la lógica de deselección para actividades neutral/discount
      if (
        (updatedActivity.type === "neutral" || updatedActivity.type === "discount") &&
        updatedActivity.minutesActive >= updatedActivity.allowedTime
      ) {
        await systemApi.unselectActivity();
      }
    }

    // Después evaluamos los constraints de todos los desafíos
    await _evaluateAllChallengeConstraints();

    // Procesamos los registros de tiempo
    for (const record of timeRecords) {
      await systemApi.updateTempoBalance({ investedTimeRecord: record });
    }

    // Actualizamos el timestamp de la última actualización
    await systemApi.updateLastUpdateTimestamp(updatedTimestamp);

    // Si debe terminar el día, se ejecuta la función endDay
    if (shouldEndDay) {
      await endDay();
    }

    // Sincronizamos el estado de la UI con el estado persistido
    await _syncUiStateFromPersisted();
  }, [
    endDay,
    _syncUiStateFromPersisted,
    timeSimulator,
    systemApi,
    _evaluateAllChallengeConstraints,
  ]);

  const _applyNeutralActivityEarlyCompletionCompensation = useCallback(
    async ({ activity }: { activity: NeutralActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      const compensation = activity.allowedTime - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        activityId: activity.id,
        type: "neutral",
        timestamp: lastUpdateTimestamp,
        reason: "earlyNeutralActivityCompletionCompensation",
        tempoModification: compensation,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _applyDiscountActivityEarlyCompletionCompensation = useCallback(
    async ({ activity }: { activity: HobbyActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      // Calculamos el tiempo restante no utilizado
      const unusedTime = activity.allowedTime - activity.minutesActive;

      // Calculamos el factor de compensación basado en la tasa de consumo
      // Si tempoConsumptionRate es 0.6, entonces el factor será 0.4 (1 - 0.6)
      const compensationFactor = 1 - activity.tempoConsumptionRate;

      // La compensación final es el tiempo no utilizado multiplicado por el factor
      const compensation = compensationFactor * unusedTime;

      const tempoModificationRecord: TempoModificationRecord = {
        activityId: activity.id,
        type: "discount",
        timestamp: lastUpdateTimestamp,
        reason: "earlyDiscountActivityCompletionCompensation",
        tempoModification: compensation,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  /**
   * TERCER BLOQUE: LÓGICA PÚBLICA - ACCIONES DEL USUARIO
   * Este es el set de métodos que SÍ retornaremos. Tienen sentido en la UI.
   */

  // ===========================
  //   ACCIONES: Boards
  // ===========================
  const createBoard = useCallback(
    async (boardInput: CreateBoardInput) => {
      console.log("createBoard boardInput", boardInput);
      const board: Board = {
        ...boardInput,
        id: crypto.randomUUID(),
      };
      await systemApi.createBoard(board);
      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const updateBoard = useCallback(
    async (boardUpdates: Partial<Board> & { id: BoardId }) => {
      await systemApi.updateBoard(boardUpdates);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const removeBoard = useCallback(
    async (board: Board) => {
      await systemApi.removeBoard(board);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  // ===========================
  //   ACCIONES: Activities
  // ===========================

  const createActivity = async (activityInput: CreateActivityInput) => {
    await systemApi.createActivity({
      ...activityInput,
      id: crypto.randomUUID(),
      inheritedProps: {},
    });

    await _syncUiStateFromPersisted();
  };

  const updateActivity = useCallback(
    async (activityUpdates: Partial<Activity> & { id: ActivityId }) => {
      await systemApi.updateActivity(activityUpdates);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const removeActivity = useCallback(
    async (activity: Activity) => {
      await systemApi.removeActivity(activity);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  /**
   * Seleccionar o quitar selección de actividad:
   */
  const selectActivity = useCallback(
    async (activity: Activity) => {
      // Primero actualizamos el estado de la actividad a "inProgress"
      await systemApi.updateActivity({
        id: activity.id,
        status: "inProgress",
      });

      // Luego la seleccionamos
      await systemApi.setSelectedActivity(activity);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const unselectActivity = useCallback(async () => {
    // Obtenemos la actividad actual antes de deseleccionarla
    const currentActivity = await systemApi.getSelectedActivity();

    // Deseleccionamos la actividad
    await systemApi.unselectActivity();

    // Si hay una actividad seleccionada, aplicamos la lógica según su tipo
    if (currentActivity) {
      switch (currentActivity.type) {
        case "neutral": {
          // Para actividades neutrales, compensamos si hay tiempo restante
          if (currentActivity.minutesActive < currentActivity.allowedTime) {
            await _applyNeutralActivityEarlyCompletionCompensation({
              activity: currentActivity,
            });
          }
          break;
        }
        case "discount": {
          // Para actividades hobby/discount, compensamos según la tasa de consumo
          if (currentActivity.minutesActive < currentActivity.allowedTime) {
            await _applyDiscountActivityEarlyCompletionCompensation({
              activity: currentActivity,
            });
          }
          break;
        }
        case "challenge": {
          // Para desafíos, simplemente deseleccionamos sin compensación
          break;
        }
      }
    }

    // Sincronizamos el estado UI
    await _syncUiStateFromPersisted();
  }, [
    _syncUiStateFromPersisted,
    _applyNeutralActivityEarlyCompletionCompensation,
    _applyDiscountActivityEarlyCompletionCompensation,
  ]);

  /**
   * Completar un challenge manualmente (acción del usuario).
   * Por ejemplo, aplicamos la recompensa (reason="challengeCompletionReward").
   */
  const completeChallenge = useCallback(
    async ({ activity }: { activity: ChallengeActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      // Actualizar el estado de la actividad a completada
      await systemApi.updateActivity({
        id: activity.id,
        status: "completed",
      });

      // Deseleccionar la actividad
      await systemApi.unselectActivity();

      if (activity.minutesActive >= activity.totalTempoReward) {
        await _syncUiStateFromPersisted();
        return;
      }

      const reward = activity.totalTempoReward - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        activityId: activity.id,
        type: "challenge",
        timestamp: lastUpdateTimestamp,
        reason: "challengeCompletionReward",
        tempoModification: reward,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  // Funciones utilitarias
  const calculateActivityProgress = (activity: Activity): number => {
    if (activity.type === "challenge") {
      return Math.min((activity.minutesActive / activity.totalTempoReward) * 100, 100);
    }
    return Math.min((activity.minutesActive / activity.allowedTime) * 100, 100);
  };

  const validateNewActivity = (activity: Partial<Activity>): boolean => {
    if (!activity.title?.trim()) return false;

    if (activity.type === "neutral" || activity.type === "discount") {
      if (!activity.allowedTime || activity.allowedTime <= 0 || activity.allowedTime > 960) {
        return false;
      }
    }

    if (activity.type === "challenge") {
      if (!activity.totalTempoReward || activity.totalTempoReward <= 0) {
        return false;
      }
    }

    if (activity.type === "discount") {
      if (
        !activity.tempoConsumptionRate ||
        activity.tempoConsumptionRate <= 0 ||
        activity.tempoConsumptionRate >= 1
      ) {
        return false;
      }
    }

    return true;
  };

  const getActivitiesByBoard = (boardId: string): Activity[] => {
    return uiState.activities.filter((a) => a.parentBoardId === boardId);
  };

  const calculateDayProgress = (
    day: DayState | undefined
  ): {
    remainingTime: number;
    endTime: string;
    currentMinute: number;
  } => {
    if (!day) {
      return {
        remainingTime: 0,
        endTime: "--:--",
        currentMinute: 0,
      };
    }

    const dayStartDate = new Date(day.date);
    const currentDate = new Date(timeSimulator.now());
    const minutesElapsed = Math.floor(
      (currentDate.getTime() - dayStartDate.getTime()) / (1000 * 60)
    );

    const remainingTime = Math.max(0, Math.min(960 - minutesElapsed, 960));

    const endDate = new Date(day.date);
    endDate.setMinutes(endDate.getMinutes() + 960);
    const endTime = endDate.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return {
      remainingTime,
      endTime,
      currentMinute: Math.min(minutesElapsed, 960),
    };
  };

  const updateSystemParams = useCallback(
    async (params: SystemParams) => {
      console.log("updateSystemParams", params);
      await systemApi.updateSystemParams(params);
      await _syncUiStateFromPersisted();
    },
    [systemApi.updateSystemParams, _syncUiStateFromPersisted]
  );

  /**
   * Avanza manualmente un minuto en el sistema
   * Solo funciona cuando el multiplicador es 0
   */
  const advanceOneMinute = useCallback(async () => {
    timeSimulator.advanceOneMinute();
    await _updateSystemState();
  }, [_updateSystemState]);

  // ===========================
  // DEVOLVEMOS SOLO LAS FUNCIONES "PÚBLICAS"
  // ===========================
  return {
    day: {
      startDay,
      calculateProgress: calculateDayProgress,
    },
    board: {
      createBoard,
      updateBoard,
      removeBoard,
      getActivities: getActivitiesByBoard,
    },
    activity: {
      createActivity,
      updateActivity,
      removeActivity,
      selectActivity,
      unselectActivity,
      completeChallenge,
      calculateProgress: calculateActivityProgress,
      validate: validateNewActivity,
    },
    updateSystemParams,
    advanceOneMinute,
    clearAllData: useCallback(async () => {
      await systemApi.clearAllData();
    }, []),
  };
};
