import { ActivityManager } from "../activityManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState, ActivityTemplate, TimeBlock } from "../../types";

// Mock for SystemCore
jest.mock("../index");

// Mock for UtilityService
jest.mock("../utilityService");

describe("ActivityManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let activityManager: ActivityManager;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;
  let mockTemplateId: string;
  let mockBlockId: string;
  let mockDayId: string;

  // Helper to set up an active day
  const setupActiveDay = () => {
    mockDayId = "day-id-123";
    mockAppState.currentDay = {
      day: {
        id: mockDayId,
        state: "active",
        startTime: mockTimestamp,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
      activityInstances: [],
      activeActivityInstanceId: undefined,
    };
  };

  // Helper to set up an activity template
  const setupActivityTemplate = (
    type: "clear-objective" | "flexible-duration" | "timeboxing" = "clear-objective"
  ): ActivityTemplate => {
    mockTemplateId = "template-id-123";
    const template: ActivityTemplate = {
      id: mockTemplateId,
      title: "Test Activity",
      description: "Test description",
      type,
      isSystemActivity: false,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    // Set up settings based on the type
    if (type === "clear-objective") {
      template.clearObjectiveSettings = {
        estimatedDurationMinutes: 30,
      };
    } else if (type === "flexible-duration") {
      template.flexibleDurationSettings = {
        minimumDurationMinutes: 15,
        maximumDurationMinutes: 60,
      };
    } else if (type === "timeboxing") {
      template.timeboxingSettings = {
        type: "both",
        minimumDurationMinutes: 20,
        maximumDurationMinutes: 45,
      };
    }

    mockAppState.global.activityTemplates.push(template);
    return template;
  };

  // Helper to set up a time block
  const setupTimeBlock = (): TimeBlock => {
    mockBlockId = "block-id-123";
    const timeBlock: TimeBlock = {
      id: mockBlockId,
      name: "Test Block",
      startMinute: 540, // 9:00 AM
      endMinute: 720, // 12:00 PM
      isDefault: false,
      order: 1,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    mockAppState.global.timeBlocks.push(timeBlock);
    return timeBlock;
  };

  beforeEach(() => {
    // Set up the initial application state
    mockAppState = {
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
      },
      currentDay: null,
    };

    // Set up mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    // Use the real implementations for the tempo calculation functions
    // (auto-mock would have left them as undefined)
    const actualUtilityService = jest.requireActual("../utilityService")
      .UtilityService as typeof UtilityService;
    (UtilityService.calculateBeatEstimate as jest.Mock).mockImplementation(
      actualUtilityService.calculateBeatEstimate
    );
    (UtilityService.calculateTemposAwarded as jest.Mock).mockImplementation(
      actualUtilityService.calculateTemposAwarded
    );

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);

    // This is the problem: the mock implementation is not using the same object to update
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      // Make a deep copy of the state to avoid unexpected mutations
      const stateCopy = JSON.parse(JSON.stringify(mockAppState));

      // Update the mockAppState used across all tests
      mockAppState = updater(stateCopy);

      // Also return the mockAppState object used by systemCore.getState
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    });

    // Create the ActivityManager instance
    activityManager = new ActivityManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===============================================
  // Template management tests
  // ===============================================

  describe("Template management", () => {
    describe("createActivityTemplate", () => {
      it("should create a new activity template", () => {
        const templateData = {
          title: "Nueva Actividad",
          description: "Descripción de prueba",
          type: "clear-objective" as const,
          isSystemActivity: false,
          clearObjectiveSettings: {
            estimatedDurationMinutes: 30,
          },
        };

        const result = activityManager.createActivityTemplate(templateData);

        // Check that the template was created correctly
        expect(result).toEqual({
          ...templateData,
          id: mockUUID,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Check that the global state was updated
        expect(systemCore.updateState).toHaveBeenCalled();
        expect(mockAppState.global.activityTemplates.length).toBe(1);
        expect(mockAppState.global.activityTemplates[0]).toEqual(result);
      });
    });

    describe("updateActivityTemplate", () => {
      it("should update an existing template", () => {
        // Create a template first
        const template = setupActivityTemplate();

        // Data to update
        const updateData = {
          title: "Título Actualizado",
          description: "Descripción actualizada",
        };

        const result = activityManager.updateActivityTemplate(template.id, updateData);

        // Check that it was updated correctly
        expect(result).toEqual({
          ...template,
          ...updateData,
          updatedAt: mockTimestamp,
        });

        // Check that it was updated in the global state
        expect(mockAppState.global.activityTemplates[0]).toEqual(result);
      });

      it("should throw if the template does not exist", () => {
        expect(() => {
          activityManager.updateActivityTemplate("non-existent-id", { title: "Test" });
        }).toThrowCoreError("activity-template-not-found");
      });
    });

    describe("deleteActivityTemplate", () => {
      it("should delete an existing template", () => {
        // Create a template first
        const template = setupActivityTemplate();

        activityManager.deleteActivityTemplate(template.id);

        // Check that the template was deleted
        expect(mockAppState.global.activityTemplates.length).toBe(0);
      });

      it("should throw if the template does not exist", () => {
        expect(() => {
          activityManager.deleteActivityTemplate("non-existent-id");
        }).toThrowCoreError("activity-template-not-found");
      });

      it("should throw if the template has active instances", () => {
        // Create a template
        const template = setupActivityTemplate();

        // Set up an active day and create an instance
        setupActiveDay();
        mockAppState.currentDay!.activityInstances.push({
          id: "instance-id-123",
          templateId: template.id,
          blockId: "block-id-123",
          order: 0,
          state: "instantiated",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        expect(() => {
          activityManager.deleteActivityTemplate(template.id);
        }).toThrowCoreError("activity-template-in-use");
      });
    });

    describe("getActivityTemplates", () => {
      it("should return all templates", () => {
        // Create several templates
        const template1 = setupActivityTemplate("clear-objective");

        // Reset mockUUID to create a different ID
        mockUUID = "template-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const template2 = setupActivityTemplate("flexible-duration");

        const result = activityManager.getActivityTemplates();

        expect(result).toEqual([template1, template2]);
      });
    });

    describe("getActivityTemplate", () => {
      it("should return a specific template", () => {
        // Create a template
        const template = setupActivityTemplate();

        const result = activityManager.getActivityTemplate(template.id);

        expect(result).toEqual(template);
      });

      it("should return undefined if the template does not exist", () => {
        const result = activityManager.getActivityTemplate("non-existent-id");

        expect(result).toBeUndefined();
      });
    });
  });

  // ===============================================
  // Instance management tests
  // ===============================================

  describe("Instance management", () => {
    beforeEach(() => {
      // Set up template, block and active day for all tests
      setupActivityTemplate();
      setupTimeBlock();
      setupActiveDay();
    });

    describe("createActivityInstance", () => {
      it("should create an instance from a template", () => {
        const result = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Check that the instance was created correctly
        expect(result).toEqual({
          id: mockUUID,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "instantiated",
          clearObjectiveSettings: {
            estimatedDurationMinutes: 30,
          },
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Check that the state was updated
        expect(mockAppState.currentDay?.activityInstances.length).toBe(1);
        expect(mockAppState.currentDay?.activityInstances[0]).toEqual(result);
      });

      it("should apply dynamic settings", () => {
        const dynamicSettings = {
          clearObjectiveSettings: {
            estimatedDurationMinutes: 45, // Value different from the template's
          },
        };

        const result = activityManager.createActivityInstance(
          mockTemplateId,
          mockBlockId,
          dynamicSettings
        );

        // Check that the dynamic settings were applied
        expect(result.clearObjectiveSettings?.estimatedDurationMinutes).toBe(45);
      });

      it("should throw if there is no active day", () => {
        // Remove the active day
        mockAppState.currentDay = null;

        expect(() => {
          activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        }).toThrowCoreError("no-active-day");
      });

      it("should throw if the template does not exist", () => {
        expect(() => {
          activityManager.createActivityInstance("non-existent-template", mockBlockId);
        }).toThrowCoreError("activity-template-not-found");
      });
    });

    describe("updateActivityInstance", () => {
      it("should update an existing instance", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Data to update
        const updateData = {
          clearObjectiveSettings: {
            estimatedDurationMinutes: 60,
          },
        };

        const result = activityManager.updateActivityInstance(instance.id, updateData);

        // Check that it was updated correctly
        expect(result.clearObjectiveSettings?.estimatedDurationMinutes).toBe(60);
        expect(result.updatedAt).toBe(mockTimestamp);
      });

      it("should throw when trying to change the state directly", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Try to change the state directly
        expect(() => {
          activityManager.updateActivityInstance(instance.id, { state: "active" });
        }).toThrowCoreError("invalid-state-change");
      });
    });

    describe("moveActivityInstance", () => {
      it("should move an instance to another block", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Create another block
        mockUUID = "new-block-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
        const newBlockId = mockUUID;
        mockAppState.global.timeBlocks.push({
          id: newBlockId,
          name: "New Block",
          startMinute: 780,
          endMinute: 900,
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Move the instance
        const result = activityManager.moveActivityInstance(instance.id, newBlockId);

        // Check that it was moved correctly
        expect(result.blockId).toBe(newBlockId);
        expect(result.order).toBe(0); // First item in the new block
      });

      it("should insert at the given position and renumber the block", () => {
        (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce("a");
        const a = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce("b");
        const b = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce("c");
        const c = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Move the last one to the start
        const result = activityManager.moveActivityInstance(c.id, mockBlockId, 0);
        expect(result.order).toBe(0);

        const ordered = mockAppState
          .currentDay!.activityInstances.filter((i) => i.blockId === mockBlockId)
          .sort((x, y) => x.order - y.order)
          .map((i) => i.id);
        expect(ordered).toEqual([c.id, a.id, b.id]);
      });

      it("should clamp an out-of-range position to the end of the block", () => {
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        const result = activityManager.moveActivityInstance(instance.id, mockBlockId, 5);
        expect(result.order).toBe(0);
      });

      it("should throw when trying to move an active activity", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activate the instance
        activityManager.activateActivity(instance.id);

        // Try to move the active activity
        expect(() => {
          activityManager.moveActivityInstance(instance.id, "new-block-id");
        }).toThrowCoreError("activity-is-active");
      });
    });

    describe("deleteActivityInstance", () => {
      it("should delete an instance", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        activityManager.deleteActivityInstance(instance.id);

        // Check that the instance was deleted
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
      });

      it("should throw when trying to delete an active activity", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activate the instance
        activityManager.activateActivity(instance.id);

        // Try to delete the active activity
        expect(() => {
          activityManager.deleteActivityInstance(instance.id);
        }).toThrowCoreError("activity-is-active");
      });
    });

    describe("getActivityInstances", () => {
      it("should return all instances", () => {
        // Create several instances
        const instance1 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Change mockUUID to create a different ID
        mockUUID = "instance-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const instance2 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.getActivityInstances();

        expect(result).toEqual([instance1, instance2]);
      });

      it("should throw if there is no active day", () => {
        // Remove the active day
        mockAppState.currentDay = null;

        expect(() => {
          activityManager.getActivityInstances();
        }).toThrowCoreError("no-active-day");
      });
    });

    describe("getActivityInstance", () => {
      it("should return a specific instance", () => {
        // Create an instance
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.getActivityInstance(instance.id);

        expect(result).toEqual(instance);
      });

      it("should return undefined if the instance does not exist", () => {
        const result = activityManager.getActivityInstance("non-existent-id");

        expect(result).toBeUndefined();
      });
    });
  });

  // ===============================================
  // State control tests
  // ===============================================

  describe("State control", () => {
    beforeEach(() => {
      // Set up template, block and active day for all tests
      setupActivityTemplate();
      setupTimeBlock();
      setupActiveDay();
    });

    describe("activateActivity", () => {
      it("should activate an activity instance", () => {
        // Create an instance first
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.activateActivity(instance.id);

        // Check that it was activated correctly
        expect(result.state).toBe("active");
        expect(result.startTime).toBe(mockTimestamp);

        // Check that the active activity ID was updated
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBe(instance.id);
      });

      it("throws if an activity is already active (the UI must close it first)", () => {
        // Create two instances
        const instance1 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        mockUUID = "instance-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const instance2 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activate the first instance
        activityManager.activateActivity(instance1.id);

        // Try to activate the second instance while the first is still active: must throw
        // (the UI must close the first one via completeActivity/interruptActivity first)
        expect(() => {
          activityManager.activateActivity(instance2.id);
        }).toThrowCoreError("activity-already-running");

        // Check that the first is still active (it was not closed automatically)
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBe(instance1.id);
        expect(mockAppState.currentDay?.activityInstances.length).toBe(2);
      });
    });

    describe("completeActivity", () => {
      beforeEach(() => {
        // Set up template, block and active day
        setupActivityTemplate();
        setupTimeBlock();
        setupActiveDay();
      });

      it("should complete the active activity and create a record", () => {
        // Create an instance
        const instanceId = "instance-id-123";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z", // 30 minutes before mockTimestamp
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });

        // Mark as the active activity
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        // Complete the activity
        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 8 });

        // Check that the completed activity record was created
        expect(result).toBeDefined();
        expect(result.record.state).toBe("completed");
        expect(result.record.templateId).toBe(mockTemplateId);
        expect(result.record.dayId).toBe(mockDayId);
        expect(result.record.satisfactionScore).toBe(8);
        expect(result.temposAwarded).toBeGreaterThan(0);

        // Check that the instance was removed from the current day
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();

        // Check that the record was added to completedActivityRecords
        expect(mockAppState.global.completedActivityRecords.length).toBe(1);
        expect(mockAppState.global.completedActivityRecords[0]).toEqual(result.record);
      });

      it("should complete only the active activity without affecting others", () => {
        // Create several activity instances in different blocks
        const activeInstanceId = "active-instance-id";
        const otherInstanceId1 = "other-instance-id-1";
        const otherInstanceId2 = "other-instance-id-2";

        // Create a second block
        const otherBlockId = "other-block-id";
        mockAppState.global.timeBlocks.push({
          id: otherBlockId,
          name: "Otro Bloque",
          startMinute: 780, // 13:00
          endMinute: 900, // 15:00
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Create three instances: one active and two inactive
        mockAppState.currentDay!.activityInstances = [
          {
            id: activeInstanceId,
            templateId: mockTemplateId,
            blockId: mockBlockId,
            order: 0,
            state: "active",
            startTime: "2023-01-01T11:30:00.000Z",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: otherInstanceId1,
            templateId: mockTemplateId,
            blockId: mockBlockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: otherInstanceId2,
            templateId: mockTemplateId,
            blockId: otherBlockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ];

        // Mark the active activity
        mockAppState.currentDay!.activeActivityInstanceId = activeInstanceId;

        // Complete the active activity
        activityManager.completeActivity(activeInstanceId, { satisfactionScore: 7 });

        // Check that only the active activity was removed
        expect(mockAppState.currentDay?.activityInstances.length).toBe(2);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();

        // Check that the other activities still exist
        const remainingIds = mockAppState.currentDay!.activityInstances.map((i) => i.id);
        expect(remainingIds).toContain(otherInstanceId1);
        expect(remainingIds).toContain(otherInstanceId2);
        expect(remainingIds).not.toContain(activeInstanceId);

        // Check that exactly one record was added to completedActivityRecords
        expect(mockAppState.global.completedActivityRecords.length).toBe(1);
        expect(mockAppState.global.completedActivityRecords[0].templateId).toBe(mockTemplateId);
      });

      it("should throw when trying to complete a non-active activity", () => {
        // Create an instance without activating it
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        expect(() => {
          activityManager.completeActivity(instance.id, { satisfactionScore: 8 });
        }).toThrowCoreError("not-the-active-activity");
      });

      it("should compute tempos correctly: clear-objective score 10 (MVP v3.1)", () => {
        // 30 min estimated, 30 min actual -> ceil(30 × 10 / 7) = 43
        const instanceId = "instance-no-bonus";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        expect(result.beatEstimate).toBe(false);
        // MVP v3.1 formula: ceil(30 × 10 / 7) = ceil(42.86) = 43
        expect(result.temposAwarded).toBe(43);
        expect(result.record.beatEstimate).toBe(false);
        expect(result.record.temposAwarded).toBe(43);
      });

      it("should use the estimate (not the duration) on a beat (MVP v3.1)", () => {
        // 30 min estimated, 20 min actual (66%) -> beat
        // ceil(30 × 10 / 7) = 43 (uses the estimate, not the actual duration)
        const instanceId = "instance-bonus";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:40:00.000Z", // 20 min before mockTimestamp
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        expect(result.beatEstimate).toBe(true);
        // MVP v3.1 formula: ceil(30 × 10 / 7) = 43
        expect(result.temposAwarded).toBe(43);
        expect(result.record.beatEstimate).toBe(true);
      });

      it("should NOT give a bonus for timeboxing even if it beat the estimate (MVP v3.1)", () => {
        // Switch the template to timeboxing
        mockAppState.global.activityTemplates[0].type = "timeboxing";
        mockAppState.global.activityTemplates[0].clearObjectiveSettings = undefined;
        mockAppState.global.activityTemplates[0].timeboxingSettings = {
          type: "minimum-time",
          minimumDurationMinutes: 15,
        };

        const instanceId = "instance-timeboxing";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z", // 15 min before
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        // timeboxing NEVER has beatEstimate (there is no estimate in the same sense)
        expect(result.beatEstimate).toBe(false);
        // MVP v3.1 formula: ceil(15 × 10 / 7) = ceil(21.43) = 22
        expect(result.temposAwarded).toBe(22);
      });

      it("score 0 -> 0 total tempos, even with a beat (MVP v3.1)", () => {
        // 30 min estimated, 20 min actual (66%) -> beat available, but score 0
        const instanceId = "instance-zero";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:40:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 0 });

        // MVP v3.1 formula: score 0 -> 0 tempos
        expect(result.temposAwarded).toBe(0);
      });

      it("uses a frozen endTime: the duration does not change between request and confirm", () => {
        // Codex blocker 6: endTime must be preserved from requestCompletion.
        // Setup: active activity with startTime 20 min ago.
        const instanceId = "instance-frozen";
        const startTime = "2023-01-01T11:40:00.000Z"; // 20 min before mockTimestamp (12:00)
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        // requestCompletion freezes requestedAt = mockTimestamp (= 20 min)
        const request = activityManager.requestCompletion(instanceId);
        expect(request.durationMinutes).toBe(20);

        // The user stays 5 minutes in the modal (we change Date.now virtually)
        // Then completeActivity with the frozen endTime: must use the request's endTime
        const result = activityManager.completeActivity(instanceId, {
          satisfactionScore: 10,
          endTime: request.requestedAt, // frozen
        });

        // The duration must be the request's (20), not the "now" one (25)
        expect(result.record.durationMinutes).toBe(20);
        expect(result.record.endTime).toBe(mockTimestamp); // respects the passed endTime
      });

      it("throws on an invalid score (< 0)", () => {
        const instanceId = "instance-invalid";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        expect(() => {
          activityManager.completeActivity(instanceId, { satisfactionScore: -1 });
        }).toThrowCoreError("invalid-satisfaction-score");
      });

      it("throws on a fractional (non-integer) score", () => {
        const instanceId = "instance-fractional";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        expect(() => {
          activityManager.completeActivity(instanceId, { satisfactionScore: 7.5 });
        }).toThrowCoreError("invalid-satisfaction-score");
      });
    });

    describe("requestCompletion", () => {
      beforeEach(() => {
        setupActivityTemplate();
        setupTimeBlock();
        setupActiveDay();
      });

      it("returns correct data for clear-objective", () => {
        const instanceId = "req-1";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z", // 30 min before
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.activityTitle).toBe("Test Activity");
        expect(req.durationMinutes).toBe(30);
        expect(req.estimatedMinutes).toBe(30);
        // 30 min actual, 30 estimated -> 100% -> no bonus
        expect(req.beatEstimate).toBe(false);
        expect(req.requestedAt).toBeDefined();
      });

      it("sets beatEstimate=true when the estimate is beaten", () => {
        const instanceId = "req-2";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z", // 15 min before, 50% of the estimate
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.durationMinutes).toBe(15);
        expect(req.beatEstimate).toBe(true);
      });

      it("beatEstimate=false for timeboxing even if it beats the estimate", () => {
        mockAppState.global.activityTemplates[0].type = "timeboxing";
        mockAppState.global.activityTemplates[0].clearObjectiveSettings = undefined;
        mockAppState.global.activityTemplates[0].timeboxingSettings = {
          type: "minimum-time",
          minimumDurationMinutes: 15,
        };

        const instanceId = "req-3";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.beatEstimate).toBe(false);
      });

      it("throws if there is no active activity", () => {
        expect(() => activityManager.requestCompletion("non-existent")).toThrow();
      });
    });

    describe("interruptActivity", () => {
      it("should interrupt the active activity (no avoidable question)", () => {
        // Create and activate an instance
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        activityManager.activateActivity(instance.id);

        // Change mockUUID for the interrupted record
        mockUUID = "interrupted-id-123";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const result = activityManager.interruptActivity(instance.id);

        // Schema v2+: there is no interruptionData anymore. Tempos=0 always.
        expect(result.state).toBe("interrupted");
        expect(result.templateId).toBe(mockTemplateId);
        expect(result.temposAwarded).toBe(0);
        expect(result.satisfactionScore).toBe(0);
        expect(result.beatEstimate).toBe(false);

        // Check that the instance was deleted
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();
      });

      it("should throw if the activity is not active", () => {
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        expect(() => {
          activityManager.interruptActivity(instance.id);
        }).toThrowCoreError("not-the-active-activity");
      });
    });

    describe("getActiveActivity", () => {
      it("should return the active activity", () => {
        // Create and activate an instance
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        const activatedInstance = activityManager.activateActivity(instance.id);

        const result = activityManager.getActiveActivity();

        expect(result).toEqual(activatedInstance);
      });

      it("should return null if there is no active activity", () => {
        const result = activityManager.getActiveActivity();

        expect(result).toBeNull();
      });
    });
  });

  // ===============================================
  // System activity tests
  // ===============================================

  describe("System activities", () => {
    beforeEach(() => {
      // Set up block and active day
      setupTimeBlock();
      setupActiveDay();
    });

    describe("createPilotAutomaticActivity", () => {
      it("should create a Piloto Automático (autopilot) activity", () => {
        // Prepare mockUUID for the template
        mockUUID = "pilot-template-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        // Create the autopilot activity
        const result = activityManager.createPilotAutomaticActivity(mockBlockId);

        // Check that the system template was created
        const template = mockAppState.global.activityTemplates[0];
        expect(template.title).toBe("Piloto Automático");
        expect(template.isSystemActivity).toBe(true);
        expect(template.type).toBe("flexible-duration");

        // Check that the instance was created correctly
        expect(result.templateId).toBe(template.id);
      });

      it("should reuse the existing template if it already exists", () => {
        // Create an autopilot template
        const pilotTemplate = activityManager.createActivityTemplate({
          title: "Piloto Automático",
          description: "Actividad de sistema para registrar tiempo en piloto automático",
          type: "flexible-duration",
          isSystemActivity: true,
          flexibleDurationSettings: {
            minimumDurationMinutes: 15,
            maximumDurationMinutes: 480,
          },
        });

        // Change mockUUID for the instance
        mockUUID = "pilot-instance-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        // Create the autopilot activity
        const result = activityManager.createPilotAutomaticActivity(mockBlockId);

        // Check that the existing template was reused
        expect(result.templateId).toBe(pilotTemplate.id);

        // Check that no new template was created
        expect(mockAppState.global.activityTemplates.length).toBe(1);
      });
    });
  });
});
