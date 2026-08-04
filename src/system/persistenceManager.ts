import type { AppState, IPersistenceManager } from "../types";

/**
 * Clave utilizada para almacenar el estado de la aplicación en localStorage
 */
export const STORAGE_KEY = "qualia_control_app_state";

/**
 * Versión actual del esquema de estado persistido.
 * Incrementar cuando se hagan cambios incompatibles con estados antiguos.
 */
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Resultado de una migración de estado
 */
export interface MigrationResult {
  state: AppState;
  migrated: boolean;
  warnings: string[];
}

/**
 * Implementación del gestor de persistencia basado en localStorage
 * Responsable de guardar, cargar y limpiar el estado de la aplicación
 *
 * A partir del schema v2, soporta versionado y migración automática desde
 * estados anteriores (sin perder datos históricos).
 */
export class PersistenceManager implements IPersistenceManager {
  /**
   * Guarda el estado de la aplicación en localStorage
   * @param state Estado completo de la aplicación a persistir
   */
  public saveState(state: AppState): void {
    try {
      const stateWithVersion = { ...state, schemaVersion: CURRENT_SCHEMA_VERSION };
      const serializedState = JSON.stringify(stateWithVersion);
      localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Error al guardar el estado en localStorage:", error);
    }
  }

  /**
   * Carga el estado de la aplicación desde localStorage.
   * Si el estado es de una versión anterior, ejecuta la migración.
   * @returns Estado de la aplicación o null si no existe o no es válido
   */
  public loadState(): AppState | null {
    try {
      const serializedState = localStorage.getItem(STORAGE_KEY);

      if (!serializedState) {
        return null;
      }

      let parsedState: unknown;
      try {
        parsedState = JSON.parse(serializedState);
      } catch (parseError) {
        console.error("Error al parsear el estado desde localStorage:", parseError);
        return null;
      }

      if (!this.isValidAppState(parsedState)) {
        console.error("Estructura de estado inválida en localStorage");
        return null;
      }

      const migration = this.migrateIfNeeded(parsedState as AppState & { schemaVersion?: number });

      if (migration.warnings.length > 0) {
        console.warn("Migración de estado:", migration.warnings);
      }

      return migration.state;
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
      console.error("Error al limpiar el estado en localStorage:", error);
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

    return { state: migrated, migrated: true, warnings };
  }

  /**
   * Migración de v1 a v2:
   * - Agrega dailyTempoTarget: 1000 si falta
   * - Marca completedActivityRecords antiguos con temposAwarded=0
   * - Preserva subjectiveVariables/interruptionCauses en localStorage pero no los expone en AppState
   *   (la limpieza real se hará en fase 10 cuando eliminemos los managers)
   */
  private migrateV1ToV2(
    state: AppState & { schemaVersion?: number },
    warnings: string[]
  ): AppState & { schemaVersion?: number } {
    const userPreferences = state.global?.userPreferences;
    if (!userPreferences || typeof userPreferences !== "object") {
      warnings.push("userPreferences ausente en estado migrado");
      return state;
    }

    const migrated = {
      ...state,
      global: {
        ...state.global,
        userPreferences: {
          ...userPreferences,
          dailyTempoTarget:
            typeof (userPreferences as { dailyTempoTarget?: number }).dailyTempoTarget === "number"
              ? (userPreferences as { dailyTempoTarget: number }).dailyTempoTarget
              : 1000,
        },
        // Sanear completedActivityRecords: marcar los viejos con tempos=0 si faltan
        completedActivityRecords: (state.global.completedActivityRecords || []).map((record) => {
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
        }),
      },
      schemaVersion: 2,
    };

    warnings.push(`Migrado de v${(state as { schemaVersion?: number }).schemaVersion ?? 1} a v2`);
    return migrated;
  }
}
