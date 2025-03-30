import { VariableManagement } from "../variables";
import type { CustomVariable, CustomVariableId, SharedState, VariableSnapshot } from "../../types";

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
 * Crear una variable personalizada de prueba
 */
const createMockCustomVariable = (variableId: string): CustomVariable => {
  return {
    id: variableId,
    name: `Variable ${variableId}`,
    description: `Descripción de variable ${variableId}`,
    minValue: 1,
    maxValue: 10,
    isHigherBetter: true,
    iconId: "test-icon",
    color: "#FF5733",
  };
};

/**
 * Crear un snapshot de variables de prueba
 */
const createMockVariableSnapshot = (
  snapshotId: string,
  variableIds: CustomVariableId[] = [],
  activityIds: string[] = [],
  eventIds: string[] = []
): VariableSnapshot => {
  return {
    id: snapshotId,
    timestamp: Date.now(),
    variables: variableIds.map((variableId) => ({
      variableId,
      currentValue: 5,
      previousValue: 3,
      change: 2,
    })),
    relatedActivityIds: activityIds,
    relatedEventIds: eventIds,
    notes: `Notas para snapshot ${snapshotId}`,
  };
};

describe("VariableManagement", () => {
  // Test para gestión de variables personalizadas
  describe("Gestión de variables personalizadas", () => {
    test("createCustomVariable - debe crear una nueva variable personalizada", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);
      const newVariable: Omit<CustomVariable, "id"> = {
        name: "Nivel de Energía",
        description: "Medición del nivel de energía personal",
        minValue: 1,
        maxValue: 10,
        isHigherBetter: true,
        iconId: "energy-icon",
        color: "#4287f5",
      };

      // Act
      const createdVariable = await variableManagement.createCustomVariable(newVariable);

      // Assert
      expect(createdVariable).toBeDefined();
      expect(createdVariable.id).toBeDefined();
      expect(createdVariable.name).toBe(newVariable.name);
      expect(mockState.customVariables[createdVariable.id]).toBeDefined();
      expect(mockState.customVariables[createdVariable.id]).toEqual(createdVariable);
    });

    test("getCustomVariable - debe obtener una variable existente por ID", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableId = "existing-variable";
      const existingVariable = createMockCustomVariable(variableId);
      mockState.customVariables[variableId] = existingVariable;

      const variableManagement = new VariableManagement(mockState);

      // Act
      const retrievedVariable = await variableManagement.getCustomVariable(variableId);

      // Assert
      expect(retrievedVariable).toBeDefined();
      expect(retrievedVariable).toEqual(existingVariable);
    });

    test("updateCustomVariable - debe actualizar una variable existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableId = "variable-to-update";
      const existingVariable = createMockCustomVariable(variableId);
      mockState.customVariables[variableId] = existingVariable;

      const variableManagement = new VariableManagement(mockState);
      const variableUpdates = {
        id: variableId,
        name: "Nombre actualizado",
        description: "Descripción actualizada",
        maxValue: 12,
      };

      // Act
      await variableManagement.updateCustomVariable(variableUpdates);

      // Assert
      expect(mockState.customVariables[variableId].name).toBe("Nombre actualizado");
      expect(mockState.customVariables[variableId].description).toBe("Descripción actualizada");
      expect(mockState.customVariables[variableId].maxValue).toBe(12);
      // Verifica que otras propiedades no se modificaron
      expect(mockState.customVariables[variableId].minValue).toBe(existingVariable.minValue);
      expect(mockState.customVariables[variableId].isHigherBetter).toBe(
        existingVariable.isHigherBetter
      );
      expect(mockState.customVariables[variableId].color).toBe(existingVariable.color);
    });

    test("removeCustomVariable - debe eliminar una variable existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableId = "variable-to-remove";
      const existingVariable = createMockCustomVariable(variableId);
      mockState.customVariables[variableId] = existingVariable;

      const variableManagement = new VariableManagement(mockState);

      // Act
      await variableManagement.removeCustomVariable(variableId);

      // Assert
      expect(mockState.customVariables[variableId]).toBeUndefined();
    });
  });

  // Test para gestión de snapshots de variables
  describe("Gestión de snapshots de variables", () => {
    test("createVariableSnapshot - debe crear un nuevo snapshot de variables", async () => {
      // Arrange
      const mockState = createMockSharedState();

      // Crear algunas variables para el snapshot
      const variableId1 = "variable-1";
      const variableId2 = "variable-2";
      mockState.customVariables[variableId1] = createMockCustomVariable(variableId1);
      mockState.customVariables[variableId2] = createMockCustomVariable(variableId2);

      const variableManagement = new VariableManagement(mockState);

      const newSnapshot: Omit<VariableSnapshot, "id"> = {
        timestamp: Date.now(),
        variables: [
          {
            variableId: variableId1,
            currentValue: 7,
            previousValue: 5,
            change: 2,
          },
          {
            variableId: variableId2,
            currentValue: 3,
            previousValue: 4,
            change: -1,
          },
        ],
        relatedActivityIds: ["activity-1"],
        relatedEventIds: ["event-1"],
        notes: "Snapshot de prueba",
      };

      // Act
      const createdSnapshot = await variableManagement.createVariableSnapshot(newSnapshot);

      // Assert
      expect(createdSnapshot).toBeDefined();
      expect(createdSnapshot.id).toBeDefined();
      expect(createdSnapshot.timestamp).toBe(newSnapshot.timestamp);
      expect(createdSnapshot.variables).toHaveLength(2);

      // Verificar que se añadió al historial
      expect(mockState.currentDay.dayHistory.variableHistory).toContain(createdSnapshot);
    });

    test("getVariableSnapshots - debe obtener snapshots en un rango de fechas", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);

      // Crear variables para usar en los snapshots
      const variableId = "test-variable";
      mockState.customVariables[variableId] = createMockCustomVariable(variableId);

      // Crear snapshots con diferentes fechas
      const now = Date.now();
      const dayInMs = 24 * 60 * 60 * 1000;

      const snapshot1 = createMockVariableSnapshot("snapshot-1", [variableId]);
      snapshot1.timestamp = now - 2 * dayInMs; // Hace 2 días

      const snapshot2 = createMockVariableSnapshot("snapshot-2", [variableId]);
      snapshot2.timestamp = now - dayInMs; // Hace 1 día

      const snapshot3 = createMockVariableSnapshot("snapshot-3", [variableId]);
      snapshot3.timestamp = now; // Hoy

      // Añadir snapshots al historial
      mockState.currentDay.dayHistory.variableHistory = [snapshot1, snapshot2, snapshot3];

      // Act
      const result = await variableManagement.getVariableSnapshots(
        now - 1.5 * dayInMs,
        now + dayInMs
      );

      // Assert
      expect(result).toHaveLength(2);
      expect(result).toContain(snapshot2);
      expect(result).toContain(snapshot3);
      expect(result).not.toContain(snapshot1);
    });

    test("getVariableSnapshotById - debe obtener un snapshot específico por ID", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const snapshotId = "specific-snapshot";
      const variableId = "test-variable";

      // Crear variable para usar en el snapshot
      mockState.customVariables[variableId] = createMockCustomVariable(variableId);

      // Crear snapshot específico
      const specificSnapshot = createMockVariableSnapshot(snapshotId, [variableId]);

      // Añadir varios snapshots al historial
      mockState.currentDay.dayHistory.variableHistory = [
        createMockVariableSnapshot("other-snapshot-1", [variableId]),
        specificSnapshot,
        createMockVariableSnapshot("other-snapshot-2", [variableId]),
      ];

      const variableManagement = new VariableManagement(mockState);

      // Act
      const result = await variableManagement.getVariableSnapshotById(snapshotId);

      // Assert
      expect(result).toBeDefined();
      expect(result).toEqual(specificSnapshot);
    });
  });

  // Tests para validación y manejo de errores
  describe("Validación y manejo de errores", () => {
    test("getCustomVariable - debe devolver undefined para una variable inexistente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);
      const nonExistentId = "non-existent-variable";

      // Act
      const result = await variableManagement.getCustomVariable(nonExistentId);

      // Assert
      expect(result).toBeUndefined();
    });

    test("updateCustomVariable - debe rechazar actualizaciones para variables inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);
      const nonExistentId = "non-existent-variable";
      const variableUpdates = {
        id: nonExistentId,
        name: "Nombre actualizado",
      };

      // Act & Assert
      await expect(variableManagement.updateCustomVariable(variableUpdates)).rejects.toThrow(
        /no existe/i
      );
    });

    test("removeCustomVariable - debe rechazar eliminar variables inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);
      const nonExistentId = "non-existent-variable";

      // Act & Assert
      await expect(variableManagement.removeCustomVariable(nonExistentId)).rejects.toThrow(
        /no existe/i
      );
    });

    test("getVariableSnapshotById - debe devolver undefined para un snapshot inexistente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);
      const nonExistentId = "non-existent-snapshot";

      // Act
      const result = await variableManagement.getVariableSnapshotById(nonExistentId);

      // Assert
      expect(result).toBeUndefined();
    });

    test("createVariableSnapshot - debe rechazar snapshots con variables inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableManagement = new VariableManagement(mockState);

      const invalidSnapshot: Omit<VariableSnapshot, "id"> = {
        timestamp: Date.now(),
        variables: [
          {
            variableId: "non-existent-variable",
            currentValue: 7,
            previousValue: 5,
            change: 2,
          },
        ],
        relatedActivityIds: [],
        relatedEventIds: [],
      };

      // Act & Assert
      await expect(variableManagement.createVariableSnapshot(invalidSnapshot)).rejects.toThrow(
        /variable.*no existe/i
      );
    });

    test("createVariableSnapshot - debe rechazar valores fuera de rango", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const variableId = "test-variable";

      // Crear variable con rango 1-10
      mockState.customVariables[variableId] = createMockCustomVariable(variableId);

      const variableManagement = new VariableManagement(mockState);

      const invalidSnapshot: Omit<VariableSnapshot, "id"> = {
        timestamp: Date.now(),
        variables: [
          {
            variableId: variableId,
            currentValue: 15, // Fuera del rango máximo (10)
            previousValue: 5,
            change: 10,
          },
        ],
        relatedActivityIds: [],
        relatedEventIds: [],
      };

      // Act & Assert
      await expect(variableManagement.createVariableSnapshot(invalidSnapshot)).rejects.toThrow(
        /valor.*fuera de rango/i
      );
    });
  });
});
