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
   * In MVP v3 this is an **informational metric only**: it is not used
   * to compute an automatic bonus in the tempos formula. It is stored as
   * record data (`beatEstimate: boolean`) and shown in the completion
   * modal as "you beat the estimate". The user explicitly decides the
   * bonus by moving the slider to 8/9/10.
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

  /**
   * Score divisor: the reward percentage is computed as
   * `score / SCORE_DIVISOR`, where SCORE_DIVISOR is the score that
   * represents 100% of the base.
   *
   * MVP v3.1 design:
   * - score 0  → 0%   (not completed)
   * - score 1  → 14%  (1/7)
   * - score 5  → 71%  (5/7)
   * - score 7  → 100% (default)
   * - score 10 → 143% (10/7)
   *
   * Full formula: `tempos = ceil(baseMinutes × score / SCORE_DIVISOR)`.
   *
   * Example: task estimated at 30 min, score 5 → ceil(30 × 5 / 7) = 22.
   *
   * **This constant is the single source of truth**: both the final
   * calculation (`calculateTemposAwarded`) and the live preview
   * (`calculatePreviewTempos`) consume it. If it changes, both
   * update automatically.
   */
  public static readonly SCORE_DIVISOR = 7;

  /**
   * Resolves the base the tempos are computed on: the estimate if it
   * is valid (number > 0), otherwise the actual duration. If both are
   * 0/negative, returns 0.
   *
   * This is the **single source** of the "estimate or duration" logic. If
   * it changes (for example, to add a fallback or log), both the final
   * calculation (`calculateTemposAwarded`) and the UI preview
   * (`calculatePreviewTempos`) use it through this helper.
   *
   * Important: `estimatedMinutes === 0` is NOT considered valid (it is not
   * a real estimate). This prevents the bug where a legacy or corrupt
   * state with estimate 0 made the preview diverge from the core.
   *
   * @param estimatedMinutes Activity estimate (may be undefined,
   *   null, 0 or negative)
   * @param durationMinutes Actual duration (may be 0 if confirmed
   *   within the first 30s)
   * @returns The resolved base (>= 0)
   */
  public static resolveBaseMinutes(
    estimatedMinutes: number | undefined | null,
    durationMinutes: number
  ): number {
    const estimated =
      typeof estimatedMinutes === "number" && estimatedMinutes > 0
        ? estimatedMinutes
        : durationMinutes;
    return estimated > 0 ? estimated : 0;
  }

  /**
   * Computes the tempos preview for a given score and baseMinutes.
   * Used by the UI (CompletionModal) to show live how many tempos
   * the user will receive for the selected score.
   *
   * Equivalent to `calculateTemposAwarded` but without requiring all the
   * duration/estimate parameters — only the base (which the caller
   * already resolved as estimate or actual duration) and the current
   * slider score.
   *
   * Formula: `tempos = ceil(baseMinutes × score / SCORE_DIVISOR)`.
   * Guarantee: **the preview ALWAYS matches the core's final
   * calculation**. If the formula changes here, the preview updates in
   * the same change.
   *
   * @param score Current 0-10 slider score
   * @param baseMinutes Base to compute on (estimate if present, otherwise
   *   actual duration). Math.ceil applied at the end.
   * @returns Total tempos that would be awarded on confirm
   */
  public static calculatePreviewTempos(score: number, baseMinutes: number): number {
    if (typeof score !== "number" || !Number.isInteger(score)) return 0;
    if (score < 0 || score > 10) return 0;
    if (typeof baseMinutes !== "number" || baseMinutes <= 0) return 0;

    // Linear formula: ceil(base × score / 7)
    return Math.ceil((baseMinutes * score) / UtilityService.SCORE_DIVISOR);
  }

  /**
   * Computes the tempos reward for a completed activity.
   *
   * Formula: `tempos = ceil(baseMinutes × score / SCORE_DIVISOR)`,
   * where baseMinutes comes from `resolveBaseMinutes(estimate, duration)`.
   *
   * Rules:
   * - invalid score (< 0 or > 10, non-integer) → 0 tempos
   * - score 0 → 0 tempos (not completed)
   * - score 1-10 → ceil(baseMinutes × score / 7). Linear scale: each
   *   slider point increases the reward by ~14% of the base.
   * - Base:
   *     - If there is a valid estimate (> 0), the reward is based on it.
   *       This avoids the "0 tempos because the activity was active for
   *       less than 1 minute and Math.round returned 0" bug.
   *     - If there is no estimate, the reward is based on actual duration.
   *     - If both are 0/negative, returns 0 (nothing is awarded).
   *
   * @param durationMinutes Actual time spent (may be 0 if it was just
   *   started and is honestly confirmed).
   * @param satisfactionScore Self-assessment 0-10
   * @param estimatedMinutes Original estimate (if any). Otherwise
   *   durationMinutes is used as the base.
   * @returns Total tempos awarded (>= 0)
   */
  public static calculateTemposAwarded(
    durationMinutes: number,
    satisfactionScore: number,
    estimatedMinutes: number | undefined
  ): number {
    // Input validation: durationMinutes may be 0 if the user honestly
    // confirms within the first 30s and Math.round rounds to 0.
    // The original bug was returning 0 in that case; now we use the
    // estimate if available (see resolveBaseMinutes).
    if (typeof durationMinutes !== "number" || durationMinutes < 0) return 0;
    if (typeof satisfactionScore !== "number") return 0;
    if (satisfactionScore < 0 || satisfactionScore > 10) return 0;
    if (!Number.isInteger(satisfactionScore)) return 0;

    // Base resolved by the helper shared with calculatePreviewTempos.
    // estimatedMinutes === 0 or negative is NOT valid: falls back to durationMinutes.
    const base = UtilityService.resolveBaseMinutes(estimatedMinutes, durationMinutes);

    // Delegate to the shared helper (same source as the preview).
    return UtilityService.calculatePreviewTempos(satisfactionScore, base);
  }
}
