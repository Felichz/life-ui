import type {
  AppState,
  ISystemCore,
  StateUpdater,
  GlobalState,
  Day,
  ActivityTemplate,
  ActivityInstance,
  CompletedActivityRecord,
  TimeBlock,
  DayMinutes,
  EventTemplate,
  EventInstance,
  TimelineData,
  TimeDistributionData,
  ActivityStatistics,
  UserPreferences,
  UUID,
  CompletionRequest,
  CompletionResult,
  TempoSummary,
  TempoTrendPoint,
  ISODateTimeString,
} from "../types";
import { PersistenceManager } from "./persistenceManager";
import { DayManager } from "./dayManager";
import { ActivityManager } from "./activityManager";
import { TimeBlockManager } from "./timeBlockManager";
import { EventManager } from "./eventManager";
import { AnalyticsManager } from "./analyticsManager";
import { UserPreferencesManager } from "./userPreferencesManager";
import { UtilityService } from "./utilityService";

export { PersistenceManager } from "./persistenceManager";
export { CoreError, isCoreError, type CoreErrorCode } from "./errors";

type StateChangeCallback = (newState: AppState) => void;

/**
 * Implementation of the LifeUI system core
 * Acts as the main orchestrator and single entry point for state manipulation
 */
export class SystemCore implements ISystemCore {
  private state: AppState;
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private persistenceManager: PersistenceManager;

  // System modules
  private dayManager: DayManager;
  private activityManager: ActivityManager;
  private timeBlockManager: TimeBlockManager;
  private eventManager: EventManager;
  private analyticsManager: AnalyticsManager;
  private userPreferencesManager: UserPreferencesManager;

  /**
   * SystemCore constructor
   */
  constructor() {
    // Initialize persistence first
    this.persistenceManager = new PersistenceManager();

    // Load state or create a default one
    const savedState = this.loadStateFromStorage();
    this.state = savedState || this.createDefaultState();

    // Initialize modules with a reference to this
    this.dayManager = new DayManager(this);
    this.activityManager = new ActivityManager(this);
    this.timeBlockManager = new TimeBlockManager(this);
    this.eventManager = new EventManager(this);
    this.analyticsManager = new AnalyticsManager(this);
    this.userPreferencesManager = new UserPreferencesManager(this);

    this.initialize();
  }

  /**
   * Initializes the system, updating state if needed
   */
  private initialize(): void {
    // Can be extended with additional initialization logic if needed
  }

  /**
   * Returns the current application state
   */
  public getState(): AppState {
    return this.state;
  }

  /**
   * Updates the application state using an updater function
   * @param updater Function that receives the current state and returns the new state
   */
  public updateState(updater: StateUpdater): void {
    // Create a deep copy to avoid direct mutations
    const currentState = JSON.parse(JSON.stringify(this.state)) as AppState;

    // Apply the updater function
    const newState = updater(currentState);

    // Update state
    this.state = newState;

    // Persist the state
    this.saveState();

    // Notify observers
    this.notifyStateChanged();
  }

  /**
   * Registers a callback to be notified of state changes
   * @param callback Function to invoke when the state changes
   * @returns Function that cancels the subscription
   */
  public onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);

    // Return a function that removes the callback
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  // ===============================================
  // DayManager methods
  // ===============================================

  /**
   * Starts a new activity day
   */
  public startDay(): Day {
    const newDay = this.dayManager.startDay();
    // Ensure the default "Por Hacer" block exists
    this.timeBlockManager.ensureDefaultBlockExists();
    return newDay;
  }

  /**
   * Ends the active day
   */
  public endDay(): Day {
    return this.dayManager.endDay();
  }

  /**
   * Returns the active day
   */
  public getCurrentDay(): Day | null {
    return this.dayManager.getCurrentDay();
  }

  /**
   * Checks whether there is an active day
   */
  public isDayActive(): boolean {
    return this.dayManager.isDayActive();
  }

  // ===============================================
  // ActivityManager methods
  // ===============================================

  /**
   * Creates a new activity template
   */
  public createActivityTemplate(
    data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">
  ): ActivityTemplate {
    return this.activityManager.createActivityTemplate(data);
  }

  /**
   * Updates an existing activity template
   */
  public updateActivityTemplate(id: UUID, data: Partial<ActivityTemplate>): ActivityTemplate {
    return this.activityManager.updateActivityTemplate(id, data);
  }

  /**
   * Deletes an activity template
   */
  public deleteActivityTemplate(id: UUID): void {
    this.activityManager.deleteActivityTemplate(id);
  }

  /**
   * Returns all activity templates
   */
  public getActivityTemplates(): ActivityTemplate[] {
    return this.activityManager.getActivityTemplates();
  }

  /**
   * Creates a new activity instance
   */
  public createActivityInstance(
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Pick<
      ActivityInstance,
      "clearObjectiveSettings" | "flexibleDurationSettings" | "timeboxingSettings"
    >
  ): ActivityInstance {
    return this.activityManager.createActivityInstance(templateId, blockId, dynamicSettings);
  }

  /**
   * Updates an existing activity instance
   */
  public updateActivityInstance(id: UUID, data: Partial<ActivityInstance>): ActivityInstance {
    return this.activityManager.updateActivityInstance(id, data);
  }

  /**
   * Moves an activity instance to another block
   */
  public moveActivityInstance(id: UUID, targetBlockId: UUID, newOrder?: number): ActivityInstance {
    return this.activityManager.moveActivityInstance(id, targetBlockId, newOrder);
  }

  /**
   * Deletes an activity instance
   */
  public deleteActivityInstance(id: UUID): void {
    this.activityManager.deleteActivityInstance(id);
  }

  /**
   * Activates an activity
   */
  public activateActivity(id: UUID): ActivityInstance {
    return this.activityManager.activateActivity(id);
  }

  /**
   * Requests closing an activity: the UI uses this to open the CompletionModal.
   */
  public requestCompletion(activityId: UUID): CompletionRequest {
    return this.activityManager.requestCompletion(activityId);
  }

  /**
   * Completes an activity with the user's self-assessment.
   * Computes tempos in the core (the UI never recomputes the formula).
   */
  public completeActivity(
    activityId: UUID,
    assessment: { satisfactionScore: number; endTime?: ISODateTimeString }
  ): CompletionResult {
    return this.activityManager.completeActivity(activityId, assessment);
  }

  /**
   * Interrupts an activity. Schema v2+: no avoidable/cause question.
   */
  public interruptActivity(activityId: UUID): CompletedActivityRecord {
    return this.activityManager.interruptActivity(activityId);
  }

  /**
   * Returns the currently active activity
   */
  public getActiveActivity(): ActivityInstance | null {
    return this.activityManager.getActiveActivity();
  }

  // ===============================================
  // TimeBlockManager methods
  // ===============================================

  /**
   * Creates a new time block
   */
  public createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock {
    return this.timeBlockManager.createTimeBlock(name, startMinute, endMinute);
  }

  /**
   * Updates an existing time block
   */
  public updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock {
    return this.timeBlockManager.updateTimeBlock(id, data);
  }

  /**
   * Deletes a time block
   */
  public deleteTimeBlock(id: UUID, moveActivitiesToTodo: boolean = true): void {
    this.timeBlockManager.deleteTimeBlock(id, moveActivitiesToTodo);
  }

  /**
   * Returns all time blocks
   */
  public getTimeBlocks(): TimeBlock[] {
    return this.timeBlockManager.getTimeBlocks();
  }

  /**
   * Returns the current time block based on the system time
   */
  public getCurrentTimeBlock(): TimeBlock | null {
    return this.timeBlockManager.getCurrentTimeBlock();
  }

  /**
   * Checks whether a time block is available for assigning activities
   */
  public isTimeBlockAvailable(blockId: UUID): boolean {
    return this.timeBlockManager.isTimeBlockAvailable(blockId);
  }

  /**
   * Checks whether a time block exists, ignoring time-of-day restrictions
   * This allows placing activities in blocks outside their scheduled hours
   */
  public isTimeBlockExisting(blockId: UUID): boolean {
    return this.timeBlockManager.isTimeBlockExisting(blockId);
  }

  // ===============================================
  // EventManager methods
  // ===============================================

  /**
   * Creates a new event template
   */
  public createEventTemplate(name: string): EventTemplate {
    return this.eventManager.createEventTemplate(name);
  }

  /**
   * Updates an existing event template
   */
  public updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate {
    return this.eventManager.updateEventTemplate(id, data);
  }

  /**
   * Deletes an event template
   */
  public deleteEventTemplate(id: UUID): void {
    this.eventManager.deleteEventTemplate(id);
  }

  /**
   * Creates a new event instance
   */
  public createEventInstance(templateId: UUID): EventInstance {
    return this.eventManager.createEventInstance(templateId);
  }

  /**
   * Returns event instances with optional filters
   */
  public getEventInstances(filters?: {
    dayId?: UUID;
    since?: string;
    until?: string;
  }): EventInstance[] {
    return this.eventManager.getEventInstances(filters);
  }

  /**
   * Returns recent events within a time window
   */
  public getRecentEvents(minutesWindow?: number): EventInstance[] {
    return this.eventManager.getRecentEvents(minutesWindow);
  }

  // ===============================================
  // AnalyticsManager methods
  // ===============================================

  /**
   * Generates data for the timeline visualization
   */
  public getTimelineData(dayId?: UUID): TimelineData {
    return this.analyticsManager.getTimelineData(dayId);
  }

  /**
   * Generates data for time distribution charts
   */
  public getTimeDistributionData(dayId?: UUID): TimeDistributionData {
    return this.analyticsManager.getTimeDistributionData(dayId);
  }

  /**
   * Returns statistics for a specific activity type
   */
  public getActivityStats(templateId?: UUID): ActivityStatistics {
    return this.analyticsManager.getActivityStats(templateId);
  }

  /**
   * Returns the activity completion rate
   */
  public getCompletionRate(): number {
    return this.analyticsManager.getCompletionRate();
  }

  /**
   * Schema v2+: tempo summary for a day
   */
  public getTempoSummary(dayId: UUID): TempoSummary {
    return this.analyticsManager.getTempoSummary(dayId);
  }

  /**
   * Schema v2+: tempo trends over a range
   */
  public getTempoTrends(range: {
    from: ISODateTimeString;
    to: ISODateTimeString;
  }): TempoTrendPoint[] {
    return this.analyticsManager.getTempoTrends(range);
  }

  /**
   * Returns the time estimation accuracy
   */
  public getEstimationAccuracy(): number {
    return this.analyticsManager.getEstimationAccuracy();
  }

  // ===============================================
  // UserPreferencesManager methods
  // ===============================================

  /**
   * Updates the user preferences
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences {
    return this.userPreferencesManager.updateUserPreferences(preferences);
  }

  /**
   * Returns the current user preferences
   */
  public getUserPreferences(): UserPreferences {
    return this.userPreferencesManager.getUserPreferences();
  }

  /**
   * Schema v2+: updates the daily tempo target
   */
  public updateDailyTempoTarget(target: number): UserPreferences {
    return this.userPreferencesManager.updateDailyTempoTarget(target);
  }

  // ===============================================
  // PersistenceManager methods
  // ===============================================

  /**
   * Exports all system data as JSON.
   * Goes through the central persistence pipeline (sanitizes legacy fields +
   * current schemaVersion), identical to the format written to localStorage.
   */
  public exportData(): string {
    return this.persistenceManager.serialize(this.state);
  }

  /**
   * Imports system data from JSON.
   * Goes through the central pipeline (parse + validate + migrate + sanitize).
   * If the JSON is v1/v2 with legacy fields, archives them in `legacyArchive`
   * and removes them from the main shape.
   */
  public importData(jsonData: string): AppState {
    const migrated = this.persistenceManager.deserialize(jsonData);
    this.updateState(() => migrated);
    return this.state;
  }

  /**
   * Clears the application state
   */
  public clearState(): void {
    this.persistenceManager.clearState();
    this.state = this.createDefaultState();
    this.notifyStateChanged();
  }

  /**
   * Notifies all registered observers of a state change
   */
  private notifyStateChanged(): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(this.state);
    }
  }

  /**
   * Creates a default state with initial values
   */
  private createDefaultState(): AppState {
    const timestamp = UtilityService.getCurrentISODateTime();

    const defaultGlobalState: GlobalState = {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      timeBlocks: [],
      userPreferences: {
        dailyTempoTarget: 100,
        updatedAt: timestamp,
      },
      completedActivityRecords: [],
      eventInstances: [],
      schemaVersion: 3,
    };

    return {
      global: defaultGlobalState,
      currentDay: null,
    };
  }

  /**
   * Loads the state from localStorage
   */
  private loadStateFromStorage(): AppState | null {
    return this.persistenceManager.loadState();
  }

  /**
   * Saves the state to localStorage
   */
  private saveState(): void {
    this.persistenceManager.saveState(this.state);
  }
}
