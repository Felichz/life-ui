// Type definitions for Qualia Control - Life UI System
// Commented types are left for future implementations

/**
 * Unique identifiers for all entity types in the system
 */
export type ActivityTemplateId = string; // ID for activity template in the library
export type ActivityId = string; // ID for activity instance in the day
export type BlockId = string; // ID for time block
export type ActionPlanId = string; // ID for action plan
export type CustomVariableId = string; // ID for custom variable
export type EventTemplateId = string; // ID for discrete event
export type EventId = string; // ID for discrete event
export type InterruptionCauseId = string; // ID for interruption cause
export type SnapshotId = string; // ID for variable snapshot

type UnixTimestamp = number;

/**
 * Activity Types as defined in the system
 * - goalOriented: Activities with clear objectives and defined end states
 * - flexibleDuration: Activities with flexible duration within a range
 * - timeboxed: Activities with intentional time constraints
 */
export type ActivityType = "goalOriented" | "flexibleDuration" | "timeboxed";

/**
 * Activity Status in the system workflow
 */
export type ActivityStatus = "todo" | "inProgress" | "completed" | "interrupted";

/**
 * Timebox Modes for structured time management
 */
export type TimeboxMode =
  | { mode: "minimum"; minimumMinutes: number }
  | { mode: "maximum"; maximumMinutes: number }
  | { mode: "range"; minimumMinutes: number; maximumMinutes: number };

/**
 * Universal System Activities
 */
export type SystemActivityType = "autopilot" | "meditation" | "consciousRest";

/**
 * Activity type, this can be a template or an instance
 *
 * If the `instance` prop is present, this is an instance, if not, this is a template
 */
type BaseActivity = {
  /** User-defined title for the activity */
  title: string;
  /** Optional detailed description */
  description?: string;
  /** Type of activity defining its time handling behavior */
  type: ActivityType;
  /** User-defined tags for organization */
  tags: string[];
  /** Icon identifier for visual representation */
  iconId: string;
  /** Reference to template this activity was created from, always defined */
  templateId: ActivityTemplateId;
  /** Current status of the activity */
  status: ActivityStatus;
  /** Optional parent action plan this activity belongs to */
  parentActionPlanId?: ActionPlanId;
  /** Time block this activity is assigned to */
  assignedBlockId?: BlockId;
  /** Whether this is a system activity */
  systemActivity?: boolean;
  /** Only for instances */
  instance?: {
    /** Unique identifier for the activity instance */
    id: ActivityId;
    /** Timestamp when activity was started (if applicable) */
    startTime?: UnixTimestamp;
    /** Timestamp when activity was completed or interrupted (if applicable) */
    endTime?: UnixTimestamp;
    /** Only for instances: Minutes spent in this activity */
    minutes?: number;
  };
};

/**
 * Activity with a clear objective and estimated completion time
 */
export type GoalOrientedActivityProps = {
  type: "goalOriented";
  dynamicProps: {
    /** Estimated minutes to complete the activity (~45 means approximately 45 minutes) */
    estimatedMinutes: number;
  };
  instance?: BaseActivity["instance"] & {
    type: "goalOriented";
    /** Actual minutes spent on the activity (only set when completed) */
    actualMinutes?: number;
    /** Variance between estimated and actual time (actualMinutes - estimatedMinutes) */
    timeVariance?: number;
  };
};

/**
 * Activity with flexible duration within an expected range
 */
type FlexibleDurationActivityProps = {
  type: "flexibleDuration";
  dynamicProps: {
    /** Minimum expected minutes for the activity */
    minExpectedMinutes: number;
    /** Maximum expected minutes for the activity */
    maxExpectedMinutes: number;
  };
  instance?: BaseActivity["instance"] & {
    /** Actual minutes spent on the activity (only set when completed) */
    actualMinutes?: number;
    /** Whether the actual time fell within the expected range */
    withinExpectedRange?: boolean;
  };
};

/**
 * Activity with deliberate time constraints (timebox)
 */
type TimeboxedActivityProps = {
  type: "timeboxed";
  dynamicProps: {
    /** Specific timebox configuration */
    timeboxConfig: TimeboxMode;
  };
  instance?: BaseActivity["instance"] & {
    /** Actual minutes spent on the activity (only set when completed) */
    actualMinutes?: number;
    /** Minutes of voluntary extension beyond the initial timebox */
    extensionMinutes?: number;
    /** Whether the user completed the minimum required time */
    metMinimumRequirement?: boolean;
    /** Whether the user stayed within maximum time limit */
    stayedWithinMaximum?: boolean;
  };
};

export type ActivityTypes =
  | GoalOrientedActivityProps
  | FlexibleDurationActivityProps
  | TimeboxedActivityProps;

export type Activity = BaseActivity & ActivityTypes;

/**
 * Time Block represents a predefined time range in the user's day
 */
export interface TimeBlock {
  /** Unique identifier for the time block */
  id: BlockId;
  /** User-defined title for the block */
  title: string;
  /** Start time in minutes from midnight (0-1440) */
  startMinute: number;
  /** End time in minutes from midnight (0-1440) */
  endMinute: number;
  /** Activity instances assigned to this block */
  activityInstances: Activity[];
  /** Block color for visual representation */
  color: string;
  /** Whether this block is currently active based on current time */
  isActive?: boolean;
  /** Day pattern this block appears in (weekdays, weekend, etc.) */
  // dayPattern?: DayPatternConfig;
}

/**
 * Action Plan is a predefined collection of activities with optional ordering
 */
// export interface ActionPlan {
//   /** Unique identifier for the action plan */
//   id: ActionPlanId;
//   /** User-defined title for the action plan */
//   title: string;
//   /** Optional detailed description */
//   description?: string;
//   /** Activities included in this action plan */
//   activities: {
//     /** Reference to activity template */
//     templateId: ActivityTemplateId;
//     /** Optional position in sequence (1-based, null for unordered) */
//     order?: number | null;
//     /** Override for dynamic properties */
//     dynamicOverrides?:
//       | { type: "goalOriented"; estimatedMinutes: number }
//       | { type: "flexibleDuration"; minExpectedMinutes: number; maxExpectedMinutes: number }
//       | { type: "timeboxed"; timeboxConfig: TimeboxMode };
//   }[];
//   /** Created timestamp */
//   /** Updated timestamp */
//   updatedAt: number;
// }

/**
 * Day Pattern Configuration for determining which days certain configurations apply to
 */
// export type DayPatternConfig =
//   | { pattern: "weekdays" }
//   | { pattern: "weekend" }
//   | { pattern: "everyday" }
//   | { pattern: "specific"; days: number[] }; // 0-6 representing Sunday-Saturday

/**
 * User-defined Custom Variable for tracking subjective states
 */
export interface CustomVariable {
  /** Unique identifier for the variable */
  id: CustomVariableId;
  /** User-defined name for the variable */
  name: string;
  /** Optional description of what this variable represents */
  description?: string;
  /** Minimum value on the scale */
  minValue: number;
  /** Maximum value on the scale */
  maxValue: number;
  /** Whether higher values are good or bad */
  isHigherBetter: boolean;
  /** Icon identifier for visual representation */
  iconId: string;
  /** Color for visual representation */
  color: string;
}

/**
 * Snapshot of all custom variables at a point in time
 */
export interface VariableSnapshot {
  /** Unique identifier for the snapshot */
  id: SnapshotId;
  /** Timestamp when snapshot was taken */
  timestamp: UnixTimestamp;
  /** All variable values in this snapshot */
  variables: {
    /** ID of the variable */
    variableId: CustomVariableId;
    /** Current value at snapshot time */
    currentValue: number;
    /** Previous value (from last snapshot of this variable) */
    previousValue?: number;
    /** Change magnitude (currentValue - previousValue) */
    change?: number;
  }[];
  /** Related activities that may have influenced this state */
  relatedActivityIds: ActivityId[];
  /** Related events that may have influenced this state */
  relatedEventIds: EventId[];
  /** Optional user notes about this state */
  notes?: string;
}

/**
 * Event represents a discrete occurrence (like taking medication), this can be a template or an instance
 *
 * If the `instance` prop is present, this is an instance, if not, this is a template
 */
export interface DiscreteEvent {
  /** Unique identifier for the event */
  templateId: EventTemplateId;
  /** User-defined title for the event */
  title: string;
  /** Optional detailed description */
  description?: string;
  instance?: {
    /** Unique identifier for the event */
    id: EventId;
    /** Timestamp when event occurred */
    timestamp: UnixTimestamp;
  };
  /** User-defined tags for organization */
  tags: string[];
  /** Icon identifier for visual representation */
  iconId: string;
  /** Expected delay before effects (in minutes, if applicable) */
  //   expectedEffectDelay?: number;
  //   /** Expected duration of effects (in minutes, if applicable) */
  //   expectedEffectDuration?: number;
}

/**
 * Interruption Cause tracks reasons activities are interrupted
 * We only register interruptions that the user considers avoidable and actionable
 */
export interface InterruptionCause {
  /** Unique identifier for the cause */
  id: InterruptionCauseId;
  /** User-defined title for the cause */
  title: string;
  /** Count of how many times this cause has occurred */
  occurrenceCount: number;
}

/**
 * Interrupted Activity Record
 */
export interface InterruptedActivity {
  /** ID of the interrupted activity */
  activityId: ActivityId;
  /** When the interruption occurred */
  timestamp: UnixTimestamp;
  /** ID of the cause of interruption */
  causeId: InterruptionCauseId;
  /** Minutes spent before interruption */
  minutesBeforeInterruption: number;
  /** Minutes left to complete the activity or reach the min estimation */
  minutesLeft?: number;
  /** User notes about this interruption */
  notes?: string;
}

/**
 * Satisfaction Rating for an activity
 */
export interface ActivitySatisfaction {
  /** ID of the activity being rated */
  activityId: ActivityId;
  /** When the rating was recorded */
  timestamp: UnixTimestamp;
  /** Satisfaction score (1-10) */
  satisfactionScore: number;
  /** Perceived value score (1-10) */
  valueScore: number;
  /** Optional user notes about the rating */
  notes?: string;
}

/**
 * Momentum is a derived system variable representing productivity flow
 */
export interface MomentumRecord {
  /** Timestamp for this momentum measurement */
  timestamp: UnixTimestamp;
  /** Momentum value (0-100) */
  value: number;
}

export type History = {
  variableHistory: VariableSnapshot[];
  activityHistory: Activity[];
  eventHistory: DiscreteEvent[];
  interruptionHistory: InterruptedActivity[];
  satisfactionHistory: ActivitySatisfaction[];
  momentumHistory: MomentumRecord[];
};

export type TimeDistribution = {
  /** Percentage in objective activities */
  objective: number;
  /** Percentage in flexible activities */
  flexible: number;
  /** Percentage in timebox activities */
  timebox: number;
  /** Percentage in autopilot state */
  autopilot: number;
  /** Percentage in conscious rest */
  consciousRest: number;
  /** Percentage in meditation */
  meditation: number;
};

/**
 * Daily Summary stored in the day database
 */
export interface DailySummary {
  /** Total number of activities completed */
  activitiesCompleted: number;
  /** Total number of activities interrupted */
  activitiesInterrupted: number;
  /** Percentage of activities completed vs planned */
  completionRate: number;
  /** Average satisfaction score for the day */
  averageSatisfaction: number;
  /** Average value perception score for the day */
  averageValuePerception: number;
  /** Percentage of day spent in each activity type */
  timeDistribution: TimeDistribution;
  /** Overall momentum quality for the day (0-100) */
  overallMomentumQuality: number;
}

/**
 * Day State contains summary information about the day
 */
export interface DayState {
  /** Start date of the day represented as timestamp */
  startDate: UnixTimestamp;
  /** End date of the day represented as timestamp */
  endDate: UnixTimestamp;
  /** Block assignments for this specific day */
  //   blocks: TimeBlock[];
  /** Activities assigned to specific blocks or todo column */
  activityInstances: Activity[];
  /** History of the day */
  dayHistory: History;
  /** Time distribution for the day */
  timeDistribution: TimeDistribution;
  /** Summary of the day */
  daySummary: DailySummary;
}

/**
 * User Settings for the application
 */
export interface UserSettings {
  /** Preferred theme */
  theme: "light" | "dark" | "system";
  /** UI-specific state for Kanban layout */
  kanbanState: Record<
    BlockId,
    {
      /** Expanded/collapsed state */
      isExpanded: boolean;
      /** Whether to show completed activities */
      showCompleted: boolean;
      /** Sort order for activities (default, auto, alphabetical, duration, etc.) */
      sortOrder: "default" | "auto" | "alphabetical" | "duration";
    }
  >;
  /** Default day pattern assignments */
  //   defaultDayPatterns: {
  //     /** Day pattern this config applies to */
  //     pattern: DayPatternConfig;
  //     /** Action plans automatically added on these days */
  //     actionPlans: {
  //       /** Action plan ID */
  //       actionPlanId: ActionPlanId;
  //       /** Block ID to assign to */
  //       blockId: BlockId;
  //     }[];
  //     /** Individual activities automatically added on these days */
  //     activities: {
  //       /** Activity template ID */
  //       templateId: string;
  //       /** Block ID to assign to */
  //       blockId: BlockId;
  //     }[];
  //   }[];
  /** Time between reminder prompts to update variables (in minutes) (if set) */
  variableReminderInterval?: number;
  /** Whether to show notifications for timebox limits */
  enableTimeboxNotifications: boolean;
  /** User display settings */
  displaySettings: {
    /** Whether to show the momentum chart */
    showMomentumChart: boolean;
    /** Default visible variable charts */
    defaultVisibleVariables: CustomVariableId[];
  };
}

export interface SharedState {
  /** Current day state */
  currentDay: DayState;
  /** Active activity */
  activeActivity?: Activity;
  /** Library of activity templates */
  activityTemplates: Record<ActivityTemplateId, Activity>;
  /** Custom variable definitions */
  customVariables: Record<CustomVariableId, CustomVariable>;
  /** Time block definitions */
  //   timeBlocks: Record<BlockId, TimeBlock>;
  /** Action plan definitions */
  //   actionPlans: Record<ActionPlanId, ActionPlan>;
  /** Interruption cause definitions */
  interruptionCauses: Record<InterruptionCauseId, InterruptionCause>;
  /** Discrete event definitions */
  discreteEvents: Record<EventTemplateId, DiscreteEvent>;
  /** User application settings */
  userSettings: UserSettings;
  /** Timestamp of last update */
  lastUpdateTimestamp: UnixTimestamp;
}

/**
 * Persisted State of the application
 */
export interface PersistedState extends SharedState {
  /** Database of past days */
  dayDatabase: DayState[];
}

/**
 * API interface for interacting with the system storage
 */
export interface QualiaControlAPIType {
  // System lifecycle methods
  getPersistedState: () => Promise<PersistedState>;
  startDay: (date: UnixTimestamp) => Promise<void>;
  endDay: (dayState: DayState) => Promise<void>;

  // Activity template management
  getActivityTemplate: (templateId: ActivityTemplateId) => Promise<Activity | undefined>;
  getActivityTemplates: () => Promise<Activity[]>;
  createActivityTemplate: (template: Omit<Activity, "id">) => Promise<Activity>;
  updateActivityTemplate: (
    templateUpdates: Partial<Activity> & { id: ActivityTemplateId }
  ) => Promise<void>;
  removeActivityTemplate: (templateId: ActivityTemplateId) => Promise<void>;

  // Daily activity management
  getActivity: (activityId: ActivityId) => Promise<Activity | undefined>;
  getActivities: () => Promise<Activity[]>;
  createActivity: (activity: Omit<Activity, "id">) => Promise<Activity>;
  updateActivity: (activityUpdates: Partial<Activity> & { id: ActivityId }) => Promise<void>;
  removeActivity: (activityId: ActivityId) => Promise<void>;

  // Activity creation from templates
  createActivityFromTemplate: (
    templateId: ActivityTemplateId,
    overrides?: {
      assignedBlockId?: BlockId;
      dynamicProps?: ActivityTypes["dynamicProps"];
    }
  ) => Promise<Activity>;

  // Activity state management
  startActivity: (activityId: ActivityId) => Promise<void>;
  completeActivity: (
    activityId: ActivityId,
    satisfactionData?: ActivitySatisfaction
  ) => Promise<void>;
  interruptActivity: (
    activityId: ActivityId,
    interruptionData: Omit<InterruptedActivity, "activityId">
  ) => Promise<void>;

  // Time block management
  //   getTimeBlock: (blockId: BlockId) => Promise<TimeBlock | undefined>;
  //   getTimeBlocks: () => Promise<TimeBlock[]>;
  //   createTimeBlock: (block: Omit<TimeBlock, "id">) => Promise<TimeBlock>;
  //   updateTimeBlock: (blockUpdates: Partial<TimeBlock> & { id: BlockId }) => Promise<void>;
  //   removeTimeBlock: (blockId: BlockId) => Promise<void>;

  // Action plan management
  //   getActionPlan: (planId: ActionPlanId) => Promise<ActionPlan | undefined>;
  //   getActionPlans: () => Promise<ActionPlan[]>;
  //   createActionPlan: (plan: Omit<ActionPlan, "id">) => Promise<ActionPlan>;
  //   updateActionPlan: (planUpdates: Partial<ActionPlan> & { id: ActionPlanId }) => Promise<void>;
  //   removeActionPlan: (planId: ActionPlanId) => Promise<void>;

  // Action plan execution
  //   executeActionPlan: (planId: ActionPlanId, blockId?: BlockId) => Promise<Activity[]>;

  // Variable management
  getCustomVariable: (variableId: CustomVariableId) => Promise<CustomVariable | undefined>;
  getCustomVariables: () => Promise<CustomVariable[]>;
  createCustomVariable: (variable: Omit<CustomVariable, "id">) => Promise<CustomVariable>;
  updateCustomVariable: (
    variableUpdates: Partial<CustomVariable> & { id: CustomVariableId }
  ) => Promise<void>;
  removeCustomVariable: (variableId: CustomVariableId) => Promise<void>;

  // Variable snapshot management
  createVariableSnapshot: (snapshot: Omit<VariableSnapshot, "id">) => Promise<VariableSnapshot>;
  getVariableSnapshots: (dateFrom: number, dateTo: number) => Promise<VariableSnapshot[]>;
  getVariableSnapshotById: (snapshotId: SnapshotId) => Promise<VariableSnapshot | undefined>;

  // Event management
  createEvent: (event: Omit<DiscreteEvent, "id">) => Promise<DiscreteEvent>;
  getEvents: (dateFrom: number, dateTo: number) => Promise<DiscreteEvent[]>;
  getEventById: (eventId: EventId) => Promise<DiscreteEvent | undefined>;
  updateEvent: (eventUpdates: Partial<DiscreteEvent> & { id: EventId }) => Promise<void>;
  removeEvent: (eventId: EventId) => Promise<void>;

  // Interruption cause management
  getInterruptionCause: (causeId: InterruptionCauseId) => Promise<InterruptionCause | undefined>;
  getInterruptionCauses: () => Promise<InterruptionCause[]>;
  createInterruptionCause: (cause: Omit<InterruptionCause, "id">) => Promise<InterruptionCause>;
  updateInterruptionCause: (
    causeUpdates: Partial<InterruptionCause> & { id: InterruptionCauseId }
  ) => Promise<void>;
  removeInterruptionCause: (causeId: InterruptionCauseId) => Promise<void>;

  // Day database management
  getDaySummary: (date: number) => Promise<DailySummary | undefined>;
  getDaySummaries: (dateFrom: number, dateTo: number) => Promise<DailySummary[]>;

  // User settings management
  getUserSettings: () => Promise<UserSettings>;
  updateUserSettings: (settingsUpdates: Partial<UserSettings>) => Promise<void>;

  // Utility functions
  getDayActivities: (date: number) => Promise<Activity[]>;
  //   getCurrentDayBlocks: () => Promise<TimeBlock[]>;
  //   getActiveTimeBlock: () => Promise<TimeBlock | undefined>;
}

/**
 * UI State maintained in the application
 */
export interface UiState extends SharedState {
  /** Whether the system is currently updating */
  updatingSystemState: boolean;
}
