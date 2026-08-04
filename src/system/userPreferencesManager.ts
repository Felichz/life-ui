import type { ISystemCore, UserPreferences, UUID } from "../types";

/**
 * Gestor de preferencias de usuario
 * Permite personalizar aspectos de la experiencia de usuario mediante preferencias persistentes
 */
export class UserPreferencesManager {
  private systemCore: ISystemCore;

  /**
   * Constructor del gestor de preferencias
   * @param systemCore Referencia al núcleo del sistema
   */
  constructor(systemCore: ISystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Obtiene las preferencias de usuario actuales
   * @returns Preferencias de usuario actuales
   */
  public getUserPreferences(): UserPreferences {
    return this.systemCore.getState().global.userPreferences;
  }

  /**
   * Actualiza las preferencias de usuario parcial o totalmente
   * @param preferences Objeto parcial con las preferencias a actualizar
   * @returns Preferencias actualizadas
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences {
    let updatedPreferences: UserPreferences;

    this.systemCore.updateState((state) => {
      // Crear una nueva instancia de preferencias combinando las existentes con las nuevas
      updatedPreferences = {
        ...state.global.userPreferences,
        ...preferences,
        updatedAt: new Date().toISOString(),
      };

      // Actualizar estado manteniendo inmutabilidad
      return {
        ...state,
        global: {
          ...state.global,
          userPreferences: updatedPreferences,
        },
      };
    });

    // Devolver las preferencias actualizadas
    return this.getUserPreferences();
  }

  /**
   * Alterna la visibilidad de una variable subjetiva específica
   * @param variableId ID de la variable a alternar visibilidad
   */
  public toggleVariableVisibility(variableId: UUID): void {
    this.systemCore.updateState((state) => {
      const currentPreferences = state.global.userPreferences;
      const hiddenIds = [...currentPreferences.hiddenSubjectiveVariableIds];

      // Alternar visibilidad
      const isCurrentlyHidden = hiddenIds.includes(variableId);
      const updatedHiddenIds = isCurrentlyHidden
        ? hiddenIds.filter((id) => id !== variableId) // Mostrar (quitar de ocultos)
        : [...hiddenIds, variableId]; // Ocultar (añadir a ocultos)

      // Actualizar estado manteniendo inmutabilidad
      return {
        ...state,
        global: {
          ...state.global,
          userPreferences: {
            ...currentPreferences,
            hiddenSubjectiveVariableIds: updatedHiddenIds,
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  }

  /**
   * Verifica si una variable subjetiva está visible
   * @param variableId ID de la variable a verificar
   * @returns true si la variable está visible, false si está oculta
   */
  public isVariableVisible(variableId: UUID): boolean {
    const preferences = this.getUserPreferences();
    return !preferences.hiddenSubjectiveVariableIds.includes(variableId);
  }

  /**
   * Schema v2+: actualiza el target diario de tempos
   * @param target Nuevo target (entero positivo)
   * @returns Preferencias actualizadas
   */
  public updateDailyTempoTarget(target: number): UserPreferences {
    if (typeof target !== "number" || target <= 0 || !Number.isInteger(target)) {
      throw new Error("dailyTempoTarget debe ser un entero positivo");
    }
    return this.updateUserPreferences({ dailyTempoTarget: target });
  }
}
