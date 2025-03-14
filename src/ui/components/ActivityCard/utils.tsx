import type { Activity, ChallengeActivity, SystemParams } from "@core/types";

export type ActivityStatus = "toDo" | "inProgress" | "completed";
export type ActivityType = "challenge" | "neutral" | "discount";

/**
 * Formatea minutos a formato de hora HH:MM
 */
export const formatMinuteToTime = (minute: number): string => {
  const hours = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
};

/**
 * Formatea la penalización de un constraint
 */
export const formatConstraintPenalty = (penalty: number | string | undefined): string => {
  if (penalty === undefined) return "Sin penalización";
  if (typeof penalty === "string") return penalty;
  return `-${penalty} tempos`;
};

/**
 * Determina el color de fondo para el badge de estado
 */
export const getStatusColor = (status: ActivityStatus, activity?: Activity): string => {
  if (activity?.type === "challenge") {
    if (status === "completed") {
      return "bg-blue-500";
    }
    if (status === "inProgress") {
      const isGeneratingTempo =
        activity.minutesActive < (activity as ChallengeActivity).totalTempoReward;
      return isGeneratingTempo ? "bg-green-500" : "bg-red-500";
    }
  }

  switch (status) {
    case "toDo":
      return "";
    case "inProgress":
      return "bg-blue-500";
    case "completed":
      return "bg-green-500";
    default:
      return "bg-gray-500";
  }
};

/**
 * Obtiene la etiqueta para el estado de la actividad
 */
export const getStatusLabel = (status: ActivityStatus): string => {
  switch (status) {
    case "toDo":
      return "Por hacer";
    case "inProgress":
      return "En progreso";
    case "completed":
      return "Completada";
    default:
      return "Desconocido";
  }
};

/**
 * Obtiene la etiqueta para el tipo de actividad
 */
export const getTypeLabel = (type: ActivityType): string => {
  switch (type) {
    case "challenge":
      return "Desafío";
    case "neutral":
      return "Neutral";
    case "discount":
      return "Hobby";
    default:
      return "Desconocido";
  }
};

/**
 * Genera el mensaje para la deselección de una actividad
 */
export const getUnselectMessage = (activity: Activity, systemParams: SystemParams) => {
  if (activity.type === "challenge") {
    return "Al deseleccionar un desafío, podrás retomarlo más tarde desde donde lo dejaste.";
  }

  const remainingTime = activity.allowedTime - activity.minutesActive;

  if (activity.type === "neutral") {
    return (
      <>
        Recibirás una compensación de{" "}
        <span className="text-green-500 font-medium">+{remainingTime} tempos</span>.
      </>
    );
  }

  if (activity.type === "discount") {
    // Calcular la compensación correctamente: tiempo no utilizado * ahorro por minuto
    // Ahorro por minuto = tasa consumo pasivo - (tasa consumo pasivo * tasa consumo hobby)
    const compensationFactor =
      systemParams.passiveTempoConsumptionRate -
      systemParams.passiveTempoConsumptionRate * activity.tempoConsumptionRate;

    const compensation = remainingTime * compensationFactor;

    const formattedCompensation = Number.isInteger(compensation)
      ? compensation.toString()
      : compensation.toFixed(1);

    return (
      <>
        Recibirás una compensación de{" "}
        <span className="text-green-500 font-medium">+{formattedCompensation} tempos</span> basada
        en el tiempo restante y la tasa de consumo.
      </>
    );
  }
};

/**
 * Genera el mensaje para completar un desafío
 */
export const getCompleteMessage = (activity: ChallengeActivity) => {
  const remainingTempos = activity.totalTempoReward - activity.minutesActive;
  const isEarlyCompletion = activity.minutesActive < activity.totalTempoReward;

  if (isEarlyCompletion) {
    return (
      <>
        <p>¡Excelente! Has completado el desafío antes del tiempo estimado.</p>
        <p>
          Recibirás los{" "}
          <span className="text-green-500 font-medium">+{remainingTempos} tempos</span> restantes de
          inmediato, en lugar de esperar {remainingTempos} minutos más.
        </p>
      </>
    );
  }

  return (
    <>
      <p>Has excedido el tiempo estimado para este desafío.</p>
      <p>
        Ya has recibido el total de la recompensa ({activity.totalTempoReward} tempos) durante los
        primeros {activity.totalTempoReward} minutos.
      </p>
    </>
  );
};

/**
 * Genera una advertencia si hay constraints fallidos
 */
export const getFailedConstraintsWarning = (activity: ChallengeActivity) => {
  if (activity.constraintList.some((c) => c.status === "failed")) {
    return (
      <p className="text-destructive mt-2">
        ¡Atención! Hay criterios fallidos que pueden afectar la modificación de tempo final.
      </p>
    );
  }
  return null;
};

/**
 * Calcula el tiempo estimado de finalización para una actividad seleccionada
 */
export const getEstimatedEndTime = (
  activity: Activity,
  isSelected: boolean,
  lastUpdateTimestamp: number
): string | null => {
  if (!isSelected || activity.status !== "inProgress") return null;

  let minutesToAdd = 0;

  if (activity.type === "challenge") {
    minutesToAdd = (activity as ChallengeActivity).totalTempoReward - activity.minutesActive;
    if (minutesToAdd <= 0) return null;
  } else if ("allowedTime" in activity) {
    minutesToAdd = activity.allowedTime - activity.minutesActive;
  }

  if (minutesToAdd <= 0) return null;

  const endTime = new Date(lastUpdateTimestamp + minutesToAdd * 60000);
  return endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
};

/**
 * Verifica si una propiedad es heredada
 */
export const isPropertyInherited = (
  activity: Activity,
  propertyName: keyof typeof activity.inheritedProps
): boolean => activity.inheritedProps?.[propertyName] !== undefined;
