import type { AppState, IPersistenceManager } from "../types";

/**
 * Clave utilizada para almacenar el estado de la aplicación en localStorage
 */
export const STORAGE_KEY = "qualia_control_app_state";

/**
 * Versión actual del esquema de estado persistido.
 * Incrementar cuando se hagan cambios incompatibles con estados antiguos.
 *
 * Historial:
 * - v1: estado original (sin tempos, con variables subjetivas y causas de interrupción).
 * - v2: introduce `dailyTempoTarget` en `userPreferences` y backfill de `temposAwarded=0`
 *       en `completedActivityRecords`. Mantiene las variables/causas pero el runtime ya
 *       no las usa.
 * - v3: limpia los campos legacy (subjectiveVariables, interruptionCauses,
 *       subjectiveVariableSnapshots, hiddenSubjectiveVariableIds). Se archivan en
 *       `legacyArchive` para posible exportación/auditoría. El runtime ya no los usa
 *       ni los persiste en el shape principal.
 */
export const CURRENT_SCHEMA_VERSION = 3;

/**
 * Resultado de una migración de estado
 */
export interface MigrationResult {
  state: AppState;
  migrated: boolean;
  warnings: string[];
}

/**
 * Implementación del gestor de persistencia basado en localStorage.
 *
 * Centraliza el pipeline de serialización/deserialización para que
 * localStorage, export e import produzcan y consuman exactamente el mismo
 * formato con las mismas garantías:
 *
 *   parse → validate → migrate v1→v2→v3 → sanitize → persist
 *
 * A partir del schema v3:
 * - los campos legacy (variables subjetivas, causas de interrupción, snapshots,
 *   hiddenSubjectiveVariableIds) se eliminan del shape persistido;
 * - se archivan en `legacyArchive` para auditoría o exportación.
 */
export class PersistenceManager implements IPersistenceManager {
  /**
   * Construye el JSON final a persistir: aplica `stripLegacyFields` y
   * `schemaVersion: CURRENT_SCHEMA_VERSION`. Lo usan `saveState` y `serialize`.
   */
  private buildSerializedState(state: AppState): string {
    const sanitized = this.stripLegacyFields(state);
    const stateWithVersion = { ...sanitized, schemaVersion: CURRENT_SCHEMA_VERSION };
    return JSON.stringify(stateWithVersion);
  }

  /**
   * Serializa un AppState a JSON con la versión actual y los legacy fields
   * saneados. Idéntico al formato que va a localStorage.
   */
  public serialize(state: AppState): string {
    return this.buildSerializedState(state);
  }

  /**
   * Parsea + valida + migra un JSON a AppState. Si es de una versión
   * anterior, ejecuta la cadena de migraciones (v1→v2→v3) y archiva los
   * campos legacy en `legacyArchive` antes de retornarlo.
   * Lanza Error si el JSON es inválido o no parseable.
   */
  public deserialize(json: string): AppState {
    let parsedState: unknown;
    try {
      parsedState = JSON.parse(json);
    } catch (parseError) {
      throw new Error(
        `Error al parsear JSON del estado: ${
          parseError instanceof Error ? parseError.message : String(parseError)
        }`
      );
    }

    if (!this.isValidAppState(parsedState)) {
      throw new Error("Estructura de estado inválida");
    }

    const migration = this.migrateIfNeeded(
      parsedState as AppState & { schemaVersion?: number }
    );

    if (migration.warnings.length > 0) {
      console.warn("Migración de estado:", migration.warnings);
    }

    return migration.state;
  }

  /**
   * Guarda el estado de la aplicación en localStorage.
   * Pasa por el mismo pipeline que `serialize`.
   */
  public saveState(state: AppState): void {
    try {
      const serializedState = this.buildSerializedState(state);
      localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Error al guardar el estado en localStorage:", error);
    }
  }

  /**
   * Carga el estado de la aplicación desde localStorage.
   * Pasa por el mismo pipeline que `deserialize`.
   * @returns Estado de la aplicación o null si no existe o no se pudo cargar
   */
  public loadState(): AppState | null {
    try {
      const serializedState = localStorage.getItem(STORAGE_KEY);

      if (!serializedState) {
        return null;
      }

      try {
        return this.deserialize(serializedState);
      } catch (deserializeError) {
        console.error(
          "Error al deserializar el estado desde localStorage:",
          deserializeError
        );
        return null;
      }
    } catch (error) {
      console.error("Error al cargar el estado desde localStorage:", error);
      return null;
    }
  }

  /**
   * Elimina el estado de la aplicación de localStorage
   */
  public clearState(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error("Error al limpiar el estado de localStorage:", error);
    }
  }

  /**
   * Valida que el objeto tenga la estructura básica esperada para un AppState
   * @param state Objeto a validar
   * @returns true si la estructura es válida, false en caso contrario
   */
  private isValidAppState(state: unknown): boolean {
    if (!state || typeof state !== "object") {
      console.error("Validación fallida: el estado no es un objeto");
      return false;
    }

    const stateObj = state as Record<string, unknown>;

    if (!("global" in stateObj)) {
      console.error("Validación fallida: el estado no tiene la propiedad 'global'");
      return false;
    }

    if (typeof stateObj.global !== "object" || stateObj.global === null) {
      console.error("Validación fallida: la propiedad 'global' no es un objeto válido");
      return false;
    }

    if (
      "currentDay" in stateObj &&
      stateObj.currentDay !== null &&
      typeof stateObj.currentDay !== "object"
    ) {
      console.error("Validación fallida: la propiedad 'currentDay' no es un objeto válido");
      return false;
    }

    return true;
  }

  /**
   * Ejecuta la migración si el estado es de una versión anterior a CURRENT_SCHEMA_VERSION
   */
  private migrateIfNeeded(state: AppState & { schemaVersion?: number }): MigrationResult {
    const warnings: string[] = [];
    const fromVersion = typeof state.schemaVersion === "number" ? state.schemaVersion : 1;

    if (fromVersion >= CURRENT_SCHEMA_VERSION) {
      return { state, migrated: false, warnings };
    }

    let migrated = state;

    // v1 -> v2: agregar dailyTempoTarget, marcar records viejos con tempos=0
    if (fromVersion < 2) {
      migrated = this.migrateV1ToV2(migrated, warnings);
    }

    // v2 -> v3: archivar y eliminar campos legacy (variables subjetivas, causas, snapshots)
    if (migrated.schemaVersion !== undefined && migrated.schemaVersion < 3) {
      migrated = this.migrateV2ToV3(migrated, warnings);
    }

    return { state: migrated, migrated: true, warnings };
  }

  /**
   * Migración de v1 a v2.
   * Robusta ante estados parciales: si falta global, userPreferences o
   * completedActivityRecords, reconstruye defaults sin perder lo que sí exista.
   */
  private migrateV1ToV2(
    state: AppState & { schemaVersion?: number },
    warnings: string[]
  ): AppState & { schemaVersion?: number } {
    const fromVersion = typeof state.schemaVersion === "number" ? state.schemaVersion : 1;

    // Reconstruir userPreferences si falta
    const existingPrefs = state.global?.userPreferences;
    const userPreferences = {
      dailyTempoTarget:
        typeof existingPrefs?.dailyTempoTarget === "number" ? existingPrefs.dailyTempoTarget : 1000,
      updatedAt: existingPrefs?.updatedAt ?? new Date().toISOString(),
    };
    warnings.push("userPreferences reconstruido con defaults");

    // Sanear completedActivityRecords: marcar los viejos con tempos=0 si faltan
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

    // Reconstruir global manteniendo lo que exista (incluyendo legacy fields por ahora;
    // la migración v2->v3 se encarga de archivarlos).
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

    warnings.push(`Migrado de v${fromVersion} a v2`);
    return migrated;
  }

  /**
   * Migración de v2 a v3.
   * Archiva los campos legacy (variables subjetivas, causas de interrupción,
   * snapshots y hiddenSubjectiveVariableIds) en `legacyArchive` para auditoría,
   * y los elimina del shape persistido principal. El runtime actual ya no los usa.
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
      // Archivar antes de eliminar
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
        `Legacy archivado: ${JSON.stringify({
          vars: legacyArchive.subjectiveVariables.length,
          causes: legacyArchive.interruptionCauses.length,
          snapshots: legacyArchive.subjectiveVariableSnapshots.length,
          hiddenIds: legacyArchive.hiddenSubjectiveVariableIds.length,
        })}`
      );

      // Adjuntar el archivo al estado para que pueda ser exportado si se desea.
      migratedGlobal = {
        ...migratedGlobal,
        legacyArchive,
      };
    } else {
      warnings.push("Sin datos legacy para archivar");
    }

    // Eliminar definitivamente los campos legacy del shape persistido principal
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

    warnings.push(`Migrado de v2 a v${CURRENT_SCHEMA_VERSION} (legacy eliminado)`);
    return migrated;
  }

  /**
   * Defensa en profundidad: elimina los campos legacy conocidos del estado
   * antes de persistirlo. Aunque la migración v2->v3 los limpia, un bug o un
   * import externo podrían reintroducirlos.
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