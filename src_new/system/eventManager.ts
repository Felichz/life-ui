import type { EventTemplate, EventInstance, ISystemCore, UUID } from "../types";
import { UtilityService } from "./utilityService";

export class EventManager {
    constructor(private core: ISystemCore) { }

    public createEventTemplate(name: string): EventTemplate {
        if (!name.trim()) throw new Error("Event template name cannot be empty");

        const template: EventTemplate = {
            id: UtilityService.generateUUID(),
            name: name.trim(),
            createdAt: UtilityService.getCurrentISODateTime(),
            updatedAt: UtilityService.getCurrentISODateTime(),
        };

        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                eventTemplates: [...state.global.eventTemplates, template]
            }
        }));

        return template;
    }

    public updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate {
        const state = this.core.getState();
        const existing = state.global.eventTemplates.find(t => t.id === id);
        if (!existing) throw new Error("Event template not found");

        const updated: EventTemplate = {
            ...existing,
            ...data,
            id,
            updatedAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(s => ({
            ...s,
            global: {
                ...s.global,
                eventTemplates: s.global.eventTemplates.map(t => t.id === id ? updated : t)
            }
        }));

        return updated;
    }

    public deleteEventTemplate(id: UUID): void {
        const state = this.core.getState();
        const inUse = state.global.eventInstances.some(inst => inst.templateId === id);
        if (inUse) {
            throw new Error("Cannot delete event template because it is already used in event instances");
        }

        this.core.updateState(s => ({
            ...s,
            global: {
                ...s.global,
                eventTemplates: s.global.eventTemplates.filter(t => t.id !== id)
            }
        }));
    }

    public getEventTemplates(): EventTemplate[] {
        return this.core.getState().global.eventTemplates;
    }

    public createEventInstance(templateId: UUID): EventInstance {
        const state = this.core.getState();
        if (!state.currentDay) {
            throw new Error("Cannot create event instance: no active day");
        }

        const template = state.global.eventTemplates.find(t => t.id === templateId);
        if (!template) throw new Error("Event template not found");

        const instance: EventInstance = {
            id: UtilityService.generateUUID(),
            templateId,
            templateName: template.name,
            timestamp: UtilityService.getCurrentISODateTime(),
            dayId: state.currentDay.day.id,
            createdAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(s => ({
            ...s,
            global: {
                ...s.global,
                eventInstances: [...s.global.eventInstances, instance]
            }
        }));

        return instance;
    }

    public getEventInstances(filters?: { dayId?: UUID; since?: string; until?: string }): EventInstance[] {
        let instances = this.core.getState().global.eventInstances;
        if (!filters) return instances;

        if (filters.dayId) instances = instances.filter(i => i.dayId === filters.dayId);
        if (filters.since) instances = instances.filter(i => new Date(i.timestamp) >= new Date(filters.since!));
        if (filters.until) instances = instances.filter(i => new Date(i.timestamp) <= new Date(filters.until!));

        return instances;
    }

    public getRecentEvents(minutesWindow: number = 30): EventInstance[] {
        const cutoff = new Date();
        cutoff.setMinutes(cutoff.getMinutes() - minutesWindow);
        return this.getEventInstances({ since: cutoff.toISOString() });
    }
}
