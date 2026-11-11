import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type { Day, UUID, ActivityInstance } from "../types";
import { CoreError } from "./errors";

/**
 * Lifecycle manager for activity days in LifeUI
 * Lets you start, end and query information about days
 */
export class DayManager {
  private systemCore: SystemCore;

  /**
   * DayManager constructor
   * @param systemCore System core instance
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Starts a new activity day
   * @returns The created day
   * @throws Error if a day is already active
   */
  public startDay(): Day {
    // Check that no day is already active
    if (this.isDayActive()) {
      throw new CoreError("day-already-active");
    }

    // Generate data for the new day
    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    // Build the day object
    const newDay: Day = {
      id,
      state: "active",
      startTime: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Update the global state and the current day
    this.systemCore.updateState((state) => {
      // Get pending activities if they exist in the global state
      let pendingActivities: ActivityInstance[] = [];

      // Check whether there are pending activities in the global state
      if (
        state.global.pendingActivityInstances &&
        state.global.pendingActivityInstances.length > 0
      ) {
        pendingActivities = [...state.global.pendingActivityInstances];

        // Clear the pending activities after retrieving them
        state.global.pendingActivityInstances = [];
      }

      // Add the day to the list of days in the global state
      state.global.days.push(newDay);

      // Set the current day with the pending instances
      state.currentDay = {
        day: newDay,
        activityInstances: pendingActivities,
        activeActivityInstanceId: undefined,
      };

      return state;
    });

    return newDay;
  }

  /**
   * Ends the active day
   * @returns The ended day
   * @throws Error if there is no active day
   */
  public endDay(): Day {
    // Check that a day is active
    if (!this.isDayActive()) {
      throw new CoreError("no-active-day");
    }

    const timestamp = UtilityService.getCurrentISODateTime();

    // Update the state
    let completedDay: Day | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        return state;
      }

      // Get a reference to the current day
      const currentDay = state.currentDay.day;

      // Save the pending activities before clearing the current day
      // Make sure we only save activities that are not active
      // A planned time belongs to its day (ADR-006)
      const pendingActivities = state.currentDay.activityInstances
        .filter((instance) => instance.state !== "active")
        .map((instance) => {
          if (instance.scheduledStart === undefined) return instance;
          const { scheduledStart: _, ...rest } = instance;
          return rest;
        });

      // Initialize the field if it does not exist
      if (!state.global.pendingActivityInstances) {
        state.global.pendingActivityInstances = [];
      }

      // Save pending activities in the global state
      state.global.pendingActivityInstances = pendingActivities;

      // Set the day's state to inactive and record the end time
      const updatedDay: Day = {
        ...currentDay,
        state: "inactive",
        endTime: timestamp,
        updatedAt: timestamp,
      };

      // Keep a reference to return
      completedDay = updatedDay;

      // Update the day in the global list
      const dayIndex = state.global.days.findIndex((day) => day.id === currentDay.id);
      if (dayIndex >= 0) {
        state.global.days[dayIndex] = updatedDay;
      }

      // Clear the current day
      state.currentDay = null;

      return state;
    });

    if (!completedDay) {
      throw new CoreError("internal", "ending the day");
    }

    return completedDay;
  }

  /**
   * Gets the active day
   * @returns The active day, or null if there is no active day
   */
  public getCurrentDay(): Day | null {
    const state = this.systemCore.getState();
    return state.currentDay ? state.currentDay.day : null;
  }

  /**
   * Gets all recorded days
   * @returns List of all days
   */
  public getDays(): Day[] {
    const state = this.systemCore.getState();
    return state.global.days;
  }

  /**
   * Checks whether a day is active
   * @returns true if a day is active, false otherwise
   */
  public isDayActive(): boolean {
    const state = this.systemCore.getState();
    return state.currentDay !== null;
  }
}
