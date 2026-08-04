import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type {
  InterruptionCause,
  InterruptionStatistics,
  UUID,
  ISODateTimeString,
  CompletedActivityRecord,
} from "../types";

/**
 * Gestor de interrupciones en Qualia Control
 * Permite crear y gestionar causas de interrupción y estadísticas relacionadas
 */
export class InterruptionManager {
  private systemCore: SystemCore;

  /**
   * Constructor de InterruptionManager
   * @param systemCore Instancia del núcleo del sistema
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Crea una nueva causa de interrupción
   * @param description Descripción de la causa de interrupción
   * @returns La causa de interrupción creada
   */
  public createInterruptionCause(description: string): InterruptionCause {
    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    const newCause: InterruptionCause = {
      id,
      description,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.systemCore.updateState((state) => {
      state.global.interruptionCauses.push(newCause);
      return state;
    });

    return newCause;
  }

  /**
   * Actualiza una causa de interrupción existente
   * @param id UUID de la causa a actualizar
   * @param data Datos parciales para actualizar
   * @returns La causa actualizada
   * @throws Error si la causa no existe
   */
  public updateInterruptionCause(id: UUID, data: Partial<InterruptionCause>): InterruptionCause {
    // Verificar que la causa existe
    const cause = this.getInterruptionCauseById(id);
    if (!cause) {
      throw new Error(`La causa de interrupción con id ${id} no existe`);
    }

    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedCause: InterruptionCause | null = null;

    // Actualizar el estado
    this.systemCore.updateState((state) => {
      const index = state.global.interruptionCauses.findIndex((c) => c.id === id);

      if (index >= 0) {
        // Crear versión actualizada manteniendo la inmutabilidad
        updatedCause = {
          ...state.global.interruptionCauses[index],
          ...data,
          id, // Asegurar que el ID no se modifique
          updatedAt: timestamp,
        };

        // Reemplazar en el array
        state.global.interruptionCauses[index] = updatedCause;
      }

      return state;
    });

    if (!updatedCause) {
      throw new Error(`Error al actualizar la causa de interrupción con id ${id}`);
    }

    return updatedCause;
  }

  /**
   * Elimina una causa de interrupción
   * @param id UUID de la causa a eliminar
   * @throws Error si la causa no existe o está en uso
   */
  public deleteInterruptionCause(id: UUID): void {
    // Verificar que la causa existe
    const cause = this.getInterruptionCauseById(id);
    if (!cause) {
      throw new Error(`La causa de interrupción con id ${id} no existe`);
    }

    // Schema v2+: interruptionData eliminado. Causas personalizadas no se usan ya.
    // Mantenemos el método por compatibilidad pero no hace nada relevante.
    const _state = this.systemCore.getState();
    const inUse = false;

    if (inUse) {
      throw new Error(
        `No se puede eliminar la causa de interrupción con id ${id} porque está en uso`
      );
    }

    // Actualizar el estado
    this.systemCore.updateState((state) => {
      state.global.interruptionCauses = state.global.interruptionCauses.filter((c) => c.id !== id);
      return state;
    });
  }

  /**
   * Obtiene todas las causas de interrupción
   * @returns Lista de todas las causas de interrupción
   */
  public getInterruptionCauses(): InterruptionCause[] {
    const state = this.systemCore.getState();
    return state.global.interruptionCauses;
  }

  /**
   * Obtiene una causa de interrupción por su ID
   * @param id UUID de la causa
   * @returns La causa o null si no existe
   */
  private getInterruptionCauseById(id: UUID): InterruptionCause | null {
    const state = this.systemCore.getState();
    return state.global.interruptionCauses.find((c) => c.id === id) || null;
  }

  /**
   * Obtiene estadísticas de interrupciones según filtros opcionales
   * @param filters Filtros opcionales: dayId, since, until
   * @returns Estadísticas de interrupciones
   */
  public getInterruptionStatistics(filters?: {
    dayId?: UUID;
    since?: ISODateTimeString;
    until?: ISODateTimeString;
  }): InterruptionStatistics {
    const state = this.systemCore.getState();
    let records = state.global.completedActivityRecords.filter(
      (record) => record.state === "interrupted"
    );

    if (filters) {
      // Aplicar filtros
      if (filters.dayId) {
        records = records.filter((r) => r.dayId === filters.dayId);
      }

      if (filters.since) {
        records = records.filter((r) => r.startTime >= filters.since!);
      }

      if (filters.until) {
        records = records.filter((r) => r.endTime <= filters.until!);
      }
    }

    // Schema v2+: ya no se distingue evitable/no evitable. Stub por compatibilidad.
    const totalInterruptions = records.length;
    const avoidableInterruptions = 0;
    const unavoidableInterruptions = totalInterruptions;
    const avoidablePercentage = 0;

    // Calcular causas más frecuentes
    const causeCounts: { [causeId: string]: number } = {};

    // Contar ocurrencias de cada causa
    // Schema v2+: sin causas. Stub vacío.
    // Mantenemos la estructura por compatibilidad con la interfaz.

    // Convertir conteos a lista de causas ordenada
    const topCauses = Object.entries(causeCounts)
      .map(([causeId, count]) => {
        const cause = this.getInterruptionCauseById(causeId);
        if (!cause) return null;

        return {
          id: causeId,
          description: cause.description,
          count,
          percentage: (count / totalInterruptions) * 100,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.count - a.count);

    return {
      totalInterruptions,
      avoidableInterruptions,
      unavoidableInterruptions,
      avoidablePercentage,
      topCauses,
    };
  }

  /**
   * Obtiene todas las actividades interrumpidas para un tipo específico
   * @param activityTemplateId ID de la plantilla de actividad
   * @returns Lista de registros de actividades interrumpidas
   */
  public getInterruptionsByActivity(activityTemplateId: UUID): CompletedActivityRecord[] {
    const state = this.systemCore.getState();
    return state.global.completedActivityRecords.filter(
      (record) => record.state === "interrupted" && record.templateId === activityTemplateId
    );
  }

  /**
   * Obtiene las causas de interrupción más frecuentes
   * @param limit Número máximo de causas a devolver (por defecto 5)
   * @returns Lista de causas más frecuentes con su conteo y porcentaje
   */
  public getTopInterruptionCauses(limit: number = 5): {
    cause: InterruptionCause;
    count: number;
    percentage: number;
  }[] {
    // Schema v2+: stub. No hay causas configurables. Siempre retorna [].
    const state = this.systemCore.getState();
    const records = state.global.completedActivityRecords.filter(
      (record) => record.state === "interrupted"
    );

    const totalInterruptions = records.length;
    const causeCounts: { [causeId: string]: number } = {};
    // Vacío por schema v2+: sin classification.

    // Convertir conteos a lista de causas ordenada
    const topCauses = Object.entries(causeCounts)
      .map(([causeId, count]) => {
        const cause = this.getInterruptionCauseById(causeId);
        if (!cause) return null;

        return {
          cause,
          count,
          percentage: totalInterruptions > 0 ? (count / totalInterruptions) * 100 : 0,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return topCauses;
  }
}
