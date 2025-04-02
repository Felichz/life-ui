import { SystemCore } from "../index";
import type { AppState, IPersistenceManager } from "../../types";

// Mock del PersistenceManager
class MockPersistenceManager implements IPersistenceManager {
  private storedState: AppState | null = null;

  saveState(state: AppState): void {
    this.storedState = JSON.parse(JSON.stringify(state));
  }

  loadState(): AppState | null {
    return this.storedState ? JSON.parse(JSON.stringify(this.storedState)) : null;
  }

  clearState(): void {
    this.storedState = null;
  }
}

describe("SystemCore", () => {
  // Prueba de inicialización
  test("debe inicializar con un estado predeterminado", () => {
    const systemCore = new SystemCore();
    const state = systemCore.getState();

    // Verificar estructura básica del estado
    expect(state).toHaveProperty("global");
    expect(state).toHaveProperty("currentDay");
    expect(state.currentDay).toBeNull();
    expect(state.global.days).toEqual([]);
    expect(state.global.activityTemplates).toEqual([]);
  });

  // Prueba de getState
  test("getState debe devolver el estado actual", () => {
    const systemCore = new SystemCore();
    const state = systemCore.getState();

    // El estado debe ser un objeto válido con la estructura esperada
    expect(state).toBeDefined();
    expect(typeof state).toBe("object");
  });

  // Prueba de updateState
  test("updateState debe actualizar el estado correctamente", () => {
    const systemCore = new SystemCore();

    // Definir un actualizador de estado simple
    const updater = (state: AppState): AppState => {
      return {
        ...state,
        global: {
          ...state.global,
          activityTemplates: [
            ...state.global.activityTemplates,
            {
              id: "123",
              title: "Nueva Actividad",
              description: "Descripción de prueba",
              type: "clear-objective",
              isSystemActivity: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            },
          ],
        },
      };
    };

    // Actualizar el estado
    systemCore.updateState(updater);

    // Verificar que el estado se haya actualizado
    const updatedState = systemCore.getState();
    expect(updatedState.global.activityTemplates).toHaveLength(1);
    expect(updatedState.global.activityTemplates[0].title).toBe("Nueva Actividad");
  });

  // Prueba de inicialización con PersistenceManager
  test("initialize debe cargar el estado desde persistenceManager", () => {
    // Crear y configurar el mock
    const mockPersistenceManager = new MockPersistenceManager();
    const savedState: AppState = {
      global: {
        days: [],
        activityTemplates: [
          {
            id: "456",
            title: "Actividad Guardada",
            description: "Esta actividad estaba guardada",
            type: "timeboxing",
            isSystemActivity: true,
            timeboxingSettings: {
              type: "maximum-time",
              maximumDurationMinutes: 30,
            },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
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

    // Guardar el estado en el mock
    mockPersistenceManager.saveState(savedState);

    // Crear SystemCore con el mock e inicializar
    const systemCore = new SystemCore(mockPersistenceManager);
    systemCore.initialize();

    // Verificar que el estado se haya cargado
    const state = systemCore.getState();
    expect(state.global.activityTemplates).toHaveLength(1);
    expect(state.global.activityTemplates[0].title).toBe("Actividad Guardada");
  });

  // Prueba del mecanismo de notificación
  test("onStateChange debe notificar cuando cambia el estado", () => {
    const systemCore = new SystemCore();

    // Crear un mock de callback
    const mockCallback = jest.fn();

    // Registrar el callback
    const unsubscribe = systemCore.onStateChange(mockCallback);

    // Verificar que no se haya llamado aún
    expect(mockCallback).not.toHaveBeenCalled();

    // Actualizar el estado
    systemCore.updateState((state) => ({
      ...state,
      global: {
        ...state.global,
        days: [
          ...state.global.days,
          {
            id: "789",
            state: "active",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }));

    // Verificar que se haya llamado una vez con el nuevo estado
    expect(mockCallback).toHaveBeenCalledTimes(1);
    expect(mockCallback.mock.calls[0][0].global.days).toHaveLength(1);

    // Probar la función de cancelación de suscripción
    unsubscribe();

    // Hacer otra actualización
    systemCore.updateState((state) => state);

    // Verificar que no se haya llamado de nuevo
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  // Prueba de persistencia automática al actualizar el estado
  test("updateState debe persistir el estado cuando hay un persistenceManager", () => {
    const mockPersistenceManager = new MockPersistenceManager();
    const saveSpy = jest.spyOn(mockPersistenceManager, "saveState");

    const systemCore = new SystemCore(mockPersistenceManager);

    // Actualizar el estado
    systemCore.updateState((state) => ({
      ...state,
      global: {
        ...state.global,
        activityTemplates: [
          ...state.global.activityTemplates,
          {
            id: "999",
            title: "Otra Actividad",
            description: "Debe ser persistida",
            type: "flexible-duration",
            isSystemActivity: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      },
    }));

    // Verificar que se llamó a saveState
    expect(saveSpy).toHaveBeenCalledTimes(1);

    // Verificar que el estado se guardó correctamente
    const savedState = mockPersistenceManager.loadState();
    expect(savedState?.global.activityTemplates).toHaveLength(1);
    expect(savedState?.global.activityTemplates[0].title).toBe("Otra Actividad");
  });
});
