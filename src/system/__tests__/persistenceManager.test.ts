/**
 * @jest-environment jsdom
 */

import {
  PersistenceManager,
  STORAGE_KEY,
  CURRENT_SCHEMA_VERSION,
} from "../persistenceManager";
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
      timeBlocks: [],
      userPreferences: {
        updatedAt: new Date().toISOString(),
      },
      completedActivityRecords: [],
      eventInstances: [],
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

      // Schema v3: saveState añade schemaVersion=3 al payload
      const expectedPayload = JSON.stringify({ ...mockValidState, schemaVersion: 3 });

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
          timeBlocks: [],
          userPreferences: {
            // NO dailyTempoTarget (es v1)
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
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
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 500, // usuario lo había configurado
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
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
          timeBlocks: [],
          userPreferences: {
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
          timeBlocks: [],
          // NO userPreferences
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(stateWithoutPrefs);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(result!.global.userPreferences).toBeDefined();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(1000);
    });

    it("RECONSTRUYE completedActivityRecords si falta el array", () => {
      const stateWithoutRecords = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          // NO completedActivityRecords
          eventInstances: [],
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
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 750, // valor custom del usuario
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2State);

      const result = persistenceManager.loadState();
      // Si fuera v1, se sobrescribiría a 1000. v2 respeta el 750.
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(750);
    });

    it("saveState incluye schemaVersion=3 al persistir", () => {
      persistenceManager.saveState(mockValidState);

      const stored = mockLocalStorage[STORAGE_KEY];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.schemaVersion).toBe(3);
    });

    // Schema v3: archivado y eliminación de campos legacy
    it("estado v2 con campos legacy se migra a v3 archivando los campos en legacyArchive", () => {
      const v2StateWithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["var-1"],
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "var-1", name: "Energía" }],
          interruptionCauses: [{ id: "cause-1", description: "Notificación" }],
          subjectiveVariableSnapshots: [{ id: "snap-1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2StateWithLegacy);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();

      // El shape persistido principal ya no tiene los campos legacy
      const global = result!.global as unknown as Record<string, unknown>;
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      const prefs = global.userPreferences as Record<string, unknown>;
      expect(prefs.hiddenSubjectiveVariableIds).toBeUndefined();

      // El archivo está disponible para auditoría
      expect(global.legacyArchive).toBeDefined();
      const archive = global.legacyArchive as {
        subjectiveVariables: unknown[];
        interruptionCauses: unknown[];
        subjectiveVariableSnapshots: unknown[];
        hiddenSubjectiveVariableIds: unknown[];
      };
      expect(archive.subjectiveVariables).toHaveLength(1);
      expect(archive.interruptionCauses).toHaveLength(1);
      expect(archive.subjectiveVariableSnapshots).toHaveLength(1);
      expect(archive.hiddenSubjectiveVariableIds).toEqual(["var-1"]);
    });

    it("estado v2 sin campos legacy migra a v3 sin legacyArchive", () => {
      const v2CleanState = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2CleanState);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      const global = result!.global as unknown as Record<string, unknown>;
      expect(global.legacyArchive).toBeUndefined();
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
    });

    it("saveState defensivo: elimina campos legacy si se cuelan en el estado", () => {
      // Forzamos un estado con campos legacy inyectados
      const stateWithLegacyInjected = {
        global: {
          ...mockValidState.global,
          subjectiveVariables: [{ id: "var-x" }],
          interruptionCauses: [{ id: "cause-x" }],
          subjectiveVariableSnapshots: [{ id: "snap-x" }],
          userPreferences: {
            ...mockValidState.global.userPreferences,
            hiddenSubjectiveVariableIds: ["var-x"],
          },
        },
        currentDay: null,
      } as typeof mockValidState;

      persistenceManager.saveState(stateWithLegacyInjected);

      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored.global.subjectiveVariables).toBeUndefined();
      expect(stored.global.interruptionCauses).toBeUndefined();
      expect(stored.global.subjectiveVariableSnapshots).toBeUndefined();
      expect(stored.global.userPreferences.hiddenSubjectiveVariableIds).toBeUndefined();
    });

    it("estado v1 pasa por v2 y v3 en cadena (un solo loadState)", () => {
      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["var-1"],
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "var-1", name: "Energía" }],
          interruptionCauses: [{ id: "cause-1", description: "Notificación" }],
          subjectiveVariableSnapshots: [{ id: "snap-1" }],
        },
        currentDay: null,
        // NO schemaVersion => v1
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1State);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      const global = result!.global as unknown as Record<string, unknown>;

      // dailyTempoTarget creado por v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(1000);

      // Campos legacy archivados por v2→v3
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect((global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds)
        .toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
    });
  });

  // Pipeline central: serialize/deserialize (lo que export/import y localStorage usan)
  describe("serialize / deserialize", () => {
    it("serialize incluye schemaVersion=3 y produce JSON parseable", () => {
      const json = persistenceManager.serialize(mockValidState);
      const parsed = JSON.parse(json);

      expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parsed.global).toEqual(mockValidState.global);
    });

    it("serialize elimina campos legacy aunque estén en el estado", () => {
      const stateWithLegacy = {
        ...mockValidState,
        global: {
          ...mockValidState.global,
          subjectiveVariables: [{ id: "v1" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          userPreferences: {
            ...mockValidState.global.userPreferences,
            hiddenSubjectiveVariableIds: ["v1"],
          },
        },
      } as typeof mockValidState;

      const json = persistenceManager.serialize(stateWithLegacy);
      const parsed = JSON.parse(json);

      expect(parsed.global.subjectiveVariables).toBeUndefined();
      expect(parsed.global.interruptionCauses).toBeUndefined();
      expect(parsed.global.subjectiveVariableSnapshots).toBeUndefined();
      expect(parsed.global.userPreferences.hiddenSubjectiveVariableIds).toBeUndefined();
    });

    it("deserialize de v3 retorna el estado tal cual sin migración", () => {
      const json = JSON.stringify({ ...mockValidState, schemaVersion: 3 });
      const result = persistenceManager.deserialize(json);

      expect(result.global).toEqual(mockValidState.global);
      // Sin warnings porque no hay migración
    });

    it("deserialize de v2 con campos legacy los archiva y limpia", () => {
      const v2State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 800,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1", description: "Notif" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };

      const result = persistenceManager.deserialize(JSON.stringify(v2State));
      const global = result.global as unknown as Record<string, unknown>;

      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect((global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds)
        .toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
      // dailyTempoTarget preservado por la migración
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(800);
    });

    it("deserialize de v1 sin schemaVersion ejecuta v1→v2→v3", () => {
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

      const result = persistenceManager.deserialize(JSON.stringify(v1State));
      const global = result.global as unknown as Record<string, unknown>;

      // dailyTempoTarget creado por v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(1000);
      // Legacy archivado por v2→v3
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
    });

    it("deserialize lanza Error con JSON inválido", () => {
      expect(() => persistenceManager.deserialize("invalid json")).toThrow();
    });

    it("deserialize lanza Error con estructura inválida", () => {
      expect(() => persistenceManager.deserialize(JSON.stringify({}))).toThrow();
    });

    it("roundtrip serialize → deserialize preserva el estado", () => {
      const original = {
        ...mockValidState,
        global: {
          ...mockValidState.global,
          days: [
            {
              id: "d1",
              state: "active" as const,
              createdAt: "2023-01-01T00:00:00.000Z",
              updatedAt: "2023-01-01T00:00:00.000Z",
            },
          ],
        },
      };

      const json = persistenceManager.serialize(original);
      const result = persistenceManager.deserialize(json);

      expect(result.global.days).toEqual(original.global.days);
      expect(result.global.userPreferences).toEqual(original.global.userPreferences);
    });

    // Hardening: payload v3 con legacy fields inyectados debe normalizarse
    it("payload v3 con legacy fields inyectados se normaliza (stripLegacyFields)", () => {
      const v3WithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 1000,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          // Payload manipulado: declara v3 pero trae legacy fields
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
        },
        currentDay: null,
        schemaVersion: 3,
      };

      const result = persistenceManager.deserialize(JSON.stringify(v3WithLegacy));
      const global = result.global as unknown as Record<string, unknown>;

      // El runtime NO debe contener los legacy fields, ni siquiera en memoria
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect((global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds)
        .toBeUndefined();

      // Sin migración (ya era v3) -> sin legacyArchive (no había datos para archivar
      // porque stripLegacyFields los eliminó directamente)
      expect(global.legacyArchive).toBeUndefined();
    });
  });
});
