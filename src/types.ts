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

  // Datos de interrupción, si aplica
  interruptionData?: {
    isAvoidable: boolean;
    causeId?: UUID;
    causeDescription?: string;
  };

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
 * Definición de Variable Subjetiva
 * Variable personalizada que el usuario puede crear y actualizar
 */
export interface SubjectiveVariable {
  id: UUID;
  name: string;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Snapshot de Variables Subjetivas
 * Registro de un conjunto de valores de variables en un momento específico
 */
export interface SubjectiveVariableSnapshot {
  id: UUID;
  timestamp: ISODateTimeString;
  dayId: UUID; // Día al que pertenece

  // Valores para cada variable
  values: {
    variableId: UUID;
    variableName: string; // Para facilitar visualización
    previousValue: number; // Escala 1-10
    currentValue: number; // Escala 1-10
  }[];

  // Actividades/eventos relacionados
  relatedActivityIds: UUID[];
  relatedEventIds: UUID[];

  createdAt: ISODateTimeString;
}

/**
 * Causa de Interrupción
 * Razón por la que una actividad fue interrumpida (para causas evitables)
 */
export interface InterruptionCause {
  id: UUID;
  description: string;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
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
  hiddenSubjectiveVariableIds: UUID[]; // Variables ocultas en gráficos

  updatedAt: ISODateTimeString;
}

// ===============================================
// Estados de la Aplicación
// ===============================================

/**
 * Estado Global (persiste entre días)
 * Contiene datos históricos y configuraciones persistentes
 */
export interface GlobalState {
  // Configuraciones persistentes
  days: Day[];
  activityTemplates: ActivityTemplate[];
  eventTemplates: EventTemplate[];
  subjectiveVariables: SubjectiveVariable[];
  interruptionCauses: InterruptionCause[];
  timeBlocks: TimeBlock[]; // Bloques de tiempo son persistentes
  userPreferences: UserPreferences;

  // Datos históricos
  completedActivityRecords: CompletedActivityRecord[];
  eventInstances: EventInstance[];
  subjectiveVariableSnapshots: SubjectiveVariableSnapshot[];

  // Datos transitorios entre días
  pendingActivityInstances?: ActivityInstance[]; // Actividades pendientes al pasar de un día a otro
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
  interruptions: {
    id: UUID;
    activityId: UUID;
    timestamp: ISODateTimeString;
    position: DayMinutes;
    isAvoidable: boolean;
    cause?: string;
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
 * Datos para visualización de variables subjetivas
 */
export interface SubjectiveVariablesData {
  variables: {
    id: UUID;
    name: string;
    values: {
      timestamp: ISODateTimeString;
      value: number;
      relatedActivities: string[];
      relatedEvents: string[];
    }[];
  }[];
  timeRange: {
    start: ISODateTimeString;
    end: ISODateTimeString;
  };
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
  frequentInterruptionCauses?: {
    cause: string;
    count: number;
    percentage: number;
  }[];
}

/**
 * Estadísticas de interrupciones para análisis
 */
export interface InterruptionStatistics {
  totalInterruptions: number;
  avoidableInterruptions: number;
  unavoidableInterruptions: number;
  avoidablePercentage: number;
  topCauses: {
    id: UUID;
    description: string;
    count: number;
    percentage: number;
  }[];
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
}

/**
 * Tipo para funciones de actualización de estado
 * Utilizado para todas las actualizaciones de estado en el sistema
 */
export type StateUpdater = (state: AppState) => AppState;
