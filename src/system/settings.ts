// Qualia Control - Settings Management Module

import type { SharedState, UserSettings } from "../types";

/**
 * Módulo para la gestión de la configuración y ajustes del usuario
 */
export class SettingsManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Obtiene la configuración actual del usuario
   */
  public async getUserSettings(): Promise<UserSettings> {
    return this.state.userSettings;
  }

  /**
   * Actualiza la configuración del usuario
   */
  public async updateUserSettings(settingsUpdates: Partial<UserSettings>): Promise<void> {
    // Validar el tema si está presente en las actualizaciones
    if (settingsUpdates.theme !== undefined) {
      const validThemes = ["light", "dark", "system"];
      if (!validThemes.includes(settingsUpdates.theme)) {
        throw new Error(
          `Tema no válido: ${settingsUpdates.theme}. Temas válidos: ${validThemes.join(", ")}`
        );
      }
    }

    // Validar kanbanState si está presente
    if (settingsUpdates.kanbanState) {
      const validSortOrders = ["alphabetical", "duration"];

      for (const blockKey in settingsUpdates.kanbanState) {
        const block = settingsUpdates.kanbanState[blockKey];
        if (block && block.sortOrder && !validSortOrders.includes(block.sortOrder)) {
          throw new Error(
            `Orden de clasificación no válido: ${block.sortOrder}. Órdenes válidos: ${validSortOrders.join(", ")}`
          );
        }
      }
    }

    // Realizar la actualización de configuración
    if (settingsUpdates.theme !== undefined) {
      this.state.userSettings.theme = settingsUpdates.theme;
    }

    if (settingsUpdates.enableTimeboxNotifications !== undefined) {
      this.state.userSettings.enableTimeboxNotifications =
        settingsUpdates.enableTimeboxNotifications;
    }

    if (settingsUpdates.kanbanState) {
      this.state.userSettings.kanbanState = {
        ...this.state.userSettings.kanbanState,
        ...settingsUpdates.kanbanState,
      };
    }

    if (settingsUpdates.displaySettings) {
      // Solo actualizar las propiedades proporcionadas
      this.state.userSettings.displaySettings = {
        ...this.state.userSettings.displaySettings,
        ...settingsUpdates.displaySettings,
      };
    }

    // Actualizar el timestamp de última actualización
    this.state.lastUpdateTimestamp = Date.now();
  }
}
