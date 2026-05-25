/**
 * @jest-environment jsdom
 */

import { PersistenceManager, STORAGE_KEY } from "../persistenceManager";
import type { AppState } from "../../types";

// Mock directo de localStorage
let mockLocalStorage: Record<string, string> = {};

beforeAll(() => {
  // Crear mock de localStorage
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key: string) => mockLocalStorage[key] || null),
      setItem: jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => {
        mockLocalStorage = {};
      }),
    },
    writable: true,
  });
});

// Silenciamos console.error durante las pruebas
jest.spyOn(console, "error").mockImplementation();

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
    mockLocalStorage = {};
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

      // Verificar que setItem fue llamado con los parámetros correctos
      expect(localStorage.setItem).toHaveBeenCalledWith(
        STORAGE_KEY,
        JSON.stringify(mockValidState)
      );

      // Verificar que el valor se guardó en mockLocalStorage
      expect(mockLocalStorage[STORAGE_KEY]).toBe(JSON.stringify(mockValidState));
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
      // Guardar datos en localStorage
      const serializedState = JSON.stringify(mockValidState);
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
});
