import { useCallback, useEffect, useRef } from "react";

import type { UiStateContextValue } from "src/ui/system-context/UiStateContext";

import type {
  Activity,
  Board,
  ChallengeActivity,
  HobbyActivity,
  InvestedTimeRecord,
  TempoModificationRecord,
  DayState,
  NeutralActivity,
  SystemAPIType,
  UiState,
} from "./types";

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

/**
 * Este hook gestiona la lógica del sistema.
 * - Expone SOLO las acciones que la UI (usuario) necesita (crear board, completar challenge, etc.).
 * - Mantiene internas las funciones que corren en el loop 1-min o que no son disparadas por el usuario directamente.
 */
export const useSystemEngine = ({ uiState, setUiState, systemApi }: SystemEngineProps) => {
  /**
   * PRIMER BLOQUE: Efectos de inicialización y sincronización
   */
  useEffect(() => {
    // Al montar el hook, sincronizamos la UI con el estado persistido
    const persistedState = systemApi.getPersistedState();
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

    // Al iniciar, actualizamos el estado del sistema según el tiempo transcurrido
    _updateSystemState();
  }, []);

  // Ejecuta la lógica de evaluación base cada un minuto
  useEffect(() => {
    const interval = setInterval(() => {
      setUiState((current) => {
        if (current.updatingSystemState === false) {
          _updateSystemState();

          return {
            ...current,
            updatingSystemState: true,
          };
        }

        return current;
      });
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  const _getMinutesFromTimestamp = useCallback((timestamp: number) => {
    return new Date(timestamp).getHours() * 60 + new Date(timestamp).getMinutes();
  }, []);

  const _getCurrentMinute = useCallback(() => {
    return _getMinutesFromTimestamp(Date.now());
  }, [_getMinutesFromTimestamp]);

  /**
   * Función privada para re-sincronizar el UiState tras cada modificación en systemApi.
   */
  const _syncUiStateFromPersisted = useCallback(() => {
    const persistedState = systemApi.getPersistedState();

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
   * Función privada para actualizar el estado del sistema según el tiempo transcurrido
   * Esta función se encarga de:
   * 1. Calcular minutos transcurridos desde la última actualización
   * 2. Aplicar los cambios correspondientes según la actividad actual
   * 3. Verificar si el día debe terminar
   */
  const _updateSystemState = useCallback(() => {
    // En cada iteración vamos a:
    // 1. Obtener el estado más reciente
    // 2. Calcular si podemos procesar un minuto más
    // 3. Procesar el minuto
    // 4. Actualizar lastUpdateTimestamp
    // 5. Repetir hasta que no haya más minutos que procesar
    let shouldContinue = true;

    // TODO: Cambiar por un bucle de setTimeout para no bloquear el hilo principal
    while (shouldContinue) {
      const now = Date.now();

      // Obtenemos el estado más reciente en cada iteración
      const persistedState = systemApi.getPersistedState();
      const currentDay = persistedState.currentDay;
      const lastUpdateTimestamp = persistedState.lastUpdateTimestamp;

      // Si no hay día en progreso, no hay nada que actualizar
      if (!currentDay || persistedState.lifecycleState !== "dayInProgress") {
        return;
      }

      const minutesRemainingToProcess = Math.floor((now - lastUpdateTimestamp) / 60000);

      // Si no ha pasado ningún minuto, no hay nada que actualizar
      if (minutesRemainingToProcess === 0) {
        return;
      }

      // Calculamos cuántos minutos faltan para terminar el día
      const dayEndMinute = currentDay.dayStartMinute + 960;
      const lastUpdateMinute = _getMinutesFromTimestamp(lastUpdateTimestamp);
      const minutesToEndDay = dayEndMinute - lastUpdateMinute;

      if (minutesRemainingToProcess === 0) {
        shouldContinue = false;

        // Si corresponde, terminamos el día
        if (dayEndMinute === lastUpdateMinute) {
          systemApi.endDay();
          _syncUiStateFromPersisted();
        }

        return;
      }

      // Procesamos un solo minuto
      const currentActivity = systemApi.getSelectedActivity();

      // Si no hay actividad seleccionada, aplicamos consumo pasivo
      if (!currentActivity) {
        _applyIdlePassiveConsumption();
      } else {
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
            _applyDiscountedConsumption(currentActivity);
            break;
          }
        }

        // Actualizar minutesActive de la actividad
        systemApi.updateActivity({
          ...currentActivity,
          minutesActive: currentActivity.minutesActive + 1,
        });
      }

      // Actualizamos el timestamp sumando un minuto
      systemApi.updateLastUpdateTimestamp(lastUpdateTimestamp + 60000);
    }

    setUiState((current) => ({
      ...current,
      updatingSystemState: false,
    }));

    _syncUiStateFromPersisted();
  }, []);

  /**
   * SEGUNDO BLOQUE: LÓGICA PRIVADA (core) - NO se expone
   * Estas funciones podrían llamarse en un setInterval (bucle de 1 minuto) o en otras partes
   * internas del sistema. Ejemplo: aplicar consumos pasivos, generar tempo, etc.
   */
  const _applyChallengeMinuteGeneration = useCallback((activity: ChallengeActivity) => {
    const isWithinEstimatedTime = activity.minutesActive < activity.totalTempoReward;

    // Si estamos dentro del tiempo estimado, generamos tempo
    if (isWithinEstimatedTime) {
      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: Date.now(),
        tempoModification: 1,
        minutesInvested: 1,
      };

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: Date.now(),
        reason: "challengeMinuteGeneration",
        tempoModification: 1,
      };

      systemApi.updateTempoBalance({
        investedTimeRecord,
        tempoModificationRecord,
      });

      systemApi.updateActivity({
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });
    } else {
      // Si excedimos el tiempo estimado, aplicamos consumo pasivo
      _applyIdlePassiveConsumption();
    }
  }, []);

  const _applyNeutralTimeRecord = useCallback((activity: NeutralActivity) => {
    const investedTimeRecord: InvestedTimeRecord = {
      status: "activity",
      activityId: activity.id,
      type: "neutral",
      timestamp: Date.now(),
      tempoModification: 0,
      minutesInvested: 1,
    };

    systemApi.updateActivity({
      ...activity,
      minutesActive: activity.minutesActive + 1,
    });

    systemApi.pushToInvestedTimeHistory(investedTimeRecord);

    if (activity.minutesActive === activity.allowedTime) {
      systemApi.unselectActivity();
    }
  }, []);

  const _applyDiscountedConsumption = useCallback((activity: HobbyActivity) => {
    const discountedConsumption = 0 - activity.tempoConsumptionRate;

    const investedTimeRecord: InvestedTimeRecord = {
      status: "activity",
      activityId: activity.id,
      type: "discount",
      timestamp: Date.now(),
      tempoModification: discountedConsumption,
      minutesInvested: 1,
    };

    const tempoModificationRecord: TempoModificationRecord = {
      status: "activity",
      activityId: activity.id,
      type: "discount",
      timestamp: Date.now(),
      reason: "discountedPassiveConsumption",
      tempoModification: discountedConsumption,
    };

    systemApi.updateTempoBalance({
      investedTimeRecord,
      tempoModificationRecord,
    });

    systemApi.updateActivity({
      ...activity,
      minutesActive: activity.minutesActive + 1,
    });

    if (activity.minutesActive === activity.allowedTime) {
      systemApi.unselectActivity();
    }
  }, []);

  const _applyIdlePassiveConsumption = useCallback(() => {
    const passiveConsumption = 0 - systemApi.getSystemParams().passiveTempoConsumptionRate;

    const investedTimeRecord: InvestedTimeRecord = {
      status: "idle",
      timestamp: Date.now(),
      tempoModification: passiveConsumption,
      minutesInvested: 1,
    };

    const tempoModificationRecord: TempoModificationRecord = {
      status: "idle",
      timestamp: Date.now(),
      reason: "passiveConsumption",
      tempoModification: passiveConsumption,
    };

    systemApi.updateTempoBalance({
      investedTimeRecord,
      tempoModificationRecord,
    });
  }, []);

  const _applyNeutralActivityEarlyCompletionCompensation = useCallback(
    (activity: NeutralActivity) => {
      const compensation = activity.allowedTime - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "neutral",
        timestamp: Date.now(),
        reason: "earlyNeutralActivityCompletionCompensation",
        tempoModification: compensation,
      };

      systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _applyDiscountActivityEarlyCompletionCompensation = useCallback(
    (activity: HobbyActivity) => {
      // Calculamos el tiempo restante no utilizado
      const unusedTime = activity.allowedTime - activity.minutesActive;

      // Calculamos el factor de compensación basado en la tasa de consumo
      // Si tempoConsumptionRate es 0.6, entonces el factor será 0.4 (1 - 0.6)
      const compensationFactor = 1 - activity.tempoConsumptionRate;

      // La compensación final es el tiempo no utilizado multiplicado por el factor
      const compensation = compensationFactor * unusedTime;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "discount",
        timestamp: Date.now(),
        reason: "earlyDiscountActivityCompletionCompensation",
        tempoModification: compensation,
      };

      systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _applyChallengeCriteriaFailed = useCallback(
    ({ activity, penaltyAmount }: { activity: ChallengeActivity; penaltyAmount: number }) => {
      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: Date.now(),
        reason: "challengeCriteriaFailed",
        tempoModification: -penaltyAmount,
      };

      systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  // etc. (Otras funciones "privadas" para la lógica core minuto a minuto o cálculos internos)

  /**
   * TERCER BLOQUE: LÓGICA PÚBLICA - ACCIONES DEL USUARIO
   * Este es el set de métodos que SÍ retornaremos. Tienen sentido en la UI.
   */

  // ===========================
  //     ACCIONES: Día
  // ===========================
  const startDay = useCallback(() => {
    const currentMinute = _getCurrentMinute();

    systemApi.updateLastUpdateTimestamp(Date.now());

    const dayState: DayState = {
      date: Date.now(),
      dayStartMinute: currentMinute,
      dayTempoBalance: 0,
    };

    systemApi.startDay(dayState);

    _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  const endDay = useCallback(() => {
    systemApi.endDay();

    _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  // ===========================
  //   ACCIONES: Boards
  // ===========================
  const createBoard = useCallback(
    (board: Board) => {
      systemApi.createBoard(board);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const updateBoard = useCallback(
    (board: Board) => {
      systemApi.updateBoard(board);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const removeBoard = useCallback(
    (board: Board) => {
      systemApi.removeBoard(board);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  // ===========================
  //   ACCIONES: Activities
  // ===========================
  const createActivity = useCallback(
    (activity: Activity) => {
      systemApi.createActivity(activity);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const updateActivity = useCallback(
    (activity: Activity) => {
      systemApi.updateActivity(activity);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const removeActivity = useCallback(
    (activity: Activity) => {
      systemApi.removeActivity(activity);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  /**
   * Seleccionar o quitar selección de actividad:
   */
  const selectActivity = useCallback(
    (activity: Activity) => {
      systemApi.setSelectedActivity(activity);

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const unselectActivity = useCallback(() => {
    systemApi.unselectActivity();

    _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  /**
   * Completar un challenge manualmente (acción del usuario).
   * Por ejemplo, aplicamos la recompensa (reason="challengeCompletionReward").
   */
  const completeChallenge = useCallback(
    (activity: ChallengeActivity) => {
      const reward = activity.totalTempoReward - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: Date.now(),
        reason: "challengeCompletionReward",
        tempoModification: reward,
      };

      systemApi.updateTempoBalance({
        tempoModificationRecord,
      });

      // Actualizar el estado de la actividad a completada
      systemApi.updateActivity({
        ...activity,
        status: "completed",
      });

      // Deseleccionar la actividad
      systemApi.unselectActivity();

      _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  // ===========================
  // DEVOLVEMOS SOLO LAS FUNCIONES "PÚBLICAS"
  // ===========================
  return {
    // DÍA
    day: {
      startDay,
      // Por ahora no se puede terminar el día desde la UI, una vez que se inicia un dia, ya se fija el tiempo de finalización
      // endDay,
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
