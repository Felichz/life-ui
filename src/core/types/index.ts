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

/** Constraints especificos de un desafio */
type BaseChallengeConstraint = {
  /** Id de esta instancia de constraint */
  id: string;
  /** Tipo de criterio, p. ej. "expiration" */
  type: string;
  /** Penalización por incumplimiento (puede ser número fijo o porcentaje en string, e.g. "100%") */
  penalty?: number | string;
  /** Id del constraint original del que este fue clonado */
  parentConstraintId?: string | undefined;
  /** Cantidad de veces que fallo este constraint (especifico para este id unico, para esta instancia en esta actividad) */
  failCount: number;
  /** Estado actual del criterio */
  status: "active" | "failed";
};

/** Criterio de expiración, que extiende el base */
export interface ExpirationChallengeConstraint extends BaseChallengeConstraint {
  type: "expiration";
  dayMinuteExpiration: number;
}

/** Unión de criterios disponibles */
export type ChallengeConstraint = ExpirationChallengeConstraint;

// Constraints que se guardan dentro de un board para luego heredarlos a los desafios
type BoardExpirationChallengeConstraint = Pick<
  ExpirationChallengeConstraint,
  "id" | "type" | "penalty" | "dayMinuteExpiration"
>;

export type BoardChallengeConstraint = BoardExpirationChallengeConstraint;

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
  allowedTime: number;
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
  constraintList: ExpirationChallengeConstraint[];
}

export type Activity = NeutralActivity | HobbyActivity | ChallengeActivity;

export interface InheritableActivityProps {
  challenge?: { constraintList: BoardChallengeConstraint[] } & Pick<
    ChallengeActivity,
    "isRepetitive"
  >;
  neutral?: Pick<NeutralActivity, "isRepetitive" | "allowedTime">;
  hobby?: Pick<HobbyActivity, "isRepetitive" | "tempoConsumptionRate" | "allowedTime">;
}

export type BoardId = string;

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
    intrinsicProductivity: number;
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
  /**
   * Si está activo, el sistema procesará cada minuto como si fuera un segundo
   * @default false
   */
  isTestMode: boolean;
  /**
   * Factor de multiplicación del tiempo en modo prueba
   * @default 1
   */
  timeMultiplier: number;
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
  selectedActivity?: ActivityId | undefined;
  totalTempoBalance: number;
  /**
   * Es como un timeline de los minutos invertidos en las actividades, se separa en registros por actividad (o idle)
   * No existen dos registros de la misma actividad consecutivos ni dos registros idle consecutivos.
   */
  investedTimeHistory: InvestedTimeHistory;
  tempoModificationHistory: TempoModificationHistory;
  usefulMetrics: UsefulMetrics;
  systemParams: SystemParams;
  /**
   * Timestamp de la última actualización del sistema
   * Se usa para calcular el tiempo transcurrido cuando la app se reactiva
   */
  lastUpdateTimestamp: number;
} & PersistedDayState;

// API para interacutar con la base de datos o local storage, persistencia del state del sistema
export interface SystemAPIType {
  // Obtiene todo el estado del sistema
  getPersistedState: () => Promise<PersistedState>;

  // Gestión del ciclo de vida del sistema
  getLifecycleState: () => Promise<PersistedState["lifecycleState"]>;
  startDay: (currentDay: DayState) => Promise<void>;
  endDay: () => Promise<void>;

  // Gestión de tableros (Boards)
  getBoard: (boardId: BoardId) => Promise<Board | undefined>;
  getBoards: () => Promise<Board[]>;
  createBoard: (board: Board) => Promise<void>;
  updateBoard: (board: Board) => Promise<void>;
  removeBoard: (board: Board) => Promise<void>;

  // Gestión de actividades
  getActivity: (activityId: ActivityId) => Promise<Activity | undefined>;
  getActivities: () => Promise<Activity[]>;
  createActivity: (activity: Activity) => Promise<void>;
  updateActivity: (activityUpdates: Partial<Activity> & { id: ActivityId }) => Promise<void>;
  removeActivity: (activity: Activity) => Promise<void>;

  getSelectedActivity: () => Promise<Activity | undefined>;
  setSelectedActivity: (activity: Activity) => Promise<void>;
  unselectActivity: () => Promise<void>;

  // Gestión de Tempo
  getTotalTempoBalance: () => Promise<PersistedState["totalTempoBalance"]>;

  updateTempoBalance: ({
    investedTimeRecord,
    tempoModificationRecord,
  }: {
    investedTimeRecord?: InvestedTimeRecord | undefined;
    tempoModificationRecord: TempoModificationRecord;
  }) => Promise<void>;

  getInvestedTimeHistory: () => Promise<InvestedTimeHistory>;
  getInvestedTimeHistoryByDay: (day: Date) => Promise<InvestedTimeHistory>;

  // Agregar registros al historial de tiempo invertido
  pushToInvestedTimeHistory: (investedTimeRecord: InvestedTimeRecord) => Promise<void>;

  // Métricas y parámetros del sistema
  getUsefulMetrics: () => Promise<UsefulMetrics>;
  updateUsefulMetrics: ({ metrics }: { metrics: UsefulMetrics }) => Promise<void>;

  getSystemParams: () => Promise<SystemParams>;
  updateSystemParams: (params: SystemParams) => Promise<void>;

  getCurrentDay: () => Promise<DayState | undefined>;

  /**
   * Actualiza el timestamp de la última actualización del sistema
   */
  updateLastUpdateTimestamp: (timestamp: number) => Promise<void>;

  /**
   * Borra toda la data persistida. Solo disponible en modo de prueba.
   */
  clearAllData: () => Promise<void>;
}

// Este es estado del sistema que se mantiene en la ui, se mantiene en el SystemContext
// sincronizado y actualizado con el SystemAPI mediante el SystemEngine
export type UiState = {
  updatingSystemState: boolean;
  currentDay?: DayState | undefined;
  lifecycleState: PersistedState["lifecycleState"];
  totalTempoBalance: number;
  investedTimeHistory: InvestedTimeHistory;
  tempoModificationHistory: TempoModificationHistory;
  selectedActivity?: Activity | undefined;
  boards: Board[];
  activities: Activity[];
  usefulMetrics: UsefulMetrics;
  systemParams: SystemParams;
  lastUpdateTimestamp: number;
};

export type CreateBoardInput = Omit<Board, "id">;

export type CreateActivityBaseInput = Omit<BaseActivity, "id">;

export type CreateChallengeActivityInput = CreateActivityBaseInput &
  Omit<ChallengeActivity, keyof BaseActivity | "id">;
export type CreateNeutralActivityInput = CreateActivityBaseInput &
  Omit<NeutralActivity, keyof BaseActivity | "id">;
export type CreateHobbyActivityInput = CreateActivityBaseInput &
  Omit<HobbyActivity, keyof BaseActivity | "id">;

export type CreateActivityInput = Omit<Activity, "id">;
