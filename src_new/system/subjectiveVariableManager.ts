import type { ISystemCore, SubjectiveVariable, SubjectiveVariableSnapshot, UUID } from "../types";
import { UtilityService } from "./utilityService";

export class SubjectiveVariableManager {
    constructor(private core: ISystemCore) { }

    public createSubjectiveVariable(name: string): SubjectiveVariable {
        if (!name.trim()) throw new Error("Variable name cannot be empty");

        const variable: SubjectiveVariable = {
            id: UtilityService.generateUUID(),
            name: name.trim(),
            createdAt: UtilityService.getCurrentISODateTime(),
            updatedAt: UtilityService.getCurrentISODateTime(),
        };

        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                subjectiveVariables: [...state.global.subjectiveVariables, variable]
            }
        }));

        return variable;
    }

    public updateSubjectiveVariable(id: UUID, data: Partial<SubjectiveVariable>): SubjectiveVariable {
        const s = this.core.getState();
        const existing = s.global.subjectiveVariables.find(v => v.id === id);
        if (!existing) throw new Error("Variable not found");

        const updated = {
            ...existing,
            ...data,
            id,
            updatedAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                subjectiveVariables: state.global.subjectiveVariables.map(v => v.id === id ? updated : v)
            }
        }));

        return updated;
    }

    public deleteSubjectiveVariable(id: UUID): void {
        const inUse = this.core.getState().global.subjectiveVariableSnapshots.some(s =>
            s.values.some(v => v.variableId === id)
        );

        if (inUse) {
            throw new Error("Cannot delete variable: it has existing snapshots");
        }

        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                subjectiveVariables: state.global.subjectiveVariables.filter(v => v.id !== id)
            }
        }));
    }

    public canUpdateVariables(): boolean {
        const snapshots = this.core.getState().global.subjectiveVariableSnapshots;
        if (snapshots.length === 0) return true;

        // Check if the most recent snapshot is older than 5 minutes
        const latest = new Date(snapshots[snapshots.length - 1].timestamp);
        const now = new Date();
        const diffMins = (now.getTime() - latest.getTime()) / (1000 * 60);

        return diffMins >= 5;
    }

    public getLatestValues(): Record<UUID, number> {
        const result: Record<UUID, number> = {};
        const snapshots = this.core.getState().global.subjectiveVariableSnapshots;
        const vars = this.core.getState().global.subjectiveVariables;

        // initialize with mid value 5
        vars.forEach(v => result[v.id] = 5);

        if (snapshots.length > 0) {
            const latestSnapshot = snapshots[snapshots.length - 1];
            latestSnapshot.values.forEach(val => {
                result[val.variableId] = val.currentValue;
            });
        }

        return result;
    }

    public createSnapshot(
        values: { variableId: UUID; currentValue: number }[],
        relatedActivityIds: UUID[] = [],
        relatedEventIds: UUID[] = []
    ): SubjectiveVariableSnapshot | null {
        if (!this.canUpdateVariables()) {
            throw new Error("Updates have a 5 minute cooldown.");
        }

        const state = this.core.getState();
        if (!state.currentDay) {
            throw new Error("Active day required to record snapshots.");
        }

        const vars = state.global.subjectiveVariables;
        const latestValues = this.getLatestValues();

        // Generate complete snapshot data including unchanged variables
        const fullValues = vars.map(v => {
            const userProvided = values.find(val => val.variableId === v.id);
            return {
                variableId: v.id,
                variableName: v.name,
                previousValue: latestValues[v.id],
                currentValue: userProvided ? userProvided.currentValue : latestValues[v.id]
            };
        });

        const snapshot: SubjectiveVariableSnapshot = {
            id: UtilityService.generateUUID(),
            timestamp: UtilityService.getCurrentISODateTime(),
            dayId: state.currentDay.day.id,
            values: fullValues,
            relatedActivityIds,
            relatedEventIds,
            createdAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(s => ({
            ...s,
            global: {
                ...s.global,
                subjectiveVariableSnapshots: [...s.global.subjectiveVariableSnapshots, snapshot]
            }
        }));

        return snapshot;
    }

    public getSnapshots(filters?: { dayId?: UUID; variableIds?: UUID[]; since?: string; until?: string }): SubjectiveVariableSnapshot[] {
        let snaps = this.core.getState().global.subjectiveVariableSnapshots;
        if (!filters) return snaps;

        if (filters.dayId) snaps = snaps.filter(s => s.dayId === filters.dayId);
        if (filters.since) snaps = snaps.filter(s => new Date(s.timestamp) >= new Date(filters.since!));
        if (filters.until) snaps = snaps.filter(s => new Date(s.timestamp) <= new Date(filters.until!));

        if (filters.variableIds && filters.variableIds.length > 0) {
            // Return a copy where values only include the filtered variable IDs
            return snaps.map(snap => ({
                ...snap,
                values: snap.values.filter(v => filters.variableIds!.includes(v.variableId))
            }));
        }

        return snaps;
    }
}
