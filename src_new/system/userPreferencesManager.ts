import type { ISystemCore, UserPreferences, UUID } from "../types";
import { UtilityService } from "./utilityService";

export class UserPreferencesManager {
    constructor(private core: ISystemCore) { }

    public getUserPreferences(): UserPreferences {
        return this.core.getState().global.userPreferences;
    }

    public updateUserPreferences(prefs: Partial<UserPreferences>): UserPreferences {
        const current = this.getUserPreferences();
        const updated: UserPreferences = {
            ...current,
            ...prefs,
            updatedAt: UtilityService.getCurrentISODateTime()
        };

        this.core.updateState(state => ({
            ...state,
            global: {
                ...state.global,
                userPreferences: updated
            }
        }));

        return updated;
    }

    public toggleVariableVisibility(variableId: UUID): void {
        const prefs = this.getUserPreferences();
        let hidden = [...prefs.hiddenSubjectiveVariableIds];

        if (hidden.includes(variableId)) {
            hidden = hidden.filter(id => id !== variableId);
        } else {
            hidden.push(variableId);
        }

        this.updateUserPreferences({ hiddenSubjectiveVariableIds: hidden });
    }

    public isVariableVisible(variableId: UUID): boolean {
        return !this.getUserPreferences().hiddenSubjectiveVariableIds.includes(variableId);
    }
}
