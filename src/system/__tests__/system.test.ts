// Qualia Control - System Integration Tests

import { System } from "../index";
import type { ActivityManagement } from "../activity";
import type { TimeManagement } from "../time";
import type { VariableManagement } from "../variables";
import type { EventManagement } from "../events";
import type { DailyManagement } from "../daily";
import type { SettingsManagement } from "../settings";
import type { MomentumManagement } from "../momentum";
import type {
  Activity,
  ActivitySatisfaction,
  CustomVariable,
  DailySummary,
  DayState,
  DiscreteEvent,
  InterruptedActivity,
  InterruptionCause,
  TimeBlock,
  UserSettings,
  VariableSnapshot,
  History,
} from "../../types";

// Mocks para todos los módulos del sistema
jest.mock("../activity");
jest.mock("../time");
jest.mock("../variables");
jest.mock("../events");
jest.mock("../daily");
jest.mock("../settings");
jest.mock("../momentum");

describe("System", () => {
  let system: System;

  // Mocks para los módulos
  let mockActivityManagement: jest.Mocked<ActivityManagement>;
  let mockTimeManagement: jest.Mocked<TimeManagement>;
  let mockVariableManagement: jest.Mocked<VariableManagement>;
  let mockEventManagement: jest.Mocked<EventManagement>;
  let mockDailyManagement: jest.Mocked<DailyManagement>;
  let mockSettingsManagement: jest.Mocked<SettingsManagement>;
  let mockMomentumManagement: jest.Mocked<MomentumManagement>;

  // Reset de los mocks y del singleton antes de cada test
  beforeEach(() => {
    // Limpiar todas las instancias y llamadas a mocks
    jest.clearAllMocks();

    // Reset del singleton (necesitaremos modificar System para esto en la implementación)
    // Para las pruebas, asumimos que hay un método reset o podemos acceder a instance
    // @ts-expect-error - Acceso a la propiedad privada para pruebas
    System.instance = undefined;

    // Obtener el sistema después de reiniciar el singleton
    system = System.getInstance();

    // Capturar las instancias de los mocks
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockActivityManagement = system.activityManagement as jest.Mocked<ActivityManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockTimeManagement = system.timeManagement as jest.Mocked<TimeManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockVariableManagement = system.variableManagement as jest.Mocked<VariableManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockEventManagement = system.eventManagement as jest.Mocked<EventManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockDailyManagement = system.dailyManagement as jest.Mocked<DailyManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockSettingsManagement = system.settingsManagement as jest.Mocked<SettingsManagement>;
    // @ts-expect-error - Acceso a las propiedades privadas para pruebas
    mockMomentumManagement = system.momentumManagement as jest.Mocked<MomentumManagement>;
  });

  describe("Singleton Pattern", () => {
    test("getInstance devuelve siempre la misma instancia", () => {
      const instance1 = System.getInstance();
      const instance2 = System.getInstance();

      expect(instance1).toBe(instance2);
    });
  });

  describe("ActivityManagement Integration", () => {
    test("createActivityTemplate debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const templateData = {
        title: "Test Activity",
        description: "Test Description",
        type: "goalOriented" as const,
        tags: ["test"],
        iconId: "test-icon",
        templateId: "test-template-id",
        status: "todo" as const,
        dynamicProps: {
          estimatedMinutes: 30,
        },
      };

      const expectedResponse: Activity = {
        ...templateData,
        templateId: "created-template-id",
      } as Activity;

      mockActivityManagement.createActivityTemplate.mockResolvedValue(expectedResponse);

      // Act
      const result = await system.createActivityTemplate(templateData);

      // Assert
      expect(mockActivityManagement.createActivityTemplate).toHaveBeenCalledWith(templateData);
      expect(result).toBe(expectedResponse);
    });

    test("getActivityTemplate debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const templateId = "test-template-id";
      const expectedTemplate = {
        title: "Test Activity",
        type: "goalOriented" as const,
        tags: [],
        iconId: "test-icon",
        templateId: "test-template-id",
        status: "todo" as const,
        dynamicProps: {
          estimatedMinutes: 30,
        },
      } as Activity;

      mockActivityManagement.getActivityTemplate.mockResolvedValue(expectedTemplate);

      // Act
      const result = await system.getActivityTemplate(templateId);

      // Assert
      expect(mockActivityManagement.getActivityTemplate).toHaveBeenCalledWith(templateId);
      expect(result).toBe(expectedTemplate);
    });

    test("updateActivityTemplate debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const templateUpdates = {
        id: "test-template-id",
        title: "Updated Title",
      };

      mockActivityManagement.updateActivityTemplate.mockResolvedValue();

      // Act
      await system.updateActivityTemplate(templateUpdates);

      // Assert
      expect(mockActivityManagement.updateActivityTemplate).toHaveBeenCalledWith(templateUpdates);
    });

    test("removeActivityTemplate debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const templateId = "test-template-id";

      mockActivityManagement.removeActivityTemplate.mockResolvedValue();

      // Act
      await system.removeActivityTemplate(templateId);

      // Assert
      expect(mockActivityManagement.removeActivityTemplate).toHaveBeenCalledWith(templateId);
    });

    test("createActivity debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const activityData = {
        title: "Test Activity",
        type: "goalOriented" as const,
        templateId: "test-template-id",
        status: "todo" as const,
        tags: [],
        iconId: "test-icon",
        dynamicProps: {
          estimatedMinutes: 30,
        },
      } as unknown as Activity;

      const expectedActivity: Activity = {
        ...activityData,
        instance: {
          id: "created-instance-id",
        },
      } as Activity;

      mockActivityManagement.createActivity.mockResolvedValue(expectedActivity);

      // Act
      const result = await system.createActivity(activityData);

      // Assert
      expect(mockActivityManagement.createActivity).toHaveBeenCalledWith(activityData);
      expect(result).toBe(expectedActivity);
    });

    test("startActivity debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const activityId = "test-activity-id";

      mockActivityManagement.startActivity.mockResolvedValue();

      // Act
      await system.startActivity(activityId);

      // Assert
      expect(mockActivityManagement.startActivity).toHaveBeenCalledWith(activityId);
    });

    test("completeActivity debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const activityId = "test-activity-id";
      const satisfactionData: ActivitySatisfaction = {
        activityId,
        timestamp: Date.now(),
        satisfactionScore: 8,
        valueScore: 9,
      };

      mockActivityManagement.completeActivity.mockResolvedValue();

      // Act
      await system.completeActivity(activityId, satisfactionData);

      // Assert
      expect(mockActivityManagement.completeActivity).toHaveBeenCalledWith(
        activityId,
        satisfactionData
      );
    });

    test("interruptActivity debe llamar al método correspondiente en ActivityManagement", async () => {
      // Arrange
      const activityId = "test-activity-id";
      const interruptionData: Omit<InterruptedActivity, "activityId"> = {
        timestamp: Date.now(),
        causeId: "test-cause-id",
        minutesBeforeInterruption: 15,
      };

      mockActivityManagement.interruptActivity.mockResolvedValue();

      // Act
      await system.interruptActivity(activityId, interruptionData);

      // Assert
      expect(mockActivityManagement.interruptActivity).toHaveBeenCalledWith(
        activityId,
        interruptionData
      );
    });
  });

  describe("TimeManagement Integration", () => {
    test("createTimeBlock debe llamar al método correspondiente en TimeManagement", async () => {
      // Arrange
      const blockData = {
        title: "Morning",
        startMinute: 480, // 8:00 AM
        endMinute: 720, // 12:00 PM
        activityInstances: [],
        color: "#4285F4",
      };

      const expectedBlock: TimeBlock = {
        ...blockData,
        id: "created-block-id",
      } as TimeBlock;

      mockTimeManagement.createTimeBlock.mockResolvedValue(expectedBlock);

      // Act
      const result = await system.createTimeBlock(blockData);

      // Assert
      expect(mockTimeManagement.createTimeBlock).toHaveBeenCalledWith(blockData);
      expect(result).toBe(expectedBlock);
    });

    test("updateTimeBlock debe llamar al método correspondiente en TimeManagement", async () => {
      // Arrange
      const blockUpdates = {
        id: "test-block-id",
        title: "Updated Block",
      };

      mockTimeManagement.updateTimeBlock.mockResolvedValue();

      // Act
      await system.updateTimeBlock(blockUpdates);

      // Assert
      expect(mockTimeManagement.updateTimeBlock).toHaveBeenCalledWith(blockUpdates);
    });

    test("removeTimeBlock debe llamar al método correspondiente en TimeManagement", async () => {
      // Arrange
      const blockId = "test-block-id";

      mockTimeManagement.removeTimeBlock.mockResolvedValue();

      // Act
      await system.removeTimeBlock(blockId);

      // Assert
      expect(mockTimeManagement.removeTimeBlock).toHaveBeenCalledWith(blockId);
    });

    test("getCurrentBlock debe llamar al método correspondiente en TimeManagement", async () => {
      // Arrange
      const expectedBlock: TimeBlock = {
        id: "current-block",
        title: "Current Block",
        startMinute: 600,
        endMinute: 720,
        activityInstances: [],
        color: "#4285F4",
        isActive: true,
      };

      mockTimeManagement.getCurrentBlock.mockResolvedValue(expectedBlock);

      // Act
      const result = await system.getCurrentBlock();

      // Assert
      expect(mockTimeManagement.getCurrentBlock).toHaveBeenCalled();
      expect(result).toBe(expectedBlock);
    });

    test("validateTimeboxLimits debe llamar al método correspondiente en TimeManagement", async () => {
      // Arrange
      const activity: Activity = {
        title: "Test Activity",
        type: "timeboxed" as const,
        templateId: "test-template",
        status: "inProgress" as const,
        tags: [],
        iconId: "test-icon",
        dynamicProps: {
          timeboxConfig: {
            mode: "minimum",
            minimumMinutes: 20,
          },
        },
        instance: {
          id: "test-instance",
          startTime: Date.now() - 1200000, // Started 20 minutes ago
        },
      } as Activity;

      mockTimeManagement.validateTimeboxLimits.mockResolvedValue(true);

      // Act
      const result = await system.validateTimeboxLimits(activity);

      // Assert
      expect(mockTimeManagement.validateTimeboxLimits).toHaveBeenCalledWith(activity);
      expect(result).toBe(true);
    });
  });

  describe("VariableManagement Integration", () => {
    test("createCustomVariable debe llamar al método correspondiente en VariableManagement", async () => {
      // Arrange
      const variableData = {
        name: "Energy Level",
        description: "Tracks personal energy level",
        minValue: 1,
        maxValue: 10,
        isHigherBetter: true,
        iconId: "energy-icon",
        color: "#FF5722",
      };

      const expectedVariable: CustomVariable = {
        ...variableData,
        id: "created-variable-id",
      };

      mockVariableManagement.createCustomVariable.mockResolvedValue(expectedVariable);

      // Act
      const result = await system.createCustomVariable(variableData);

      // Assert
      expect(mockVariableManagement.createCustomVariable).toHaveBeenCalledWith(variableData);
      expect(result).toBe(expectedVariable);
    });

    test("getCustomVariable debe llamar al método correspondiente en VariableManagement", async () => {
      // Arrange
      const variableId = "test-variable-id";
      const expectedVariable: CustomVariable = {
        id: variableId,
        name: "Energy Level",
        minValue: 1,
        maxValue: 10,
        isHigherBetter: true,
        iconId: "energy-icon",
        color: "#FF5722",
      };

      mockVariableManagement.getCustomVariable.mockResolvedValue(expectedVariable);

      // Act
      const result = await system.getCustomVariable(variableId);

      // Assert
      expect(mockVariableManagement.getCustomVariable).toHaveBeenCalledWith(variableId);
      expect(result).toBe(expectedVariable);
    });

    test("updateCustomVariable debe llamar al método correspondiente en VariableManagement", async () => {
      // Arrange
      const variableUpdates = {
        id: "test-variable-id",
        name: "Updated Energy Level",
        maxValue: 12,
      };

      mockVariableManagement.updateCustomVariable.mockResolvedValue();

      // Act
      await system.updateCustomVariable(variableUpdates);

      // Assert
      expect(mockVariableManagement.updateCustomVariable).toHaveBeenCalledWith(variableUpdates);
    });

    test("removeCustomVariable debe llamar al método correspondiente en VariableManagement", async () => {
      // Arrange
      const variableId = "test-variable-id";

      mockVariableManagement.removeCustomVariable.mockResolvedValue();

      // Act
      await system.removeCustomVariable(variableId);

      // Assert
      expect(mockVariableManagement.removeCustomVariable).toHaveBeenCalledWith(variableId);
    });

    test("createVariableSnapshot debe llamar al método correspondiente en VariableManagement", async () => {
      // Arrange
      const snapshotData = {
        timestamp: Date.now(),
        variables: [
          {
            variableId: "energy-variable-id",
            currentValue: 8,
            previousValue: 7,
            change: 1,
          },
        ],
        relatedActivityIds: ["related-activity-id"],
        relatedEventIds: [],
      };

      const expectedSnapshot: VariableSnapshot = {
        ...snapshotData,
        id: "created-snapshot-id",
      };

      mockVariableManagement.createVariableSnapshot.mockResolvedValue(expectedSnapshot);

      // Act
      const result = await system.createVariableSnapshot(snapshotData);

      // Assert
      expect(mockVariableManagement.createVariableSnapshot).toHaveBeenCalledWith(snapshotData);
      expect(result).toBe(expectedSnapshot);
    });
  });

  describe("EventManagement Integration", () => {
    test("createEvent debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const eventData = {
        templateId: "event-template-id",
        title: "Took Medication",
        description: "Regular medication dose",
        tags: ["health"],
        iconId: "pill-icon",
      };

      const expectedEvent: DiscreteEvent = {
        ...eventData,
        instance: {
          id: "created-event-id",
          timestamp: Date.now(),
        },
      };

      mockEventManagement.createEvent.mockResolvedValue(expectedEvent);

      // Act
      const result = await system.createEvent(eventData);

      // Assert
      expect(mockEventManagement.createEvent).toHaveBeenCalledWith(eventData);
      expect(result).toBe(expectedEvent);
    });

    test("getEvents debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const dateFrom = Date.now() - 86400000; // 24 hours ago
      const dateTo = Date.now();

      const expectedEvents: DiscreteEvent[] = [
        {
          templateId: "event-template-id",
          title: "Took Medication",
          description: "Regular medication dose",
          tags: ["health"],
          iconId: "pill-icon",
          instance: {
            id: "event-id-1",
            timestamp: Date.now() - 43200000, // 12 hours ago
          },
        },
        {
          templateId: "event-template-id-2",
          title: "Had Coffee",
          tags: ["health", "nutrition"],
          iconId: "coffee-icon",
          instance: {
            id: "event-id-2",
            timestamp: Date.now() - 10800000, // 3 hours ago
          },
        },
      ];

      mockEventManagement.getEvents.mockResolvedValue(expectedEvents);

      // Act
      const result = await system.getEvents(dateFrom, dateTo);

      // Assert
      expect(mockEventManagement.getEvents).toHaveBeenCalledWith(dateFrom, dateTo);
      expect(result).toBe(expectedEvents);
    });

    test("getEventById debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const eventId = "test-event-id";
      const expectedEvent: DiscreteEvent = {
        templateId: "event-template-id",
        title: "Took Medication",
        description: "Regular medication dose",
        tags: ["health"],
        iconId: "pill-icon",
        instance: {
          id: eventId,
          timestamp: Date.now() - 43200000, // 12 hours ago
        },
      };

      mockEventManagement.getEventById.mockResolvedValue(expectedEvent);

      // Act
      const result = await system.getEventById(eventId);

      // Assert
      expect(mockEventManagement.getEventById).toHaveBeenCalledWith(eventId);
      expect(result).toBe(expectedEvent);
    });

    test("updateEvent debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const eventUpdates = {
        id: "test-event-id",
        title: "Updated Event Title",
        description: "Updated description",
      };

      mockEventManagement.updateEvent.mockResolvedValue();

      // Act
      await system.updateEvent(eventUpdates);

      // Assert
      expect(mockEventManagement.updateEvent).toHaveBeenCalledWith(eventUpdates);
    });

    test("removeEvent debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const eventId = "test-event-id";

      mockEventManagement.removeEvent.mockResolvedValue();

      // Act
      await system.removeEvent(eventId);

      // Assert
      expect(mockEventManagement.removeEvent).toHaveBeenCalledWith(eventId);
    });

    test("createInterruptionCause debe llamar al método correspondiente en EventManagement", async () => {
      // Arrange
      const causeData = {
        title: "Phone Call",
        occurrenceCount: 0,
      };

      const expectedCause: InterruptionCause = {
        ...causeData,
        id: "created-cause-id",
      };

      mockEventManagement.createInterruptionCause.mockResolvedValue(expectedCause);

      // Act
      const result = await system.createInterruptionCause(causeData);

      // Assert
      expect(mockEventManagement.createInterruptionCause).toHaveBeenCalledWith(causeData);
      expect(result).toBe(expectedCause);
    });
  });

  describe("DailyManagement Integration", () => {
    test("getDaySummary debe llamar al método correspondiente en DailyManagement", async () => {
      // Arrange
      const date = Date.now();
      const expectedSummary: DailySummary = {
        activitiesCompleted: 5,
        activitiesInterrupted: 1,
        completionRate: 0.83,
        averageSatisfaction: 7.5,
        averageValuePerception: 8.0,
        timeDistribution: {
          objective: 45,
          flexible: 30,
          timebox: 15,
          autopilot: 5,
          consciousRest: 3,
          meditation: 2,
        },
        overallMomentumQuality: 75,
      };

      mockDailyManagement.getDaySummary.mockResolvedValue(expectedSummary);

      // Act
      const result = await system.getDaySummary(date);

      // Assert
      expect(mockDailyManagement.getDaySummary).toHaveBeenCalledWith(date);
      expect(result).toBe(expectedSummary);
    });

    test("getDaySummaries debe llamar al método correspondiente en DailyManagement", async () => {
      // Arrange
      const dateFrom = Date.now() - 604800000; // 7 days ago
      const dateTo = Date.now();

      const expectedSummaries: DailySummary[] = [
        {
          activitiesCompleted: 5,
          activitiesInterrupted: 1,
          completionRate: 0.83,
          averageSatisfaction: 7.5,
          averageValuePerception: 8.0,
          timeDistribution: {
            objective: 45,
            flexible: 30,
            timebox: 15,
            autopilot: 5,
            consciousRest: 3,
            meditation: 2,
          },
          overallMomentumQuality: 75,
        },
        {
          activitiesCompleted: 6,
          activitiesInterrupted: 0,
          completionRate: 1.0,
          averageSatisfaction: 8.5,
          averageValuePerception: 9.0,
          timeDistribution: {
            objective: 50,
            flexible: 25,
            timebox: 15,
            autopilot: 2,
            consciousRest: 5,
            meditation: 3,
          },
          overallMomentumQuality: 85,
        },
      ];

      mockDailyManagement.getDaySummaries.mockResolvedValue(expectedSummaries);

      // Act
      const result = await system.getDaySummaries(dateFrom, dateTo);

      // Assert
      expect(mockDailyManagement.getDaySummaries).toHaveBeenCalledWith(dateFrom, dateTo);
      expect(result).toBe(expectedSummaries);
    });

    test("getDayHistory debe llamar al método correspondiente en DailyManagement", () => {
      // Arrange
      const expectedHistory: History = {
        variableHistory: [],
        activityHistory: [],
        eventHistory: [],
        interruptionHistory: [],
        satisfactionHistory: [],
        momentumHistory: [],
      };

      mockDailyManagement.getDayHistory.mockReturnValue(expectedHistory);

      // Act
      const result = system.getDayHistory();

      // Assert
      expect(mockDailyManagement.getDayHistory).toHaveBeenCalled();
      expect(result).toBe(expectedHistory);
    });

    test("calculateDailySummary debe llamar al método correspondiente en DailyManagement", () => {
      // Arrange
      const dayState: DayState = {
        startDate: Date.now() - 43200000, // 12 hours ago
        endDate: Date.now() + 43200000, // 12 hours from now
        activityInstances: [],
        dayHistory: {
          variableHistory: [],
          activityHistory: [],
          eventHistory: [],
          interruptionHistory: [],
          satisfactionHistory: [],
          momentumHistory: [],
        },
        timeDistribution: {
          objective: 0,
          flexible: 0,
          timebox: 0,
          autopilot: 0,
          consciousRest: 0,
          meditation: 0,
        },
        daySummary: {} as DailySummary,
      };

      const expectedSummary: DailySummary = {
        activitiesCompleted: 0,
        activitiesInterrupted: 0,
        completionRate: 0,
        averageSatisfaction: 0,
        averageValuePerception: 0,
        timeDistribution: {
          objective: 0,
          flexible: 0,
          timebox: 0,
          autopilot: 100,
          consciousRest: 0,
          meditation: 0,
        },
        overallMomentumQuality: 0,
      };

      mockDailyManagement.calculateDailySummary.mockReturnValue(expectedSummary);

      // Act
      const result = system.calculateDailySummary(dayState);

      // Assert
      expect(mockDailyManagement.calculateDailySummary).toHaveBeenCalledWith(dayState);
      expect(result).toBe(expectedSummary);
    });
  });

  describe.skip("System State Management", () => {
    test("updateSystemState debe actualizar el estado global del sistema", async () => {
      // Arrange
      const mockUpdatePromise = Promise.resolve();

      // En este test no necesitamos crear mocks adicionales, solo verificamos
      // que se llama al método updateSystemState y no lanza errores

      // Act
      const updatePromise = system.updateSystemState();

      // Assert
      await expect(updatePromise).resolves.not.toThrow();

      // Podemos verificar alguna interacción con módulos existentes
      // Por ejemplo, verificar que se llama al método updateMomentum como parte de la actualización global
      expect(mockMomentumManagement.updateMomentum).toHaveBeenCalled();
    });
  });

  describe("SettingsManagement Integration", () => {
    test("getUserSettings debe llamar al método correspondiente en SettingsManagement", async () => {
      // Arrange
      const expectedSettings: UserSettings = {
        theme: "dark",
        kanbanState: {},
        enableTimeboxNotifications: true,
        displaySettings: {
          showMomentumChart: true,
          defaultVisibleVariables: ["energy-id", "focus-id"],
        },
      };

      mockSettingsManagement.getUserSettings.mockResolvedValue(expectedSettings);

      // Act
      const result = await system.getUserSettings();

      // Assert
      expect(mockSettingsManagement.getUserSettings).toHaveBeenCalled();
      expect(result).toBe(expectedSettings);
    });

    test("updateUserSettings debe llamar al método correspondiente en SettingsManagement", async () => {
      // Arrange
      const settingsUpdates = {
        theme: "light" as const,
        enableTimeboxNotifications: false,
      };

      mockSettingsManagement.updateUserSettings.mockResolvedValue();

      // Act
      await system.updateUserSettings(settingsUpdates);

      // Assert
      expect(mockSettingsManagement.updateUserSettings).toHaveBeenCalledWith(settingsUpdates);
    });
  });

  describe("MomentumManagement Integration", () => {
    test("calculateMomentum debe llamar al método correspondiente en MomentumManagement", async () => {
      // Arrange
      const expectedMomentum = 75;

      mockMomentumManagement.calculateMomentum.mockResolvedValue(expectedMomentum);

      // Act
      const result = await system.calculateMomentum();

      // Assert
      expect(mockMomentumManagement.calculateMomentum).toHaveBeenCalled();
      expect(result).toBe(expectedMomentum);
    });

    test("updateMomentum debe llamar al método correspondiente en MomentumManagement", async () => {
      // Arrange
      mockMomentumManagement.updateMomentum.mockResolvedValue();

      // Act
      await system.updateMomentum();

      // Assert
      expect(mockMomentumManagement.updateMomentum).toHaveBeenCalled();
    });
  });

  // Tests para verificar que el sistema maneja correctamente errores de los módulos
  describe("Error Handling", () => {
    test("debe propagar los errores lanzados por ActivityManagement", async () => {
      // Arrange
      const templateId = "non-existent-template";
      const error = new Error("La plantilla no existe");

      mockActivityManagement.getActivityTemplate.mockRejectedValue(error);

      // Act & Assert
      await expect(system.getActivityTemplate(templateId)).rejects.toThrow(error);
    });

    test("debe propagar los errores lanzados por TimeManagement", async () => {
      // Arrange
      const blockId = "non-existent-block";
      const error = new Error("El bloque no existe");

      mockTimeManagement.removeTimeBlock.mockRejectedValue(error);

      // Act & Assert
      await expect(system.removeTimeBlock(blockId)).rejects.toThrow(error);
    });
  });
});
