type PenaltyId = string;

export interface Penalty {
  id: PenaltyId;
  title: string;
  amount: number;
}

// Registro de tiempo invertido por tipo de actividad
type InvestedTimeRecordByType =
  | {
      status: "activity";
      activityId: ActivityId;
      type: Activity["type"];
    }
  | {
      status: "idle";
      activityId?: undefined;
      type?: undefined;
    };

export type InvestedTimeRecord = {
  timestamp: number;
  tempoModification: number;
  minutesInvested: number;
} & InvestedTimeRecordByType;

export type InvestedTimeHistory = InvestedTimeRecord[];

// Modificaciones posibles para un Desafío
type ChallengeTempoModificationReason =
  | "challengeMinuteGeneration" // +1 por minuto dentro del tiempo estimado
  | "challengeCompletionReward" // Tempos restantes al completar antes
  | "challengeCriteriaFailed" // Penalización por fallar criterios
  | "passiveConsumption"; // -1/min al exceder tiempo estimado

// Modificaciones posibles para Actividad Neutral
type NeutralTempoModificationReason = "earlyNeutralActivityCompletionCompensation"; // Compensación por terminar antes

// Modificaciones posibles para Actividad Hobby
type DiscountTempoModificationReason =
  | "discountedPassiveConsumption"
  | "earlyDiscountActivityCompletionCompensation"; // Consumo a tasa reducida

type TempoModificationByType =
  | {
      status: "activity";
      activityId: ActivityId;
      type: ChallengeActivity["type"];
      reason: ChallengeTempoModificationReason;
    }
  | {
      status: "activity";
      activityId: ActivityId;
      type: NeutralActivity["type"];
      reason: NeutralTempoModificationReason;
    }
  | {
      status: "activity";
      activityId: ActivityId;
      type: HobbyActivity["type"];
      reason: DiscountTempoModificationReason;
    }
  | {
      status: "idle";
      reason: "passiveConsumption";
      activityId?: undefined;
      type?: undefined;
    };

export type TempoModificationRecord = {
  timestamp: number;
  tempoModification: number;
} & TempoModificationByType;

export type TempoModificationHistory = TempoModificationRecord[];

/** Criterio de aceptación base */
interface BaseActivityConstraint {
  /** Tipo de criterio, p. ej. "expiration" */
  type: string;
  /** Penalización por incumplimiento (puede ser número fijo o porcentaje en string, e.g. "100%") */
  penalty?: number | string;
  /** Estado actual del criterio */
  status: "active" | "failed";
}

/** Criterio de expiración, que extiende el base */
interface ExpirationActivityConstraint extends BaseActivityConstraint {
  type: "expiration";
  expirationDate: number;
}

/** Unión de criterios disponibles */
export type ActivityConstraint = ExpirationActivityConstraint;

type ActivityType = "challenge" | "neutral" | "discount";
type ActivityStatus = "toDo" | "inProgress" | "completed";

export type ActivityId = string;

interface BaseActivity {
  id: ActivityId;
  parentBoardId?: BoardId | undefined;
  type: ActivityType;
  title: string;
  isRepetitive: boolean;
  /**
   * Minutos acumulados en los que la actividad estuvo activa durante el día actual.
   * Se incrementa cada vez que pasa un minuto y está seleccionada.
   */
  minutesActive: number;

  status: ActivityStatus;
}

interface TimeLimitedActivity extends BaseActivity {
  type: "neutral" | "discount";
  allowedTimeWindow?: {
    /**
     * Minuto del 0 al 1440
     */
    start: number;
    /**
     * Minuto del 0 al 1440
     */
    end: number;
  };
}

// Actividad Tempo Neutral
export interface NeutralActivity extends TimeLimitedActivity {
  type: "neutral";
}

// Al deseleccionar antes, se da compensación (se calcula segun el tiempo restante y el descuento)
export interface HobbyActivity extends TimeLimitedActivity {
  type: "discount";
  tempoConsumptionRate: number; // Tasa reducida de consumo (ej: 0.5)
}

// Al deseleccionar antes, se da compensación para cubrir el totalTempoReward
export interface ChallengeActivity extends BaseActivity {
  type: "challenge";
  totalTempoReward: number;
  constraintList: ExpirationActivityConstraint[];
}

export type Activity = NeutralActivity | HobbyActivity | ChallengeActivity;

export type BoardId = string;

interface InheritableActivityProps {
  challenge?: Pick<ChallengeActivity, "constraintList" | "isRepetitive">;
  neutral?: Pick<NeutralActivity, "isRepetitive" | "allowedTimeWindow">;
  hobby?: Pick<HobbyActivity, "isRepetitive" | "tempoConsumptionRate" | "allowedTimeWindow">;
}

export interface Board {
  id: BoardId;
  parentBoardId: BoardId | undefined;
  childrenBoards: BoardId[] | undefined;
  activities: ActivityId[];
  activityProps: InheritableActivityProps;
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
  /**
   * Es como un timeline de los minutos invertidos en las actividades, se separa en registros por actividad (o idle)
   * No existen dos registros de la misma actividad consecutivos ni dos registros idle consecutivos.
   */
  investedTimeHistory: InvestedTimeHistory;
  tempoModificationHistory: TempoModificationHistory;
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
  getBoard: (boardId: BoardId) => Board | undefined;
  getBoards: () => Board[];
  createBoard: (board: Board) => void;
  updateBoard: (board: Board) => void;
  removeBoard: (board: Board) => void;

  // Gestión de actividades
  getActivity: (activityId: ActivityId) => Activity | undefined;
  getActivities: () => Activity[];
  createActivity: (activity: Activity) => void;
  updateActivity: (activity: Activity) => void;
  removeActivity: (activity: Activity) => void;

  getSelectedActivity: () => PersistedState["selectedActivity"];
  setSelectedActivity: (activity: PersistedState["selectedActivity"]) => void;

  // Gestión de Tempo
  getTotalTempoBalance: () => PersistedState["totalTempoBalance"];

  updateTempoBalance: ({
    investedTimeRecord,
    tempoModificationRecord,
  }: {
    investedTimeRecord: InvestedTimeRecord;
    tempoModificationRecord: TempoModificationRecord;
  }) => void;

  getInvestedTimeHistory: () => PersistedState["investedTimeHistory"];
  getInvestedTimeHistoryByDay: (day: Date) => PersistedState["investedTimeHistory"];

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
  investedTimeHistory: InvestedTimeHistory;
  selectedActivity?: Activity | undefined;
  boards: Board[];
  activities: Activity[];
  usefulMetrics: UsefulMetrics;
  systemParams: SystemParams;
};
