import { DayManager } from "../dayManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState } from "../../types";

// Mock for SystemCore
jest.mock("../index");

// Mock for UtilityService
jest.mock("../utilityService");

describe("DayManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let dayManager: DayManager;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;

  beforeEach(() => {
    // Set up the initial app state
    mockAppState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        timeBlocks: [],
        userPreferences: {
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
      },
      currentDay: null,
    };

    // Set up mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      mockAppState = updater(mockAppState);
    });

    // Create a DayManager instance
    dayManager = new DayManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startDay", () => {
    it("creates a new active day", () => {
      const result = dayManager.startDay();

      // Check that the day was generated correctly
      expect(result).toEqual({
        id: mockUUID,
        state: "active",
        startTime: mockTimestamp,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Check that the global state was updated
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.days.length).toBe(1);
      expect(mockAppState.global.days[0]).toEqual(result);

      // Check that the current day was updated
      expect(mockAppState.currentDay).not.toBeNull();
      expect(mockAppState.currentDay?.day).toEqual(result);
    });

    it("throws an error if a day is already active", () => {
      // Create an active day first
      dayManager.startDay();

      // Try to create another active day
      expect(() => dayManager.startDay()).toThrowCoreError("day-already-active");
    });
  });

  describe("endDay", () => {
    it("ends the active day", () => {
      // Create an active day
      const day = dayManager.startDay();

      // Mock a different timestamp when ending
      const endTimestamp = "2023-01-01T18:00:00.000Z";
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(endTimestamp);

      // End the day
      const result = dayManager.endDay();

      // Check that the day was updated correctly
      expect(result).toEqual({
        ...day,
        state: "inactive",
        endTime: endTimestamp,
        updatedAt: endTimestamp,
      });

      // Check that the global state was updated
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.days.length).toBe(1);
      expect(mockAppState.global.days[0]).toEqual(result);

      // Check that the current day was cleared
      expect(mockAppState.currentDay).toBeNull();
    });

    it("throws an error if there is no active day", () => {
      expect(() => dayManager.endDay()).toThrowCoreError("no-active-day");
    });
  });

  describe("getCurrentDay", () => {
    it("returns the active day", () => {
      // Create an active day
      const day = dayManager.startDay();

      // Get the active day
      const result = dayManager.getCurrentDay();

      // Check that the correct day was returned
      expect(result).toEqual(day);
    });

    it("returns null if there is no active day", () => {
      const result = dayManager.getCurrentDay();
      expect(result).toBeNull();
    });
  });

  describe("getDays", () => {
    it("returns all recorded days", () => {
      // Create an active day
      const day = dayManager.startDay();

      // Get the days
      const result = dayManager.getDays();

      // Check that all days were returned
      expect(result).toEqual([day]);
    });
  });

  describe("isDayActive", () => {
    it("returns true if a day is active", () => {
      // Create an active day
      dayManager.startDay();

      // Check that isDayActive returns true
      expect(dayManager.isDayActive()).toBe(true);
    });

    it("returns false if there is no active day", () => {
      expect(dayManager.isDayActive()).toBe(false);
    });
  });
});
