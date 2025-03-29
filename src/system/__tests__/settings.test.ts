import { SettingsManagement } from "../settings";
import type { SharedState, UserSettings } from "../../types";

/**
 * Mock base para el estado compartido
 * Se modificará según sea necesario para cada test específico
 */
const createMockSharedState = (): SharedState => ({
  currentDay: {
    startDate: Date.now() - 3600000, // 1 hora atrás
    endDate: Date.now() + 82800000, // 23 horas adelante
    activityInstances: [],
    dayHistory: {
      variableHistory: [],
      activityHistory: [],
      eventHistory: [],
      interruptionHistory: [],
      satisfactionHistory: [],
      momentumHistory: [],
    },
    timeDistribution: {
      objective: 0,
      flexible: 0,
      timebox: 0,
      autopilot: 0,
      consciousRest: 0,
      meditation: 0,
    },
    daySummary: {
      activitiesCompleted: 0,
      activitiesInterrupted: 0,
      completionRate: 0,
      averageSatisfaction: 0,
      averageValuePerception: 0,
      timeDistribution: {
        objective: 0,
        flexible: 0,
        timebox: 0,
        autopilot: 0,
        consciousRest: 0,
        meditation: 0,
      },
      overallMomentumQuality: 0,
    },
  },
  activeActivity: undefined,
  activityTemplates: {},
  customVariables: {},
  interruptionCauses: {},
  discreteEvents: {},
  userSettings: {
    theme: "light",
    kanbanState: {},
    enableTimeboxNotifications: true,
    displaySettings: {
      showMomentumChart: true,
      defaultVisibleVariables: [],
    },
  },
  lastUpdateTimestamp: Date.now(),
});

/**
 * Crear ajustes de usuario de prueba
 */
const createMockUserSettings = (overrides: Partial<UserSettings> = {}): UserSettings => ({
  theme: "light",
  kanbanState: {},
  enableTimeboxNotifications: true,
  displaySettings: {
    showMomentumChart: true,
    defaultVisibleVariables: [],
  },
  ...overrides,
});

describe("SettingsManagement", () => {
  // Tests para obtener configuración de usuario
  describe("Obtener configuración de usuario", () => {
    test("getUserSettings - debe obtener la configuración actual del usuario", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const customSettings = createMockUserSettings({
        theme: "dark",
        enableTimeboxNotifications: false,
      });
      mockState.userSettings = customSettings;
      const settingsManagement = new SettingsManagement(mockState);

      // Act
      const retrievedSettings = await settingsManagement.getUserSettings();

      // Assert
      expect(retrievedSettings).toBeDefined();
      expect(retrievedSettings).toEqual(customSettings);
      expect(retrievedSettings.theme).toBe("dark");
      expect(retrievedSettings.enableTimeboxNotifications).toBe(false);
    });
  });

  // Tests para actualizar configuración de usuario
  describe("Actualizar configuración de usuario", () => {
    test("updateUserSettings - debe actualizar parcialmente la configuración", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const initialSettings = createMockUserSettings();
      mockState.userSettings = initialSettings;
      const settingsManagement = new SettingsManagement(mockState);

      const settingsUpdates: Partial<UserSettings> = {
        theme: "dark",
        displaySettings: {
          showMomentumChart: false,
          defaultVisibleVariables: ["var1", "var2"],
        },
      };

      // Act
      await settingsManagement.updateUserSettings(settingsUpdates);

      // Assert
      expect(mockState.userSettings.theme).toBe("dark");
      expect(mockState.userSettings.displaySettings.showMomentumChart).toBe(false);
      expect(mockState.userSettings.displaySettings.defaultVisibleVariables).toEqual([
        "var1",
        "var2",
      ]);
      // Verifica que las propiedades no mencionadas no cambiaron
      expect(mockState.userSettings.enableTimeboxNotifications).toBe(
        initialSettings.enableTimeboxNotifications
      );
    });

    test("updateUserSettings - debe actualizar correctamente la propiedad kanbanState", async () => {
      // Arrange
      const mockState = createMockSharedState();
      mockState.userSettings = createMockUserSettings();
      const settingsManagement = new SettingsManagement(mockState);

      const newKanbanState = {
        block1: { isExpanded: true, showCompleted: false, sortOrder: "alphabetical" as const },
        block2: { isExpanded: false, showCompleted: true, sortOrder: "duration" as const },
      };

      const settingsUpdates: Partial<UserSettings> = {
        kanbanState: newKanbanState,
      };

      // Act
      await settingsManagement.updateUserSettings(settingsUpdates);

      // Assert
      expect(mockState.userSettings.kanbanState).toEqual(newKanbanState);
      expect(mockState.userSettings.kanbanState["block1"].isExpanded).toBe(true);
      expect(mockState.userSettings.kanbanState["block1"].sortOrder).toBe("alphabetical");
      expect(mockState.userSettings.kanbanState["block2"].showCompleted).toBe(true);
    });

    test("updateUserSettings - debe actualizar el timestamp de última actualización", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const initialTimestamp = mockState.lastUpdateTimestamp;
      const settingsManagement = new SettingsManagement(mockState);

      const settingsUpdates: Partial<UserSettings> = {
        theme: "system",
      };

      // Esperar un momento para asegurar que el timestamp cambie
      await new Promise((resolve) => setTimeout(resolve, 5));

      // Act
      await settingsManagement.updateUserSettings(settingsUpdates);

      // Assert
      expect(mockState.lastUpdateTimestamp).toBeGreaterThan(initialTimestamp);
    });

    test("updateUserSettings - debe manejar actualizaciones vacías sin cambiar el estado", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const initialSettings = createMockUserSettings();
      mockState.userSettings = initialSettings;
      const initialTimestamp = mockState.lastUpdateTimestamp;
      const settingsManagement = new SettingsManagement(mockState);

      const emptyUpdates = {};

      // Act
      await settingsManagement.updateUserSettings(emptyUpdates);

      // Assert
      expect(mockState.userSettings).toEqual(initialSettings);
      // El timestamp debería actualizarse incluso con cambios vacíos
      expect(mockState.lastUpdateTimestamp).toBeGreaterThanOrEqual(initialTimestamp);
    });
  });

  // Tests para validación y manejo de errores
  describe("Validación y manejo de errores", () => {
    test("updateUserSettings - debe rechazar valores de theme inválidos", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const settingsManagement = new SettingsManagement(mockState);

      const invalidUpdates = {
        theme: "invalid-theme",
      } as unknown as UserSettings;

      // Act & Assert
      await expect(settingsManagement.updateUserSettings(invalidUpdates)).rejects.toThrow(
        /tema no válido/i
      );
    });

    test("updateUserSettings - debe validar formato correcto de kanbanState", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const settingsManagement = new SettingsManagement(mockState);

      const invalidKanbanState = {
        block1: {
          isExpanded: true,
          showCompleted: true,
          sortOrder: "invalid-order",
        },
      };

      const invalidUpdates = {
        kanbanState: invalidKanbanState,
      } as unknown as Partial<UserSettings>;

      // Act & Assert
      await expect(settingsManagement.updateUserSettings(invalidUpdates)).rejects.toThrow(
        /orden de clasificación no válido/i
      );
    });

    test("updateUserSettings - debe manejar correctamente valores nulos/undefined en las actualizaciones", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const initialSettings = createMockUserSettings();
      mockState.userSettings = initialSettings;
      const settingsManagement = new SettingsManagement(mockState);

      const updatesWithNull = {
        displaySettings: null,
      } as unknown as Partial<UserSettings>;

      // Act
      await settingsManagement.updateUserSettings(updatesWithNull);

      // Assert
      // Las propiedades válidas deben mantenerse intactas
      expect(mockState.userSettings.theme).toBe(initialSettings.theme);
      expect(mockState.userSettings.enableTimeboxNotifications).toBe(
        initialSettings.enableTimeboxNotifications
      );
      // displaySettings no debería ser nulo a pesar de la actualización
      expect(mockState.userSettings.displaySettings).toEqual(initialSettings.displaySettings);
    });
  });
});
