import { TimeManagement } from "../time";
import type { Activity, TimeBlock, BlockId, SharedState } from "../../types";

// Extender el tipo SharedState para los tests
interface MockSharedState extends SharedState {
  timeBlocks: Record<BlockId, TimeBlock>;
}

/**
 * Mock base para el estado compartido
 * Se modificará según sea necesario para cada test específico
 */
const createMockSharedState = (): MockSharedState => ({
  currentDay: {
    startDate: Date.now() - 3600000, // 1 hora atrás
    endDate: Date.now() + 82800000, // 23 horas adelante
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
    daySummary: {
      activitiesCompleted: 0,
      activitiesInterrupted: 0,
      completionRate: 0,
      averageSatisfaction: 0,
      averageValuePerception: 0,
      timeDistribution: {
        objective: 0,
        flexible: 0,
        timebox: 0,
        autopilot: 0,
        consciousRest: 0,
        meditation: 0,
      },
      overallMomentumQuality: 0,
    },
  },
  activeActivity: undefined,
  activityTemplates: {},
  customVariables: {},
  interruptionCauses: {},
  discreteEvents: {},
  userSettings: {
    theme: "light",
    kanbanState: {},
    enableTimeboxNotifications: true,
    displaySettings: {
      showMomentumChart: true,
      defaultVisibleVariables: [],
    },
  },
  lastUpdateTimestamp: Date.now(),
  // Añadimos timeBlocks para los tests
  timeBlocks: {},
});

/**
 * Crear un bloque de tiempo de prueba
 */
const createMockTimeBlock = (
  id: string,
  startMinute: number = 480, // 8:00 AM
  endMinute: number = 540, // 9:00 AM
  title: string = `Block ${id}`
): TimeBlock => {
  return {
    id,
    title,
    startMinute,
    endMinute,
    activityInstances: [],
    color: "#4285F4",
  };
};

/**
 * Crear una actividad de prueba para los timeboxes
 */
const createMockTimeboxedActivity = (id: string): Activity => {
  return {
    templateId: `template-${id}`,
    title: `Activity ${id}`,
    description: `Test activity ${id}`,
    type: "timeboxed" as const,
    tags: ["test"],
    iconId: "test-icon",
    status: "inProgress",
    dynamicProps: {
      timeboxConfig: {
        mode: "minimum",
        minimumMinutes: 20,
      },
    },
    instance: {
      id,
      startTime: Date.now() - 15 * 60 * 1000, // Iniciada hace 15 minutos
    },
  } as Activity;
};

describe("TimeManagement", () => {
  // Test para gestión de bloques de tiempo
  describe("Gestión de bloques de tiempo", () => {
    test("createTimeBlock - debe crear un nuevo bloque de tiempo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const timeManagement = new TimeManagement(mockState);
      const newBlock = {
        title: "Mañana",
        startMinute: 480, // 8:00 AM
        endMinute: 720, // 12:00 PM
        activityInstances: [],
        color: "#4285F4",
      };

      // Act
      const createdBlock = await timeManagement.createTimeBlock(newBlock);

      // Assert
      expect(createdBlock).toBeDefined();
      expect(createdBlock.id).toBeDefined();
      expect(createdBlock.title).toBe(newBlock.title);
      // La implementación debería almacenar el bloque en el estado, podríamos verificarlo
      // cuando se implemente esta funcionalidad
    });

    test("updateTimeBlock - debe actualizar un bloque de tiempo existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const blockId = "block-to-update";
      const existingBlock = createMockTimeBlock(blockId);
      // Aquí asumimos que habrá un lugar en el estado para almacenar los bloques
      // Esto requerirá ajustes una vez se defina la estructura exacta
      mockState.timeBlocks = {
        [blockId]: existingBlock,
      };

      const timeManagement = new TimeManagement(mockState);
      const blockUpdates = {
        id: blockId,
        title: "Tarde",
        startMinute: 720, // 12:00 PM
        endMinute: 1080, // 18:00 PM
      };

      // Act
      await timeManagement.updateTimeBlock(blockUpdates);

      // Assert
      expect(mockState.timeBlocks[blockId].title).toBe("Tarde");
      expect(mockState.timeBlocks[blockId].startMinute).toBe(720);
      expect(mockState.timeBlocks[blockId].endMinute).toBe(1080);
      // Verificamos que otras propiedades no se modificaron
      expect(mockState.timeBlocks[blockId].color).toBe(existingBlock.color);
    });

    test("removeTimeBlock - debe eliminar un bloque de tiempo existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const blockId = "block-to-remove";
      const existingBlock = createMockTimeBlock(blockId);
      // Asumimos estructura de estado para bloques
      mockState.timeBlocks = {
        [blockId]: existingBlock,
      };

      const timeManagement = new TimeManagement(mockState);

      // Act
      await timeManagement.removeTimeBlock(blockId);

      // Assert
      expect(mockState.timeBlocks[blockId]).toBeUndefined();
    });

    test("getCurrentBlock - debe obtener el bloque de tiempo actual basado en la hora", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const currentTime = new Date();
      const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes();

      // Creamos tres bloques: uno pasado, uno actual y uno futuro
      const pastBlockId = "past-block";
      const currentBlockId = "current-block";
      const futureBlockId = "future-block";

      const pastBlock = createMockTimeBlock(pastBlockId, currentMinute - 120, currentMinute - 60);
      const currentBlock = createMockTimeBlock(
        currentBlockId,
        currentMinute - 30,
        currentMinute + 30
      );
      const futureBlock = createMockTimeBlock(
        futureBlockId,
        currentMinute + 60,
        currentMinute + 120
      );

      // Asumimos estructura de estado para bloques
      mockState.timeBlocks = {
        [pastBlockId]: pastBlock,
        [currentBlockId]: currentBlock,
        [futureBlockId]: futureBlock,
      };

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.getCurrentBlock();

      // Assert
      expect(result).toBeDefined();
      expect(result?.id).toBe(currentBlockId);
    });
  });

  // Test para funcionalidades de timeboxing
  describe("Funcionalidades de timeboxing", () => {
    test("validateTimeboxLimits - debe validar correctamente una actividad que cumple con el tiempo mínimo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-minimum-met";
      const activity = createMockTimeboxedActivity(activityId);

      // Aseguramos que el tipo y las propiedades sean correctas
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "minimum",
          minimumMinutes: 10,
        };
      }

      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.validateTimeboxLimits(activity);

      // Assert
      expect(result).toBe(true);
    });

    test("validateTimeboxLimits - debe validar correctamente una actividad que no cumple con el tiempo mínimo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-minimum-not-met";
      const activity = createMockTimeboxedActivity(activityId);

      // Aseguramos que el tipo y las propiedades sean correctas
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "minimum",
          minimumMinutes: 30,
        };
      }

      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.validateTimeboxLimits(activity);

      // Assert
      expect(result).toBe(false);
    });

    test("validateTimeboxLimits - debe validar correctamente una actividad que está dentro del límite máximo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-maximum-not-exceeded";
      const activity = createMockTimeboxedActivity(activityId);

      // Aseguramos que el tipo y las propiedades sean correctas
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "maximum",
          maximumMinutes: 20,
        };
      }

      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.validateTimeboxLimits(activity);

      // Assert
      expect(result).toBe(true);
    });

    test("validateTimeboxLimits - debe validar correctamente una actividad que excede el límite máximo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-maximum-exceeded";
      const activity = createMockTimeboxedActivity(activityId);

      // Aseguramos que el tipo y las propiedades sean correctas
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "maximum",
          maximumMinutes: 10,
        };
      }

      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.validateTimeboxLimits(activity);

      // Assert
      expect(result).toBe(false);
    });

    test("validateTimeboxLimits - debe validar correctamente una actividad dentro de un rango de tiempo", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-range-valid";
      const activity = createMockTimeboxedActivity(activityId);

      // Aseguramos que el tipo y las propiedades sean correctas
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "range",
          minimumMinutes: 10,
          maximumMinutes: 20,
        };
      }

      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000; // 15 minutos atrás
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const result = await timeManagement.validateTimeboxLimits(activity);

      // Assert
      expect(result).toBe(true);
    });

    test("calculateTimeSpent - debe calcular correctamente el tiempo empleado en una actividad", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-for-time-calculation";
      const activity = createMockTimeboxedActivity(activityId);

      // La actividad se inició hace 15 minutos
      if (activity.instance) {
        activity.instance.startTime = Date.now() - 15 * 60 * 1000;
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act
      const timeSpent = await timeManagement.calculateTimeSpent(activityId);

      // Assert
      expect(timeSpent).toBeCloseTo(15, 0); // Aproximadamente 15 minutos
    });

    test("notifyTimeboxEnd - debe notificar adecuadamente cuando finaliza un timebox", async () => {
      // Arrange
      const mockState = createMockSharedState();
      mockState.userSettings.enableTimeboxNotifications = true;

      const activityId = "activity-for-notification";
      const activity = createMockTimeboxedActivity(activityId);

      // Configuramos un timebox de mínimo 20 minutos
      if (activity.type === "timeboxed") {
        activity.dynamicProps.timeboxConfig = {
          mode: "minimum",
          minimumMinutes: 20,
        };
      }

      // Pero la actividad lleva más de 20 minutos
      if (activity.instance) {
        activity.instance.startTime = Date.now() - 25 * 60 * 1000;
      }

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      // Mock para el sistema de notificaciones (podría implementarse en la clase real)
      let notificationSent = false;
      const notificationSystem = {
        sendNotification: () => {
          notificationSent = true;
        },
      };

      const timeManagement = new TimeManagement(mockState, notificationSystem);

      // Act
      await timeManagement.notifyTimeboxEnd(activityId);

      // Assert
      expect(notificationSent).toBe(true);
    });
  });

  // Tests para validación y manejo de errores
  describe("Validación y manejo de errores", () => {
    test("updateTimeBlock - debe rechazar actualizaciones para bloques inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      mockState.timeBlocks = {};

      const timeManagement = new TimeManagement(mockState);
      const nonExistentId = "non-existent-block";
      const blockUpdates = {
        id: nonExistentId,
        title: "Título actualizado",
      };

      // Act & Assert
      await expect(timeManagement.updateTimeBlock(blockUpdates)).rejects.toThrow(/no existe/i);
    });

    test("removeTimeBlock - debe rechazar eliminaciones para bloques inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      mockState.timeBlocks = {};

      const timeManagement = new TimeManagement(mockState);
      const nonExistentId = "non-existent-block";

      // Act & Assert
      await expect(timeManagement.removeTimeBlock(nonExistentId)).rejects.toThrow(/no existe/i);
    });

    test("validateTimeboxLimits - debe manejar actividades que no son timeboxed", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activity = {
        templateId: "non-timeboxed-template",
        title: "Non-timeboxed Activity",
        type: "goalOriented" as const,
        tags: ["test"],
        iconId: "test-icon",
        status: "inProgress",
        dynamicProps: {
          estimatedMinutes: 30,
        },
        instance: {
          id: "non-timeboxed-activity",
          startTime: Date.now() - 15 * 60 * 1000,
        },
      } as Activity;

      mockState.activeActivity = activity;
      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act & Assert
      await expect(timeManagement.validateTimeboxLimits(activity)).rejects.toThrow(
        /no es una actividad timeboxed/i
      );
    });

    test("calculateTimeSpent - debe rechazar actividades inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const timeManagement = new TimeManagement(mockState);
      const nonExistentId = "non-existent-activity";

      // Act & Assert
      await expect(timeManagement.calculateTimeSpent(nonExistentId)).rejects.toThrow(/no existe/i);
    });

    test("calculateTimeSpent - debe manejar actividades sin tiempo de inicio", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityId = "activity-without-start-time";
      const activity = createMockTimeboxedActivity(activityId);

      // Eliminamos el tiempo de inicio
      if (activity.instance) {
        activity.instance.startTime = undefined;
      }

      mockState.currentDay.activityInstances.push(activity);

      const timeManagement = new TimeManagement(mockState);

      // Act & Assert
      await expect(timeManagement.calculateTimeSpent(activityId)).rejects.toThrow(
        /no tiene tiempo de inicio/i
      );
    });

    test("notifyTimeboxEnd - debe rechazar notificaciones para actividades inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const timeManagement = new TimeManagement(mockState);
      const nonExistentId = "non-existent-activity";

      // Act & Assert
      await expect(timeManagement.notifyTimeboxEnd(nonExistentId)).rejects.toThrow(/no existe/i);
    });
  });
});
