import { useCallback, useEffect, useMemo, useRef } from "react";

import { TimeSimulator } from "./TimeSimulator";
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
  CreateBoardInput,
  CreateActivityInput,
  SystemParams,
} from "./types";

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
        }
        console.log("    already updating system state?");
        return current;
      });
    }, timeSimulator.getUpdateInterval());

    return () => clearInterval(interval);
  }, [timeSimulator.getUpdateInterval()]);

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
    console.log("= START _updateSystemState =");

    const processNextMinute = async () => {
      // Obtenemos el estado más reciente en cada iteración
      const persistedState = await systemApi.getPersistedState();
      const currentDay = persistedState.currentDay;
      const lastUpdateTimestamp = persistedState.lastUpdateTimestamp;

      console.log(`  iteration for minute ${await _getCurrentProcessedMinute()}`);

      // Si no hay día en progreso, no hay nada que actualizar
      if (!currentDay || persistedState.lifecycleState !== "dayInProgress") {
        console.log("  return because no day in progress");
        return;
      }

      // Calculamos cuántos minutos faltan para terminar el día
      const dayEndMinute = currentDay.dayStartMinute + 960;
      const lastUpdateMinute = await _getCurrentProcessedMinute();

      console.log("timeSimulator.now()", timeSimulator.now());
      console.log("lastUpdateTimestamp", lastUpdateTimestamp);
      const minutesRemainingToProcess = Math.floor(
        (timeSimulator.now() - lastUpdateTimestamp) / 60000
      );

      console.log("  minutesRemainingToProcess", minutesRemainingToProcess);
      console.log(
        "    because _getMinutesFromTimestamp(timeSimulator.now())",
        _getMinutesFromTimestamp(timeSimulator.now())
      );
      console.log("    and lastUpdateMinute", lastUpdateMinute);

      // Si no ha pasado ningún minuto, no hay nada que actualizar
      if (minutesRemainingToProcess === 0) {
        console.log("  return because no minutes to process");
        return;
      }

      // Si corresponde, terminamos el día
      if (dayEndMinute === lastUpdateMinute) {
        console.log("  return because end day");

        await endDay();
        await _syncUiStateFromPersisted();
        return;
      }

      // Procesamos un solo minuto
      const currentActivity = await systemApi.getSelectedActivity();
      console.log("  currentActivity", currentActivity);

      // Si hay una actividad seleccionada
      if (currentActivity) {
        // Lógica según el tipo de actividad
        switch (currentActivity.type) {
          case "challenge": {
            console.log("  _applyChallengeMinuteGeneration");
            await _applyChallengeMinuteGeneration({
              activity: currentActivity,
            });

            // Evaluamos los constraints
            console.log("  _evaluateChallengeConstraints");
            await _evaluateChallengeConstraints({
              activity: currentActivity,
            });
            break;
          }
          case "neutral": {
            console.log("  _applyNeutralTimeRecord");
            await _applyNeutralTimeRecord({
              activity: currentActivity,
            });
            break;
          }
          case "discount": {
            console.log("  _applyDiscountedConsumption");
            await _applyDiscountedConsumption({
              activity: currentActivity,
            });
            break;
          }
        }

        console.log("  minutesActive", currentActivity.minutesActive);
        console.log("  new minutesActive", currentActivity.minutesActive + 1);

        // Actualizar minutesActive de la actividad
        await systemApi.updateActivity({
          ...currentActivity,
          minutesActive: currentActivity.minutesActive + 1,
        });
      } else {
        // Si no hay actividad seleccionada, aplicamos consumo pasivo
        await _applyIdlePassiveConsumption();
      }

      // Actualizamos el timestamp sumando un minuto
      await systemApi.updateLastUpdateTimestamp(
        lastUpdateTimestamp + timeSimulator.getTimeIncrement()
      );

      console.log("  setUiState");

      await _syncUiStateFromPersisted();

      // Programamos el siguiente minuto con un pequeño retraso para no bloquear el hilo principal
      setTimeout(processNextMinute, 50);
    };

    // Iniciamos el procesamiento del primer minuto
    processNextMinute();
  }, []);

  /**
   * SEGUNDO BLOQUE: LÓGICA PRIVADA (core) - NO se expone
   * Estas funciones podrían llamarse en un setInterval (bucle de 1 minuto) o en otras partes
   * internas del sistema. Ejemplo: aplicar consumos pasivos, generar tempo, etc.
   */
  const _applyChallengeMinuteGeneration = useCallback(
    async ({ activity }: { activity: ChallengeActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      const isWithinEstimatedTime = activity.minutesActive < activity.totalTempoReward;

      // Si estamos dentro del tiempo estimado, generamos tempo
      if (isWithinEstimatedTime) {
        const investedTimeRecord: InvestedTimeRecord = {
          status: "activity",
          activityId: activity.id,
          type: "challenge",
          timestamp: lastUpdateTimestamp,
          tempoModification: 1,
          minutesInvested: 1,
        };

        const tempoModificationRecord: TempoModificationRecord = {
          status: "activity",
          activityId: activity.id,
          type: "challenge",
          timestamp: lastUpdateTimestamp,
          reason: "challengeMinuteGeneration",
          tempoModification: 1,
        };

        await systemApi.updateTempoBalance({
          investedTimeRecord,
          tempoModificationRecord,
        });
      } else {
        // Si excedimos el tiempo estimado, aplicamos consumo pasivo
        await _applyIdlePassiveConsumption();
      }
    },
    []
  );

  const _applyNeutralTimeRecord = useCallback(
    async ({ activity }: { activity: NeutralActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      // Si ya alcanzamos el tiempo límite, deseleccionamos, autocompletamos, y no registramos más tiempo
      // if (activity.minutesActive >= activity.allowedTime) {
      //   await systemApi.unselectActivity();

      //   await systemApi.updateActivity({
      //     ...activity,
      //     status: "completed",
      //   });

      //   return;
      // }

      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "neutral",
        timestamp: lastUpdateTimestamp,
        tempoModification: 0,
        minutesInvested: 1,
      };

      await systemApi.pushToInvestedTimeHistory(investedTimeRecord);

      // Si con este nuevo minuto llegamos al límite, deseleccionamos
      if (activity.minutesActive + 1 === activity.allowedTime) {
        await systemApi.unselectActivity();

        console.log("updateActivity!", {
          ...activity,
          status: "completed",
        });

        await systemApi.updateActivity({
          ...activity,
          status: "completed",
          minutesActive: activity.minutesActive + 1,
        });

        return;
      }

      console.log("updateActivity!!", {
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });

      await systemApi.updateActivity({
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });
    },
    []
  );

  const _applyDiscountedConsumption = useCallback(
    async ({ activity }: { activity: HobbyActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      // Si ya alcanzamos el tiempo límite, deseleccionamos y no registramos más tiempo
      if (activity.minutesActive >= activity.allowedTime) {
        await systemApi.unselectActivity();
        return;
      }

      const discountedConsumption = 0 - activity.tempoConsumptionRate;

      const investedTimeRecord: InvestedTimeRecord = {
        status: "activity",
        activityId: activity.id,
        type: "discount",
        timestamp: lastUpdateTimestamp,
        tempoModification: discountedConsumption,
        minutesInvested: 1,
      };

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
        activityId: activity.id,
        type: "discount",
        timestamp: lastUpdateTimestamp,
        reason: "discountedPassiveConsumption",
        tempoModification: discountedConsumption,
      };

      await systemApi.updateTempoBalance({
        investedTimeRecord,
        tempoModificationRecord,
      });

      // Actualizamos minutesActive
      await systemApi.updateActivity({
        ...activity,
        minutesActive: activity.minutesActive + 1,
      });

      // Si con este nuevo minuto llegamos al límite, deseleccionamos
      if (activity.minutesActive + 1 === activity.allowedTime) {
        await systemApi.unselectActivity();
      }
    },
    []
  );

  const _applyIdlePassiveConsumption = useCallback(async () => {
    const { lastUpdateTimestamp } = await systemApi.getPersistedState();

    const { passiveTempoConsumptionRate } = await systemApi.getSystemParams();
    const passiveConsumption = 0 - passiveTempoConsumptionRate;

    const investedTimeRecord: InvestedTimeRecord = {
      status: "idle",
      timestamp: lastUpdateTimestamp,
      tempoModification: passiveConsumption,
      minutesInvested: 1,
    };

    const tempoModificationRecord: TempoModificationRecord = {
      status: "idle",
      timestamp: lastUpdateTimestamp,
      reason: "passiveConsumption",
      tempoModification: passiveConsumption,
    };

    await systemApi.updateTempoBalance({
      investedTimeRecord,
      tempoModificationRecord,
    });
  }, []);

  const _applyNeutralActivityEarlyCompletionCompensation = useCallback(
    async ({ activity }: { activity: NeutralActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      const compensation = activity.allowedTime - activity.minutesActive;

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
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
        status: "activity",
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

  const _applyChallengeCriteriaFailed = useCallback(
    async ({ activity, penaltyAmount }: { activity: ChallengeActivity; penaltyAmount: number }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

      const tempoModificationRecord: TempoModificationRecord = {
        status: "activity",
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

  const _evaluateChallengeConstraints = useCallback(
    async ({ activity }: { activity: ChallengeActivity }) => {
      const { lastUpdateTimestamp } = await systemApi.getPersistedState();

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
            if (lastUpdateTimestamp > constraint.dayMinuteExpiration) {
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
      date: timeSimulator.now(),
      dayStartMinute: _getMinutesFromTimestamp(timeSimulator.now()),
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
    async (activityInput: Omit<Activity, "id">) => {
      if (!validateNewActivity(activityInput)) {
        throw new Error("Invalid activity data");
      }

      const activity: Activity = {
        ...activityInput,
        id: crypto.randomUUID(),
      } as Activity;

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
      // Primero actualizamos el estado de la actividad a "inProgress"
      await systemApi.updateActivity({
        ...activity,
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
        ...activity,
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
        status: "activity",
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
    clearAllData: useCallback(async () => {
      await systemApi.clearAllData();
    }, []),
  };
};
