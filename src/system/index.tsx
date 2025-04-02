import type {
  AppState,
  ISystemCore,
  IPersistenceManager,
  StateUpdater,
  GlobalState,
  UserPreferences,
} from "../types";
export { PersistenceManager } from "./persistenceManager";

type StateChangeCallback = (newState: AppState) => void;

/**
 * Implementación del núcleo central del sistema Qualia Control
 * Actúa como orquestador principal y punto único de entrada para la manipulación del estado
 */
export class SystemCore implements ISystemCore {
  private state: AppState;
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private persistenceManager?: IPersistenceManager;

  /**
   * Constructor de SystemCore
   * @param persistenceManager Gestor de persistencia opcional para cargar/guardar el estado
   */
  constructor(persistenceManager?: IPersistenceManager) {
    this.persistenceManager = persistenceManager;
    this.state = this.createDefaultState();
  }

  /**
   * Inicializa el sistema, cargando el estado desde la persistencia si está disponible
   */
  public initialize(): void {
    if (this.persistenceManager) {
      const savedState = this.persistenceManager.loadState();
      if (savedState) {
        this.state = savedState;
      }
    }
  }

  /**
   * Obtiene el estado actual de la aplicación
   */
  public getState(): AppState {
    return this.state;
  }

  /**
   * Actualiza el estado de la aplicación utilizando una función actualizadora
   * @param updater Función que recibe el estado actual y devuelve el nuevo estado
   */
  public updateState(updater: StateUpdater): void {
    // Crear copia profunda para evitar mutaciones directas
    const currentState = JSON.parse(JSON.stringify(this.state)) as AppState;

    // Aplicar función actualizadora
    const newState = updater(currentState);

    // Actualizar estado
    this.state = newState;

    // Persistir si hay un gestor de persistencia
    if (this.persistenceManager) {
      this.persistenceManager.saveState(this.state);
    }

    // Notificar a los observadores
    this.notifyStateChanged();
  }

  /**
   * Registra una función callback para recibir notificaciones de cambios de estado
   * @param callback Función a invocar cuando cambie el estado
   * @returns Función para cancelar la suscripción
   */
  public onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);

    // Devolver función para eliminar el callback
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  /**
   * Notifica a todos los observadores registrados sobre un cambio de estado
   */
  private notifyStateChanged(): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(this.state);
    }
  }

  /**
   * Crea un estado predeterminado con valores iniciales
   */
  private createDefaultState(): AppState {
    const timestamp = new Date().toISOString();

    const defaultGlobalState: GlobalState = {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      subjectiveVariables: [],
      interruptionCauses: [],
      timeBlocks: [],
      userPreferences: {
        hiddenSubjectiveVariableIds: [],
        updatedAt: timestamp,
      },
      completedActivityRecords: [],
      eventInstances: [],
      subjectiveVariableSnapshots: [],
    };

    return {
      global: defaultGlobalState,
      currentDay: null,
    };
  }
}
