/**
 * @jest-environment jsdom
 */

import { PersistenceManager, STORAGE_KEY } from "../persistenceManager";
import type { AppState } from "../../types";

// Mock directo de localStorage
// Usamos un objeto estable y mutamos sus keys en lugar de reasignar la referencia.
// Esto evita problemas de closures que no ven la reasignación.
const mockLocalStorage: Record<string, string> = {};
const clearMockStorage = () => {
  for (const k of Object.keys(mockLocalStorage)) {
    delete mockLocalStorage[k];
  }
};

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => clearMockStorage()),
    },
    writable: true,
  });
});

// Silenciamos console.error durante las pruebas
const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
const consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();

describe("PersistenceManager", () => {
  let persistenceManager: PersistenceManager;

  // Datos de prueba
  const mockValidState: AppState = {
    global: {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      subjectiveVariables: [],
      interruptionCauses: [],
      timeBlocks: [],
      userPreferences: {
        hiddenSubjectiveVariableIds: [],
        updatedAt: new Date().toISOString(),
      },
      completedActivityRecords: [],
      eventInstances: [],
      subjectiveVariableSnapshots: [],
    },
    currentDay: null,
  };

  beforeEach(() => {
    // Limpiar mocks y localStorage antes de cada prueba
    jest.clearAllMocks();
    window.localStorage.clear();
    clearMockStorage();
    persistenceManager = new PersistenceManager();
  });

  afterAll(() => {
    // Restaurar mocks
    jest.restoreAllMocks();
  });

  // Test simple para verificar que nuestro mock funciona
  it("verifica que el mock de localStorage funciona", () => {
    localStorage.setItem("test-key", "test-value");
    expect(localStorage.getItem("test-key")).toBe("test-value");
  });

  describe("saveState", () => {
    it("debe guardar el estado correctamente en localStorage", () => {
      persistenceManager.saveState(mockValidState);

      // Schema v2+: saveState añade schemaVersion=2 al payload
      const expectedPayload = JSON.stringify({ ...mockValidState, schemaVersion: 2 });

      // Verificar que setItem fue llamado con los parámetros correctos
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expectedPayload);

      // Verificar que el valor se guardó en mockLocalStorage
      expect(mockLocalStorage[STORAGE_KEY]).toBe(expectedPayload);
    });

    it("debe manejar errores durante el guardado", () => {
      // Simular un error
      localStorage.setItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error de almacenamiento");
      });

      // La llamada no debe lanzar excepción
      expect(() => {
        persistenceManager.saveState(mockValidState);
      }).not.toThrow();

      // Verificar que se registró el error
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("loadState", () => {
    it("debe retornar null si no hay datos en localStorage", () => {
      const result = persistenceManager.loadState();
      expect(result).toBeNull();
    });

    it("debe cargar y deserializar correctamente el estado", () => {
      // Schema v2+: el estado persistido lleva schemaVersion
      const serializedState = JSON.stringify({ ...mockValidState, schemaVersion: 2 });
      mockLocalStorage[STORAGE_KEY] = serializedState;

      // Verificar que nuestro mock funciona
      expect(localStorage.getItem(STORAGE_KEY)).toBe(serializedState);

      // Ejecutar el método para probar
      const result = persistenceManager.loadState();

      // Verificar el resultado
      expect(result).not.toBeNull();
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);

      if (result) {
        expect(result.global).toEqual(mockValidState.global);
        expect(result.currentDay).toBeNull();
      }
    });

    it("debe retornar null si los datos no son un objeto válido", () => {
      // Guardar un string que no es un objeto al deserializar
      mockLocalStorage[STORAGE_KEY] = JSON.stringify("string no válido");

      jest.clearAllMocks();

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("debe retornar null si el objeto no tiene la estructura esperada", () => {
      // Guardar un objeto con estructura incorrecta
      mockLocalStorage[STORAGE_KEY] = JSON.stringify({ invalidKey: "value" });

      jest.clearAllMocks();

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("debe manejar errores durante la carga", () => {
      // Simular un error en getItem
      localStorage.getItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error de lectura");
      });

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("clearState", () => {
    it("debe eliminar el estado de localStorage", () => {
      // Guardar datos en localStorage
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(mockValidState);

      // Verificar que existe antes de eliminarlo
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      // Limpiar el estado
      persistenceManager.clearState();

      // Verificar que se llamó a removeItem y que se eliminó
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(mockLocalStorage[STORAGE_KEY]).toBeUndefined();
    });

    it("debe manejar errores durante la limpieza", () => {
      // Simular un error en removeItem
      localStorage.removeItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error al eliminar");
      });

      // No debe lanzar la excepción
      expect(() => {
        persistenceManager.clearState();
      }).not.toThrow();

      expect(console.error).toHaveBeenCalled();
    });
  });

  // Schema v2: migración resiliente
  describe("migrateV1ToV2 (schema upgrade)", () => {
    // Restaurar TODOS los métodos de localStorage. Los tests previos
    // ("debe manejar errores durante el guardado" y "debe manejar errores durante la carga")
    // sobreescriben setItem/getItem con mocks que solo lanzan una vez.
    beforeEach(() => {
      localStorage.setItem = jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      });
      localStorage.getItem = jest.fn((key: string) => mockLocalStorage[key] ?? null);
      localStorage.removeItem = jest.fn((key: string) => {
        delete mockLocalStorage[key];
      });
      localStorage.clear = jest.fn(() => clearMockStorage());
    });

    it("estado sin schemaVersion (v1) se migra a v2 con dailyTempoTarget default 1000", () => {
      // Guardar un estado v1 (sin schemaVersion)
      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            // NO dailyTempoTarget (es v1)
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
        // NO schemaVersion
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1State);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(1000);
    });

    it("preserva dailyTempoTarget si ya existe (no sobrescribe)", () => {
      const v1StateWithTarget = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            dailyTempoTarget: 500, // usuario lo había configurado
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1StateWithTarget);

      const result = persistenceManager.loadState();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(500);
    });

    it("marca completedActivityRecords antiguos con tempos=0", () => {
      const v1StateWithRecords = {
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
          completedActivityRecords: [
            {
              id: "r1",
              templateId: "t1",
              templateTitle: "Old",
              state: "completed",
              type: "clear-objective",
              startTime: "2023-01-01T00:00:00.000Z",
              endTime: "2023-01-01T00:30:00.000Z",
              durationMinutes: 30,
              dayId: "d1",
              createdAt: "2023-01-01T00:00:00.000Z",
              // NO satisfactionScore, NO temposAwarded, NO beatEstimate (es v1)
            },
          ],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1StateWithRecords);

      const result = persistenceManager.loadState();
      expect(result!.global.completedActivityRecords.length).toBe(1);
      expect(result!.global.completedActivityRecords[0].satisfactionScore).toBe(0);
      expect(result!.global.completedActivityRecords[0].temposAwarded).toBe(0);
      expect(result!.global.completedActivityRecords[0].beatEstimate).toBe(false);
    });

    it("RECONSTRUYE userPreferences si falta global completo (estado corrupto parcial)", () => {
      const corruptState = {
        // Falta global.currentDay
        global: {
          days: [],
          activityTemplates: [],
          // ...faltan varios campos
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(corruptState);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      // Debe haber reconstruido userPreferences con dailyTempoTarget=1000
      expect(result!.global.userPreferences).toBeDefined();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(1000);
    });

    it("RECONSTRUYE userPreferences si el objeto global existe pero userPreferences falta", () => {
      const stateWithoutPrefs = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          // NO userPreferences
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(stateWithoutPrefs);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(result!.global.userPreferences).toBeDefined();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(1000);
      expect(result!.global.userPreferences.hiddenSubjectiveVariableIds).toEqual([]);
    });

    it("RECONSTRUYE completedActivityRecords si falta el array", () => {
      const stateWithoutRecords = {
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
          // NO completedActivityRecords
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(stateWithoutRecords);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(Array.isArray(result!.global.completedActivityRecords)).toBe(true);
      expect(result!.global.completedActivityRecords.length).toBe(0);
    });

    it("estado v2 (schemaVersion=2) no se re-migra", () => {
      const v2State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            dailyTempoTarget: 750, // valor custom del usuario
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2State);

      const result = persistenceManager.loadState();
      // Si fuera v1, se sobrescribiría a 1000. v2 respeta el 750.
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(750);
    });

    it("saveState incluye schemaVersion=2 al persistir", () => {
      persistenceManager.saveState(mockValidState);

      const stored = mockLocalStorage[STORAGE_KEY];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.schemaVersion).toBe(2);
    });
  });
});
