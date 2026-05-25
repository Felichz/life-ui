import { SubjectiveVariableManager } from "../subjectiveVariableManager";
import { SystemCore } from "../SystemCore";
import type {
  AppState,
  ISystemCore,
  SubjectiveVariable,
  SubjectiveVariableSnapshot,
  UUID,
} from "../../types";
import { UtilityService } from "../utilityService";

// Mock para UtilityService
jest.mock("../utilityService", () => {
  const originalModule = jest.requireActual("../utilityService");
  return {
    __esModule: true,
    UtilityService: {
      ...originalModule.UtilityService,
      generateUUID: jest.fn().mockImplementation(() => "test-uuid"),
      getCurrentISODateTime: jest.fn().mockImplementation(() => "2023-01-01T12:00:00.000Z"),
    },
  };
});

describe("SubjectiveVariableManager", () => {
  let systemCore: ISystemCore;
  let subjectiveVariableManager: SubjectiveVariableManager;
  let mockState: AppState;

  beforeEach(() => {
    // Limpiar todos los mocks
    jest.clearAllMocks();
    // Restaurar cualquier mock de Date
    jest.restoreAllMocks();

    // Configurar el estado inicial mockeado
    mockState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: {
          hiddenSubjectiveVariableIds: [],
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
      },
      currentDay: {
        day: {
          id: "current-day-id",
          state: "active",
          createdAt: "2023-01-01T00:00:00.000Z",
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        activityInstances: [],
      },
    };

    // Crear un mock para SystemCore
    systemCore = {
      getState: jest.fn().mockImplementation(() => mockState),
      updateState: jest.fn().mockImplementation((updater) => {
        mockState = updater(mockState);
      }),
    };

    // Instanciar SubjectiveVariableManager con el SystemCore mockeado
    subjectiveVariableManager = new SubjectiveVariableManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe("createSubjectiveVariable", () => {
    it.skip("debe crear una nueva variable subjetiva y actualizar el estado", () => {
      const variable = subjectiveVariableManager.createSubjectiveVariable("Nivel de energía");

      expect(variable).toEqual({
        id: "test-uuid",
        name: "Nivel de energía",
        createdAt: "2023-01-01T12:00:00.000Z",
        updatedAt: "2023-01-01T12:00:00.000Z",
      });

      expect(systemCore.updateState).toHaveBeenCalledTimes(1);
      expect(mockState.global.subjectiveVariables.length).toBe(1);
      expect(mockState.global.subjectiveVariables[0]).toEqual(variable);
    });
  });

  describe("updateSubjectiveVariable", () => {
    beforeEach(() => {
      // Agregar una variable al estado para poder actualizarla
      mockState.global.subjectiveVariables = [
        {
          id: "test-var-id",
          name: "Nivel de energía",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
      ];
    });

    it.skip("debe actualizar el nombre de una variable existente", () => {
      const updatedVariable = subjectiveVariableManager.updateSubjectiveVariable("test-var-id", {
        name: "Energía diaria",
      });

      expect(updatedVariable.name).toBe("Energía diaria");
      expect(updatedVariable.updatedAt).toBe("2023-01-01T12:00:00.000Z");
      expect(updatedVariable.createdAt).toBe("2023-01-01T10:00:00.000Z");
      expect(systemCore.updateState).toHaveBeenCalledTimes(1);
    });

    it.skip("debe lanzar un error si la variable no existe", () => {
      expect(() => {
        subjectiveVariableManager.updateSubjectiveVariable("non-existent-id", {
          name: "Nueva variable",
        });
      }).toThrow("Variable subjetiva con ID non-existent-id no encontrada");
    });
  });

  describe("deleteSubjectiveVariable", () => {
    beforeEach(() => {
      // Agregar una variable al estado para poder eliminarla
      mockState.global.subjectiveVariables = [
        {
          id: "test-var-id",
          name: "Nivel de energía",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
      ];
    });

    it.skip("debe eliminar una variable existente", () => {
      subjectiveVariableManager.deleteSubjectiveVariable("test-var-id");

      expect(mockState.global.subjectiveVariables.length).toBe(0);
      expect(systemCore.updateState).toHaveBeenCalledTimes(1);
    });

    it.skip("debe lanzar un error si la variable no existe", () => {
      expect(() => {
        subjectiveVariableManager.deleteSubjectiveVariable("non-existent-id");
      }).toThrow("Variable subjetiva con ID non-existent-id no encontrada");
    });

    it.skip("debe lanzar un error si la variable está en uso en snapshots", () => {
      // Agregar un snapshot que usa la variable
      mockState.global.subjectiveVariableSnapshots = [
        {
          id: "test-snapshot-id",
          timestamp: "2023-01-01T11:00:00.000Z",
          dayId: "current-day-id",
          values: [
            {
              variableId: "test-var-id",
              variableName: "Nivel de energía",
              previousValue: 0,
              currentValue: 7,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T11:00:00.000Z",
        },
      ];

      expect(() => {
        subjectiveVariableManager.deleteSubjectiveVariable("test-var-id");
      }).toThrow(
        'No se puede eliminar la variable "Nivel de energía" porque está en uso en uno o más snapshots'
      );
    });
  });

  describe("getSubjectiveVariables", () => {
    it.skip("debe retornar un array vacío si no hay variables", () => {
      const variables = subjectiveVariableManager.getSubjectiveVariables();
      expect(variables).toEqual([]);
    });

    it.skip("debe retornar todas las variables subjetivas", () => {
      // Agregar variables al estado
      mockState.global.subjectiveVariables = [
        {
          id: "var1",
          name: "Variable 1",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
        {
          id: "var2",
          name: "Variable 2",
          createdAt: "2023-01-01T11:00:00.000Z",
          updatedAt: "2023-01-01T11:00:00.000Z",
        },
      ];

      const variables = subjectiveVariableManager.getSubjectiveVariables();
      expect(variables.length).toBe(2);
      expect(variables[0].id).toBe("var1");
      expect(variables[1].id).toBe("var2");
    });
  });

  describe("createSnapshot", () => {
    beforeEach(() => {
      // Configurar variables en el estado
      mockState.global.subjectiveVariables = [
        {
          id: "var1",
          name: "Energía",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
        {
          id: "var2",
          name: "Concentración",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
      ];
    });

    it.skip("debe crear un nuevo snapshot con todas las variables", () => {
      const values = [{ variableId: "var1", currentValue: 8 }];
      const snapshot = subjectiveVariableManager.createSnapshot(values);

      expect(snapshot).not.toBeNull();
      expect(snapshot?.values.length).toBe(2);
      expect(snapshot?.values[0].variableId).toBe("var1");
      expect(snapshot?.values[0].currentValue).toBe(8);
      expect(snapshot?.values[0].previousValue).toBe(0);
      expect(snapshot?.values[1].variableId).toBe("var2");
      expect(snapshot?.values[1].currentValue).toBe(0);
      expect(snapshot?.values[1].previousValue).toBe(0);
    });

    it.skip("debe incluir actividades y eventos relacionados", () => {
      const values = [{ variableId: "var1", currentValue: 8 }];
      const activityIds = ["activity1", "activity2"];
      const eventIds = ["event1"];

      const snapshot = subjectiveVariableManager.createSnapshot(values, activityIds, eventIds);

      expect(snapshot?.relatedActivityIds).toEqual(["activity1", "activity2"]);
      expect(snapshot?.relatedEventIds).toEqual(["event1"]);
    });

    it.skip("debe lanzar error si no hay día activo", () => {
      // Quitar el día activo
      mockState.currentDay = null;

      expect(() => {
        subjectiveVariableManager.createSnapshot([{ variableId: "var1", currentValue: 8 }]);
      }).toThrow("No hay un día activo actualmente");
    });

    it.skip("debe respetar los valores previos en snapshots subsecuentes", () => {
      // Crear un snapshot inicial
      const firstValues = [
        { variableId: "var1", currentValue: 8 },
        { variableId: "var2", currentValue: 6 },
      ];

      // Asegurarse de que canUpdateVariables devuelva true
      jest.spyOn(subjectiveVariableManager, "canUpdateVariables").mockReturnValue(true);

      // Primer snapshot
      const firstSnapshot = subjectiveVariableManager.createSnapshot(firstValues);

      // No necesitamos actualizar manualmente mockState.global.subjectiveVariableSnapshots
      // porque updateState ya lo habrá hecho

      // Actualizar la fecha para el segundo snapshot
      jest
        .spyOn(UtilityService, "getCurrentISODateTime")
        .mockReturnValue("2023-01-01T12:10:00.000Z");

      // Crear un segundo snapshot actualizando solo var1
      const secondValues = [{ variableId: "var1", currentValue: 5 }];
      const secondSnapshot = subjectiveVariableManager.createSnapshot(secondValues);

      // Verificar que el segundo snapshot tenga los valores correctos
      expect(secondSnapshot).not.toBeNull();
      expect(secondSnapshot?.values[0].variableId).toBe("var1");
      expect(secondSnapshot?.values[0].previousValue).toBe(8);
      expect(secondSnapshot?.values[0].currentValue).toBe(5);
      expect(secondSnapshot?.values[1].variableId).toBe("var2");
      expect(secondSnapshot?.values[1].previousValue).toBe(6);
      expect(secondSnapshot?.values[1].currentValue).toBe(6);
    });
  });

  describe("getSnapshots", () => {
    beforeEach(() => {
      // Configurar varios snapshots en el estado
      mockState.global.subjectiveVariableSnapshots = [
        {
          id: "snapshot1",
          timestamp: "2023-01-01T10:00:00.000Z",
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 0,
              currentValue: 8,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T10:00:00.000Z",
        },
        {
          id: "snapshot2",
          timestamp: "2023-01-01T14:00:00.000Z",
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 8,
              currentValue: 6,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T14:00:00.000Z",
        },
        {
          id: "snapshot3",
          timestamp: "2023-01-02T10:00:00.000Z",
          dayId: "day2",
          values: [
            {
              variableId: "var2",
              variableName: "Concentración",
              previousValue: 0,
              currentValue: 7,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-02T10:00:00.000Z",
        },
      ];
    });

    it.skip("debe retornar todos los snapshots sin filtros", () => {
      const snapshots = subjectiveVariableManager.getSnapshots();
      expect(snapshots.length).toBe(3);
    });

    it.skip("debe filtrar snapshots por dayId", () => {
      const snapshots = subjectiveVariableManager.getSnapshots({ dayId: "day1" });
      expect(snapshots.length).toBe(2);
      expect(snapshots[0].id).toBe("snapshot1");
      expect(snapshots[1].id).toBe("snapshot2");
    });

    it.skip("debe filtrar snapshots por variableIds", () => {
      const snapshots = subjectiveVariableManager.getSnapshots({ variableIds: ["var2"] });
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).toBe("snapshot3");
    });

    it.skip("debe filtrar snapshots por rango de tiempo", () => {
      const snapshots = subjectiveVariableManager.getSnapshots({
        since: "2023-01-01T12:00:00.000Z",
        until: "2023-01-01T15:00:00.000Z",
      });
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).toBe("snapshot2");
    });

    it.skip("debe combinar múltiples filtros", () => {
      const snapshots = subjectiveVariableManager.getSnapshots({
        dayId: "day1",
        variableIds: ["var1"],
        since: "2023-01-01T12:00:00.000Z",
      });
      expect(snapshots.length).toBe(1);
      expect(snapshots[0].id).toBe("snapshot2");
    });
  });

  describe("getLatestValues", () => {
    beforeEach(() => {
      // Configurar variables en el estado
      mockState.global.subjectiveVariables = [
        {
          id: "var1",
          name: "Energía",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
        {
          id: "var2",
          name: "Concentración",
          createdAt: "2023-01-01T10:00:00.000Z",
          updatedAt: "2023-01-01T10:00:00.000Z",
        },
      ];

      // Configurar varios snapshots en el estado con var1=8 como valor más reciente
      mockState.global.subjectiveVariableSnapshots = [
        {
          id: "snapshot1",
          timestamp: "2023-01-01T10:00:00.000Z",
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 0,
              currentValue: 5,
            },
            {
              variableId: "var2",
              variableName: "Concentración",
              previousValue: 0,
              currentValue: 6,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T10:00:00.000Z",
        },
        {
          id: "snapshot2",
          timestamp: "2023-01-01T14:00:00.000Z", // Este es más reciente, así que su valor (8) debe prevalecer
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 5,
              currentValue: 8,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T14:00:00.000Z",
        },
      ];
    });

    it.skip("debe retornar los valores más recientes para cada variable", () => {
      const latestValues = subjectiveVariableManager.getLatestValues();

      expect(latestValues).toEqual({
        var1: 8, // Del snapshot2 que es más reciente (14:00)
        var2: 6, // Del snapshot1 (no se actualizó en snapshot2)
      });
    });

    it.skip("debe retornar 0 para variables sin snapshots", () => {
      // Agregar una variable sin snapshots
      mockState.global.subjectiveVariables.push({
        id: "var3",
        name: "Nueva Variable",
        createdAt: "2023-01-01T15:00:00.000Z",
        updatedAt: "2023-01-01T15:00:00.000Z",
      });

      const latestValues = subjectiveVariableManager.getLatestValues();

      expect(latestValues).toEqual({
        var1: 8,
        var2: 6,
        var3: 0, // No tiene snapshots, valor por defecto
      });
    });
  });

  describe("canUpdateVariables", () => {
    it.skip("debe retornar true si no hay snapshots previos", () => {
      expect(subjectiveVariableManager.canUpdateVariables()).toBe(true);
    });

    it.skip("debe retornar false si no han pasado 5 minutos desde el último snapshot", () => {
      // Agregar un snapshot reciente (1 minuto antes)
      mockState.global.subjectiveVariableSnapshots = [
        {
          id: "snapshot1",
          timestamp: "2023-01-01T11:59:00.000Z", // 1 minuto antes de las 12:00
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 0,
              currentValue: 5,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T11:59:00.000Z",
        },
      ];

      // Mockear completamente Date para controlar el tiempo actual
      const originalDate = global.Date;
      const mockDate = class extends Date {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super("2023-01-01T12:00:00.000Z"); // Fijar fecha actual
          } else {
            super(args[0] as string | number | Date);
          }
        }
      };
      global.Date = mockDate as DateConstructor;

      expect(subjectiveVariableManager.canUpdateVariables()).toBe(false);

      // Restaurar Date original
      global.Date = originalDate;
    });

    it.skip("debe retornar true si han pasado 5 minutos o más desde el último snapshot", () => {
      // Agregar un snapshot antiguo (10 minutos antes)
      mockState.global.subjectiveVariableSnapshots = [
        {
          id: "snapshot1",
          timestamp: "2023-01-01T11:50:00.000Z", // 10 minutos antes de las 12:00
          dayId: "day1",
          values: [
            {
              variableId: "var1",
              variableName: "Energía",
              previousValue: 0,
              currentValue: 5,
            },
          ],
          relatedActivityIds: [],
          relatedEventIds: [],
          createdAt: "2023-01-01T11:50:00.000Z",
        },
      ];

      // Mockear completamente Date para controlar el tiempo actual
      const originalDate = global.Date;
      const mockDate = class extends Date {
        constructor(...args: unknown[]) {
          if (args.length === 0) {
            super("2023-01-01T12:00:00.000Z"); // Fijar fecha actual
          } else {
            super(args[0] as string | number | Date);
          }
        }
      };
      global.Date = mockDate as DateConstructor;

      expect(subjectiveVariableManager.canUpdateVariables()).toBe(true);

      // Restaurar Date original
      global.Date = originalDate;
    });
  });
});
