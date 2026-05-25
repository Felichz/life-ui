import type { AppState, IPersistenceManager } from "../types";

export const STORAGE_KEY = "qualia_control_app_state";

export class PersistenceManager implements IPersistenceManager {
    public saveState(state: AppState): void {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        } catch (error) {
            console.error("Persistence error saving state:", error);
        }
    }

    public loadState(): AppState | null {
        try {
            const serial = localStorage.getItem(STORAGE_KEY);
            if (!serial) return null;

            const parsed = JSON.parse(serial);
            if (!this.isValid(parsed)) {
                console.error("Persistence error loading state: Invalid structure");
                return null;
            }

            return parsed as AppState;
        } catch (error) {
            console.error("Persistence error loading state:", error);
            return null;
        }
    }

    public clearState(): void {
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (error) {
            console.error("Persistence error clearing state:", error);
        }
    }

    private isValid(state: any): boolean {
        if (!state || typeof state !== "object") return false;
        if (!state.global || typeof state.global !== "object") return false;
        if (state.currentDay !== null && typeof state.currentDay !== "object") return false;
        return true;
    }
}
