// Local imports
import type { TimeSimulator } from "./TimeSimulator";
import type {
  Activity,
  InvestedTimeRecord,
  SystemParams,
  ExpirationChallengeConstraint,
  ChallengeActivity,
  DayState,
  InvestedTimeHistory,
  TempoModificationHistory,
  UsefulMetrics,
  DayRecord,
} from "./types";

// External imports
import { formatMultiLog } from "@/lib/utils/logger";

// Interfaces para los parámetros de entrada
export interface TimeStateInput {
  currentDay?: {
    date: number;
    dayStartMinute: number;
    dayTempoBalance: number;
  };
  lastUpdateTimestamp: number;
  currentActivity?: Activity;
  systemParams: SystemParams;
  totalTempoBalance: number;
  timeSimulator: TimeSimulator;
}

export interface ProcessTimeBatchInput {
  deltaTime: number;
  baseTimestamp: number;
  currentActivity?: Activity;
  systemParams: SystemParams;
}

// Interfaces para los resultados
export interface TimeStateResult {
  shouldEndDay: boolean;
  processedMinutes: number;
  timeRecords: InvestedTimeRecord[];
  newDayTempoBalance: number;
  newTotalTempoBalance: number;
  updatedTimestamp: number;
  updatedActivity?: Activity;
}

export interface ProcessTimeBatchResult {
  timeRecords: InvestedTimeRecord[];
  updatedActivity?: Activity;
  updatedTimestamp: number;
}

export interface EvaluateConstraintsResult {
  updatedConstraints: ExpirationChallengeConstraint[];
  failedConstraints: {
    constraint: ExpirationChallengeConstraint;
    penaltyAmount: number;
  }[];
}

/**
 * Convierte un timestamp en minutos del día (0-1440)
 */
export function getMinutesFromTimestamp(timestamp: number): number {
  const date = new Date(timestamp);
  return date.getHours() * 60 + date.getMinutes();
}

/**
 * Calcula los nuevos balances basado en una modificación de tempo
 */
export function calculateNewBalances({
  currentDayBalance,
  totalBalance,
  tempoModification,
}: {
  currentDayBalance: number;
  totalBalance: number;
  tempoModification: number;
}): { newDayTempoBalance: number; newTotalTempoBalance: number } {
  return {
    newDayTempoBalance: currentDayBalance + tempoModification,
    newTotalTempoBalance: totalBalance + tempoModification,
  };
}

/**
 * Procesa un lote de tiempo para una actividad específica
 */
export const processTimeBatch = ({
  deltaTime,
  baseTimestamp,
  currentActivity,
  systemParams,
}: {
  deltaTime: number;
  baseTimestamp: number;
  currentActivity: Activity | undefined;
  systemParams: SystemParams;
}): {
  timeRecords: InvestedTimeRecord[];
  updatedActivity: Activity | undefined;
  updatedTimestamp: number;
} => {
  formatMultiLog({
    label: "Procesando Time Batch",
    data: {
      deltaTime,
      baseTimestamp,
      currentActivity: currentActivity
        ? {
            id: currentActivity.id,
            type: currentActivity.type,
            status: currentActivity.status,
            minutesActive: currentActivity.minutesActive,
            constraintList:
              currentActivity.type === "challenge" ? currentActivity.constraintList : undefined,
          }
        : undefined,
    },
  });

  const records: InvestedTimeRecord[] = [];
  let activeMinutes = 0;

  if (currentActivity) {
    switch (currentActivity.type) {
      case "challenge": {
        // Calculamos el tiempo que aún aporta recompensa usando tempoGeneratingMinutes
        const remaining = currentActivity.totalTempoReward - currentActivity.tempoGeneratingMinutes;
        const activeMinutes = Math.min(deltaTime, remaining);
        // Los minutos extra serán lo que queda
        const extraMinutes = deltaTime - activeMinutes;

        // Registrar tiempo de actividad
        if (activeMinutes > 0) {
          records.push({
            status: "activity",
            activityId: currentActivity.id,
            type: "challenge",
            timestamp: baseTimestamp,
            tempoModification: activeMinutes * 1,
            minutesInvested: activeMinutes,
          });
        }

        // Registrar tiempo idle restante
        if (extraMinutes > 0) {
          records.push({
            status: "idle",
            timestamp: baseTimestamp + activeMinutes * 60000,
            tempoModification: extraMinutes * -systemParams.passiveTempoConsumptionRate,
            minutesInvested: extraMinutes,
          });
        }

        return {
          timeRecords: records,
          updatedActivity: {
            ...currentActivity,
            // Actualizamos tanto minutesActive como tempoGeneratingMinutes
            minutesActive: currentActivity.minutesActive + deltaTime,
            tempoGeneratingMinutes: currentActivity.tempoGeneratingMinutes + activeMinutes,
            // Se acumulan los extra en la nueva propiedad
            exceededMinutes: (currentActivity.exceededMinutes ?? 0) + extraMinutes,
          },
          updatedTimestamp: baseTimestamp + deltaTime * 60000,
        };
      }
      case "neutral": {
        const remaining = currentActivity.allowedTime - currentActivity.minutesActive;
        activeMinutes = Math.min(deltaTime, remaining);
        const idleMinutes = deltaTime - activeMinutes;

        // Registrar tiempo neutral
        if (activeMinutes > 0) {
          records.push({
            status: "activity",
            activityId: currentActivity.id,
            type: "neutral",
            timestamp: baseTimestamp,
            tempoModification: 0,
            minutesInvested: activeMinutes,
          });
        }

        // Registrar tiempo idle
        if (idleMinutes > 0) {
          records.push({
            status: "idle",
            timestamp: baseTimestamp + activeMinutes * 60000,
            tempoModification: idleMinutes * -systemParams.passiveTempoConsumptionRate,
            minutesInvested: idleMinutes,
          });
        }

        return {
          timeRecords: records,
          updatedActivity: {
            ...currentActivity,
            minutesActive: currentActivity.minutesActive + activeMinutes,
            status: activeMinutes === remaining ? "completed" : currentActivity.status,
          },
          updatedTimestamp: baseTimestamp + deltaTime * 60000,
        };
      }
      case "discount": {
        const remaining = currentActivity.allowedTime - currentActivity.minutesActive;
        activeMinutes = Math.min(deltaTime, remaining);
        const idleMinutes = deltaTime - activeMinutes;

        // Registrar tiempo con descuento
        if (activeMinutes > 0) {
          records.push({
            status: "activity",
            activityId: currentActivity.id,
            type: "discount",
            timestamp: baseTimestamp,
            tempoModification: activeMinutes * -currentActivity.tempoConsumptionRate,
            minutesInvested: activeMinutes,
          });
        }

        // Registrar tiempo idle
        if (idleMinutes > 0) {
          records.push({
            status: "idle",
            timestamp: baseTimestamp + activeMinutes * 60000,
            tempoModification: idleMinutes * -systemParams.passiveTempoConsumptionRate,
            minutesInvested: idleMinutes,
          });
        }

        return {
          timeRecords: records,
          updatedActivity: {
            ...currentActivity,
            minutesActive: currentActivity.minutesActive + activeMinutes,
            status: activeMinutes === remaining ? "completed" : currentActivity.status,
          },
          updatedTimestamp: baseTimestamp + deltaTime * 60000,
        };
      }
    }
  }

  // Si no hay actividad, registrar todo el tiempo como idle
  records.push({
    status: "idle",
    timestamp: baseTimestamp,
    tempoModification: deltaTime * -systemParams.passiveTempoConsumptionRate,
    minutesInvested: deltaTime,
  });

  return {
    timeRecords: records,
    updatedActivity: undefined,
    updatedTimestamp: baseTimestamp + deltaTime * 60000,
  };
};

/**
 * Evalúa los constraints de una actividad challenge y retorna los resultados
 * @param constraints Lista de constraints a evaluar
 * @param currentMinutes Minutos actuales del día
 * @param totalTempoReward Recompensa total de la actividad (necesario para calcular penalizaciones porcentuales)
 */
export const evaluateConstraints = ({
  constraints,
  currentMinutes,
  totalTempoReward,
  activity,
  currentTimestamp,
}: {
  constraints: ExpirationChallengeConstraint[];
  currentMinutes: number;
  totalTempoReward: number;
  activity: ChallengeActivity;
  currentTimestamp: number;
}): {
  updatedConstraints: ExpirationChallengeConstraint[];
  failedConstraints: Array<{ constraint: ExpirationChallengeConstraint; penaltyAmount: number }>;
} => {
  formatMultiLog({
    label: "Evaluando Constraints",
    data: { constraints, currentMinutes, totalTempoReward },
  });

  // Si la actividad está completada, retornamos los constraints sin cambios y sin fallos
  if (activity.status === "completed") {
    return {
      updatedConstraints: constraints,
      failedConstraints: [],
    };
  }

  const updatedConstraints: ExpirationChallengeConstraint[] = [];
  const failedConstraints: Array<{
    constraint: ExpirationChallengeConstraint;
    penaltyAmount: number;
  }> = [];

  // Verificar si la actividad fue creada hoy
  const activityCreationDate = new Date(activity.createdAt);
  const currentDate = new Date(currentTimestamp);
  const activityWasCreatedToday =
    activityCreationDate.getFullYear() === currentDate.getFullYear() &&
    activityCreationDate.getMonth() === currentDate.getMonth() &&
    activityCreationDate.getDate() === currentDate.getDate();

  // Obtener el minuto del día en que fue creada la actividad
  const activityCreationMinute = getMinutesFromTimestamp(activity.createdAt);

  constraints.forEach((constraint) => {
    // Solo evaluamos constraints activos
    if (constraint.status === "failed") {
      formatMultiLog({
        label: "Ignorando Constraint Ya Fallido",
        data: { constraintId: constraint.id },
      });
      updatedConstraints.push(constraint);
      return;
    }

    // Solo evaluamos constraints de expiración que estén activos
    if (constraint.type === "expiration" && constraint.status === "active") {
      if (currentMinutes > constraint.dayMinuteExpiration) {
        // Verificar si debemos exonerar el constraint
        const expirationMinuteIsBeforeActivityCreationMinute =
          constraint.dayMinuteExpiration < activityCreationMinute;

        const shouldExemptConstraint =
          activityWasCreatedToday && expirationMinuteIsBeforeActivityCreationMinute;

        if (shouldExemptConstraint) {
          // Si la actividad fue creada hoy después del minuto de expiración,
          // simplemente mantenemos el constraint sin cambios
          updatedConstraints.push(constraint);
          return;
        }

        // Se ha vencido el tiempo permitido para este constraint
        // Calcular el monto de la penalización
        let penaltyAmount = 0;
        if (typeof constraint.penalty === "number") {
          penaltyAmount = constraint.penalty;
        } else if (typeof constraint.penalty === "string") {
          // Ejemplo: "100%" se interpreta como 100% del totalTempoReward
          const porcentaje = parseFloat(constraint.penalty.replace("%", ""));
          penaltyAmount = (porcentaje / 100) * totalTempoReward;
        }

        // Actualizar el constraint: marcar como fallido y aumentar el contador de fallos
        const updatedConstraint: ExpirationChallengeConstraint = {
          ...constraint,
          failCount: constraint.failCount + 1,
          status: "failed",
        };

        updatedConstraints.push(updatedConstraint);
        failedConstraints.push({ constraint: updatedConstraint, penaltyAmount });
      } else {
        // Si no ha fallado, lo mantenemos igual
        updatedConstraints.push(constraint);
      }
    } else {
      // Si no es de tipo expiración o no está activo, lo mantenemos igual
      updatedConstraints.push(constraint);
    }
  });

  return {
    updatedConstraints,
    failedConstraints,
  };
};

/**
 * Función principal que actualiza el estado del sistema según el tiempo transcurrido
 */
export function updateTimeState({
  currentDay,
  lastUpdateTimestamp,
  currentActivity,
  systemParams,
  totalTempoBalance,
  timeSimulator,
}: TimeStateInput): TimeStateResult {
  if (!currentDay) {
    return {
      shouldEndDay: false,
      processedMinutes: 0,
      timeRecords: [],
      newDayTempoBalance: 0,
      newTotalTempoBalance: totalTempoBalance,
      updatedTimestamp: lastUpdateTimestamp,
      updatedActivity: undefined,
    };
  }

  const now = timeSimulator.now();
  const deltaTime = Math.floor((now - lastUpdateTimestamp) / 60000);

  if (deltaTime <= 0) {
    return {
      shouldEndDay: false,
      processedMinutes: 0,
      timeRecords: [],
      newDayTempoBalance: currentDay.dayTempoBalance,
      newTotalTempoBalance: totalTempoBalance,
      updatedTimestamp: lastUpdateTimestamp,
      updatedActivity: undefined,
    };
  }

  const dayEndTimestamp = currentDay.date + 960 * 60000; // 16 horas en ms
  const remainingDayTime = dayEndTimestamp - lastUpdateTimestamp;
  const remainingDayMinutes = Math.floor(remainingDayTime / 60000);
  const processableMinutes = Math.min(deltaTime, remainingDayMinutes);

  if (processableMinutes <= 0) {
    return {
      shouldEndDay: true,
      processedMinutes: 0,
      timeRecords: [],
      newDayTempoBalance: currentDay.dayTempoBalance,
      newTotalTempoBalance: totalTempoBalance,
      updatedTimestamp: lastUpdateTimestamp,
      updatedActivity: undefined,
    };
  }

  const { timeRecords, updatedActivity, updatedTimestamp } = processTimeBatch({
    deltaTime: processableMinutes,
    baseTimestamp: lastUpdateTimestamp,
    currentActivity,
    systemParams,
  });

  let newDayTempoBalance = currentDay.dayTempoBalance;
  let newTotalTempoBalance = totalTempoBalance;

  // Calcular los nuevos balances
  timeRecords.forEach((record) => {
    const { newDayTempoBalance: dayBalance, newTotalTempoBalance: totalBalance } =
      calculateNewBalances({
        currentDayBalance: newDayTempoBalance,
        totalBalance: newTotalTempoBalance,
        tempoModification: record.tempoModification,
      });

    newDayTempoBalance = dayBalance;
    newTotalTempoBalance = totalBalance;
  });

  return {
    shouldEndDay: processableMinutes < deltaTime,
    processedMinutes: processableMinutes,
    timeRecords,
    newDayTempoBalance,
    newTotalTempoBalance,
    updatedTimestamp,
    updatedActivity,
  };
}

/**
 * Crea un registro del día con toda la información relevante
 * @param params Parámetros necesarios para crear el registro del día
 * @returns DayRecord con la información del día
 */
export function createDayRecord({
  currentDay,
  activities,
  investedTimeHistory,
  tempoModificationHistory,
  usefulMetrics,
}: {
  currentDay: DayState;
  activities: Activity[];
  investedTimeHistory: InvestedTimeHistory;
  tempoModificationHistory: TempoModificationHistory;
  usefulMetrics: UsefulMetrics;
}): DayRecord {
  // Crear el registro base del día
  const dayRecord: DayRecord = {
    dayState: currentDay,
    investedTimeHistory,
    tempoModificationHistory,
    activitiesFinalState: {},
    usefulMetrics,
  };

  // Recopilar el estado final de todas las actividades
  for (const activity of activities) {
    dayRecord.activitiesFinalState[activity.id] = activity;
  }

  return dayRecord;
}

export function processActivitiesAtDayEnd(activities: Activity[]): {
  activitiesToRemove: Activity[];
  activitiesToReset: Array<Partial<Activity> & { id: string }>;
} {
  const activitiesToRemove: Activity[] = [];
  const activitiesToReset: Array<Partial<Activity> & { id: string }> = [];

  for (const activity of activities) {
    if (!activity.isRepetitive) {
      activitiesToRemove.push(activity);
    } else {
      // Preparar la actualización para actividades repetibles
      const resetState: Partial<Activity> & { id: string } = {
        id: activity.id,
        status: "toDo",
        minutesActive: 0,
      };

      // Agregar propiedades específicas para desafíos
      if (activity.type === "challenge") {
        const resetChallenge = resetState as Partial<ChallengeActivity>;
        resetChallenge.tempoGeneratingMinutes = 0;
        resetChallenge.exceededMinutes = 0;

        // Reiniciar los constraints solo si existen en la actividad original
        if ("constraintList" in activity && activity.constraintList.length > 0) {
          resetChallenge.constraintList = activity.constraintList.map((constraint) => ({
            ...constraint,
            status: "active",
            failCount: 0,
          }));
        }
      }

      activitiesToReset.push(resetState);
    }
  }

  return {
    activitiesToRemove,
    activitiesToReset,
  };
}
