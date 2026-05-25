import type { AppState, Day, ISystemCore, StateUpdater } from "../types";
import { UtilityService } from "./utilityService";

export class DayManager {
    constructor(private core: ISystemCore) { }

    public startDay(): Day {
        if (this.isDayActive()) {
            throw new Error("Cannot start a new day because one is already active.");
        }

        const newDay: Day = {
            id: UtilityService.generateUUID(),
            state: "active",
            startTime: UtilityService.getCurrentISODateTime(),
            createdAt: UtilityService.getCurrentISODateTime(),
            updatedAt: UtilityService.getCurrentISODateTime(),
        };

        this.core.updateState((state) => {
            const pendingInstances = state.global.pendingActivityInstances || [];
            return {
                ...state,
                currentDay: {
                    day: newDay,
                    activityInstances: pendingInstances,
                    activeActivityInstanceId: undefined,
                },
                global: {
                    ...state.global,
                    pendingActivityInstances: [],
                },
            };
        });

        return newDay;
    }

    public endDay(): Day {
        if (!this.isDayActive()) {
            throw new Error("No active day to end.");
        }

        const currentState = this.core.getState();
        const currentDayState = currentState.currentDay!;

        const endedDay: Day = {
            ...currentDayState.day,
            state: "inactive",
            endTime: UtilityService.getCurrentISODateTime(),
            updatedAt: UtilityService.getCurrentISODateTime(),
        };

        const remainingInstances = currentDayState.activityInstances.filter(
            inst => inst.state === "instantiated" || inst.state === "in-library"
        );

        this.core.updateState((state) => ({
            ...state,
            currentDay: null,
            global: {
                ...state.global,
                days: [...state.global.days, endedDay],
                pendingActivityInstances: remainingInstances
            }
        }));

        return endedDay;
    }

    public getCurrentDay(): Day | null {
        return this.core.getState().currentDay?.day || null;
    }

    public isDayActive(): boolean {
        return this.core.getState().currentDay !== null;
    }

    public getDays(): Day[] {
        return this.core.getState().global.days;
    }
}
