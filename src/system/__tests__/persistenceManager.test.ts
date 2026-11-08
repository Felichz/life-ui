/**
 * @jest-environment jsdom
 */

import { PersistenceManager, STORAGE_KEY, CURRENT_SCHEMA_VERSION } from "../persistenceManager";
import type { AppState } from "../../types";

// Direct localStorage mock
// We use a stable object and mutate its keys instead of reassigning the reference.
// This avoids issues with closures that do not see the reassignment.
const mockLocalStorage: Record<string, string> = {};
const clearMockStorage = () => {
  for (const k of Object.keys(mockLocalStorage)) {
    delete mockLocalStorage[k];
  }
};

beforeAll(() => {
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: jest.fn((key: string) => mockLocalStorage[key] ?? null),
      setItem: jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      }),
      removeItem: jest.fn((key: string) => {
        delete mockLocalStorage[key];
      }),
      clear: jest.fn(() => clearMockStorage()),
    },
    writable: true,
  });
});

// Silence console.error during the tests
jest.spyOn(console, "error").mockImplementation();
jest.spyOn(console, "warn").mockImplementation();

describe("PersistenceManager", () => {
  let persistenceManager: PersistenceManager;

  // Test data
  const mockValidState: AppState = {
    global: {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      timeBlocks: [],
      userPreferences: {
        updatedAt: new Date().toISOString(),
      },
      completedActivityRecords: [],
      eventInstances: [],
    },
    currentDay: null,
  };

  beforeEach(() => {
    // Clear mocks and localStorage before each test
    jest.clearAllMocks();
    window.localStorage.clear();
    clearMockStorage();
    persistenceManager = new PersistenceManager();
  });

  afterAll(() => {
    // Restore mocks
    jest.restoreAllMocks();
  });

  // Simple test to verify our mock works
  it("verifies the localStorage mock works", () => {
    localStorage.setItem("test-key", "test-value");
    expect(localStorage.getItem("test-key")).toBe("test-value");
  });

  describe("saveState", () => {
    it("saves the state to localStorage correctly", () => {
      persistenceManager.saveState(mockValidState);

      // Schema v3: saveState adds schemaVersion=3 to the payload
      const expectedPayload = JSON.stringify({ ...mockValidState, schemaVersion: 3 });

      // Verify setItem was called with the correct parameters
      expect(localStorage.setItem).toHaveBeenCalledWith(STORAGE_KEY, expectedPayload);

      // Verify the value was saved in mockLocalStorage
      expect(mockLocalStorage[STORAGE_KEY]).toBe(expectedPayload);
    });

    it("handles errors while saving", () => {
      // Simulate an error
      localStorage.setItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error de almacenamiento");
      });

      // The call must not throw
      expect(() => {
        persistenceManager.saveState(mockValidState);
      }).not.toThrow();

      // Verify the error was logged
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("loadState", () => {
    it("returns null if there is no data in localStorage", () => {
      const result = persistenceManager.loadState();
      expect(result).toBeNull();
    });

    it("loads and deserializes the state correctly", () => {
      // Schema v2+: the persisted state carries schemaVersion
      const serializedState = JSON.stringify({ ...mockValidState, schemaVersion: 2 });
      mockLocalStorage[STORAGE_KEY] = serializedState;

      // Verify our mock works
      expect(localStorage.getItem(STORAGE_KEY)).toBe(serializedState);

      // Run the method under test
      const result = persistenceManager.loadState();

      // Verify the result
      expect(result).not.toBeNull();
      expect(localStorage.getItem).toHaveBeenCalledWith(STORAGE_KEY);

      if (result) {
        expect(result.global).toEqual(mockValidState.global);
        expect(result.currentDay).toBeNull();
      }
    });

    it("returns null if the data is not a valid object", () => {
      // Store a string that is not an object when deserialized
      mockLocalStorage[STORAGE_KEY] = JSON.stringify("string no válido");

      jest.clearAllMocks();

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("returns null if the object does not have the expected structure", () => {
      // Store an object with an incorrect structure
      mockLocalStorage[STORAGE_KEY] = JSON.stringify({ invalidKey: "value" });

      jest.clearAllMocks();

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });

    it("handles errors while loading", () => {
      // Simulate an error in getItem
      localStorage.getItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error de lectura");
      });

      const result = persistenceManager.loadState();

      expect(result).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("clearState", () => {
    it("removes the state from localStorage", () => {
      // Save data to localStorage
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(mockValidState);

      // Verify it exists before removing it
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

      // Clear the state
      persistenceManager.clearState();

      // Verify removeItem was called and the data was removed
      expect(localStorage.removeItem).toHaveBeenCalledWith(STORAGE_KEY);
      expect(mockLocalStorage[STORAGE_KEY]).toBeUndefined();
    });

    it("handles errors while clearing", () => {
      // Simulate an error in removeItem
      localStorage.removeItem = jest.fn().mockImplementationOnce(() => {
        throw new Error("Error al eliminar");
      });

      // Must not throw the exception
      expect(() => {
        persistenceManager.clearState();
      }).not.toThrow();

      expect(console.error).toHaveBeenCalled();
    });
  });

  // Schema v2: resilient migration
  describe("migrateV1ToV2 (schema upgrade)", () => {
    // Restore ALL localStorage methods. The previous tests
    // ("handles errors while saving" and "handles errors while loading")
    // override setItem/getItem with mocks that only throw once.
    beforeEach(() => {
      localStorage.setItem = jest.fn((key: string, value: string) => {
        mockLocalStorage[key] = value;
      });
      localStorage.getItem = jest.fn((key: string) => mockLocalStorage[key] ?? null);
      localStorage.removeItem = jest.fn((key: string) => {
        delete mockLocalStorage[key];
      });
      localStorage.clear = jest.fn(() => clearMockStorage());
    });

    it("state without schemaVersion (v1) migrates to v2 with default dailyTempoTarget 100", () => {
      // Save a v1 state (no schemaVersion)
      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            // NO dailyTempoTarget (it is v1)
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
        // NO schemaVersion
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1State);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(100);
    });

    it("preserves dailyTempoTarget if it already exists (does not overwrite)", () => {
      const v1StateWithTarget = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 500, // the user had configured it
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1StateWithTarget);

      const result = persistenceManager.loadState();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(500);
    });

    it("marks old completedActivityRecords with tempos=0", () => {
      const v1StateWithRecords = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [
            {
              id: "r1",
              templateId: "t1",
              templateTitle: "Old",
              state: "completed",
              type: "clear-objective",
              startTime: "2023-01-01T00:00:00.000Z",
              endTime: "2023-01-01T00:30:00.000Z",
              durationMinutes: 30,
              dayId: "d1",
              createdAt: "2023-01-01T00:00:00.000Z",
              // NO satisfactionScore, NO temposAwarded, NO beatEstimate (it is v1)
            },
          ],
          eventInstances: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1StateWithRecords);

      const result = persistenceManager.loadState();
      expect(result!.global.completedActivityRecords.length).toBe(1);
      expect(result!.global.completedActivityRecords[0].satisfactionScore).toBe(0);
      expect(result!.global.completedActivityRecords[0].temposAwarded).toBe(0);
      expect(result!.global.completedActivityRecords[0].beatEstimate).toBe(false);
    });

    it("REBUILDS userPreferences if global is incomplete (partially corrupt state)", () => {
      const corruptState = {
        // global.currentDay is missing
        global: {
          days: [],
          activityTemplates: [],
          // ...several fields are missing
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(corruptState);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      // Must have rebuilt userPreferences with dailyTempoTarget=100
      expect(result!.global.userPreferences).toBeDefined();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(100);
    });

    it("REBUILDS userPreferences if the global object exists but userPreferences is missing", () => {
      const stateWithoutPrefs = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          // NO userPreferences
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(stateWithoutPrefs);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(result!.global.userPreferences).toBeDefined();
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(100);
    });

    it("REBUILDS completedActivityRecords if the array is missing", () => {
      const stateWithoutRecords = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          // NO completedActivityRecords
          eventInstances: [],
        },
        currentDay: null,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(stateWithoutRecords);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      expect(Array.isArray(result!.global.completedActivityRecords)).toBe(true);
      expect(result!.global.completedActivityRecords.length).toBe(0);
    });

    it("v2 state (schemaVersion=2) is not re-migrated", () => {
      const v2State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 750, // user's custom value
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2State);

      const result = persistenceManager.loadState();
      // If it were v1, it would be overwritten to 1000. v2 keeps the 750.
      expect(result!.global.userPreferences.dailyTempoTarget).toBe(750);
    });

    it("saveState includes schemaVersion=3 when persisting", () => {
      persistenceManager.saveState(mockValidState);

      const stored = mockLocalStorage[STORAGE_KEY];
      expect(stored).toBeDefined();
      const parsed = JSON.parse(stored);
      expect(parsed.schemaVersion).toBe(3);
    });

    // Schema v3: archiving and removal of legacy fields
    it("v2 state with legacy fields migrates to v3, archiving the fields in legacyArchive", () => {
      const v2StateWithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["var-1"],
            dailyTempoTarget: 100,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "var-1", name: "Energía" }],
          interruptionCauses: [{ id: "cause-1", description: "Notificación" }],
          subjectiveVariableSnapshots: [{ id: "snap-1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2StateWithLegacy);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();

      // The main persisted shape no longer has the legacy fields
      const global = result!.global as unknown as Record<string, unknown>;
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      const prefs = global.userPreferences as Record<string, unknown>;
      expect(prefs.hiddenSubjectiveVariableIds).toBeUndefined();

      // The archive is available for audit
      expect(global.legacyArchive).toBeDefined();
      const archive = global.legacyArchive as {
        subjectiveVariables: unknown[];
        interruptionCauses: unknown[];
        subjectiveVariableSnapshots: unknown[];
        hiddenSubjectiveVariableIds: unknown[];
      };
      expect(archive.subjectiveVariables).toHaveLength(1);
      expect(archive.interruptionCauses).toHaveLength(1);
      expect(archive.subjectiveVariableSnapshots).toHaveLength(1);
      expect(archive.hiddenSubjectiveVariableIds).toEqual(["var-1"]);
    });

    it("v2 state without legacy fields migrates to v3 without legacyArchive", () => {
      const v2CleanState = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v2CleanState);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      const global = result!.global as unknown as Record<string, unknown>;
      expect(global.legacyArchive).toBeUndefined();
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
    });

    it("defensive saveState: removes legacy fields if they sneak into the state", () => {
      // Force a state with injected legacy fields
      const stateWithLegacyInjected = {
        global: {
          ...mockValidState.global,
          subjectiveVariables: [{ id: "var-x" }],
          interruptionCauses: [{ id: "cause-x" }],
          subjectiveVariableSnapshots: [{ id: "snap-x" }],
          userPreferences: {
            ...mockValidState.global.userPreferences,
            hiddenSubjectiveVariableIds: ["var-x"],
          },
        },
        currentDay: null,
      } as typeof mockValidState;

      persistenceManager.saveState(stateWithLegacyInjected);

      const stored = JSON.parse(mockLocalStorage[STORAGE_KEY]);
      expect(stored.global.subjectiveVariables).toBeUndefined();
      expect(stored.global.interruptionCauses).toBeUndefined();
      expect(stored.global.subjectiveVariableSnapshots).toBeUndefined();
      expect(stored.global.userPreferences.hiddenSubjectiveVariableIds).toBeUndefined();
    });

    it("v1 state chains through v2 and v3 (a single loadState)", () => {
      const v1State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["var-1"],
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "var-1", name: "Energía" }],
          interruptionCauses: [{ id: "cause-1", description: "Notificación" }],
          subjectiveVariableSnapshots: [{ id: "snap-1" }],
        },
        currentDay: null,
        // NO schemaVersion => v1
      };
      mockLocalStorage[STORAGE_KEY] = JSON.stringify(v1State);

      const result = persistenceManager.loadState();
      expect(result).not.toBeNull();
      const global = result!.global as unknown as Record<string, unknown>;

      // dailyTempoTarget created by v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(100);

      // Legacy fields archived by v2→v3
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect(
        (global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds
      ).toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
    });
  });

  // Central pipeline: serialize/deserialize (what export/import and localStorage use)
  describe("serialize / deserialize", () => {
    it("serialize includes schemaVersion=3 and produces parseable JSON", () => {
      const json = persistenceManager.serialize(mockValidState);
      const parsed = JSON.parse(json);

      expect(parsed.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(parsed.global).toEqual(mockValidState.global);
    });

    it("serialize removes legacy fields even if they are in the state", () => {
      const stateWithLegacy = {
        ...mockValidState,
        global: {
          ...mockValidState.global,
          subjectiveVariables: [{ id: "v1" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          userPreferences: {
            ...mockValidState.global.userPreferences,
            hiddenSubjectiveVariableIds: ["v1"],
          },
        },
      } as typeof mockValidState;

      const json = persistenceManager.serialize(stateWithLegacy);
      const parsed = JSON.parse(json);

      expect(parsed.global.subjectiveVariables).toBeUndefined();
      expect(parsed.global.interruptionCauses).toBeUndefined();
      expect(parsed.global.subjectiveVariableSnapshots).toBeUndefined();
      expect(parsed.global.userPreferences.hiddenSubjectiveVariableIds).toBeUndefined();
    });

    it("deserialize of v3 returns the state as is without migration", () => {
      const json = JSON.stringify({ ...mockValidState, schemaVersion: 3 });
      const result = persistenceManager.deserialize(json);

      expect(result.global).toEqual(mockValidState.global);
      // No warnings because there is no migration
    });

    it("deserialize of v2 with legacy fields archives and cleans them", () => {
      const v2State = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 800,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1", description: "Notif" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
          schemaVersion: 2,
        },
        currentDay: null,
        schemaVersion: 2,
      };

      const result = persistenceManager.deserialize(JSON.stringify(v2State));
      const global = result.global as unknown as Record<string, unknown>;

      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect(
        (global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds
      ).toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
      // dailyTempoTarget preserved by the migration
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(800);
    });

    it("deserialize of v1 without schemaVersion runs v1→v2→v3", () => {
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

      const result = persistenceManager.deserialize(JSON.stringify(v1State));
      const global = result.global as unknown as Record<string, unknown>;

      // dailyTempoTarget created by v1→v2
      expect((global.userPreferences as { dailyTempoTarget: number }).dailyTempoTarget).toBe(100);
      // Legacy archived by v2→v3
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.legacyArchive).toBeDefined();
    });

    it("deserialize throws an Error on invalid JSON", () => {
      expect(() => persistenceManager.deserialize("invalid json")).toThrow();
    });

    it("deserialize throws an Error on invalid structure", () => {
      expect(() => persistenceManager.deserialize(JSON.stringify({}))).toThrow();
    });

    it("serialize → deserialize roundtrip preserves the state", () => {
      const original = {
        ...mockValidState,
        global: {
          ...mockValidState.global,
          days: [
            {
              id: "d1",
              state: "active" as const,
              createdAt: "2023-01-01T00:00:00.000Z",
              updatedAt: "2023-01-01T00:00:00.000Z",
            },
          ],
        },
      };

      const json = persistenceManager.serialize(original);
      const result = persistenceManager.deserialize(json);

      expect(result.global.days).toEqual(original.global.days);
      expect(result.global.userPreferences).toEqual(original.global.userPreferences);
    });

    // Hardening: a v3 payload with injected legacy fields must be normalized
    it("v3 payload with injected legacy fields is normalized (stripLegacyFields)", () => {
      const v3WithLegacy = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: ["v1"],
            dailyTempoTarget: 100,
            updatedAt: "2023-01-01T00:00:00.000Z",
          },
          completedActivityRecords: [],
          eventInstances: [],
          // Tampered payload: declares v3 but carries legacy fields
          subjectiveVariables: [{ id: "v1", name: "Energía" }],
          interruptionCauses: [{ id: "c1" }],
          subjectiveVariableSnapshots: [{ id: "s1" }],
        },
        currentDay: null,
        schemaVersion: 3,
      };

      const result = persistenceManager.deserialize(JSON.stringify(v3WithLegacy));
      const global = result.global as unknown as Record<string, unknown>;

      // The runtime must NOT contain the legacy fields, not even in memory
      expect(global.subjectiveVariables).toBeUndefined();
      expect(global.interruptionCauses).toBeUndefined();
      expect(global.subjectiveVariableSnapshots).toBeUndefined();
      expect(
        (global.userPreferences as Record<string, unknown>).hiddenSubjectiveVariableIds
      ).toBeUndefined();

      // No migration (already v3) -> no legacyArchive (there was no data to archive
      // because stripLegacyFields removed it directly)
      expect(global.legacyArchive).toBeUndefined();
    });
  });
});
