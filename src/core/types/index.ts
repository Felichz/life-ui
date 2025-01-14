type PenaltyId = string;

export interface Penalty {
  id: PenaltyId;
  title: string;
  amount: number;
}

export interface InvestedTimeRecord {
  timestamp: number;
  minutes: number;
  reason:
    | {
        type: "activity";
        id: ActivityId;
      }
    | {
        type: "penalty";
        id: PenaltyId;
      }
    | {
        type: "passiveTempoConsumption";
      };
  tempoModification: number;
}

export type InvestedTimeHistory = InvestedTimeRecord[];

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

type ActivityType = "challenge" | "neutral" | "disscount";
type ActivityStatus = "pending" | "completed";

type ActivityId = string;

export interface Activity {
  id: ActivityId;
  title: string;
  type: ActivityType;
  isRepetitive: boolean;
  tempoReward: number;
  estimatedDuration: number;
  allowedTimeWindow?: {
    start: string;
    end: string;
  };
  constraintList: ActivityConstraint[];
  status: ActivityStatus;
}

type BoardId = string;

export interface Board {
  id: BoardId;
  parentBoardId: BoardId | undefined;
  childrenBoards: BoardId[] | undefined;
  activities: ActivityId[];
  activityProps: Pick<Activity, "isRepetitive" | "allowedTimeWindow" | "constraintList">;
  title: string;
}

export interface UsefulMetrics {
  totalGeneratedTemposEver: number;
  totalMinutesInvested: {
    intrinsecProductivity: number;
    challenges: number;
    hobbies: number;
    rest: number;
    other: number;
  };
}

export interface SystemParams {
  /**
   * Tasa de consumo de tempo por minuto.
   * @default 1
   */
  passiveTempoConsumptionRate: number;
}

export type DayState = {
  date: number;
  // Minuto del 0 al 1440
  dayStartMinute: number;
  dayTempoBalance: number;
};

export type PersistedDayState =
  | {
      lifecycleState: "dayInProgress";
      currentDay: DayState;
    }
  | {
      lifecycleState: "dayNotStarted";
      currentDay: undefined;
    };

export type PersistedState = {
  boards: Record<BoardId, Board>;
  activities: Record<ActivityId, Activity>;
  selectedActivity?: Activity | undefined;
  totalTempoBalance: number;
  investedTimeHistory: InvestedTimeHistory;
  usefulMetrics: UsefulMetrics;
  systemParams: SystemParams;
} & PersistedDayState;

// API para interacutar con la base de datos o local storage, persistencia del state del sistema
export interface SystemAPIType {
  // Obtiene todo el estado del sistema
  getPersistedState: () => PersistedState;

  // Gestión del ciclo de vida del sistema
  startDay: (currentDay: DayState) => void;
  endDay: () => void;
  getLifecycleState: () => PersistedState["lifecycleState"];

  // Gestión de tableros (Boards)
  getBoard: ({ boardId }: { boardId: BoardId }) => PersistedState["boards"][BoardId] | undefined;
  getBoards: () => Board[];
  createBoard: (board: Board) => void;
  updateBoard: ({ boardId, board }: { boardId: BoardId; board: Partial<Board> }) => void;
  removeBoard: ({ boardId }: { boardId: BoardId }) => void;

  // Gestión de actividades
  getActivity: ({
    activityId,
  }: {
    activityId: ActivityId;
  }) => PersistedState["activities"][ActivityId] | undefined;
  getActivities: () => Activity[];
  createActivity: (activity: Activity) => void;
  updateActivity: ({
    activityId,
    activity,
  }: {
    activityId: ActivityId;
    activity: Partial<Activity>;
  }) => void;
  removeActivity: ({ activityId }: { activityId: ActivityId }) => void;
  getSelectedActivity: () => PersistedState["selectedActivity"];
  setSelectedActivity: ({ activity }: { activity: PersistedState["selectedActivity"] }) => void;

  // Gestión de Tempo
  getTotalTempoBalance: () => PersistedState["totalTempoBalance"];

  updateTempoBalance: ({
    amount,
    investedTimeRecord,
  }: {
    amount: number;
    investedTimeRecord: InvestedTimeRecord;
  }) => void;

  getInvestedTimeHistory: () => PersistedState["investedTimeHistory"];
  getInvestedTimeHistoryByDay: ({ day }: { day: Date }) => PersistedState["investedTimeHistory"];

  // Métricas y parámetros del sistema
  getUsefulMetrics: () => PersistedState["usefulMetrics"];
  updateUsefulMetrics: ({ metrics }: { metrics: PersistedState["usefulMetrics"] }) => void;

  getSystemParams: () => PersistedState["systemParams"];
  updateSystemParams: (params: PersistedState["systemParams"]) => void;

  getCurrentDay: () => DayState | undefined;
}

// Este es estado del sistema que se mantiene en la ui, se mantiene en el SystemContext
// sincronizado y actualizado con el SystemAPI mediante el SystemEngine
export type UiState = {
  currentDay?: DayState | undefined;
  lifecycleState: PersistedState["lifecycleState"];
  totalTempoBalance: number;
  investedTimeHistory: InvestedTimeRecord[];
  selectedActivity?: Activity | undefined;
  boards: Board[];
  activities: Activity[];
  usefulMetrics: UsefulMetrics;
  systemParams: SystemParams;
};
