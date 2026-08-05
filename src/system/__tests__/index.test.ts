import { SystemCore } from "../index";
import { PersistenceManager } from "../persistenceManager";
import { UtilityService } from "../utilityService";
import type { AppState, Day, TimeBlock } from "../../types";

// Mock del PersistenceManager: devuelve SIEMPRE la misma instancia (singleton)
// para que múltiples `new SystemCore()` en un mismo test compartan el mismo
// mock configurado. Los tests que necesiten el pipeline real (exportData/importData
// con migración v2→v3) reasignan el mockImplementation del método correspondiente.
const sharedPersistence: Record<string, jest.Mock> = {};
jest.mock("../persistenceManager", () => {
  const actual = jest.requireActual("../persistenceManager");
  const MockedClass = jest.fn().mockImplementation(() => {
    if (Object.keys(sharedPersistence).length === 0) {
      sharedPersistence.saveState = jest.fn();
      sharedPersistence.loadState = jest.fn().mockReturnValue(null);
      sharedPersistence.clearState = jest.fn();
      sharedPersistence.serialize = jest.fn((state: AppState) =>
        JSON.stringify({ ...state, schemaVersion: 3 })
      );
      sharedPersistence.deserialize = jest.fn((json: string) =>
        JSON.parse(json) as AppState
      );
    }
    return sharedPersistence;
  });
  return {
    ...actual,
    PersistenceManager: MockedClass,
  };
});
jest.mock("../dayManager");
jest.mock("../activityManager");
jest.mock("../timeBlockManager");
jest.mock("../eventManager");
jest.mock("../analyticsManager");
jest.mock("../userPreferencesManager");
jest.mock("../utilityService");

describe("SystemCore", () => {
  let systemCore: SystemCore;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;
  let mockPersistence: Record<string, jest.Mock>;

  beforeEach(() => {
    // Configurar mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    // Resetear el constructor mockeado y limpiar la instancia compartida
    (PersistenceManager as unknown as jest.Mock).mockClear();
    Object.keys(sharedPersistence).forEach((k) => delete sharedPersistence[k]);

    systemCore = new SystemCore();

    // mockPersistence es ahora la instancia compartida singleton
    mockPersistence = sharedPersistence;

    // Configurar el mock por defecto
    mockPersistence.loadState.mockReturnValue(null);
    mockPersistence.saveState.mockImplementation(() => {});
    mockPersistence.clearState.mockImplementation(() => {});
    mockPersistence.serialize.mockImplementation((state: AppState) =>
      JSON.stringify({ ...state, schemaVersion: 3 })
    );
    mockPersistence.deserialize.mockImplementation((json: string) =>
      JSON.parse(json) as AppState
    );

    // Obtener el estado inicial
    mockAppState = systemCore.getState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Inicialización", () => {
    it("debe crear un estado por defecto al inicializar", () => {
      expect(mockAppState).toEqual({
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 1000,
            updatedAt: mockTimestamp,
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 3,
        },
        currentDay: null,
      });
    });

    it("debe cargar el estado desde persistencia si existe", () => {
      const savedState: AppState = {
        global: {
          days: [
            {
              id: "existing-day",
              state: "active",
              startTime: "2023-01-01T10:00:00.000Z",
              createdAt: "2023-01-01T10:00:00.000Z",
              updatedAt: "2023-01-01T10:00:00.000Z",
            },
          ],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T10:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 2,
        },
        currentDay: {
          day: {
            id: "existing-day",
            state: "active",
            startTime: "2023-01-01T10:00:00.000Z",
            createdAt: "2023-01-01T10:00:00.000Z",
            updatedAt: "2023-01-01T10:00:00.000Z",
          },
          activityInstances: [],
          activeActivityInstanceId: undefined,
        },
      };

      // Configurar mock para devolver el estado guardado (compartido vía singleton)
      (mockPersistence.loadState as jest.Mock).mockReturnValue(savedState);

      // Crear nueva instancia con el mock configurado
      const systemCoreWithSavedState = new SystemCore();

      // Verificar que se cargó el estado
      expect(systemCoreWithSavedState.getState()).toEqual(savedState);
    });
  });

  describe("updateState", () => {
    it("debe actualizar el estado y notificar a los observadores", () => {
      // Configurar un observador
      const mockObserver = jest.fn();
      const unsubscribe = systemCore.onStateChange(mockObserver);

      // Actualizar el estado
      systemCore.updateState((state) => {
        return {
          ...state,
          global: {
            ...state.global,
            days: [
              ...state.global.days,
              {
                id: mockUUID,
                state: "active",
                startTime: mockTimestamp,
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp,
              },
            ],
          },
        };
      });

      // Verificar que se actualizó el estado
      const updatedState = systemCore.getState();
      expect(updatedState.global.days.length).toBe(1);
      expect(updatedState.global.days[0].id).toBe(mockUUID);

      // Verificar que se llamó al observador
      expect(mockObserver).toHaveBeenCalledWith(updatedState);

      // Verificar que se guardó el estado
      expect(mockPersistence.saveState).toHaveBeenCalledWith(updatedState);

      // Probar desuscripción
      unsubscribe();
      systemCore.updateState((state) => state); // Otra actualización
      expect(mockObserver).toHaveBeenCalledTimes(1); // No debería haberse llamado de nuevo
    });
  });

  describe("Métodos delegados", () => {
    it("debe delegar correctamente los métodos de DayManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de DayManager
      const startDaySpy = jest
        .spyOn(systemCore["dayManager"], "startDay")
        .mockImplementation(() => {
          return {
            id: mockUUID,
            state: "active",
            startTime: mockTimestamp,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          } as Day;
        });

      const endDaySpy = jest.spyOn(systemCore["dayManager"], "endDay").mockImplementation(() => {
        return {
          id: mockUUID,
          state: "inactive",
          startTime: mockTimestamp,
          endTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        } as Day;
      });

      const getCurrentDaySpy = jest.spyOn(systemCore["dayManager"], "getCurrentDay");
      const isDayActiveSpy = jest.spyOn(systemCore["dayManager"], "isDayActive");

      // Probar las delegaciones
      systemCore.startDay();
      expect(startDaySpy).toHaveBeenCalled();

      systemCore.endDay();
      expect(endDaySpy).toHaveBeenCalled();

      systemCore.getCurrentDay();
      expect(getCurrentDaySpy).toHaveBeenCalled();

      systemCore.isDayActive();
      expect(isDayActiveSpy).toHaveBeenCalled();
    });

    it("debe delegar correctamente los métodos de ActivityManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de ActivityManager
      const createTemplateSpy = jest.spyOn(systemCore["activityManager"], "createActivityTemplate");
      const updateTemplateSpy = jest.spyOn(systemCore["activityManager"], "updateActivityTemplate");
      const deleteTemplateSpy = jest.spyOn(systemCore["activityManager"], "deleteActivityTemplate");
      const getTemplatesSpy = jest.spyOn(systemCore["activityManager"], "getActivityTemplates");

      // Datos de ejemplo
      const templateData = {
        title: "Test Activity",
        description: "Test Description",
        type: "clear-objective" as const,
        isSystemActivity: false,
        clearObjectiveSettings: {
          estimatedDurationMinutes: 30,
        },
      };

      // Probar las delegaciones
      systemCore.createActivityTemplate(templateData);
      expect(createTemplateSpy).toHaveBeenCalledWith(templateData);

      systemCore.updateActivityTemplate(mockUUID, { title: "Updated Title" });
      expect(updateTemplateSpy).toHaveBeenCalledWith(mockUUID, { title: "Updated Title" });

      systemCore.deleteActivityTemplate(mockUUID);
      expect(deleteTemplateSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getActivityTemplates();
      expect(getTemplatesSpy).toHaveBeenCalled();
    });

    it("debe delegar correctamente los métodos de TimeBlockManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de TimeBlockManager
      const createBlockSpy = jest
        .spyOn(systemCore["timeBlockManager"], "createTimeBlock")
        .mockImplementation((name, startMinute, endMinute) => {
          return {
            id: mockUUID,
            name,
            startMinute,
            endMinute,
            isDefault: false,
            order: 1,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          } as TimeBlock;
        });

      const updateBlockSpy = jest.spyOn(systemCore["timeBlockManager"], "updateTimeBlock");
      const deleteBlockSpy = jest.spyOn(systemCore["timeBlockManager"], "deleteTimeBlock");
      const getBlocksSpy = jest.spyOn(systemCore["timeBlockManager"], "getTimeBlocks");

      // Datos de ejemplo
      const name = "Morning Block";
      const startMinute = 480; // 8:00 AM
      const endMinute = 600; // 10:00 AM

      // Probar las delegaciones
      systemCore.createTimeBlock(name, startMinute, endMinute);
      expect(createBlockSpy).toHaveBeenCalledWith(name, startMinute, endMinute);

      systemCore.updateTimeBlock(mockUUID, { name: "Updated Block" });
      expect(updateBlockSpy).toHaveBeenCalledWith(mockUUID, { name: "Updated Block" });

      systemCore.deleteTimeBlock(mockUUID);
      // deleteTimeBlock tiene un segundo argumento opcional (moveActivitiesToTodo=true por defecto)
      expect(deleteBlockSpy).toHaveBeenCalledWith(mockUUID, true);

      systemCore.getTimeBlocks();
      expect(getBlocksSpy).toHaveBeenCalled();
    });

    it("debe delegar correctamente los métodos de UserPreferencesManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de UserPreferencesManager
      const updatePreferencesSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "updateUserPreferences"
      );
      const getPreferencesSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "getUserPreferences"
      );
      const updateDailyTempoTargetSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "updateDailyTempoTarget"
      );

      // Probar las delegaciones
      systemCore.updateUserPreferences({ dailyTempoTarget: 1500 });
      expect(updatePreferencesSpy).toHaveBeenCalledWith({ dailyTempoTarget: 1500 });

      systemCore.getUserPreferences();
      expect(getPreferencesSpy).toHaveBeenCalled();

      systemCore.updateDailyTempoTarget(2000);
      expect(updateDailyTempoTargetSpy).toHaveBeenCalledWith(2000);
    });

    it("debe delegar correctamente los métodos de AnalyticsManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de AnalyticsManager
      const getTimelineSpy = jest.spyOn(systemCore["analyticsManager"], "getTimelineData");
      const getDistributionSpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getTimeDistributionData"
      );
      const getStatsSpy = jest.spyOn(systemCore["analyticsManager"], "getActivityStats");
      const getCompletionRateSpy = jest.spyOn(systemCore["analyticsManager"], "getCompletionRate");
      const getEstimationAccuracySpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getEstimationAccuracy"
      );

      // Probar las delegaciones
      systemCore.getTimelineData(mockUUID);
      expect(getTimelineSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getTimeDistributionData();
      expect(getDistributionSpy).toHaveBeenCalled();

      systemCore.getActivityStats(mockUUID);
      expect(getStatsSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getCompletionRate();
      expect(getCompletionRateSpy).toHaveBeenCalled();

      systemCore.getEstimationAccuracy();
      expect(getEstimationAccuracySpy).toHaveBeenCalled();
    });
  });

  describe("Métodos de persistencia", () => {
    it("debe exportar correctamente el estado como JSON", () => {
      const exportedJson = systemCore.exportData();
      const exportedState = JSON.parse(exportedJson);

      // El estado exportado contiene el global completo + schemaVersion top-level
      // (añadido por el pipeline central)
      expect(exportedState.global).toEqual(systemCore.getState().global);
      expect(exportedState.schemaVersion).toBe(3);
    });

    it("debe importar correctamente el estado desde JSON (v3)", () => {
      const importedState: AppState = {
        global: {
          days: [
            {
              id: "imported-day",
              state: "inactive",
              startTime: "2023-01-01T08:00:00.000Z",
              endTime: "2023-01-01T16:00:00.000Z",
              createdAt: "2023-01-01T08:00:00.000Z",
              updatedAt: "2023-01-01T16:00:00.000Z",
            },
          ],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T08:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 3,
        },
        currentDay: null,
      };

      // Importar desde JSON
      systemCore.importData(JSON.stringify(importedState));

      // Verificar que se importó correctamente
      expect(systemCore.getState()).toEqual(importedState);

      // Verificar que se guardó el estado importado
      expect(mockPersistence.saveState).toHaveBeenCalledWith(importedState);
    });

    it("importData ejecuta el pipeline central: importar v2 con legacy archiva y limpia", () => {
      // Usamos la implementación real de deserialize (incluye migración)
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        deserialize: (json: string) => AppState;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.deserialize.mockImplementation((json: string) =>
        realInstance.deserialize(json)
      );

      // JSON v2 con campos legacy - simula un usuario que importa un backup antiguo
      const v2WithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 1500,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };

      systemCore.importData(JSON.stringify(v2WithLegacy));

      const state = systemCore.getState();
      const global = state.global as unknown as Record<string, unknown>;

      // El runtime ya no contiene los legacy fields
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect((global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds)
        .toBeUndefined();
      // Pero el archivo está disponible
      expect(global.legacyArchive).toBeDefined();
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(1500);
    });

    it("importData de v1 sin schemaVersion ejecuta v1→v2→v3 en cadena", () => {
      // Usamos la implementación real de deserialize
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        deserialize: (json: string) => AppState;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.deserialize.mockImplementation((json: string) =>
        realInstance.deserialize(json)
      );

      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
        },
        currentDay: null,
      };

      systemCore.importData(JSON.stringify(v1State));

      const state = systemCore.getState();
      const global = state.global as unknown as Record<string, unknown>;

      // dailyTempoTarget creado por v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(1000);
      // Legacy archivado por v2→v3
      expect(global.legacyArchive).toBeDefined();
    });

    it("exportData pasa por el pipeline central (incluye schemaVersion, no filtra)", () => {
      // Mockeamos serialize para verificar que se llama
      mockPersistence.serialize.mockReturnValue("mock-json");

      const result = systemCore.exportData();
      expect(result).toBe("mock-json");
      expect(mockPersistence.serialize).toHaveBeenCalled();
    });

    it("exportData real: incluye schemaVersion=3 y no incluye legacy fields", () => {
      // Usamos la implementación real de serialize (incluye strip legacy)
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        serialize: (state: AppState) => string;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.serialize.mockImplementation((state: AppState) =>
        realInstance.serialize(state)
      );

      // Inyectar un estado con legacy para verificar el strip
      systemCore.updateState((state) => {
        const global = state.global as unknown as Record<string, unknown>;
        global.subjectiveVariables = [{ id: "v1" }];
        global.interruptionCauses = [{ id: "c1" }];
        return {
          ...state,
          global: global as unknown as typeof state.global,
        };
      });

      const json = systemCore.exportData();
      const parsed = JSON.parse(json);

      expect(parsed.schemaVersion).toBe(3);
      expect(parsed.global.subjectiveVariables).toBeUndefined();
      expect(parsed.global.interruptionCauses).toBeUndefined();
    });

    it("debe manejar errores al importar JSON inválido", () => {
      // Intentar importar JSON inválido
      expect(() => systemCore.importData("invalid json")).toThrow();
    });

    it("debe limpiar correctamente el estado", () => {
      // Establecer un estado con datos
      systemCore.updateState((state) => {
        return {
          ...state,
          global: {
            ...state.global,
            days: [
              {
                id: mockUUID,
                state: "active",
                startTime: mockTimestamp,
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp,
              },
            ],
          },
        };
      });

      // Verificar que tenemos datos
      expect(systemCore.getState().global.days.length).toBe(1);

      // Limpiar el estado
      systemCore.clearState();

      // Verificar que se limpió correctamente
      expect(systemCore.getState().global.days).toEqual([]);
      expect(mockPersistence.clearState).toHaveBeenCalled();
    });
  });
});