import { useCallback, useEffect } from "react";

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

import type { UiStateContextValue } from "@/system-context/UiStateContext";

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
    _syncUiStateFromPersisted();

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

  const _getCurrentProcessedMinute = useCallback(async () => {
    return _getMinutesFromTimestamp((await systemApi.getPersistedState()).lastUpdateTimestamp);
  }, [_getMinutesFromTimestamp, systemApi]);

  /**
   * Función privada para re-sincronizar el UiState tras cada modificación en systemApi.
   */
  const _syncUiStateFromPersisted = useCallback(async () => {
    const persistedState = await systemApi.getPersistedState();
    console.log("_syncUiStateFromPersisted");
    console.log("persistedState", persistedState);
    console.log("============");

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
  const _updateSystemState = useCallback(async () => {
    console.log("_updateSystemState");

    // En cada iteración vamos a:
    // 1. Obtener el estado más reciente
    // 2. Calcular si podemos procesar un minuto más
    // 3. Procesar el minuto
    // 4. Actualizar lastUpdateTimestamp
    // 5. Repetir hasta que no haya más minutos que procesar
    let shouldContinue = true;

    // TODO: Cambiar por un bucle de setTimeout para no bloquear el hilo principal
    while (shouldContinue) {
      // Obtenemos el estado más reciente en cada iteración
      const persistedState = await systemApi.getPersistedState();
      const currentDay = persistedState.currentDay;
      const lastUpdateTimestamp = persistedState.lastUpdateTimestamp;

      console.log(`_updateSystemState iteration for minute ${await _getCurrentProcessedMinute()}`);

      // Si no hay día en progreso, no hay nada que actualizar
      if (!currentDay || persistedState.lifecycleState !== "dayInProgress") {
        console.log("_updateSystemState return: no day in progress");
        return;
      }

      // Calculamos cuántos minutos faltan para terminar el día
      const dayEndMinute = currentDay.dayStartMinute + 960;
      const lastUpdateMinute = await _getCurrentProcessedMinute();

      const minutesRemainingToProcess = _getMinutesFromTimestamp(Date.now()) - lastUpdateMinute;

      console.log("minutesRemainingToProcess", minutesRemainingToProcess);
      console.log(
        "because _getMinutesFromTimestamp(Date.now())",
        _getMinutesFromTimestamp(Date.now())
      );
      console.log("and lastUpdateMinute", lastUpdateMinute);

      // Si no ha pasado ningún minuto, no hay nada que actualizar
      if (minutesRemainingToProcess === 0) {
        console.log("_updateSystemState return: no minutes to process");
        shouldContinue = false;
        return;
      }

      // Si corresponde, terminamos el día
      if (dayEndMinute === lastUpdateMinute) {
        console.log("_updateSystemState return: end day");

        await endDay();
        await _syncUiStateFromPersisted();
      }

      // Procesamos un solo minuto
      const currentActivity = await systemApi.getSelectedActivity();

      // Si hay una actividad seleccionada
      if (currentActivity) {
        // Lógica según el tipo de actividad
        switch (currentActivity.type) {
          case "challenge": {
            await _applyChallengeMinuteGeneration({
              activity: currentActivity,
              currentProcessingMinute: lastUpdateMinute,
            });

            // Evaluamos los constraints
            await _evaluateChallengeConstraints({
              activity: currentActivity,
              currentProcessingMinute: lastUpdateMinute,
            });
            break;
          }
          case "neutral": {
            await _applyNeutralTimeRecord({
              activity: currentActivity,
              currentProcessingMinute: lastUpdateMinute,
            });
            break;
          }
          case "discount": {
            await _applyDiscountedConsumption({
              activity: currentActivity,
              currentProcessingMinute: lastUpdateMinute,
            });
            break;
          }
        }

        // Actualizar minutesActive de la actividad
        await systemApi.updateActivity({
          ...currentActivity,
          minutesActive: currentActivity.minutesActive + 1,
        });
      } else {
        // Si no hay actividad seleccionada, aplicamos consumo pasivo
        await _applyIdlePassiveConsumption({ currentProcessingMinute: lastUpdateMinute });
      }

      // Actualizamos el timestamp sumando un minuto
      await systemApi.updateLastUpdateTimestamp(lastUpdateTimestamp + 60000);
    }

    console.log("_updateSystemState setUiState");

    setUiState((current) => ({
      ...current,
      updatingSystemState: false,
    }));

    await _syncUiStateFromPersisted();
  }, []);

  /**
   * SEGUNDO BLOQUE: LÓGICA PRIVADA (core) - NO se expone
   * Estas funciones podrían llamarse en un setInterval (bucle de 1 minuto) o en otras partes
   * internas del sistema. Ejemplo: aplicar consumos pasivos, generar tempo, etc.
   */
  const _applyChallengeMinuteGeneration = useCallback(
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: ChallengeActivity;
      currentProcessingMinute: number;
    }) => {
      const isWithinEstimatedTime = activity.minutesActive < activity.totalTempoReward;

      // Si estamos dentro del tiempo estimado, generamos tempo
      if (isWithinEstimatedTime) {
        const investedTimeRecord: InvestedTimeRecord = {
          status: "activity",
          activityId: activity.id,
          type: "challenge",
          timestamp: currentProcessingMinute,
          tempoModification: 1,
          minutesInvested: 1,
        };

        const tempoModificationRecord: TempoModificationRecord = {
          status: "activity",
          activityId: activity.id,
          type: "challenge",
          timestamp: currentProcessingMinute,
          reason: "challengeMinuteGeneration",
          tempoModification: 1,
        };

        await systemApi.updateTempoBalance({
          investedTimeRecord,
          tempoModificationRecord,
        });

        await systemApi.updateActivity({
          ...activity,
          minutesActive: activity.minutesActive + 1,
        });
      } else {
        // Si excedimos el tiempo estimado, aplicamos consumo pasivo
        await _applyIdlePassiveConsumption({ currentProcessingMinute });
      }
    },
    []
  );

  const _applyNeutralTimeRecord = useCallback(
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: NeutralActivity;
      currentProcessingMinute: number;
    }) => {
      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "neutral",
        timestamp: currentProcessingMinute,
        tempoModification: 0,
        minutesInvested: 1,
      };

      await systemApi.updateActivity({
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });

      await systemApi.pushToInvestedTimeHistory(investedTimeRecord);

      if (activity.minutesActive >= activity.allowedTime) {
        await systemApi.unselectActivity();
      }
    },
    []
  );

  const _applyDiscountedConsumption = useCallback(
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: HobbyActivity;
      currentProcessingMinute: number;
    }) => {
      const discountedConsumption = 0 - activity.tempoConsumptionRate;

      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "discount",
        timestamp: currentProcessingMinute,
        tempoModification: discountedConsumption,
        minutesInvested: 1,
      };

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "discount",
        timestamp: currentProcessingMinute,
        reason: "discountedPassiveConsumption",
        tempoModification: discountedConsumption,
      };

      await systemApi.updateTempoBalance({
        investedTimeRecord,
        tempoModificationRecord,
      });

      await systemApi.updateActivity({
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });

      if (activity.minutesActive === activity.allowedTime) {
        await systemApi.unselectActivity();
      }
    },
    []
  );

  const _applyIdlePassiveConsumption = useCallback(
    async ({ currentProcessingMinute }: { currentProcessingMinute: number }) => {
      const { passiveTempoConsumptionRate } = await systemApi.getSystemParams();
      const passiveConsumption = 0 - passiveTempoConsumptionRate;

      const investedTimeRecord: InvestedTimeRecord = {
        status: "idle",
        timestamp: currentProcessingMinute,
        tempoModification: passiveConsumption,
        minutesInvested: 1,
      };

      const tempoModificationRecord: TempoModificationRecord = {
        status: "idle",
        timestamp: currentProcessingMinute,
        reason: "passiveConsumption",
        tempoModification: passiveConsumption,
      };

      await systemApi.updateTempoBalance({
        investedTimeRecord,
        tempoModificationRecord,
      });
    },
    []
  );

  const _applyNeutralActivityEarlyCompletionCompensation = useCallback(
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: NeutralActivity;
      currentProcessingMinute: number;
    }) => {
      const compensation = activity.allowedTime - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "neutral",
        timestamp: currentProcessingMinute,
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
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: HobbyActivity;
      currentProcessingMinute: number;
    }) => {
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
        timestamp: currentProcessingMinute,
        reason: "earlyDiscountActivityCompletionCompensation",
        tempoModification: compensation,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _applyChallengeCriteriaFailed = useCallback(
    async ({
      activity,
      penaltyAmount,
      currentProcessingMinute,
    }: {
      activity: ChallengeActivity;
      penaltyAmount: number;
      currentProcessingMinute: number;
    }) => {
      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: currentProcessingMinute,
        reason: "challengeCriteriaFailed",
        tempoModification: -penaltyAmount,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });
    },
    []
  );

  const _evaluateChallengeConstraints = useCallback(
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: ChallengeActivity;
      currentProcessingMinute: number;
    }) => {
      // Solo evaluamos challenges y solo si tienen constraints
      if (activity.type !== "challenge" || !activity.constraintList?.length) {
        return;
      }

      // Evaluamos cada constraint que esté activo
      for (const constraint of activity.constraintList) {
        // Saltamos los que ya fallaron
        if (constraint.status === "failed") {
          continue;
        }

        switch (constraint.type) {
          case "expiration": {
            // Si pasó el minuto de expiración
            if (currentProcessingMinute > constraint.dayMinuteExpiration) {
              // Marcamos el constraint como fallido
              const updatedActivity: ChallengeActivity = {
                ...activity,
                constraintList: activity.constraintList.map((c) =>
                  c === constraint ? { ...c, status: "failed" } : c
                ),
              };

              await systemApi.updateActivity(updatedActivity);

              // Calculamos la penalización
              let penaltyAmount = 0;

              if (typeof constraint.penalty === "string" && constraint.penalty.endsWith("%")) {
                // Si es porcentual, calculamos sobre el total reward
                const percentage = parseInt(constraint.penalty) / 100;
                penaltyAmount = activity.totalTempoReward * percentage;
              }

              if (typeof constraint.penalty === "number") {
                // Si es fijo, usamos el número directamente
                penaltyAmount = constraint.penalty;
              }

              // Aplicamos la penalización
              if (penaltyAmount > 0) {
                await _applyChallengeCriteriaFailed({
                  activity,
                  penaltyAmount,
                  currentProcessingMinute,
                });
              }
            }
            break;
          }
          // Aquí se pueden agregar más tipos de constraints en el futuro
        }
      }
    },
    [_applyChallengeCriteriaFailed]
  );

  // etc. (Otras funciones "privadas" para la lógica core minuto a minuto o cálculos internos)

  /**
   * TERCER BLOQUE: LÓGICA PÚBLICA - ACCIONES DEL USUARIO
   * Este es el set de métodos que SÍ retornaremos. Tienen sentido en la UI.
   */

  // ===========================
  //     ACCIONES: Día
  // ===========================
  const startDay = useCallback(async () => {
    const dayState: DayState = {
      date: Date.now(),
      dayStartMinute: _getMinutesFromTimestamp(Date.now()),
      dayTempoBalance: 0,
    };

    await systemApi.startDay(dayState);

    await _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  const endDay = useCallback(async () => {
    await systemApi.endDay();

    await _syncUiStateFromPersisted();
  }, [_syncUiStateFromPersisted]);

  // ===========================
  //   ACCIONES: Boards
  // ===========================
  const createBoard = useCallback(
    async (board: Board) => {
      await systemApi.createBoard(board);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const updateBoard = useCallback(
    async (board: Board) => {
      await systemApi.updateBoard(board);

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
  const createActivity = useCallback(
    async (activity: Activity) => {
      await systemApi.createActivity(activity);

      await _syncUiStateFromPersisted();
    },
    [_syncUiStateFromPersisted]
  );

  const updateActivity = useCallback(
    async (activity: Activity) => {
      await systemApi.updateActivity(activity);

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
              currentProcessingMinute: await _getCurrentProcessedMinute(),
            });
          }
          break;
        }
        case "discount": {
          // Para actividades hobby/discount, compensamos según la tasa de consumo
          if (currentActivity.minutesActive < currentActivity.allowedTime) {
            await _applyDiscountActivityEarlyCompletionCompensation({
              activity: currentActivity,
              currentProcessingMinute: await _getCurrentProcessedMinute(),
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
    async ({
      activity,
      currentProcessingMinute,
    }: {
      activity: ChallengeActivity;
      currentProcessingMinute: number;
    }) => {
      const reward = activity.totalTempoReward - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "challenge",
        timestamp: currentProcessingMinute,
        reason: "challengeCompletionReward",
        tempoModification: reward,
      };

      await systemApi.updateTempoBalance({
        tempoModificationRecord,
      });

      // Actualizar el estado de la actividad a completada
      await systemApi.updateActivity({
        ...activity,
        status: "completed",
      });

      // Deseleccionar la actividad
      await systemApi.unselectActivity();

      await _syncUiStateFromPersisted();
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
