import { v4 as uuidv4 } from "uuid";
import type { UUID, ISODateTimeString, DayMinutes } from "../types";
import { CoreError } from "./errors";

/**
 * Shared utility service for the LifeUI system
 * Provides common functions to avoid code duplication
 */
export class UtilityService {
  /**
   * Generates a unique identifier in UUID format
   * @returns Generated UUID
   */
  public static generateUUID(): UUID {
    return uuidv4();
  }

  /**
   * Gets the current date and time in ISO format
   * @returns Date/time string in ISO format
   */
  public static getCurrentISODateTime(): ISODateTimeString {
    return new Date().toISOString();
  }

  /**
   * Computes the minutes elapsed since 00:00 of the current day
   * @returns Elapsed minutes (0-1439)
   */
  public static getCurrentDayMinutes(): DayMinutes {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Formats minutes as readable text (e.g. "1h 30m")
   * @param minutes Number of minutes
   * @returns Formatted text
   */
  public static formatDuration(minutes: number): string {
    if (isNaN(minutes) || minutes < 0) {
      throw new CoreError("invalid-minutes");
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  /**
   * Converts day minutes to time format (e.g. "14:30")
   * @param dayMinutes Minutes elapsed since 00:00 (0-1439)
   * @returns Formatted time (e.g. "14:30")
   */
  public static formatTime(dayMinutes: DayMinutes): string {
    if (isNaN(dayMinutes) || dayMinutes < 0 || dayMinutes >= 24 * 60) {
      throw new CoreError("minutes-out-of-range");
    }

    const hours = Math.floor(dayMinutes / 60);
    const minutes = dayMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  /**
   * Converts a time string to day minutes
   * @param timeString String in "HH:MM" format (e.g. "14:30")
   * @returns Day minutes (0-1439)
   */
  public static parseTime(timeString: string): DayMinutes {
    // Validate the "HH:MM" format
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeString)) {
      throw new CoreError("invalid-time-format");
    }

    const [hoursStr, minutesStr] = timeString.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    return hours * 60 + minutes;
  }

  /**
   * Makes a deep copy of an object
   * @param obj Object to copy
   * @returns Deep copy of the object
   */
  public static deepCopy<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Special handling for Date instances
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    // For arrays, use map and recursion
    if (Array.isArray(obj)) {
      return obj.map((item) => UtilityService.deepCopy(item)) as unknown as T;
    }

    // For regular objects
    const copy = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = UtilityService.deepCopy((obj as Record<string, unknown>)[key]);
      }
    }

    return copy as T;
  }

  /**
   * Determines whether an activity meets the "beat estimate" condition.
   *
   * Information only: it is kept on the record (`beatEstimate`).
   *
   * Rule: only `clear-objective` with a point estimate can beat it.
   * `flexible-duration` (range) and `timeboxing` (intentional window)
   * are not eligible.
   *
   * @param activityType Activity type
   * @param actualMinutes Actual duration in minutes
   * @param estimatedMinutes Estimated duration (only present for clear-objective)
   * @returns true if it meets the `beatEstimate` condition
   */
  public static calculateBeatEstimate(
    activityType: "clear-objective" | "flexible-duration" | "timeboxing",
    actualMinutes: number,
    estimatedMinutes: number | undefined
  ): boolean {
    if (activityType !== "clear-objective") return false;
    if (typeof estimatedMinutes !== "number" || estimatedMinutes <= 0) return false;
    if (actualMinutes <= 0) return false;
    return actualMinutes <= estimatedMinutes * 0.8;
  }
}
