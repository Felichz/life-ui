import { SystemCore } from "../index";
import { PersistenceManager } from "../persistenceManager";
import { UtilityService } from "../utilityService";
import type { AppState, Day, TimeBlock } from "../../types";

// PersistenceManager mock: ALWAYS returns the same instance (singleton)
// so that multiple `new SystemCore()` calls in one test share the same
// configured mock. Tests that need the real pipeline (exportData/importData
// with v2→v3 migration) reassign the mockImplementation of the relevant method.
const sharedPersistence: Record<string, jest.Mock> = {};
jest.mock("../persistenceManager", () => {
  const actual = jest.requireActual("../persistenceManager");
  const MockedClass = jest.fn().mockImplementation(() => {
    if (Object.keys(sharedPersistence).length === 0) {
      sharedPersistence.saveState = jest.fn();
      sharedPersistence.loadState = jest.fn().mockReturnValue(null);
      sharedPersistence.clearState = jest.fn();
      sharedPersistence.serialize = jest.fn((state: AppState) =>
        JSON.stringify({ ...state, schemaVersion: 3 })
      );
      sharedPersistence.deserialize = jest.fn((json: string) => JSON.parse(json) as AppState);
    }
    return sharedPersistence;
  });
  return {
    ...actual,
    PersistenceManager: MockedClass,
  };
});
jest.mock("../dayManager");
jest.mock("../activityManager");
jest.mock("../timeBlockManager");
jest.mock("../eventManager");
jest.mock("../analyticsManager");
jest.mock("../userPreferencesManager");
jest.mock("../utilityService");

describe("SystemCore", () => {
  let systemCore: SystemCore;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;
  let mockPersistence: Record<string, jest.Mock>;

  beforeEach(() => {
    // Set up mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    // Reset the mocked constructor and clear the shared instance
    (PersistenceManager as unknown as jest.Mock).mockClear();
    Object.keys(sharedPersistence).forEach((k) => delete sharedPersistence[k]);

    systemCore = new SystemCore();

    // mockPersistence is now the shared singleton instance
    mockPersistence = sharedPersistence;

    // Set up the default mock
    mockPersistence.loadState.mockReturnValue(null);
    mockPersistence.saveState.mockImplementation(() => {});
    mockPersistence.clearState.mockImplementation(() => {});
    mockPersistence.serialize.mockImplementation((state: AppState) =>
      JSON.stringify({ ...state, schemaVersion: 3 })
    );
    mockPersistence.deserialize.mockImplementation((json: string) => JSON.parse(json) as AppState);

    // Get the initial state
    mockAppState = systemCore.getState();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Initialization", () => {
    it("creates a default state on initialization", () => {
      expect(mockAppState).toEqual({
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: mockTimestamp,
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 3,
        },
        currentDay: null,
      });
    });

    it("loads the state from persistence if it exists", () => {
      const savedState: AppState = {
        global: {
          days: [
            {
              id: "existing-day",
              state: "active",
              startTime: "2023-01-01T10:00:00.000Z",
              createdAt: "2023-01-01T10:00:00.000Z",
              updatedAt: "2023-01-01T10:00:00.000Z",
            },
          ],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: "2023-01-01T10:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 2,
        },
        currentDay: {
          day: {
            id: "existing-day",
            state: "active",
            startTime: "2023-01-01T10:00:00.000Z",
            createdAt: "2023-01-01T10:00:00.000Z",
            updatedAt: "2023-01-01T10:00:00.000Z",
          },
          activityInstances: [],
          activeActivityInstanceId: undefined,
        },
      };

      // Configure the mock to return the saved state (shared via singleton)
      (mockPersistence.loadState as jest.Mock).mockReturnValue(savedState);

      // Create a new instance with the configured mock
      const systemCoreWithSavedState = new SystemCore();

      // Verify the state was loaded
      expect(systemCoreWithSavedState.getState()).toEqual(savedState);
    });
  });

  describe("updateState", () => {
    it("updates the state and notifies observers", () => {
      // Set up an observer
      const mockObserver = jest.fn();
      const unsubscribe = systemCore.onStateChange(mockObserver);

      // Update the state
      systemCore.updateState((state) => {
        return {
          ...state,
          global: {
            ...state.global,
            days: [
              ...state.global.days,
              {
                id: mockUUID,
                state: "active",
                startTime: mockTimestamp,
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp,
              },
            ],
          },
        };
      });

      // Verify the state was updated
      const updatedState = systemCore.getState();
      expect(updatedState.global.days.length).toBe(1);
      expect(updatedState.global.days[0].id).toBe(mockUUID);

      // Verify the observer was called
      expect(mockObserver).toHaveBeenCalledWith(updatedState);

      // Verify the state was saved
      expect(mockPersistence.saveState).toHaveBeenCalledWith(updatedState);

      // Test unsubscribing
      unsubscribe();
      systemCore.updateState((state) => state); // Another update
      expect(mockObserver).toHaveBeenCalledTimes(1); // Should not have been called again
    });
  });

  describe("Delegated methods", () => {
    it("delegates DayManager methods correctly", () => {
      // Restore the original mocks to test delegation
      jest.restoreAllMocks();

      // Create spies for the DayManager methods
      const startDaySpy = jest
        .spyOn(systemCore["dayManager"], "startDay")
        .mockImplementation(() => {
          return {
            id: mockUUID,
            state: "active",
            startTime: mockTimestamp,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          } as Day;
        });

      const endDaySpy = jest.spyOn(systemCore["dayManager"], "endDay").mockImplementation(() => {
        return {
          id: mockUUID,
          state: "inactive",
          startTime: mockTimestamp,
          endTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        } as Day;
      });

      const getCurrentDaySpy = jest.spyOn(systemCore["dayManager"], "getCurrentDay");
      const isDayActiveSpy = jest.spyOn(systemCore["dayManager"], "isDayActive");

      // Test the delegations
      systemCore.startDay();
      expect(startDaySpy).toHaveBeenCalled();

      systemCore.endDay();
      expect(endDaySpy).toHaveBeenCalled();

      systemCore.getCurrentDay();
      expect(getCurrentDaySpy).toHaveBeenCalled();

      systemCore.isDayActive();
      expect(isDayActiveSpy).toHaveBeenCalled();
    });

    it("delegates ActivityManager methods correctly", () => {
      // Restore the original mocks to test delegation
      jest.restoreAllMocks();

      // Create spies for the ActivityManager methods
      const createTemplateSpy = jest.spyOn(systemCore["activityManager"], "createActivityTemplate");
      const updateTemplateSpy = jest.spyOn(systemCore["activityManager"], "updateActivityTemplate");
      const deleteTemplateSpy = jest.spyOn(systemCore["activityManager"], "deleteActivityTemplate");
      const getTemplatesSpy = jest.spyOn(systemCore["activityManager"], "getActivityTemplates");

      // Sample data
      const templateData = {
        title: "Test Activity",
        description: "Test Description",
        type: "clear-objective" as const,
        isSystemActivity: false,
        clearObjectiveSettings: {
          estimatedDurationMinutes: 30,
        },
      };

      // Test the delegations
      systemCore.createActivityTemplate(templateData);
      expect(createTemplateSpy).toHaveBeenCalledWith(templateData);

      systemCore.updateActivityTemplate(mockUUID, { title: "Updated Title" });
      expect(updateTemplateSpy).toHaveBeenCalledWith(mockUUID, { title: "Updated Title" });

      systemCore.deleteActivityTemplate(mockUUID);
      expect(deleteTemplateSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getActivityTemplates();
      expect(getTemplatesSpy).toHaveBeenCalled();
    });

    it("delegates TimeBlockManager methods correctly", () => {
      // Restore the original mocks to test delegation
      jest.restoreAllMocks();

      // Create spies for the TimeBlockManager methods
      const createBlockSpy = jest
        .spyOn(systemCore["timeBlockManager"], "createTimeBlock")
        .mockImplementation((name, startMinute, endMinute) => {
          return {
            id: mockUUID,
            name,
            startMinute,
            endMinute,
            isDefault: false,
            order: 1,
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          } as TimeBlock;
        });

      const updateBlockSpy = jest.spyOn(systemCore["timeBlockManager"], "updateTimeBlock");
      const deleteBlockSpy = jest.spyOn(systemCore["timeBlockManager"], "deleteTimeBlock");
      const getBlocksSpy = jest.spyOn(systemCore["timeBlockManager"], "getTimeBlocks");

      // Sample data
      const name = "Morning Block";
      const startMinute = 480; // 8:00 AM
      const endMinute = 600; // 10:00 AM

      // Test the delegations
      systemCore.createTimeBlock(name, startMinute, endMinute);
      expect(createBlockSpy).toHaveBeenCalledWith(name, startMinute, endMinute);

      systemCore.updateTimeBlock(mockUUID, { name: "Updated Block" });
      expect(updateBlockSpy).toHaveBeenCalledWith(mockUUID, { name: "Updated Block" });

      systemCore.deleteTimeBlock(mockUUID);
      // deleteTimeBlock has an optional second argument (moveActivitiesToTodo=true by default)
      expect(deleteBlockSpy).toHaveBeenCalledWith(mockUUID, true);

      systemCore.getTimeBlocks();
      expect(getBlocksSpy).toHaveBeenCalled();
    });

    it("delegates UserPreferencesManager methods correctly", () => {
      // Restore the original mocks to test delegation
      jest.restoreAllMocks();

      // Create spies for the UserPreferencesManager methods
      const updatePreferencesSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "updateUserPreferences"
      );
      const getPreferencesSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "getUserPreferences"
      );
      const updateDailyTempoTargetSpy = jest.spyOn(
        systemCore["userPreferencesManager"],
        "updateDailyTempoTarget"
      );

      // Test the delegations
      systemCore.updateUserPreferences({ dailyTempoTarget: 1500 });
      expect(updatePreferencesSpy).toHaveBeenCalledWith({ dailyTempoTarget: 1500 });

      systemCore.getUserPreferences();
      expect(getPreferencesSpy).toHaveBeenCalled();

      systemCore.updateDailyTempoTarget(2000);
      expect(updateDailyTempoTargetSpy).toHaveBeenCalledWith(2000);
    });

    it("delegates AnalyticsManager methods correctly", () => {
      // Restore the original mocks to test delegation
      jest.restoreAllMocks();

      // Create spies for the AnalyticsManager methods
      const getTimelineSpy = jest.spyOn(systemCore["analyticsManager"], "getTimelineData");
      const getDistributionSpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getTimeDistributionData"
      );
      const getStatsSpy = jest.spyOn(systemCore["analyticsManager"], "getActivityStats");
      const getCompletionRateSpy = jest.spyOn(systemCore["analyticsManager"], "getCompletionRate");
      const getEstimationAccuracySpy = jest.spyOn(
        systemCore["analyticsManager"],
        "getEstimationAccuracy"
      );

      // Test the delegations
      systemCore.getTimelineData(mockUUID);
      expect(getTimelineSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getTimeDistributionData();
      expect(getDistributionSpy).toHaveBeenCalled();

      systemCore.getActivityStats(mockUUID);
      expect(getStatsSpy).toHaveBeenCalledWith(mockUUID);

      systemCore.getCompletionRate();
      expect(getCompletionRateSpy).toHaveBeenCalled();

      systemCore.getEstimationAccuracy();
      expect(getEstimationAccuracySpy).toHaveBeenCalled();
    });
  });

  describe("Persistence methods", () => {
    it("exports the state as JSON correctly", () => {
      const exportedJson = systemCore.exportData();
      const exportedState = JSON.parse(exportedJson);

      // The exported state contains the full global + top-level schemaVersion
      // (added by the central pipeline)
      expect(exportedState.global).toEqual(systemCore.getState().global);
      expect(exportedState.schemaVersion).toBe(3);
    });

    it("imports the state from JSON correctly (v3)", () => {
      const importedState: AppState = {
        global: {
          days: [
            {
              id: "imported-day",
              state: "inactive",
              startTime: "2023-01-01T08:00:00.000Z",
              endTime: "2023-01-01T16:00:00.000Z",
              createdAt: "2023-01-01T08:00:00.000Z",
              updatedAt: "2023-01-01T16:00:00.000Z",
            },
          ],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: "2023-01-01T08:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 3,
        },
        currentDay: null,
      };

      // Import from JSON
      systemCore.importData(JSON.stringify(importedState));

      // Verify it was imported correctly
      expect(systemCore.getState()).toEqual(importedState);

      // Verify the imported state was saved
      expect(mockPersistence.saveState).toHaveBeenCalledWith(importedState);
    });

    it("importData runs the central pipeline: importing v2 with legacy archives and cleans", () => {
      // Use the real deserialize implementation (includes migration)
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        deserialize: (json: string) => AppState;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.deserialize.mockImplementation((json: string) =>
        realInstance.deserialize(json)
      );

      // v2 JSON with legacy fields - simulates a user importing an old backup
      const v2WithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 1500,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };

      systemCore.importData(JSON.stringify(v2WithLegacy));

      const state = systemCore.getState();
      const global = state.global as unknown as Record<string, unknown>;

      // The runtime no longer contains the legacy fields
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect(
        (global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds
      ).toBeUndefined();
      // But the archive is available
      expect(global.legacyArchive).toBeDefined();
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(1500);
    });

    it("importData of v1 without schemaVersion chains v1→v2→v3", () => {
      // Use the real deserialize implementation
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        deserialize: (json: string) => AppState;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.deserialize.mockImplementation((json: string) =>
        realInstance.deserialize(json)
      );

      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
        },
        currentDay: null,
      };

      systemCore.importData(JSON.stringify(v1State));

      const state = systemCore.getState();
      const global = state.global as unknown as Record<string, unknown>;

      // dailyTempoTarget created by v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(100);
      // Legacy archived by v2→v3
      expect(global.legacyArchive).toBeDefined();
    });

    it("exportData goes through the central pipeline (includes schemaVersion, no filtering)", () => {
      // Mock serialize to verify it is called
      mockPersistence.serialize.mockReturnValue("mock-json");

      const result = systemCore.exportData();
      expect(result).toBe("mock-json");
      expect(mockPersistence.serialize).toHaveBeenCalled();
    });

    it("real exportData: includes schemaVersion=3 and no legacy fields", () => {
      // Use the real serialize implementation (includes legacy strip)
      const RealPersistenceManager = jest.requireActual("../persistenceManager")
        .PersistenceManager as new () => {
        serialize: (state: AppState) => string;
      };
      const realInstance = new RealPersistenceManager();
      mockPersistence.serialize.mockImplementation((state: AppState) =>
        realInstance.serialize(state)
      );

      // Inject a state with legacy fields to verify the strip
      systemCore.updateState((state) => {
        const global = state.global as unknown as Record<string, unknown>;
        global.subjectiveVariables = [{ id: "v1" }];
        global.interruptionCauses = [{ id: "c1" }];
        return {
          ...state,
          global: global as unknown as typeof state.global,
        };
      });

      const json = systemCore.exportData();
      const parsed = JSON.parse(json);

      expect(parsed.schemaVersion).toBe(3);
      expect(parsed.global.subjectiveVariables).toBeUndefined();
      expect(parsed.global.interruptionCauses).toBeUndefined();
    });

    it("handles errors when importing invalid JSON", () => {
      // Try to import invalid JSON
      expect(() => systemCore.importData("invalid json")).toThrow();
    });

    it("clears the state correctly", () => {
      // Set a state with data
      systemCore.updateState((state) => {
        return {
          ...state,
          global: {
            ...state.global,
            days: [
              {
                id: mockUUID,
                state: "active",
                startTime: mockTimestamp,
                createdAt: mockTimestamp,
                updatedAt: mockTimestamp,
              },
            ],
          },
        };
      });

      // Verify we have data
      expect(systemCore.getState().global.days.length).toBe(1);

      // Clear the state
      systemCore.clearState();

      // Verify it was cleared correctly
      expect(systemCore.getState().global.days).toEqual([]);
      expect(mockPersistence.clearState).toHaveBeenCalled();
    });
  });
});
