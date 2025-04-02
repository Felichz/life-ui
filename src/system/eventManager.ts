import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type { EventTemplate, EventInstance, UUID, ISODateTimeString } from "../types";

/**
 * Gestor de eventos puntuales en Qualia Control
 * Permite crear y gestionar plantillas de eventos y sus instancias
 */
export class EventManager {
  private systemCore: SystemCore;

  /**
   * Constructor de EventManager
   * @param systemCore Instancia del núcleo del sistema
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Crea una nueva plantilla de evento
   * @param name Nombre de la plantilla de evento
   * @returns La plantilla de evento creada
   */
  public createEventTemplate(name: string): EventTemplate {
    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    const newTemplate: EventTemplate = {
      id,
      name,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.systemCore.updateState((state) => {
      state.global.eventTemplates.push(newTemplate);
      return state;
    });

    return newTemplate;
  }

  /**
   * Actualiza una plantilla de evento existente
   * @param id UUID de la plantilla a actualizar
   * @param data Datos parciales para actualizar
   * @returns La plantilla actualizada
   * @throws Error si la plantilla no existe
   */
  public updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate {
    // Verificar que la plantilla existe
    const template = this.getEventTemplateById(id);
    if (!template) {
      throw new Error(`La plantilla de evento con id ${id} no existe`);
    }

    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedTemplate: EventTemplate | null = null;

    // Actualizar el estado
    this.systemCore.updateState((state) => {
      const index = state.global.eventTemplates.findIndex((t) => t.id === id);

      if (index >= 0) {
        // Crear versión actualizada manteniendo la inmutabilidad
        updatedTemplate = {
          ...template,
          ...data,
          id, // Asegurar que el ID no se modifique
          updatedAt: timestamp,
        };

        // Reemplazar en el array
        state.global.eventTemplates[index] = updatedTemplate;
      }

      return state;
    });

    if (!updatedTemplate) {
      throw new Error(`Error al actualizar la plantilla de evento con id ${id}`);
    }

    return updatedTemplate;
  }

  /**
   * Elimina una plantilla de evento
   * @param id UUID de la plantilla a eliminar
   * @throws Error si la plantilla no existe o está en uso
   */
  public deleteEventTemplate(id: UUID): void {
    // Verificar que la plantilla existe
    const template = this.getEventTemplateById(id);
    if (!template) {
      throw new Error(`La plantilla de evento con id ${id} no existe`);
    }

    // Verificar que no existan instancias que usen esta plantilla
    const instances = this.getEventInstances({ templateId: id });
    if (instances.length > 0) {
      throw new Error(
        `No se puede eliminar la plantilla de evento con id ${id} porque está en uso`
      );
    }

    // Actualizar el estado
    this.systemCore.updateState((state) => {
      state.global.eventTemplates = state.global.eventTemplates.filter((t) => t.id !== id);
      return state;
    });
  }

  /**
   * Obtiene todas las plantillas de eventos
   * @returns Lista de todas las plantillas de eventos
   */
  public getEventTemplates(): EventTemplate[] {
    const state = this.systemCore.getState();
    return state.global.eventTemplates;
  }

  /**
   * Obtiene una plantilla de evento por su ID
   * @param id UUID de la plantilla
   * @returns La plantilla o null si no existe
   */
  private getEventTemplateById(id: UUID): EventTemplate | null {
    const state = this.systemCore.getState();
    return state.global.eventTemplates.find((t) => t.id === id) || null;
  }

  /**
   * Crea una nueva instancia de evento basada en una plantilla
   * @param templateId UUID de la plantilla a utilizar
   * @returns La instancia de evento creada
   * @throws Error si la plantilla no existe o no hay un día activo
   */
  public createEventInstance(templateId: UUID): EventInstance {
    // Verificar que la plantilla existe
    const template = this.getEventTemplateById(templateId);
    if (!template) {
      throw new Error(`La plantilla de evento con id ${templateId} no existe`);
    }

    // Verificar que hay un día activo
    const state = this.systemCore.getState();
    if (!state.currentDay) {
      throw new Error("No se puede crear una instancia de evento sin un día activo");
    }

    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    const newInstance: EventInstance = {
      id,
      templateId,
      templateName: template.name, // Copiar nombre para fácil referencia
      timestamp,
      dayId: state.currentDay.day.id,
      createdAt: timestamp,
    };

    // Actualizar el estado
    this.systemCore.updateState((state) => {
      state.global.eventInstances.push(newInstance);
      return state;
    });

    return newInstance;
  }

  /**
   * Obtiene instancias de eventos según filtros opcionales
   * @param filters Filtros opcionales: dayId, templateId, since, until
   * @returns Lista de instancias de eventos que cumplen los filtros
   */
  public getEventInstances(filters?: {
    dayId?: UUID;
    templateId?: UUID;
    since?: ISODateTimeString;
    until?: ISODateTimeString;
  }): EventInstance[] {
    const state = this.systemCore.getState();
    let instances = state.global.eventInstances;

    if (filters) {
      // Aplicar filtros
      if (filters.dayId) {
        instances = instances.filter((i) => i.dayId === filters.dayId);
      }

      if (filters.templateId) {
        instances = instances.filter((i) => i.templateId === filters.templateId);
      }

      if (filters.since) {
        instances = instances.filter((i) => i.timestamp >= filters.since!);
      }

      if (filters.until) {
        instances = instances.filter((i) => i.timestamp <= filters.until!);
      }
    }

    // Ordenar cronológicamente
    return [...instances].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Obtiene eventos recientes ocurridos en los últimos X minutos
   * @param minutesWindow Ventana de tiempo en minutos (por defecto 30)
   * @returns Lista de eventos recientes ordenados cronológicamente
   */
  public getRecentEvents(minutesWindow: number = 30): EventInstance[] {
    // Calcular el timestamp límite (hace X minutos)
    const now = new Date();
    const limitTime = new Date(now.getTime() - minutesWindow * 60 * 1000);
    const limitTimestamp = limitTime.toISOString();

    // Usar getEventInstances con filtro since
    return this.getEventInstances({ since: limitTimestamp });
  }
}
