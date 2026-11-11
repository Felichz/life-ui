// ===============================================
// Basic Types
// ===============================================
export type UUID = string;
export type ISODateTimeString = string;
export type MinutesNumber = number;
export type DayMinutes = number; // 0-1439 minutes within a day

// ===============================================
// Core Types
// ===============================================

// Activity types
export type ActivityType = "clear-objective" | "flexible-duration" | "timeboxing";

// Activity states
export type ActivityState = "in-library" | "instantiated" | "active" | "completed" | "interrupted";

// Timeboxing types
export type TimeboxingType = "minimum-time" | "maximum-time" | "both";

// Day states
export type DayState = "active" | "inactive";

// ===============================================
// Dynamic Types
// ===============================================

/**
 * Dynamic settings for activity instances
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
// Main Entities
// ===============================================

/**
 * Activity template in the library
 * Holds immutable properties and default values
 */
export interface ActivityTemplate {
  id: UUID;
  title: string;
  description: string;
  type: ActivityType;
  isSystemActivity: boolean; // True for system activities (Autopilot, etc.)
  /** Pinned in "Quick access": can be started with one tap. */
  pinned?: boolean;

  // Type-specific properties (only the one matching the type is used)
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
 * Activity instance on the Kanban board or active
 * Holds settings specific to this instance for the day
 */
export interface ActivityInstance {
  id: UUID;
  templateId: UUID; // Reference to the library template
  blockId: UUID; // Reference to the time block it is placed in
  order: number; // Order within the time block
  state: ActivityState;

  // Settings specific to this instance
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

  // Time data (only for the active activity)
  startTime?: ISODateTimeString;

  /**
   * Planned start, in minutes of the day (ADR-006). A plan, not a gate: the
   * block still decides when it can start. Cleared when the activity carries
   * over to another day.
   */
  scheduledStart?: DayMinutes;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Completed/interrupted activity in the history
 * Persisted data of a finished activity
 */
export interface CompletedActivityRecord {
  id: UUID;
  activityInstanceId?: UUID;
  templateId: UUID;
  templateTitle: string;
  state: "completed" | "interrupted";
  type: ActivityType;

  // Specific settings used
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

  // Time data
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  durationMinutes: MinutesNumber;

  // Tempo system (schema v2+). The core always sets them;
  // they are optional in the type only to tolerate legacy test fixtures
  // and states from before the v1->v2 migration.
  satisfactionScore?: number;
  temposAwarded?: number;
  beatEstimate?: boolean;

  // Day it belongs to
  dayId: UUID;

  createdAt: ISODateTimeString;
  /** What the person said about how it went, in their words (ADR-002). */
  closingNote?: string;
}

/**
 * Time block on the Kanban board
 * Defines a time range within the day
 */
export interface TimeBlock {
  id: UUID;
  name: string;
  startMinute: DayMinutes; // Minutes since 00:00 (0-1439)
  endMinute: DayMinutes; // Minutes since 00:00 (0-1439)
  isDefault: boolean; // True for the "Por Hacer" block
  order: number; // Display order on the Kanban

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Event Template
 * Reusable definition of an event type
 */
export interface EventTemplate {
  id: UUID;
  name: string;

  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

/**
 * Event Instance
 * Record of an event that occurred at a specific moment
 */
export interface EventInstance {
  id: UUID;
  templateId: UUID;
  templateName: string; // To simplify display
  timestamp: ISODateTimeString;
  dayId: UUID; // Day it belongs to

  createdAt: ISODateTimeString;
}

/**
 * Day
 * Represents a day within the system
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
 * User Preferences
 * Persistent personalized settings
 */
export interface UserPreferences {
  dailyTempoTarget?: number; // Schema v2+: default 1000, optional for legacy

  updatedAt: ISODateTimeString;
}

// ===============================================
// Application State
// ===============================================

/**
 * Archive of legacy data removed in the v2->v3 migration.
 * Holds the subjective variables, interruption causes, snapshots and
 * `hiddenSubjectiveVariableIds` that existed in earlier states. Kept
 * only for auditing or explicit export; the runtime no longer uses it.
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
 * Global State (persists across days)
 * Holds historical data and persistent settings
 */
export interface GlobalState {
  // Persistent settings
  days: Day[];
  activityTemplates: ActivityTemplate[];
  eventTemplates: EventTemplate[];
  timeBlocks: TimeBlock[]; // Time blocks are persistent
  userPreferences: UserPreferences;

  // Historical data
  completedActivityRecords: CompletedActivityRecord[];
  eventInstances: EventInstance[];

  // Transient data between days
  pendingActivityInstances?: ActivityInstance[]; // Pending activities carried over from one day to the next

  // Version of the persisted schema (for migrations). Default 3.
  schemaVersion?: number;

  /**
   * Schema v3+: archive of legacy data (subjective variables + causes + snapshots
   * + hiddenSubjectiveVariableIds) that were removed from the main shape.
   * Only present if the v2->v3 migration archived something. Not read by the runtime.
   */
  legacyArchive?: LegacyArchive;
}

/**
 * Current Day State
 * Holds data specific to the ongoing day
 */
export interface CurrentDayState {
  day: Day;
  activityInstances: ActivityInstance[];
  activeActivityInstanceId?: UUID;
}

/**
 * Full Application State
 * Combines the global state and the current day's state
 */
export interface AppState {
  global: GlobalState;
  currentDay: CurrentDayState | null;
}

// ===============================================
// Types for Analytics and Visualizations
// ===============================================

/**
 * Data for the timeline visualization
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
   * Schema v2+: each interrupted activity appears as a mark on the timeline.
   * There is no avoidable/unavoidable classification or cause: the system does not ask,
   * it only records the moment.
   */
  interruptions: {
    id: UUID;
    activityId: UUID;
    timestamp: ISODateTimeString;
    position: DayMinutes;
  }[];
}

/**
 * Data for the time distribution visualization
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
 * Activity statistics for analytics
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
 * Tempo summary for a day
 * Derived calculation, not persisted
 */
export interface TempoSummary {
  totalTempos: number;
  target: number;
  /**
   * Real ratio without a cap (can be > 1 if you exceeded the target).
   * E.g.: 1847 / 1000 = 1.847
   */
  targetProgress: number;
  /**
   * Value for the progress bar (always 0..100).
   * To show >100%, `displayPercent` is used, which is not capped either.
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
 * Tempo trend point over time
 */
export interface TempoTrendPoint {
  date: ISODateTimeString;
  totalTempos: number;
  targetProgress: number;
  averageSatisfaction: number;
}

/**
 * Activity completion request: what the UI needs to show the modal.
 * The timestamp is frozen when completion is requested; completeActivity uses it
 * so the duration does not change while the user decides.
 */
export interface CompletionRequest {
  activityTitle: string;
  durationMinutes: number;
  estimatedMinutes?: number;
  /**
   * Informational metric: indicates whether the activity was completed before 80%
   * of the estimate (only applies to clear-objective with a single estimate).
   *
   * In MVP v3 it does NOT affect the tempo formula: the user decides the
   * bonus explicitly by moving the slider to 8/9/10. This flag is
   * kept only as info in the CompletionModal ("you beat the
   * estimate") and as record data for future analytics.
   */
  beatEstimate: boolean;
  requestedAt: ISODateTimeString;
}

/**
 * Result of completing an activity: what the core returns to the UI
 */
export interface CompletionResult {
  record: CompletedActivityRecord;
  temposAwarded: number;
  beatEstimate: boolean;
  dailyTempoTotal: number;
  /**
   * Real ratio without a cap (can be > 1 if you exceeded the target).
   * Consistent with `TempoSummary.targetProgress` and `TempoTrendPoint.targetProgress`.
   */
  targetProgress: number;
}

// ===============================================
// Interfaces for System Modules
// ===============================================

/**
 * Interface for the PersistenceManager
 */
export interface IPersistenceManager {
  saveState(state: AppState): void;
  loadState(): AppState | null;
  clearState(): void;
}

/**
 * Interface for SystemCore
 */
export interface ISystemCore {
  getState(): AppState;
  updateState(updater: (state: AppState) => AppState): void;

  // Subscription to state changes
  onStateChange(callback: (newState: AppState) => void): () => void;

  // DayManager methods
  startDay(): Day;
  endDay(): Day;
  getCurrentDay(): Day | null;
  isDayActive(): boolean;

  // ActivityManager methods
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
    assessment: { satisfactionScore: number; endTime?: ISODateTimeString; note?: string }
  ): CompletionResult;
  scheduleActivityInstance(id: UUID, minute: DayMinutes | null): ActivityInstance;
  interruptActivity(activityId: UUID): CompletedActivityRecord;
  getActiveActivity(): ActivityInstance | null;

  // TimeBlockManager methods
  createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock;
  updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock;
  deleteTimeBlock(id: UUID, moveActivitiesToTodo?: boolean): void;
  getTimeBlocks(): TimeBlock[];
  getCurrentTimeBlock(): TimeBlock | null;
  isTimeBlockAvailable(blockId: UUID): boolean;
  isTimeBlockExisting(blockId: UUID): boolean;

  // EventManager methods
  createEventTemplate(name: string): EventTemplate;
  updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate;
  deleteEventTemplate(id: UUID): void;
  createEventInstance(templateId: UUID): EventInstance;
  getEventInstances(filters?: { dayId?: UUID; since?: string; until?: string }): EventInstance[];
  getRecentEvents(minutesWindow?: number): EventInstance[];

  // AnalyticsManager methods
  getTimelineData(dayId?: UUID): TimelineData;
  getTimeDistributionData(dayId?: UUID): TimeDistributionData;
  getActivityStats(templateId?: UUID): ActivityStatistics;
  getCompletionRate(): number;
  getEstimationAccuracy(): number;
  getTempoSummary(dayId: UUID): TempoSummary;
  getTempoTrends(range: { from: ISODateTimeString; to: ISODateTimeString }): TempoTrendPoint[];

  // UserPreferencesManager methods
  updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences;
  getUserPreferences(): UserPreferences;
  updateDailyTempoTarget(target: number): UserPreferences;

  // PersistenceManager methods
  exportData(): string;
  importData(jsonData: string): AppState;
  clearState(): void;
}

/**
 * Type for state update functions
 * Used for all state updates in the system
 */
export type StateUpdater = (state: AppState) => AppState;
