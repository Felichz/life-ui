import type { ISystemCore, InterruptionCause, UUID, InterruptionStatistics } from "../types";
import { UtilityService } from "./utilityService";

export class InterruptionManager {
    constructor(private core: ISystemCore) { }

    public createInterruptionCause(description: string): InterruptionCause {
        if (!description.trim()) throw new Error("Description cannot be empty");

        const cause: InterruptionCause = {
            id: UtilityService.generateUUID(),
            description: description.trim(),
            createdAt: UtilityService.getCurrentISODateTime(),
            updatedAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(s => ({
            ...s,
            global: {
                ...s.global,
                interruptionCauses: [...s.global.interruptionCauses, cause]
            }
        }));

        return cause;
    }

    public updateInterruptionCause(id: UUID, data: Partial<InterruptionCause>): InterruptionCause {
        const s = this.core.getState();
        const existing = s.global.interruptionCauses.find(c => c.id === id);
        if (!existing) throw new Error("Interruption cause not found");

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
                interruptionCauses: state.global.interruptionCauses.map(c => c.id === id ? updated : c)
            }
        }));

        return updated;
    }

    public deleteInterruptionCause(id: UUID): void {
        // Unlike templates, deleting a cause might leave historical records pointing to missing causes
        // In our design, CompletedActivityRecords keep 'causeId' but we also store 'causeDescription' to be safe.
        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                interruptionCauses: state.global.interruptionCauses.filter(c => c.id !== id)
            }
        }));
    }

    public getInterruptionCauses(): InterruptionCause[] {
        return this.core.getState().global.interruptionCauses;
    }

    public getInterruptionStatistics(): InterruptionStatistics {
        const records = this.core.getState().global.completedActivityRecords.filter(r => r.state === "interrupted");

        const totalInterruptions = records.length;
        let avoidableInterruptions = 0;

        const causeCounts: Record<string, { count: number; description: string }> = {};

        records.forEach(r => {
            if (r.interruptionData?.isAvoidable) {
                avoidableInterruptions++;
                if (r.interruptionData.causeId && r.interruptionData.causeDescription) {
                    const cid = r.interruptionData.causeId;
                    const desc = r.interruptionData.causeDescription;
                    if (!causeCounts[cid]) causeCounts[cid] = { count: 0, description: desc };
                    causeCounts[cid].count++;
                }
            }
        });

        const topCauses = Object.entries(causeCounts)
            .map(([id, data]) => ({
                id,
                description: data.description,
                count: data.count,
                percentage: 0
            }))
            .sort((a, b) => b.count - a.count);

        if (avoidableInterruptions > 0) {
            topCauses.forEach(tc => {
                tc.percentage = (tc.count / avoidableInterruptions) * 100;
            });
        }

        return {
            totalInterruptions,
            avoidableInterruptions,
            unavoidableInterruptions: totalInterruptions - avoidableInterruptions,
            avoidablePercentage: totalInterruptions > 0 ? (avoidableInterruptions / totalInterruptions) * 100 : 0,
            topCauses: topCauses.slice(0, 5) // Top 5
        };
    }
}
