import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type { EventTemplate, EventInstance, UUID, ISODateTimeString } from "../types";
import { CoreError } from "./errors";

/**
 * Manager for one-off events in LifeUI
 * Creates and manages event templates and their instances
 */
export class EventManager {
  private systemCore: SystemCore;

  /**
   * EventManager constructor
   * @param systemCore System core instance
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Creates a new event template
   * @param name Name of the event template
   * @returns The created event template
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
   * Updates an existing event template
   * @param id UUID of the template to update
   * @param data Partial data to update
   * @returns The updated template
   * @throws Error if the template does not exist
   */
  public updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate {
    // Check that the template exists
    const template = this.getEventTemplateById(id);
    if (!template) {
      throw new CoreError("event-template-not-found", `id ${id}`);
    }

    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedTemplate: EventTemplate | null = null;

    // Update the state
    this.systemCore.updateState((state) => {
      const index = state.global.eventTemplates.findIndex((t) => t.id === id);

      if (index >= 0) {
        // Build the updated version, preserving immutability
        updatedTemplate = {
          ...template,
          ...data,
          id, // Make sure the ID is not modified
          updatedAt: timestamp,
        };

        // Replace it in the array
        state.global.eventTemplates[index] = updatedTemplate;
      }

      return state;
    });

    if (!updatedTemplate) {
      throw new CoreError("internal", `updating event template ${id}`);
    }

    return updatedTemplate;
  }

  /**
   * Deletes an event template
   * @param id UUID of the template to delete
   * @throws Error if the template does not exist or is in use
   */
  public deleteEventTemplate(id: UUID): void {
    // Check that the template exists
    const template = this.getEventTemplateById(id);
    if (!template) {
      throw new CoreError("event-template-not-found", `id ${id}`);
    }

    // Check that no instances use this template
    const instances = this.getEventInstances({ templateId: id });
    if (instances.length > 0) {
      throw new CoreError("event-template-in-use", `id ${id}`);
    }

    // Update the state
    this.systemCore.updateState((state) => {
      state.global.eventTemplates = state.global.eventTemplates.filter((t) => t.id !== id);
      return state;
    });
  }

  /**
   * Gets all event templates
   * @returns List of all event templates
   */
  public getEventTemplates(): EventTemplate[] {
    const state = this.systemCore.getState();
    return state.global.eventTemplates;
  }

  /**
   * Gets an event template by its ID
   * @param id UUID of the template
   * @returns The template, or null if it does not exist
   */
  private getEventTemplateById(id: UUID): EventTemplate | null {
    const state = this.systemCore.getState();
    return state.global.eventTemplates.find((t) => t.id === id) || null;
  }

  /**
   * Creates a new event instance from a template
   * @param templateId UUID of the template to use
   * @returns The created event instance
   * @throws Error if the template does not exist or there is no active day
   */
  public createEventInstance(templateId: UUID): EventInstance {
    // Check that the template exists
    const template = this.getEventTemplateById(templateId);
    if (!template) {
      throw new CoreError("event-template-not-found", `id ${templateId}`);
    }

    // Check that there is an active day
    const state = this.systemCore.getState();
    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }

    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    const newInstance: EventInstance = {
      id,
      templateId,
      templateName: template.name, // Copy the name for easy reference
      timestamp,
      dayId: state.currentDay.day.id,
      createdAt: timestamp,
    };

    // Update the state
    this.systemCore.updateState((state) => {
      state.global.eventInstances.push(newInstance);
      return state;
    });

    return newInstance;
  }

  /**
   * Gets event instances matching optional filters
   * @param filters Optional filters: dayId, templateId, since, until
   * @returns List of event instances matching the filters
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
      // Apply filters
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

    // Sort chronologically
    return [...instances].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Gets recent events that occurred in the last X minutes
   * @param minutesWindow Time window in minutes (default 30)
   * @returns List of recent events sorted chronologically
   */
  public getRecentEvents(minutesWindow: number = 30): EventInstance[] {
    // Compute the cutoff timestamp (X minutes ago)
    const now = new Date();
    const limitTime = new Date(now.getTime() - minutesWindow * 60 * 1000);
    const limitTimestamp = limitTime.toISOString();

    // Use getEventInstances with the since filter
    return this.getEventInstances({ since: limitTimestamp });
  }
}
