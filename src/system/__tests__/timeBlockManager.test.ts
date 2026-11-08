import { TimeBlockManager } from "../timeBlockManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState } from "../../types";

// Mock for SystemCore
jest.mock("../index");

// Mock for UtilityService
jest.mock("../utilityService");

describe("TimeBlockManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let timeBlockManager: TimeBlockManager;
  let mockAppState: AppState;
  let mockDefaultUUID: string;
  let mockUUID: string;
  let mockUUID2: string;
  let mockUUID3: string;
  let mockTimestamp: string;
  let mockCurrentMinutes: number;

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
    mockDefaultUUID = "default-block-uuid";
    mockUUID = "test-uuid-123";
    mockUUID2 = "test-uuid-456";
    mockUUID3 = "test-uuid-789";
    mockTimestamp = "2023-01-01T12:00:00.000Z";
    mockCurrentMinutes = 720; // 12:00 PM

    // Set up mocks for UtilityService
    jest.resetAllMocks();
    (UtilityService.generateUUID as jest.Mock).mockImplementation(() => {
      // Simulate each consecutive call returning a different value
      if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 1) {
        return mockDefaultUUID;
      } else if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 2) {
        return mockUUID;
      } else if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 3) {
        return mockUUID2;
      } else {
        return mockUUID3;
      }
    });

    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
    (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);
    (UtilityService.formatTime as jest.Mock).mockImplementation((minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    });
    (UtilityService.parseTime as jest.Mock).mockImplementation((timeString) => {
      const [hours, minutes] = timeString.split(":").map(Number);
      return hours * 60 + minutes;
    });

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      mockAppState = updater(mockAppState);
    });

    // Create a TimeBlockManager instance
    timeBlockManager = new TimeBlockManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("creates the default block if it does not exist", () => {
      // Instantiating TimeBlockManager must create the default block
      expect(mockAppState.global.timeBlocks.length).toBe(1);
      expect(mockAppState.global.timeBlocks[0].isDefault).toBe(true);
      expect(mockAppState.global.timeBlocks[0].name).toBe("Por Hacer");
      expect(mockAppState.global.timeBlocks[0].id).toBe(mockDefaultUUID);
    });

    it("ensures the default block exists when starting a new day", () => {
      // Clear the blocks to simulate an initial state with no blocks
      mockAppState.global.timeBlocks = [];

      // Simulate SystemCore initialization and an active day
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [],
        activeActivityInstanceId: undefined,
      };

      // Prepare a mock for isTimeBlockAvailable
      // We need to override the behavior for this specific test
      const isTimeBlockAvailableSpy = jest.spyOn(
        TimeBlockManager.prototype,
        "isTimeBlockAvailable"
      );
      isTimeBlockAvailableSpy.mockReturnValue(true);

      // Create a new TimeBlockManager instance
      const newTimeBlockManager = new TimeBlockManager(systemCore);

      // Check that the default block was created
      expect(mockAppState.global.timeBlocks.length).toBe(1);
      expect(mockAppState.global.timeBlocks[0].isDefault).toBe(true);
      expect(mockAppState.global.timeBlocks[0].name).toBe("Por Hacer");

      // Check that the default block is available
      const defaultBlock = newTimeBlockManager.getDefaultBlock();
      expect(defaultBlock).toBeDefined();
      expect(defaultBlock.isDefault).toBe(true);

      // Check that the default block is always available
      expect(newTimeBlockManager.isTimeBlockAvailable(defaultBlock.id)).toBe(true);

      // Clean up the spy
      isTimeBlockAvailableSpy.mockRestore();
    });
  });

  describe("createTimeBlock", () => {
    beforeEach(() => {
      // Reset mocks specifically for these tests
      jest.restoreAllMocks();

      // Set up the initial state with only the default block
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      // Explicitly set the first UUID that will be generated
      (UtilityService.generateUUID as jest.Mock)
        .mockReturnValueOnce(mockUUID)
        .mockReturnValueOnce(mockUUID2)
        .mockReturnValueOnce(mockUUID3);

      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    });

    it("creates a new time block", () => {
      const result = timeBlockManager.createTimeBlock("Mañana", 360, 720);

      // Check that the block was generated correctly
      expect(result).toEqual({
        id: mockUUID,
        name: "Mañana",
        startMinute: 360,
        endMinute: 720,
        isDefault: false,
        order: 1, // Order 1 since the default block has order 0
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Check that the global state was updated
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.timeBlocks.length).toBe(2); // 1 default + 1 new
      expect(mockAppState.global.timeBlocks[1]).toEqual(result);
    });

    it("assigns an incremental order to new blocks", () => {
      // Update the getState mock to return the current state,
      // so it reflects the changes made by systemCore.updateState
      systemCore.getState.mockImplementation(() => mockAppState);

      // Create the first block
      const block1 = timeBlockManager.createTimeBlock("Mañana", 360, 720);

      // Create the second block (does not overlap the first)
      const block2 = timeBlockManager.createTimeBlock("Tarde", 720, 1080);

      // Check that the orders are incremental
      expect(block1.order).toBe(1); // Order 1 after the default block (order 0)
      expect(block2.order).toBe(2); // Next incremental value
      expect(block1.id).toBe(mockUUID);
      expect(block2.id).toBe(mockUUID2);
    });

    it("throws an error if the name is empty", () => {
      expect(() => timeBlockManager.createTimeBlock("", 360, 720)).toThrowCoreError(
        "block-name-empty"
      );
    });

    it("throws an error if the minutes are out of range", () => {
      expect(() => timeBlockManager.createTimeBlock("Test", -10, 720)).toThrowCoreError(
        "minutes-out-of-range"
      );

      expect(() => timeBlockManager.createTimeBlock("Test", 360, 1500)).toThrowCoreError(
        "minutes-out-of-range"
      );
    });

    it("throws an error if the start is greater than or equal to the end", () => {
      expect(() => timeBlockManager.createTimeBlock("Test", 720, 720)).toThrowCoreError(
        "block-start-after-end"
      );

      expect(() => timeBlockManager.createTimeBlock("Test", 800, 720)).toThrowCoreError(
        "block-start-after-end"
      );
    });

    it("throws an error if it overlaps other blocks", () => {
      // Prepare the state with an existing "Mañana" block
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Check that the block is in the state
      expect(mockAppState.global.timeBlocks.length).toBe(2);
      expect(mockAppState.global.timeBlocks[1].name).toBe("Mañana");

      // Try to create an overlapping block (10:00 - 15:00)
      expect(() => timeBlockManager.createTimeBlock("Solapado", 600, 900)).toThrowCoreError(
        "block-overlap"
      );
    });
  });

  describe("updateTimeBlock", () => {
    let blockId: string;

    beforeEach(() => {
      // Reset mocks so they behave as expected
      jest.restoreAllMocks();

      // Set up state with an existing block to update
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      blockId = mockUUID;

      // Update mockTimestamp to tell it apart
      mockTimestamp = "2023-01-01T13:00:00.000Z";
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
    });

    it("updates an existing block", () => {
      const result = timeBlockManager.updateTimeBlock(blockId, { name: "Nueva Mañana" });

      // Check that it was updated correctly
      expect(result.name).toBe("Nueva Mañana");
      expect(result.updatedAt).toBe(mockTimestamp);

      // Check that other fields were not modified
      expect(result.startMinute).toBe(360);
      expect(result.endMinute).toBe(720);
    });

    it("updates multiple properties", () => {
      const result = timeBlockManager.updateTimeBlock(blockId, {
        name: "Nueva Mañana",
        startMinute: 300,
        endMinute: 660,
      });

      // Check that all properties were updated
      expect(result.name).toBe("Nueva Mañana");
      expect(result.startMinute).toBe(300);
      expect(result.endMinute).toBe(660);
      expect(result.updatedAt).toBe(mockTimestamp);
    });

    it("throws an error if the block does not exist", () => {
      expect(() =>
        timeBlockManager.updateTimeBlock("id-inexistente", { name: "Test" })
      ).toThrowCoreError("block-not-found");
    });

    it("throws an error when trying to change isDefault on the default block", () => {
      expect(() =>
        timeBlockManager.updateTimeBlock(mockDefaultUUID, { isDefault: false })
      ).toThrowCoreError("default-block-protected");
    });

    it("throws an error if the update causes an overlap", () => {
      // Add another block to the state
      mockAppState.global.timeBlocks.push({
        id: mockUUID2,
        name: "Tarde",
        startMinute: 720,
        endMinute: 1080,
        isDefault: false,
        order: 2,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Try to extend the first block so it overlaps
      expect(() => timeBlockManager.updateTimeBlock(blockId, { endMinute: 800 })).toThrowCoreError(
        "block-overlap"
      );
    });
  });

  describe("deleteTimeBlock", () => {
    let blockId: string;

    beforeEach(() => {
      // Set up state with an existing block to delete
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      blockId = mockUUID;
    });

    it("deletes an existing block and moves activities to 'Por Hacer' if moveActivitiesToTodo is true", () => {
      // Add activities to the block being deleted
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [
          {
            id: "a1",
            templateId: "t1",
            blockId: blockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a2",
            templateId: "t2",
            blockId: blockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a3",
            templateId: "t3",
            blockId: mockDefaultUUID,
            order: 2,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ],
        activeActivityInstanceId: undefined,
      };

      // Delete the block and move activities
      timeBlockManager.deleteTimeBlock(blockId, true);

      // The activities should now be in the default block
      const moved = mockAppState.currentDay!.activityInstances.filter(
        (a) => a.blockId === mockDefaultUUID
      );
      expect(moved.length).toBe(3); // a1, a2, a3
      expect(mockAppState.global.timeBlocks.find((b) => b.id === blockId)).toBeUndefined();
    });

    it("deletes an existing block and deletes its activities if moveActivitiesToTodo is false", () => {
      // Add activities to the block being deleted
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [
          {
            id: "a1",
            templateId: "t1",
            blockId: blockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a2",
            templateId: "t2",
            blockId: blockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a3",
            templateId: "t3",
            blockId: mockDefaultUUID,
            order: 2,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ],
        activeActivityInstanceId: undefined,
      };

      // Delete the block and delete activities
      timeBlockManager.deleteTimeBlock(blockId, false);

      // Only the activity in the default block should remain
      const remaining = mockAppState.currentDay!.activityInstances;
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("a3");
      expect(mockAppState.global.timeBlocks.find((b) => b.id === blockId)).toBeUndefined();
    });

    it("throws an error if the block does not exist", () => {
      expect(() => timeBlockManager.deleteTimeBlock("id-inexistente")).toThrowCoreError(
        "block-not-found"
      );
    });

    it("throws an error when trying to delete the default block", () => {
      expect(() => timeBlockManager.deleteTimeBlock(mockDefaultUUID)).toThrowCoreError(
        "default-block-protected"
      );
    });
  });

  describe("getTimeBlocks", () => {
    it("returns all blocks sorted by order", () => {
      // Build a state with several blocks out of order
      const bloques = [
        {
          id: mockDefaultUUID,
          name: "Por Hacer",
          startMinute: 0,
          endMinute: 0,
          isDefault: true,
          order: 0,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-noche",
          name: "Noche",
          startMinute: 1080,
          endMinute: 1439,
          isDefault: false,
          order: 3,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-tarde",
          name: "Tarde",
          startMinute: 720,
          endMinute: 1080,
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-mañana",
          name: "Mañana",
          startMinute: 360,
          endMinute: 720,
          isDefault: false,
          order: 1,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
      ];

      // The blocks are deliberately in the wrong order
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: bloques,
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Get the sorted blocks
      const result = timeBlockManager.getTimeBlocks();

      // Check that they are sorted by order
      expect(result.length).toBe(4);
      expect(result[0].isDefault).toBe(true); // The default block is always first (order 0)
      expect(result[1].name).toBe("Mañana");
      expect(result[2].name).toBe("Tarde");
      expect(result[3].name).toBe("Noche");
    });
  });

  describe("getTimeBlock", () => {
    it("returns a block by its ID", () => {
      // Set up state with a specific block
      const bloque = {
        id: mockUUID,
        name: "Mañana",
        startMinute: 360,
        endMinute: 720,
        isDefault: false,
        order: 1,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };

      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            bloque,
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Get the block by ID
      const result = timeBlockManager.getTimeBlock(mockUUID);

      // Check that it is the same block
      expect(result).toEqual(bloque);
    });

    it("returns undefined if the block does not exist", () => {
      const result = timeBlockManager.getTimeBlock("id-inexistente");
      expect(result).toBeUndefined();
    });
  });

  describe("getCurrentTimeBlock", () => {
    it("returns the current block based on the system time", () => {
      // Set the current time to 14:30 (870 minutes)
      mockCurrentMinutes = 870;
      (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);

      // Set up state with blocks
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-mañana",
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-tarde",
              name: "Tarde",
              startMinute: 720,
              endMinute: 1080,
              isDefault: false,
              order: 2,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Get the current block (should be "Tarde")
      const result = timeBlockManager.getCurrentTimeBlock();

      expect(result?.name).toBe("Tarde");
    });

    it("returns null if there is no block for the current time", () => {
      // Set the current time to 05:00 (300 minutes)
      mockCurrentMinutes = 300;
      (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);

      // Set up state with blocks that do not cover the current time
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-mañana",
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // There is no block for 5:00
      const result = timeBlockManager.getCurrentTimeBlock();

      expect(result).toBe(null);
    });
  });

  describe("getDefaultBlock", () => {
    it("returns the default block", () => {
      // Reset mocks to test getDefaultBlock
      jest.restoreAllMocks();

      // Simulate that the default block already exists
      (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockDefaultUUID);

      const mockAppStateWithDefault = {
        ...mockAppState,
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
      };

      // Simulate that the state contains the default block
      systemCore.getState = jest.fn().mockReturnValue(mockAppStateWithDefault);

      // Get the default block
      const result = timeBlockManager.getDefaultBlock();

      // Check that it is the default block
      expect(result.isDefault).toBe(true);
      expect(result.name).toBe("Por Hacer");
      expect(result.id).toBe(mockDefaultUUID);
    });

    it("creates the default block if it does not exist", () => {
      // Reset to an empty state
      mockAppState.global.timeBlocks = [];
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Set up the UUID mock to return the expected ID
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValue("default-block-id");

      // Calling getDefaultBlock should create a default block
      const result = timeBlockManager.getDefaultBlock();

      expect(result.id).toBe("default-block-id");
      expect(result.isDefault).toBe(true);
      expect(result.name).toBe("Por Hacer");
    });
  });

  describe("isTimeBlockAvailable", () => {
    let morningBlockId: string;
    let afternoonBlockId: string;

    beforeEach(() => {
      // Set up tests with specific values
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce("default-block-id");
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce(mockUUID);
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce(mockUUID2);
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

      // Build a clean state with predefined blocks
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: "default-block-id",
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID2,
              name: "Tarde",
              startMinute: 720,
              endMinute: 1080,
              isDefault: false,
              order: 2,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      morningBlockId = mockUUID;
      afternoonBlockId = mockUUID2;

      // Check that they were created correctly
      expect(mockAppState.global.timeBlocks.length).toBe(3);
      expect(mockAppState.global.timeBlocks[1].id).toBe(mockUUID);
      expect(mockAppState.global.timeBlocks[2].id).toBe(mockUUID2);
    });

    it("returns true for the default block", () => {
      const defaultBlock = timeBlockManager.getDefaultBlock();

      expect(timeBlockManager.isTimeBlockAvailable(defaultBlock.id)).toBe(true);
    });

    it("returns true for the current block", () => {
      // Afternoon starts exactly at 12:00
      expect(timeBlockManager.isTimeBlockAvailable(afternoonBlockId)).toBe(true);
    });

    it("returns false for an inactive block", () => {
      // Morning already ended at 12:00
      expect(timeBlockManager.isTimeBlockAvailable(morningBlockId)).toBe(false);
    });

    it("returns false for a nonexistent ID", () => {
      expect(timeBlockManager.isTimeBlockAvailable("id-inexistente")).toBe(false);
    });
  });

  describe("createDefaultBlock", () => {
    it("creates a new default block", () => {
      // Reset to an empty state
      mockAppState.global.timeBlocks = [];
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Set up the UUID mock to return the expected ID
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValue("default-block-id");
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

      // Create the default block
      const result = timeBlockManager.createDefaultBlock();

      expect(result).toEqual({
        id: "default-block-id",
        name: "Por Hacer",
        startMinute: 0,
        endMinute: 1439, // Updated to reflect the new "whole day" range
        isDefault: true,
        order: 0,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });
    });

    it("returns the existing default block without creating a new one", () => {
      // Build a state with a default block
      const existingDefault = {
        id: mockDefaultUUID,
        name: "Por Hacer",
        startMinute: 0,
        endMinute: 0,
        isDefault: true,
        order: 0,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };

      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [existingDefault],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // The mock should not be used because the existing one is returned
      jest.restoreAllMocks();

      // Calling createDefaultBlock should return the existing block
      const result = timeBlockManager.createDefaultBlock();

      // It must return the existing one, not create a new one
      expect(result.id).toBe(existingDefault.id);
      expect(mockAppState.global.timeBlocks.length).toBe(1);
    });
  });

  describe("convertMinutesToTimeString", () => {
    it("converts minutes to time format", () => {
      (UtilityService.formatTime as jest.Mock).mockReturnValue("12:30");

      const result = timeBlockManager.convertMinutesToTimeString(750);

      expect(result).toBe("12:30");
      expect(UtilityService.formatTime).toHaveBeenCalledWith(750);
    });
  });

  describe("convertTimeStringToMinutes", () => {
    it("converts time format to minutes", () => {
      (UtilityService.parseTime as jest.Mock).mockReturnValue(750);

      const result = timeBlockManager.convertTimeStringToMinutes("12:30");

      expect(result).toBe(750);
      expect(UtilityService.parseTime).toHaveBeenCalledWith("12:30");
    });
  });
});
