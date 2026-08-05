// ===============================================
// Tipos Básicos
// ===============================================
export type UUID = string;
export type ISODateTimeString = string;
export type MinutesNumber = number;
export type DayMinutes = number; // 0-1439 minutos dentro de un día

// ===============================================
// Tipos Fundamentales
// ===============================================

// Tipos de Actividad
export type ActivityType = "clear-objective" | "flexible-duration" | "timeboxing";

// Estados de Actividad
export type ActivityState = "in-library" | "instantiated" | "active" | "completed" | "interrupted";

// Tipos de Timeboxing
export type TimeboxingType = "minimum-time" | "maximum-time" | "both";

// Estados del Día
export type DayState = "active" | "inactive";

// ===============================================
// Tipos Dinámicos
// ===============================================

/**
 * Configuraciones dinámicas para instancias de actividades
 */
export type DynamicSettings = {
  clearObjectiveSettings?: {
    estimatedDurationMinutes: number;
  };
  flexibleDurationSettings?: {
    minimumDurationMinutes: number;
    maximumDurationMinutes: number;
  };
  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: number;
    maximumDurationMinutes?: number;
  };
};

// ===============================================
// Entidades Principales
// ===============================================

/**
 * Plantilla de actividad en la biblioteca
 * Contiene propiedades inmutables y valores predeterminados
 */
export interface ActivityTemplate {
  id: UUID;
  title: string;
  description: string;
  type: ActivityType;
  isSystemActivity: boolean; // True para actividades del sistema (Piloto Auto, etc.)

  // Propiedades específicas según tipo (solo una se utilizará según el tipo)
  clearObjectiveSettings?: {
    estimatedDurationMinutes: MinutesNumber;
  };

  flexibleDurationSettings?: {
    minimumDurationMinutes: MinutesNumber;
    maximumDurationMinutes: MinutesNumber;
  };

  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: MinutesNumber;
    maximumDurationMinutes?: MinutesNumber;
  };

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Instancia de actividad en el tablero Kanban o activa
 * Contiene configuración específica para esta instancia del día
 */
export interface ActivityInstance {
  id: UUID;
  templateId: UUID; // Referencia a la plantilla en biblioteca
  blockId: UUID; // Referencia al bloque de tiempo donde está colocada
  order: number; // Orden dentro del bloque de tiempo
  state: ActivityState;

  // Configuraciones específicas para esta instancia
  clearObjectiveSettings?: {
    estimatedDurationMinutes: MinutesNumber;
  };

  flexibleDurationSettings?: {
    minimumDurationMinutes: MinutesNumber;
    maximumDurationMinutes: MinutesNumber;
  };

  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: MinutesNumber;
    maximumDurationMinutes?: MinutesNumber;
  };

  // Datos de tiempo (solo para actividad activa)
  startTime?: ISODateTimeString;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Actividad completada/interrumpida en el historial
 * Datos persistidos de una actividad finalizada
 */
export interface CompletedActivityRecord {
  id: UUID;
  activityInstanceId?: UUID;
  templateId: UUID;
  templateTitle: string;
  state: "completed" | "interrupted";
  type: ActivityType;

  // Configuraciones específicas usadas
  clearObjectiveSettings?: {
    estimatedDurationMinutes: MinutesNumber;
  };

  flexibleDurationSettings?: {
    minimumDurationMinutes: MinutesNumber;
    maximumDurationMinutes: MinutesNumber;
  };

  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: MinutesNumber;
    maximumDurationMinutes?: MinutesNumber;
  };

  // Datos de tiempo
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  durationMinutes: MinutesNumber;

  // Sistema de tempos (schema v2+). El core siempre los setea;
  // son opcionales en el tipo solo para tolerar fixtures de tests legacy
  // y estados anteriores a la migración v1→v2.
  satisfactionScore?: number;
  temposAwarded?: number;
  beatEstimate?: boolean;

  // Día al que pertenece
  dayId: UUID;

  createdAt: ISODateTimeString;
}

/**
 * Bloque de tiempo en el tablero Kanban
 * Define un rango horario dentro del día
 */
export interface TimeBlock {
  id: UUID;
  name: string;
  startMinute: DayMinutes; // Minutos desde 00:00 (0-1439)
  endMinute: DayMinutes; // Minutos desde 00:00 (0-1439)
  isDefault: boolean; // True para bloque "Por Hacer"
  order: number; // Orden de visualización en Kanban

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Plantilla de Evento
 * Definición reutilizable de un tipo de evento
 */
export interface EventTemplate {
  id: UUID;
  name: string;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Instancia de Evento
 * Registro de un evento ocurrido en un momento específico
 */
export interface EventInstance {
  id: UUID;
  templateId: UUID;
  templateName: string; // Para facilitar visualización
  timestamp: ISODateTimeString;
  dayId: UUID; // Día al que pertenece

  createdAt: ISODateTimeString;
}

/**
 * Día
 * Representa un día dentro del sistema
 */
export interface Day {
  id: UUID;
  state: DayState;
  startTime?: ISODateTimeString;
  endTime?: ISODateTimeString;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Preferencias de Usuario
 * Configuraciones personalizadas persistentes
 */
export interface UserPreferences {
  dailyTempoTarget?: number; // Schema v2+: default 1000, opcional para legacy

  updatedAt: ISODateTimeString;
}

// ===============================================
// Estados de la Aplicación
// ===============================================

/**
 * Archivo de datos legacy eliminados en la migración v2→v3.
 * Contiene las variables subjetivas, causas de interrupción, snapshots y
 * `hiddenSubjectiveVariableIds` que existían en estados previos. Se conserva
 * sólo para auditoría o exportación explícita; el runtime ya no lo usa.
 */
export interface LegacyArchive {
  subjectiveVariables: unknown[];
  interruptionCauses: unknown[];
  subjectiveVariableSnapshots: unknown[];
  hiddenSubjectiveVariableIds: unknown[];
  archivedAt: ISODateTimeString;
  fromSchemaVersion: number;
}

/**
 * Estado Global (persiste entre días)
 * Contiene datos históricos y configuraciones persistentes
 */
export interface GlobalState {
  // Configuraciones persistentes
  days: Day[];
  activityTemplates: ActivityTemplate[];
  eventTemplates: EventTemplate[];
  timeBlocks: TimeBlock[]; // Bloques de tiempo son persistentes
  userPreferences: UserPreferences;

  // Datos históricos
  completedActivityRecords: CompletedActivityRecord[];
  eventInstances: EventInstance[];

  // Datos transitorios entre días
  pendingActivityInstances?: ActivityInstance[]; // Actividades pendientes al pasar de un día a otro

  // Versión del esquema persistido (para migraciones). Default 3.
  schemaVersion?: number;

  /**
   * Schema v3+: archivo de datos legacy (variables subjetivas + causas + snapshots
   * + hiddenSubjectiveVariableIds) que fueron eliminados del shape principal.
   * Solo presente si la migración v2→v3 archivó algo. No es leído por el runtime.
   */
  legacyArchive?: LegacyArchive;
}

/**
 * Estado del Día Actual
 * Contiene datos específicos del día en curso
 */
export interface CurrentDayState {
  day: Day;
  activityInstances: ActivityInstance[];
  activeActivityInstanceId?: UUID;
}

/**
 * Estado Completo de la Aplicación
 * Combina el estado global y el del día actual
 */
export interface AppState {
  global: GlobalState;
  currentDay: CurrentDayState | null;
}

// ===============================================
// Tipos para Análisis y Visualizaciones
// ===============================================

/**
 * Datos para visualización de timeline
 */
export interface TimelineData {
  activities: {
    id: UUID;
    title: string;
    startTime: ISODateTimeString;
    endTime: ISODateTimeString;
    durationMinutes: number;
    type: ActivityType;
    state: "completed" | "interrupted";
    estimatedDuration?: number;
    isWithinEstimation?: boolean;
  }[];
  events: {
    id: UUID;
    name: string;
    timestamp: ISODateTimeString;
    position: DayMinutes;
  }[];
  /**
   * Schema v2+: cada actividad interrumpida aparece como marca en el timeline.
   * No hay clasificación evitable/innevitable ni causa: el sistema no pregunta,
   * solo registra el momento.
   */
  interruptions: {
    id: UUID;
    activityId: UUID;
    timestamp: ISODateTimeString;
    position: DayMinutes;
  }[];
}

/**
 * Datos para visualización de distribución de tiempo
 */
export interface TimeDistributionData {
  categories: {
    name: string;
    totalMinutes: number;
    percentage: number;
    activities: {
      id: UUID;
      title: string;
      minutes: number;
      percentage: number;
    }[];
  }[];
}

/**
 * Estadísticas de actividad para análisis
 */
export interface ActivityStatistics {
  totalInstances: number;
  completedInstances: number;
  interruptedInstances: number;
  completionRate: number;
  averageDuration: number;
  estimationAccuracy?: number;
}

/**
 * Resumen de tempos de un día
 * Calculado derivado, no persistido
 */
export interface TempoSummary {
  totalTempos: number;
  target: number;
  /**
   * Ratio real sin cap (puede ser > 1 si superaste el target).
   * Ej: 1847 / 1000 = 1.847
   */
  targetProgress: number;
  /**
   * Valor para la barra de progreso (siempre 0..100).
   * Para mostrar >100% se usa `displayPercent` que tampoco se capa.
   */
  progressBarValue: number;
  displayPercent: number;
  completedActivities: number;
  averageSatisfaction: number;
  lastReward?: {
    recordId: UUID;
    activityTitle: string;
    tempos: number;
  };
}

/**
 * Punto de tendencia de tempos en el tiempo
 */
export interface TempoTrendPoint {
  date: ISODateTimeString;
  totalTempos: number;
  targetProgress: number;
  averageSatisfaction: number;
}

/**
 * Solicitud de cierre de actividad: lo que la UI necesita para mostrar el modal.
 * El timestamp se congela al pedir el cierre; completeActivity lo usa para que
 * la duración no cambie mientras el usuario decide.
 */
export interface CompletionRequest {
  activityTitle: string;
  durationMinutes: number;
  estimatedMinutes?: number;
  canApplyBonus: boolean;
  requestedAt: ISODateTimeString;
}

/**
 * Resultado de cerrar una actividad: lo que el core retorna a la UI
 */
export interface CompletionResult {
  record: CompletedActivityRecord;
  temposAwarded: number;
  beatEstimate: boolean;
  dailyTempoTotal: number;
  /**
   * Ratio real sin cap (puede ser > 1 si superaste el target).
   * Consistente con `TempoSummary.targetProgress` y `TempoTrendPoint.targetProgress`.
   */
  targetProgress: number;
}

// ===============================================
// Interfaces para Módulos del Sistema
// ===============================================

/**
 * Interfaz para el PersistenceManager
 */
export interface IPersistenceManager {
  saveState(state: AppState): void;
  loadState(): AppState | null;
  clearState(): void;
}

/**
 * Interfaz para SystemCore
 */
export interface ISystemCore {
  getState(): AppState;
  updateState(updater: (state: AppState) => AppState): void;

  // Suscripción a cambios de estado
  onStateChange(callback: (newState: AppState) => void): () => void;

  // Métodos de DayManager
  startDay(): Day;
  endDay(): Day;
  getCurrentDay(): Day | null;
  isDayActive(): boolean;

  // Métodos de ActivityManager
  createActivityTemplate(
    data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">
  ): ActivityTemplate;
  updateActivityTemplate(id: UUID, data: Partial<ActivityTemplate>): ActivityTemplate;
  deleteActivityTemplate(id: UUID): void;
  getActivityTemplates(): ActivityTemplate[];
  createActivityInstance(
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Pick<
      ActivityInstance,
      "clearObjectiveSettings" | "flexibleDurationSettings" | "timeboxingSettings"
    >
  ): ActivityInstance;
  updateActivityInstance(id: UUID, data: Partial<ActivityInstance>): ActivityInstance;
  moveActivityInstance(id: UUID, targetBlockId: UUID, newOrder?: number): ActivityInstance;
  deleteActivityInstance(id: UUID): void;
  activateActivity(id: UUID): ActivityInstance;
  requestCompletion(activityId: UUID): CompletionRequest;
  completeActivity(
    activityId: UUID,
    assessment: { satisfactionScore: number; endTime?: ISODateTimeString }
  ): CompletionResult;
  interruptActivity(activityId: UUID): CompletedActivityRecord;
  getActiveActivity(): ActivityInstance | null;

  // Métodos de TimeBlockManager
  createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock;
  updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock;
  deleteTimeBlock(id: UUID, moveActivitiesToTodo?: boolean): void;
  getTimeBlocks(): TimeBlock[];
  getCurrentTimeBlock(): TimeBlock | null;
  isTimeBlockAvailable(blockId: UUID): boolean;
  isTimeBlockExisting(blockId: UUID): boolean;

  // Métodos de EventManager
  createEventTemplate(name: string): EventTemplate;
  updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate;
  deleteEventTemplate(id: UUID): void;
  createEventInstance(templateId: UUID): EventInstance;
  getEventInstances(filters?: { dayId?: UUID; since?: string; until?: string }): EventInstance[];
  getRecentEvents(minutesWindow?: number): EventInstance[];

  // Métodos de AnalyticsManager
  getTimelineData(dayId?: UUID): TimelineData;
  getTimeDistributionData(dayId?: UUID): TimeDistributionData;
  getActivityStats(templateId?: UUID): ActivityStatistics;
  getCompletionRate(): number;
  getEstimationAccuracy(): number;
  getTempoSummary(dayId: UUID): TempoSummary;
  getTempoTrends(range: { from: ISODateTimeString; to: ISODateTimeString }): TempoTrendPoint[];

  // Métodos de UserPreferencesManager
  updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences;
  getUserPreferences(): UserPreferences;
  updateDailyTempoTarget(target: number): UserPreferences;

  // Métodos de PersistenceManager
  exportData(): string;
  importData(jsonData: string): AppState;
  clearState(): void;
}

/**
 * Tipo para funciones de actualización de estado
 * Utilizado para todas las actualizaciones de estado en el sistema
 */
export type StateUpdater = (state: AppState) => AppState;
