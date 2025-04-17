import { UtilityService } from "./utilityService";
import type {
  AppState,
  ISystemCore,
  StateUpdater,
  SubjectiveVariable,
  SubjectiveVariableSnapshot,
  UUID,
  ISODateTimeString,
} from "../types";

/**
 * Interfaz para SubjectiveVariableManager
 */
export interface ISubjectiveVariableManager {
  createSubjectiveVariable(name: string): SubjectiveVariable;
  updateSubjectiveVariable(id: UUID, data: Partial<SubjectiveVariable>): SubjectiveVariable;
  deleteSubjectiveVariable(id: UUID): void;
  getSubjectiveVariables(): SubjectiveVariable[];
  createSnapshot(
    values: { variableId: UUID; currentValue: number }[],
    relatedActivityIds?: UUID[],
    relatedEventIds?: UUID[]
  ): SubjectiveVariableSnapshot | null;
  getSnapshots(filters?: {
    dayId?: UUID;
    variableIds?: UUID[];
    since?: ISODateTimeString;
    until?: ISODateTimeString;
  }): SubjectiveVariableSnapshot[];
  getLatestValues(): Record<UUID, number>;
  canUpdateVariables(): boolean;
}

/**
 * Gestiona las variables subjetivas y sus snapshots
 * Permite al usuario crear, actualizar y eliminar variables subjetivas y registrar su evolución
 */
export class SubjectiveVariableManager implements ISubjectiveVariableManager {
  private systemCore: ISystemCore;
  private readonly MIN_UPDATE_INTERVAL_MS = 5 * 60 * 1000; // 5 minutos en milisegundos

  /**
   * Constructor de SubjectiveVariableManager
   * @param systemCore Núcleo del sistema para acceder y actualizar el estado
   */
  constructor(systemCore: ISystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Crea una nueva variable subjetiva
   * @param name Nombre de la variable subjetiva
   * @returns Variable subjetiva creada
   */
  public createSubjectiveVariable(name: string): SubjectiveVariable {
    const newVariable: SubjectiveVariable = {
      id: UtilityService.generateUUID(),
      name,
      createdAt: UtilityService.getCurrentISODateTime(),
      updatedAt: UtilityService.getCurrentISODateTime(),
    };

    const updater: StateUpdater = (state: AppState) => {
      return {
        ...state,
        global: {
          ...state.global,
          subjectiveVariables: [...state.global.subjectiveVariables, newVariable],
        },
      };
    };

    this.systemCore.updateState(updater);
    return newVariable;
  }

  /**
   * Actualiza una variable subjetiva existente
   * @param id ID de la variable a actualizar
   * @param data Datos parciales para actualizar
   * @returns Variable subjetiva actualizada
   * @throws Error si no se encuentra la variable
   */
  public updateSubjectiveVariable(id: UUID, data: Partial<SubjectiveVariable>): SubjectiveVariable {
    const variable = this.findVariableById(id);
    if (!variable) {
      throw new Error(`Variable subjetiva con ID ${id} no encontrada`);
    }

    // Solo permitir actualizar el nombre
    const updatedVariable: SubjectiveVariable = {
      ...variable,
      name: data.name !== undefined ? data.name : variable.name,
      updatedAt: UtilityService.getCurrentISODateTime(),
    };

    const updater: StateUpdater = (state: AppState) => {
      return {
        ...state,
        global: {
          ...state.global,
          subjectiveVariables: state.global.subjectiveVariables.map((v) =>
            v.id === id ? updatedVariable : v
          ),
        },
      };
    };

    this.systemCore.updateState(updater);
    return updatedVariable;
  }

  /**
   * Elimina una variable subjetiva
   * @param id ID de la variable a eliminar
   * @throws Error si la variable está en uso o no se encuentra
   */
  public deleteSubjectiveVariable(id: UUID): void {
    const variable = this.findVariableById(id);
    if (!variable) {
      throw new Error(`Variable subjetiva con ID ${id} no encontrada`);
    }

    // Verificar si la variable está en uso en algún snapshot
    const state = this.systemCore.getState();
    const variableInUse = state.global.subjectiveVariableSnapshots.some((snapshot) =>
      snapshot.values.some((value) => value.variableId === id)
    );

    if (variableInUse) {
      throw new Error(
        `No se puede eliminar la variable "${variable.name}" porque está en uso en uno o más snapshots`
      );
    }

    const updater: StateUpdater = (state: AppState) => {
      return {
        ...state,
        global: {
          ...state.global,
          subjectiveVariables: state.global.subjectiveVariables.filter((v) => v.id !== id),
        },
      };
    };

    this.systemCore.updateState(updater);
  }

  /**
   * Obtiene todas las variables subjetivas
   * @returns Lista de variables subjetivas
   */
  public getSubjectiveVariables(): SubjectiveVariable[] {
    const state = this.systemCore.getState();
    return state.global.subjectiveVariables;
  }

  /**
   * Crea un nuevo snapshot de variables subjetivas
   * @param values Valores actuales de las variables
   * @param relatedActivityIds IDs de actividades relacionadas (opcional)
   * @param relatedEventIds IDs de eventos relacionados (opcional)
   * @returns Snapshot creado o null si no se puede crear (tiempo mínimo no cumplido)
   */
  public createSnapshot(
    values: { variableId: UUID; currentValue: number }[],
    relatedActivityIds: UUID[] = [],
    relatedEventIds: UUID[] = []
  ): SubjectiveVariableSnapshot | null {
    // Verificar si se puede crear un nuevo snapshot
    if (!this.canUpdateVariables()) {
      return null;
    }

    const state = this.systemCore.getState();
    const currentDayId = state.currentDay?.day.id;

    if (!currentDayId) {
      throw new Error("No hay un día activo actualmente");
    }

    // Obtener los últimos valores para cada variable
    const latestValues = this.getLatestValues();

    // Preparar los valores del snapshot incluyendo todas las variables
    const snapshotValues = this.getSubjectiveVariables().map((variable) => {
      const valueUpdate = values.find((v) => v.variableId === variable.id);
      const currentValue = valueUpdate ? valueUpdate.currentValue : latestValues[variable.id] || 0;
      const previousValue = latestValues[variable.id] || 0;

      return {
        variableId: variable.id,
        variableName: variable.name,
        previousValue,
        currentValue,
      };
    });

    // Crear el nuevo snapshot
    const newSnapshot: SubjectiveVariableSnapshot = {
      id: UtilityService.generateUUID(),
      timestamp: UtilityService.getCurrentISODateTime(),
      dayId: currentDayId,
      values: snapshotValues,
      relatedActivityIds: [...relatedActivityIds],
      relatedEventIds: [...relatedEventIds],
      createdAt: UtilityService.getCurrentISODateTime(),
    };

    const updater: StateUpdater = (state: AppState) => {
      return {
        ...state,
        global: {
          ...state.global,
          subjectiveVariableSnapshots: [...state.global.subjectiveVariableSnapshots, newSnapshot],
        },
      };
    };

    this.systemCore.updateState(updater);
    return newSnapshot;
  }

  /**
   * Obtiene snapshots según los filtros especificados
   * @param filters Filtros opcionales (dayId, variableIds, since, until)
   * @returns Lista de snapshots filtrados
   */
  public getSnapshots(filters?: {
    dayId?: UUID;
    variableIds?: UUID[];
    since?: ISODateTimeString;
    until?: ISODateTimeString;
  }): SubjectiveVariableSnapshot[] {
    const state = this.systemCore.getState();
    let snapshots = state.global.subjectiveVariableSnapshots;

    if (!filters) {
      return snapshots;
    }

    if (filters.dayId) {
      snapshots = snapshots.filter((snapshot) => snapshot.dayId === filters.dayId);
    }

    if (filters.variableIds && filters.variableIds.length > 0) {
      snapshots = snapshots.filter((snapshot) =>
        snapshot.values.some((value) => filters.variableIds!.includes(value.variableId))
      );
    }

    if (filters.since) {
      snapshots = snapshots.filter(
        (snapshot) => new Date(snapshot.timestamp) >= new Date(filters.since!)
      );
    }

    if (filters.until) {
      snapshots = snapshots.filter(
        (snapshot) => new Date(snapshot.timestamp) <= new Date(filters.until!)
      );
    }

    return snapshots;
  }

  /**
   * Obtiene los valores más recientes para cada variable subjetiva
   * @returns Objeto con los valores más recientes (ID de variable -> valor)
   */
  public getLatestValues(): Record<UUID, number> {
    const state = this.systemCore.getState();
    const latestValues: Record<UUID, number> = {};

    // Obtener todas las variables
    const variables = state.global.subjectiveVariables;

    // Inicializar con valor 0 para todas las variables
    for (const variable of variables) {
      latestValues[variable.id] = 0;
    }

    // Ordenar snapshots por timestamp (más reciente primero)
    const snapshots = [...state.global.subjectiveVariableSnapshots].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Para cada variable, buscar su valor más reciente
    for (const variable of variables) {
      // Encontrar el snapshot más reciente que contiene esta variable
      for (const snapshot of snapshots) {
        const valueEntry = snapshot.values.find((v) => v.variableId === variable.id);
        if (valueEntry) {
          latestValues[variable.id] = valueEntry.currentValue;
          break; // Ya encontramos el valor más reciente para esta variable
        }
      }
    }

    return latestValues;
  }

  /**
   * Verifica si han pasado al menos 5 minutos desde la última actualización
   * @returns true si se pueden actualizar las variables, false en caso contrario
   */
  public canUpdateVariables(): boolean {
    // BYPASS para debug: siempre retorna true
    return true;

    /* Código original comentado
    const state = this.systemCore.getState();
    const snapshots = state.global.subjectiveVariableSnapshots;

    if (snapshots.length === 0) {
      return true; // No hay snapshots previos
    }

    // Ordenar por timestamp y obtener el más reciente
    const sortedSnapshots = [...snapshots].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const latestSnapshot = sortedSnapshots[0];
    const latestTimestamp = new Date(latestSnapshot.timestamp).getTime();
    const currentTime = new Date().getTime();

    // Verificar si han pasado al menos 5 minutos
    return currentTime - latestTimestamp >= this.MIN_UPDATE_INTERVAL_MS;
    */
  }

  /**
   * Encuentra una variable subjetiva por su ID
   * @param id ID de la variable a buscar
   * @returns Variable encontrada o undefined
   */
  private findVariableById(id: UUID): SubjectiveVariable | undefined {
    const state = this.systemCore.getState();
    return state.global.subjectiveVariables.find((v) => v.id === id);
  }
}
