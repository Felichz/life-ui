// Qualia Control - Custom Variables Management Module

import type {
  CustomVariable,
  CustomVariableId,
  SharedState,
  SnapshotId,
  VariableSnapshot,
} from "../types";

/**
 * Módulo para la gestión de variables personalizadas y sus snapshots
 */
export class VariableManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Gestión de variables personalizadas
   */

  /**
   * Crea una nueva variable personalizada
   */
  public async createCustomVariable(variable: Omit<CustomVariable, "id">): Promise<CustomVariable> {
    const newId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newVariable: CustomVariable = {
      ...variable,
      id: newId,
    };

    this.state.customVariables[newId] = newVariable;
    return newVariable;
  }

  /**
   * Obtiene una variable personalizada por su ID
   */
  public async getCustomVariable(
    variableId: CustomVariableId
  ): Promise<CustomVariable | undefined> {
    return this.state.customVariables[variableId];
  }

  /**
   * Actualiza una variable personalizada existente
   */
  public async updateCustomVariable(
    variableUpdates: Partial<CustomVariable> & { id: CustomVariableId }
  ): Promise<void> {
    const { id } = variableUpdates;
    const existingVariable = this.state.customVariables[id];

    if (!existingVariable) {
      throw new Error(`La variable con id ${id} no existe`);
    }

    this.state.customVariables[id] = {
      ...existingVariable,
      ...variableUpdates,
    };
  }

  /**
   * Elimina una variable personalizada
   */
  public async removeCustomVariable(variableId: CustomVariableId): Promise<void> {
    if (!this.state.customVariables[variableId]) {
      throw new Error(`La variable con id ${variableId} no existe`);
    }

    delete this.state.customVariables[variableId];
  }

  /**
   * Gestión de snapshots de variables
   */

  /**
   * Crea un nuevo snapshot de variables
   */
  public async createVariableSnapshot(
    snapshot: Omit<VariableSnapshot, "id">
  ): Promise<VariableSnapshot> {
    // Validar que las variables existan y que los valores estén dentro del rango
    for (const varData of snapshot.variables) {
      const variable = this.state.customVariables[varData.variableId];

      if (!variable) {
        throw new Error(`La variable con id ${varData.variableId} no existe`);
      }

      if (varData.currentValue < variable.minValue || varData.currentValue > variable.maxValue) {
        throw new Error(
          `El valor ${varData.currentValue} está fuera de rango para la variable ${variable.name} (${variable.minValue}-${variable.maxValue})`
        );
      }
    }

    const newId = `snapshot-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newSnapshot: VariableSnapshot = {
      ...snapshot,
      id: newId,
    };

    // Añadir el snapshot al historial
    this.state.currentDay.dayHistory.variableHistory.push(newSnapshot);

    return newSnapshot;
  }

  /**
   * Obtiene snapshots de variables en un rango de fechas
   */
  public async getVariableSnapshots(dateFrom: number, dateTo: number): Promise<VariableSnapshot[]> {
    return this.state.currentDay.dayHistory.variableHistory.filter(
      (snapshot) => snapshot.timestamp >= dateFrom && snapshot.timestamp <= dateTo
    );
  }

  /**
   * Obtiene un snapshot de variables por su ID
   */
  public async getVariableSnapshotById(
    snapshotId: SnapshotId
  ): Promise<VariableSnapshot | undefined> {
    return this.state.currentDay.dayHistory.variableHistory.find(
      (snapshot) => snapshot.id === snapshotId
    );
  }
}
