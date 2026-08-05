import { SystemCore } from "../index";
import { PersistenceManager } from "../persistenceManager";
import { UtilityService } from "../utilityService";
import type { AppState, Day, TimeBlock } from "../../types";

// Mocks para los módulos
jest.mock("../persistenceManager");
jest.mock("../dayManager");
jest.mock("../activityManager");
jest.mock("../timeBlockManager");
jest.mock("../subjectiveVariableManager");
jest.mock("../eventManager");
jest.mock("../interruptionManager");
jest.mock("../analyticsManager");
jest.mock("../userPreferencesManager");
jest.mock("../utilityService");

describe("SystemCore", () => {
  let systemCore: SystemCore;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;

  beforeEach(() => {
    // Configurar mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    // Configurar PersistenceManager mock
    (PersistenceManager.prototype.loadState as jest.Mock).mockReturnValue(null);
    (PersistenceManager.prototype.saveState as jest.Mock).mockImplementation(() => {});

    systemCore = new SystemCore();

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
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            dailyTempoTarget: 1000,
            updatedAt: mockTimestamp,
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
          schemaVersion: 2,
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
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T10:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
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

      // Configurar mock para devolver un estado guardado
      (PersistenceManager.prototype.loadState as jest.Mock).mockReturnValue(savedState);

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
      expect(PersistenceManager.prototype.saveState).toHaveBeenCalledWith(updatedState);

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

    it("debe delegar correctamente los métodos de SubjectiveVariableManager", () => {
      // Restaurar los mocks originales para probar la delegación
      jest.restoreAllMocks();

      // Crear spies para los métodos de SubjectiveVariableManager
      const createVariableSpy = jest.spyOn(
        systemCore["subjectiveVariableManager"],
        "createSubjectiveVariable"
      );
      const updateVariableSpy = jest.spyOn(
        systemCore["subjectiveVariableManager"],
        "updateSubjectiveVariable"
      );
      const deleteVariableSpy = jest.spyOn(
        systemCore["subjectiveVariableManager"],
        "deleteSubjectiveVariable"
      );
      const createSnapshotSpy = jest.spyOn(
        systemCore["subjectiveVariableManager"],
        "createSnapshot"
      );
      const getLatestValuesSpy = jest.spyOn(
        systemCore["subjectiveVariableManager"],
        "getLatestValues"
      );

      // Datos de ejemplo
      const variableName = "Concentración";
      const values = [{ variableId: mockUUID, currentValue: 8 }];

      // Probar las delegaciones
      systemCore.createSubjectiveVariable(variableName);
      expect(createVariableSpy).toHaveBeenCalledWith(variableName);

      systemCore.updateSubjectiveVariable(mockUUID, { name: "Foco" });
      expect(updateVariableSpy).toHaveBeenCalledWith(mockUUID, { name: "Foco" });

      systemCore.deleteSubjectiveVariable(mockUUID);
      expect(deleteVariableSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.createSnapshot(values);
      expect(createSnapshotSpy).toHaveBeenCalledWith(values, undefined, undefined);

      systemCore.getLatestValues();
      expect(getLatestValuesSpy).toHaveBeenCalled();
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
      const toggleVisibilitySpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "toggleVariableVisibility"
      );
      const isVariableVisibleSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "isVariableVisible"
      );

      // Datos de ejemplo
      const preferences = { hiddenSubjectiveVariableIds: ["var-1", "var-2"] };

      // Probar las delegaciones
      systemCore.updateUserPreferences(preferences);
      expect(updatePreferencesSpy).toHaveBeenCalledWith(preferences);

      systemCore.getUserPreferences();
      expect(getPreferencesSpy).toHaveBeenCalled();

      systemCore.toggleVariableVisibility(mockUUID);
      expect(toggleVisibilitySpy).toHaveBeenCalledWith(mockUUID);

      systemCore.isVariableVisible(mockUUID);
      expect(isVariableVisibleSpy).toHaveBeenCalledWith(mockUUID);
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
      const getVariablesDataSpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getSubjectiveVariablesData"
      );
      const getStatsSpy = jest.spyOn(systemCore["analyticsManager"], "getActivityStats");
      const getCompletionRateSpy = jest.spyOn(systemCore["analyticsManager"], "getCompletionRate");
      const getInterruptionRateSpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getInterruptionRate"
      );
      const getEstimationAccuracySpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getEstimationAccuracy"
      );

      // Probar las delegaciones
      systemCore.getTimelineData(mockUUID);
      expect(getTimelineSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getTimeDistributionData();
      expect(getDistributionSpy).toHaveBeenCalled();

      systemCore.getSubjectiveVariablesData(mockUUID);
      expect(getVariablesDataSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getActivityStats(mockUUID);
      expect(getStatsSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getCompletionRate();
      expect(getCompletionRateSpy).toHaveBeenCalled();

      systemCore.getInterruptionRate();
      expect(getInterruptionRateSpy).toHaveBeenCalled();

      systemCore.getEstimationAccuracy();
      expect(getEstimationAccuracySpy).toHaveBeenCalled();
    });
  });

  describe("Métodos de persistencia", () => {
    it("debe exportar correctamente el estado como JSON", () => {
      const exportedJson = systemCore.exportData();
      const exportedState = JSON.parse(exportedJson);

      // Verificar que el estado exportado coincide con el estado actual
      expect(exportedState).toEqual(systemCore.getState());
    });

    it("debe importar correctamente el estado desde JSON", () => {
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
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T08:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
          schemaVersion: 2,
        },
        currentDay: null,
      };

      // Importar desde JSON
      systemCore.importData(JSON.stringify(importedState));

      // Verificar que se importó correctamente
      expect(systemCore.getState()).toEqual(importedState);

      // Verificar que se guardó el estado importado
      expect(PersistenceManager.prototype.saveState).toHaveBeenCalledWith(importedState);
    });

    it("debe manejar errores al importar JSON inválido", () => {
      // Intentar importar JSON inválido
      expect(() => systemCore.importData("invalid json")).toThrow(
        "Error al importar datos: formato JSON inválido"
      );
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
      expect(PersistenceManager.prototype.clearState).toHaveBeenCalled();
    });
  });
});
