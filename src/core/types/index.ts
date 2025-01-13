export interface TempoModification {
  amount: number;
  reason: string;
  timestamp: Date;
}

/** Criterio de aceptación base */
interface BaseActivityConstraint {
  /** Tipo de criterio, p. ej. "expiration" */
  type: string;
  /** Valor específico del criterio */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any;
  /** Penalización por incumplimiento (puede ser número fijo o porcentaje en string, e.g. "100%") */
  penalty?: number | string;
  /** Estado actual del criterio */
  status: "active" | "failed";
  /** Penalización actual si aplica */
  currentPenalty: number | undefined;
}

/** Criterio de expiración, que extiende el base */
interface ExpirationActivityConstraint extends BaseActivityConstraint {
  type: "expiration";
  /** value se interpreta como una fecha/hora límite */
  value: Date;
}

/** Unión de criterios disponibles */
export type ActivityConstraint = ExpirationActivityConstraint;

type ActivityType = "challenge" | "tempoNeutral";
type ActivityStatus = "pending" | "completed";

export interface Activity {
  title: string;
  type: ActivityType;
  isRepetitive: boolean;
  tempoReward: number;
  allowedTimeWindow?: {
    start: string;
    end: string;
  };
  activityConstraint: ActivityConstraint[];
  status: ActivityStatus;
}

export interface Board {
  boards: Board[] | undefined;
  activities: Activity[];
  activityProps: Pick<Activity, "isRepetitive" | "allowedTimeWindow" | "activityConstraint">;
  title: string;
}

export interface SystemState {
  totalTempoBalance: number;
  dayTempoBalance: number;
  tempoHistory: TempoModification[];
  // Minuto del 0 al 1440
  dayStartMinute?: number | undefined;
  lifecycleState: "dayStarted" | "dayInProgress" | "dayNotStarted";
  selectedActivity?: Activity | undefined;
  boards: Board[];
  activities: Activity[];
}
