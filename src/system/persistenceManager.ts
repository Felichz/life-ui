import type { AppState, IPersistenceManager } from "../types";

/**
 * Clave utilizada para almacenar el estado de la aplicación en localStorage
 */
export const STORAGE_KEY = "qualia_control_app_state";

/**
 * Implementación del gestor de persistencia basado en localStorage
 * Responsable de guardar, cargar y limpiar el estado de la aplicación
 */
export class PersistenceManager implements IPersistenceManager {
  /**
   * Guarda el estado de la aplicación en localStorage
   * @param state Estado completo de la aplicación a persistir
   */
  public saveState(state: AppState): void {
    try {
      const serializedState = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, serializedState);
    } catch (error) {
      console.error("Error al guardar el estado en localStorage:", error);
      // No lanzamos la excepción para no interrumpir el flujo de la aplicación
    }
  }

  /**
   * Carga el estado de la aplicación desde localStorage
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

      // Validación básica de la estructura del estado
      if (!this.isValidAppState(parsedState)) {
        console.error("Estructura de estado inválida en localStorage");
        return null;
      }

      return parsedState as AppState;
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
    // Verificar que es un objeto
    if (!state || typeof state !== "object") {
      console.error("Validación fallida: el estado no es un objeto");
      return false;
    }

    const stateObj = state as Record<string, unknown>;

    // Verificar que tiene las propiedades principales
    if (!("global" in stateObj)) {
      console.error("Validación fallida: el estado no tiene la propiedad 'global'");
      return false;
    }

    // Verificar que global es un objeto
    if (typeof stateObj.global !== "object" || stateObj.global === null) {
      console.error("Validación fallida: la propiedad 'global' no es un objeto válido");
      return false;
    }

    // Verificar que currentDay es un objeto o null
    if (
      "currentDay" in stateObj &&
      stateObj.currentDay !== null &&
      typeof stateObj.currentDay !== "object"
    ) {
      console.error("Validación fallida: la propiedad 'currentDay' no es un objeto o null");
      return false;
    }

    return true;
  }
}
