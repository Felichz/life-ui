import type { AppState, IPersistenceManager } from "../types";
import { CoreError } from "./errors";
import { getStateStorage } from "./stateStorage";

/**
 * Key used to store the application state in localStorage
 */
// Historical key (from the product's previous name): kept so the data already
// saved in the browser is not lost.
export const STORAGE_KEY = "qualia_control_app_state";

/**
 * Current version of the persisted state schema.
 * Increment when making changes incompatible with older states.
 *
 * History:
 * - v1: original state (no tempos, with subjective variables and interruption causes).
 * - v2: introduces `dailyTempoTarget` in `userPreferences` and backfills `temposAwarded=0`
 *       in `completedActivityRecords`. Keeps the variables/causes but the runtime no
 *       longer uses them.
 * - v3: cleans up the legacy fields (subjectiveVariables, interruptionCauses,
 *       subjectiveVariableSnapshots, hiddenSubjectiveVariableIds). They are archived in
 *       `legacyArchive` for possible export/audit. The runtime no longer uses them
 *       nor persists them in the main shape.
 */
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Result of a state migration
 */
export interface MigrationResult {
  state: AppState;
  migrated: boolean;
  warnings: string[];
}

/**
 * localStorage-based implementation of the persistence manager.
 *
 * Centralizes the serialization/deserialization pipeline so that
 * localStorage, export and import produce and consume exactly the same
 * format with the same guarantees:
 *
 *   parse → validate → migrate v1→v2→v3 → sanitize → persist
 *
 * Starting with schema v3:
 * - the legacy fields (subjective variables, interruption causes, snapshots,
 *   hiddenSubjectiveVariableIds) are removed from the persisted shape;
 * - they are archived in `legacyArchive` for audit or export.
 */
export class PersistenceManager implements IPersistenceManager {
  /**
   * Builds the final JSON to persist: applies `stripLegacyFields` and
   * `schemaVersion: CURRENT_SCHEMA_VERSION`. Used by `saveState` and `serialize`.
   */
  private buildSerializedState(state: AppState): string {
    const sanitized = this.stripLegacyFields(state);
    const stateWithVersion = { ...sanitized, schemaVersion: CURRENT_SCHEMA_VERSION };
    return JSON.stringify(stateWithVersion);
  }

  /**
   * Serializes an AppState to JSON with the current version and the legacy
   * fields sanitized. Identical to the format that goes to localStorage.
   */
  public serialize(state: AppState): string {
    return this.buildSerializedState(state);
  }

  /**
   * Parses + validates + migrates + normalizes a JSON into an AppState.
   * - If it is from an older version, runs the migration chain
   *   (v1→v2→v3) and archives the legacy fields in `legacyArchive`.
   * - Even if the version is current (v3+), applies `stripLegacyFields`
   *   as hardening against tampered payloads with legacy fields.
   * Guarantee: the returned AppState never contains legacy fields in its
   * main shape (except `legacyArchive` for audit).
   * Throws Error if the JSON is invalid or unparseable.
   */
  public deserialize(json: string): AppState {
    let parsedState: unknown;
    try {
      parsedState = JSON.parse(json);
    } catch (parseError) {
      throw new CoreError(
        "invalid-state-json",
        parseError instanceof Error ? parseError.message : String(parseError)
      );
    }

    if (!this.isValidAppState(parsedState)) {
      throw new CoreError("invalid-state-shape");
    }

    const migration = this.migrateIfNeeded(parsedState as AppState & { schemaVersion?: number });

    if (migration.warnings.length > 0) {
      console.warn("State migration:", migration.warnings);
    }

    // Hardening: even if the version is current (v3+), a tampered
    // payload with legacy fields (subjectiveVariables, etc.) may arrive.
    // The runtime must NEVER receive them, not even in memory during
    // the session. stripLegacyFields removes them idempotently.
    return this.stripLegacyFields(migration.state);
  }

  /**
   * Saves the application state to localStorage.
   * Goes through the same pipeline as `serialize`.
   */
  public saveState(state: AppState): void {
    try {
      const serializedState = this.buildSerializedState(state);
      getStateStorage().setItem(STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Error saving state to localStorage:", error);
    }
  }

  /**
   * Loads the application state from localStorage.
   * Goes through the same pipeline as `deserialize`.
   * @returns Application state, or null if it does not exist or could not be loaded
   */
  public loadState(): AppState | null {
    try {
      const serializedState = getStateStorage().getItem(STORAGE_KEY);

      if (!serializedState) {
        return null;
      }

      try {
        return this.deserialize(serializedState);
      } catch (deserializeError) {
        console.error("Error deserializing state from localStorage:", deserializeError);
        return null;
      }
    } catch (error) {
      console.error("Error loading state from localStorage:", error);
      return null;
    }
  }

  /**
   * Removes the application state from localStorage
   */
  public clearState(): void {
    try {
      getStateStorage().removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error clearing state from localStorage:", error);
    }
  }

  /**
   * Validates that the object has the basic structure expected of an AppState
   * @param state Object to validate
   * @returns true if the structure is valid, false otherwise
   */
  private isValidAppState(state: unknown): boolean {
    if (!state || typeof state !== "object") {
      console.error("Validation failed: the state is not an object");
      return false;
    }

    const stateObj = state as Record<string, unknown>;

    if (!("global" in stateObj)) {
      console.error("Validation failed: the state has no 'global' property");
      return false;
    }

    if (typeof stateObj.global !== "object" || stateObj.global === null) {
      console.error("Validation failed: the 'global' property is not a valid object");
      return false;
    }

    if (
      "currentDay" in stateObj &&
      stateObj.currentDay !== null &&
      typeof stateObj.currentDay !== "object"
    ) {
      console.error("Validation failed: the 'currentDay' property is not a valid object");
      return false;
    }

    return true;
  }

  /**
   * Runs the migration if the state is from a version older than CURRENT_SCHEMA_VERSION
   */
  private migrateIfNeeded(state: AppState & { schemaVersion?: number }): MigrationResult {
    const warnings: string[] = [];
    const fromVersion = typeof state.schemaVersion === "number" ? state.schemaVersion : 1;

    if (fromVersion >= CURRENT_SCHEMA_VERSION) {
      return { state, migrated: false, warnings };
    }

    let migrated = state;

    // v1 -> v2: add dailyTempoTarget, mark old records with tempos=0
    if (fromVersion < 2) {
      migrated = this.migrateV1ToV2(migrated, warnings);
    }

    // v2 -> v3: archive and remove legacy fields (subjective variables, causes, snapshots)
    if (migrated.schemaVersion !== undefined && migrated.schemaVersion < 3) {
      migrated = this.migrateV2ToV3(migrated, warnings);
    }

    return { state: migrated, migrated: true, warnings };
  }

  /**
   * Migration from v1 to v2.
   * Robust against partial states: if global, userPreferences or
   * completedActivityRecords is missing, rebuilds defaults without losing what exists.
   */
  private migrateV1ToV2(
    state: AppState & { schemaVersion?: number },
    warnings: string[]
  ): AppState & { schemaVersion?: number } {
    const fromVersion = typeof state.schemaVersion === "number" ? state.schemaVersion : 1;

    // Rebuild userPreferences if missing
    const existingPrefs = state.global?.userPreferences;
    const userPreferences = {
      dailyTempoTarget:
        typeof existingPrefs?.dailyTempoTarget === "number" ? existingPrefs.dailyTempoTarget : 100,
      updatedAt: existingPrefs?.updatedAt ?? new Date().toISOString(),
    };
    warnings.push("userPreferences rebuilt with defaults");

    // Sanitize completedActivityRecords: mark old ones with tempos=0 if missing
    const records = Array.isArray(state.global?.completedActivityRecords)
      ? state.global.completedActivityRecords
      : [];
    const completedActivityRecords = records.map((record) => {
      const r = record as typeof record & {
        satisfactionScore?: number;
        temposAwarded?: number;
        beatEstimate?: boolean;
      };
      if (
        typeof r.satisfactionScore !== "number" ||
        typeof r.temposAwarded !== "number" ||
        typeof r.beatEstimate !== "boolean"
      ) {
        return {
          ...r,
          satisfactionScore: 0,
          temposAwarded: 0,
          beatEstimate: false,
        };
      }
      return r;
    });

    // Rebuild global keeping whatever exists (including legacy fields for now;
    // the v2->v3 migration takes care of archiving them).
    const migratedGlobal = {
      ...(state.global || {}),
      userPreferences,
      completedActivityRecords,
    };

    const migrated = {
      ...state,
      global: migratedGlobal,
      schemaVersion: 2,
    } as unknown as AppState & { schemaVersion?: number };

    warnings.push(`Migrated from v${fromVersion} to v2`);
    return migrated;
  }

  /**
   * Migration from v2 to v3.
   * Archives the legacy fields (subjective variables, interruption causes,
   * snapshots and hiddenSubjectiveVariableIds) in `legacyArchive` for audit,
   * and removes them from the main persisted shape. The current runtime no longer uses them.
   */
  private migrateV2ToV3(
    state: AppState & { schemaVersion?: number },
    warnings: string[]
  ): AppState & { schemaVersion?: number } {
    const legacyGlobal = state.global as unknown as Record<string, unknown> & {
      subjectiveVariables?: unknown[];
      interruptionCauses?: unknown[];
      subjectiveVariableSnapshots?: unknown[];
      userPreferences?: Record<string, unknown> & { hiddenSubjectiveVariableIds?: unknown[] };
    };

    const hasLegacyData =
      Array.isArray(legacyGlobal.subjectiveVariables) ||
      Array.isArray(legacyGlobal.interruptionCauses) ||
      Array.isArray(legacyGlobal.subjectiveVariableSnapshots) ||
      Array.isArray(legacyGlobal.userPreferences?.hiddenSubjectiveVariableIds);

    let migratedGlobal: Record<string, unknown> = { ...legacyGlobal };

    if (hasLegacyData) {
      // Archive before removing
      const legacyArchive = {
        subjectiveVariables: legacyGlobal.subjectiveVariables ?? [],
        interruptionCauses: legacyGlobal.interruptionCauses ?? [],
        subjectiveVariableSnapshots: legacyGlobal.subjectiveVariableSnapshots ?? [],
        hiddenSubjectiveVariableIds:
          legacyGlobal.userPreferences?.hiddenSubjectiveVariableIds ?? [],
        archivedAt: new Date().toISOString(),
        fromSchemaVersion: 2,
      };
      warnings.push(
        `Legacy archived: ${JSON.stringify({
          vars: legacyArchive.subjectiveVariables.length,
          causes: legacyArchive.interruptionCauses.length,
          snapshots: legacyArchive.subjectiveVariableSnapshots.length,
          hiddenIds: legacyArchive.hiddenSubjectiveVariableIds.length,
        })}`
      );

      // Attach the archive to the state so it can be exported if desired.
      migratedGlobal = {
        ...migratedGlobal,
        legacyArchive,
      };
    } else {
      warnings.push("No legacy data to archive");
    }

    // Permanently remove the legacy fields from the main persisted shape
    delete migratedGlobal.subjectiveVariables;
    delete migratedGlobal.interruptionCauses;
    delete migratedGlobal.subjectiveVariableSnapshots;
    if (migratedGlobal.userPreferences && typeof migratedGlobal.userPreferences === "object") {
      const prefs = { ...(migratedGlobal.userPreferences as Record<string, unknown>) };
      delete prefs.hiddenSubjectiveVariableIds;
      migratedGlobal.userPreferences = prefs;
    }

    const migrated = {
      ...state,
      global: migratedGlobal,
      schemaVersion: CURRENT_SCHEMA_VERSION,
    } as unknown as AppState & { schemaVersion?: number };

    warnings.push(`Migrated from v2 to v${CURRENT_SCHEMA_VERSION} (legacy removed)`);
    return migrated;
  }

  /**
   * Defense in depth: removes the known legacy fields from the state
   * before persisting it. Although the v2->v3 migration cleans them up, a bug
   * or an external import could reintroduce them.
   */
  private stripLegacyFields(state: AppState): AppState {
    const global = state.global as unknown as Record<string, unknown>;
    if (
      !Array.isArray(global.subjectiveVariables) &&
      !Array.isArray(global.interruptionCauses) &&
      !Array.isArray(global.subjectiveVariableSnapshots) &&
      !(
        global.userPreferences &&
        typeof global.userPreferences === "object" &&
        Array.isArray(
          (global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds
        )
      )
    ) {
      return state;
    }

    const cleanedGlobal: Record<string, unknown> = { ...global };
    delete cleanedGlobal.subjectiveVariables;
    delete cleanedGlobal.interruptionCauses;
    delete cleanedGlobal.subjectiveVariableSnapshots;
    if (cleanedGlobal.userPreferences && typeof cleanedGlobal.userPreferences === "object") {
      const prefs = { ...(cleanedGlobal.userPreferences as Record<string, unknown>) };
      delete prefs.hiddenSubjectiveVariableIds;
      cleanedGlobal.userPreferences = prefs;
    }

    return {
      ...state,
      global: cleanedGlobal as unknown as AppState["global"],
    };
  }
}
