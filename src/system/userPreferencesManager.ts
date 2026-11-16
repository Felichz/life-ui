import type { ISystemCore, UserPreferences } from "../types";

/**
 * User preferences manager
 * Lets users customize aspects of their experience through persistent preferences
 */
export class UserPreferencesManager {
  private systemCore: ISystemCore;

  /**
   * Preferences manager constructor
   * @param systemCore Reference to the system core
   */
  constructor(systemCore: ISystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Gets the current user preferences
   * @returns Current user preferences
   */
  public getUserPreferences(): UserPreferences {
    return this.systemCore.getState().global.userPreferences;
  }

  /**
   * Updates user preferences partially or fully
   * @param preferences Partial object with the preferences to update
   * @returns Updated preferences
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences {
    let updatedPreferences: UserPreferences;

    this.systemCore.updateState((state) => {
      // Create a new preferences instance merging the existing ones with the new ones
      updatedPreferences = {
        ...state.global.userPreferences,
        ...preferences,
        updatedAt: new Date().toISOString(),
      };

      // Update state while preserving immutability
      return {
        ...state,
        global: {
          ...state.global,
          userPreferences: updatedPreferences,
        },
      };
    });

    // Return the updated preferences
    return this.getUserPreferences();
  }
}
