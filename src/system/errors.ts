/**
 * Typed errors thrown by the domain core.
 *
 * Callers branch on `code`, never on `message`: the message is a developer-facing
 * English description (useful in logs and tests) and may change freely. The UI
 * maps each code to a localized, user-facing sentence.
 */
export const CORE_ERROR_MESSAGES = {
  "no-active-day": "There is no active day",
  "day-already-active": "A day is already active; end it before starting a new one",
  "activity-template-not-found": "Activity template not found",
  "activity-template-in-use": "The activity template has instances in the current day",
  "activity-instance-not-found": "Activity instance not found",
  "activity-is-active": "The running activity cannot be moved or removed",
  "activity-already-running":
    "Another activity is running; close it with completeActivity or interruptActivity first",
  "not-the-active-activity": "Only the currently running activity can be closed",
  "invalid-state-change": "State cannot be changed directly; use the dedicated methods",
  "invalid-satisfaction-score": "satisfactionScore must be an integer between 0 and 10",
  "event-template-not-found": "Event template not found",
  "event-template-in-use": "The event template has logged events",
  "block-name-empty": "Time block name cannot be empty",
  "minutes-out-of-range": "Minutes of the day must be between 0 and 1439",
  "block-start-after-end": "The start time must be before the end time",
  "block-overlap": "The time block overlaps an existing block",
  "block-not-found": "Time block not found",
  "default-block-protected": "The default block cannot be removed or turned into a regular block",
  "invalid-daily-target": "dailyTempoTarget must be a positive integer",
  "invalid-minutes": "Minutes must be a positive number",
  "invalid-time-format": 'Invalid time format; expected "HH:MM"',
  "invalid-date": 'Invalid date; expected "YYYY-MM-DD"',
  "too-many-planned": "Too many activities planned ahead; cancel some first",
  "invalid-state-json": "The saved state is not valid JSON",
  "invalid-state-shape": "The saved state has an invalid structure",
  internal: "Unexpected internal error",
} as const;

export type CoreErrorCode = keyof typeof CORE_ERROR_MESSAGES;

export class CoreError extends Error {
  readonly code: CoreErrorCode;

  /** `detail` adds context (an id, the original parse error) to the message. */
  constructor(code: CoreErrorCode, detail?: string) {
    super(detail ? `${CORE_ERROR_MESSAGES[code]} (${detail})` : CORE_ERROR_MESSAGES[code]);
    this.name = "CoreError";
    this.code = code;
  }
}

export function isCoreError(error: unknown): error is CoreError {
  return error instanceof CoreError;
}
