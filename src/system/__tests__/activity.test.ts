import { ActivityManagement } from "../activity";
import type {
  Activity,
  ActivitySatisfaction,
  ActivityType,
  InterruptedActivity,
  SharedState,
} from "../../types";

/**
 * Mock base para el estado compartido
 * Se modificará según sea necesario para cada test específico
 */
const createMockSharedState = (): SharedState => ({
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
});

/**
 * Crear una plantilla de actividad de prueba
 */
const createMockActivityTemplate = (
  templateId: string,
  activityType: ActivityType = "goalOriented"
): Activity => {
  let baseTemplate: Activity;

  if (activityType === "goalOriented") {
    baseTemplate = {
      title: `Template ${templateId}`,
      description: `Test template ${templateId}`,
      type: "goalOriented",
      tags: ["test"],
      iconId: "test-icon",
      templateId,
      status: "todo",
      dynamicProps: {
        estimatedMinutes: 30,
      },
    } as Activity;
  } else if (activityType === "flexibleDuration") {
    baseTemplate = {
      title: `Template ${templateId}`,
      description: `Test template ${templateId}`,
      type: "flexibleDuration",
      tags: ["test"],
      iconId: "test-icon",
      templateId,
      status: "todo",
      dynamicProps: {
        minExpectedMinutes: 15,
        maxExpectedMinutes: 45,
      },
    } as Activity;
  } else {
    baseTemplate = {
      title: `Template ${templateId}`,
      description: `Test template ${templateId}`,
      type: "timeboxed",
      tags: ["test"],
      iconId: "test-icon",
      templateId,
      status: "todo",
      dynamicProps: {
        timeboxConfig: {
          mode: "minimum",
          minimumMinutes: 20,
        },
      },
    } as Activity;
  }

  return baseTemplate;
};

/**
 * Crear una instancia de actividad de prueba
 */
const createMockActivityInstance = (
  templateId: string,
  instanceId: string,
  activityType: ActivityType = "goalOriented"
): Activity => {
  const template = createMockActivityTemplate(templateId, activityType);

  // Crea una copia del template y añade la instancia adecuada según el tipo
  const result = { ...template } as Activity;

  if (activityType === "goalOriented") {
    result.instance = {
      id: instanceId,
    };
  } else if (activityType === "flexibleDuration") {
    result.instance = {
      id: instanceId,
    };
  } else {
    result.instance = {
      id: instanceId,
    };
  }

  return result;
};

describe("ActivityManagement", () => {
  // Test para gestión de plantillas
  describe("Gestión de plantillas de actividades", () => {
    test("createActivityTemplate - debe crear una nueva plantilla de actividad", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityManagement = new ActivityManagement(mockState);
      const newTemplate = createMockActivityTemplate("new-template");

      // Act
      const createdTemplate = await activityManagement.createActivityTemplate(newTemplate);

      // Assert
      expect(createdTemplate).toBeDefined();
      expect(createdTemplate.templateId).toBeDefined();
      expect(createdTemplate.title).toBe(newTemplate.title);
      expect(mockState.activityTemplates[createdTemplate.templateId]).toBeDefined();
      expect(mockState.activityTemplates[createdTemplate.templateId]).toEqual(createdTemplate);
    });

    test("getActivityTemplate - debe obtener una plantilla existente por ID", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "existing-template";
      const existingTemplate = createMockActivityTemplate(templateId);
      mockState.activityTemplates[templateId] = existingTemplate;

      const activityManagement = new ActivityManagement(mockState);

      // Act
      const retrievedTemplate = await activityManagement.getActivityTemplate(templateId);

      // Assert
      expect(retrievedTemplate).toBeDefined();
      expect(retrievedTemplate).toEqual(existingTemplate);
    });

    test("updateActivityTemplate - debe actualizar una plantilla existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-to-update";
      const existingTemplate = createMockActivityTemplate(templateId);
      mockState.activityTemplates[templateId] = existingTemplate;

      const activityManagement = new ActivityManagement(mockState);
      const templateUpdates = {
        id: templateId,
        title: "Título actualizado",
        description: "Descripción actualizada",
      };

      // Act
      await activityManagement.updateActivityTemplate(templateUpdates);

      // Assert
      expect(mockState.activityTemplates[templateId].title).toBe("Título actualizado");
      expect(mockState.activityTemplates[templateId].description).toBe("Descripción actualizada");
      // Verifica que otras propiedades no se modificaron
      expect(mockState.activityTemplates[templateId].tags).toEqual(existingTemplate.tags);
      expect(mockState.activityTemplates[templateId].iconId).toBe(existingTemplate.iconId);
    });

    test("removeActivityTemplate - debe eliminar una plantilla existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-to-remove";
      const existingTemplate = createMockActivityTemplate(templateId);
      mockState.activityTemplates[templateId] = existingTemplate;

      const activityManagement = new ActivityManagement(mockState);

      // Act
      await activityManagement.removeActivityTemplate(templateId);

      // Assert
      expect(mockState.activityTemplates[templateId]).toBeUndefined();
    });
  });

  // Test para gestión de instancias
  describe("Gestión de instancias de actividades", () => {
    test("createActivity - debe crear una nueva instancia de actividad", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-activity";
      const activityTemplate = createMockActivityTemplate(templateId);
      mockState.activityTemplates[templateId] = activityTemplate;

      const activityManagement = new ActivityManagement(mockState);
      const newActivity = {
        ...activityTemplate,
        status: "todo" as const,
      };

      // Act
      const createdActivity = await activityManagement.createActivity(newActivity);

      // Assert
      expect(createdActivity).toBeDefined();
      expect(createdActivity.instance).toBeDefined();
      expect(createdActivity.instance?.id).toBeDefined();
      expect(createdActivity.title).toBe(newActivity.title);
      expect(createdActivity.status).toBe("todo");

      // Verificar que se añadió a las actividades del día
      const activityInState = mockState.currentDay.activityInstances.find(
        (a) => a.instance?.id === createdActivity.instance?.id
      );
      expect(activityInState).toBeDefined();
      expect(activityInState).toEqual(createdActivity);
    });

    test("startActivity - debe iniciar una actividad existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-instance";
      const instanceId = "instance-to-start";
      const activityInstance = createMockActivityInstance(templateId, instanceId);

      mockState.currentDay.activityInstances.push(activityInstance);

      const activityManagement = new ActivityManagement(mockState);
      const startTime = Date.now();

      // Act
      await activityManagement.startActivity(instanceId);

      // Assert
      const updatedActivity = mockState.currentDay.activityInstances.find(
        (a) => a.instance?.id === instanceId
      );

      expect(updatedActivity).toBeDefined();
      expect(updatedActivity?.status).toBe("inProgress");
      expect(updatedActivity?.instance?.startTime).toBeDefined();
      expect(updatedActivity?.instance?.startTime).toBeGreaterThanOrEqual(startTime);
      expect(mockState.activeActivity).toEqual(updatedActivity);
    });

    test("completeActivity - debe completar una actividad en progreso", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-completion";
      const instanceId = "instance-to-complete";
      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Configurar como en progreso
      activityInstance.status = "inProgress";
      if (activityInstance.instance) {
        activityInstance.instance.startTime = Date.now() - 1800000; // Iniciada hace 30 minutos
      }

      mockState.currentDay.activityInstances.push(activityInstance);
      mockState.activeActivity = activityInstance;

      const activityManagement = new ActivityManagement(mockState);

      const satisfactionData: ActivitySatisfaction = {
        activityId: instanceId,
        timestamp: Date.now(),
        satisfactionScore: 8,
        valueScore: 9,
      };

      const completeTime = Date.now();

      // Act
      await activityManagement.completeActivity(instanceId, satisfactionData);

      // Assert
      const completedActivity = mockState.currentDay.activityInstances.find(
        (a) => a.instance?.id === instanceId
      );

      expect(completedActivity).toBeDefined();
      expect(completedActivity?.status).toBe("completed");
      expect(completedActivity?.instance?.endTime).toBeDefined();
      expect(completedActivity?.instance?.endTime).toBeGreaterThanOrEqual(completeTime);
      expect(completedActivity?.instance?.minutes).toBeDefined();

      // Verificar que se añadió la satisfacción al historial
      const satisfactionRecord = mockState.currentDay.dayHistory.satisfactionHistory.find(
        (s) => s.activityId === instanceId
      );
      expect(satisfactionRecord).toBeDefined();
      expect(satisfactionRecord?.satisfactionScore).toBe(8);
      expect(satisfactionRecord?.valueScore).toBe(9);

      // Verificar que se eliminó como actividad activa
      expect(mockState.activeActivity).toBeUndefined();
    });

    test("interruptActivity - debe interrumpir una actividad en progreso", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-interruption";
      const instanceId = "instance-to-interrupt";
      const causeId = "interruption-cause-id";

      // Crear una causa de interrupción
      mockState.interruptionCauses[causeId] = {
        id: causeId,
        title: "Causa de prueba",
        occurrenceCount: 0,
      };

      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Configurar como en progreso
      activityInstance.status = "inProgress";
      if (activityInstance.instance) {
        activityInstance.instance.startTime = Date.now() - 1200000; // Iniciada hace 20 minutos
      }

      mockState.currentDay.activityInstances.push(activityInstance);
      mockState.activeActivity = activityInstance;

      const activityManagement = new ActivityManagement(mockState);

      const interruptionData: Omit<InterruptedActivity, "activityId"> = {
        timestamp: Date.now(),
        causeId: causeId,
        minutesBeforeInterruption: 20,
        notes: "Interrupción de prueba",
      };

      const interruptTime = Date.now();

      // Act
      await activityManagement.interruptActivity(instanceId, interruptionData);

      // Assert
      const interruptedActivity = mockState.currentDay.activityInstances.find(
        (a) => a.instance?.id === instanceId
      );

      expect(interruptedActivity).toBeDefined();
      expect(interruptedActivity?.status).toBe("interrupted");
      expect(interruptedActivity?.instance?.endTime).toBeDefined();
      expect(interruptedActivity?.instance?.endTime).toBeGreaterThanOrEqual(interruptTime);
      expect(interruptedActivity?.instance?.minutes).toBeDefined();
      expect(interruptedActivity?.instance?.minutes).toBeCloseTo(20, 0); // Aproximadamente 20 minutos

      // Verificar que se incrementó el contador de la causa
      expect(mockState.interruptionCauses[causeId].occurrenceCount).toBe(1);

      // Verificar que se añadió la interrupción al historial
      const interruptionRecord = mockState.currentDay.dayHistory.interruptionHistory.find(
        (i) => i.activityId === instanceId
      );
      expect(interruptionRecord).toBeDefined();
      expect(interruptionRecord?.causeId).toBe(causeId);
      expect(interruptionRecord?.minutesBeforeInterruption).toBe(20);
      expect(interruptionRecord?.notes).toBe("Interrupción de prueba");

      // Verificar que se eliminó como actividad activa
      expect(mockState.activeActivity).toBeUndefined();
    });

    // Tests específicos para cada tipo de actividad
    describe("Gestión de actividades con objetivo claro (goalOriented)", () => {
      test("completeActivity - debe calcular correctamente la varianza de tiempo para actividad goalOriented", async () => {
        // Arrange
        const mockState = createMockSharedState();
        const templateId = "goalOriented-template";
        const instanceId = "goalOriented-instance";
        const activityInstance = createMockActivityInstance(templateId, instanceId, "goalOriented");

        // Configurar como en progreso
        activityInstance.status = "inProgress";
        if (activityInstance.instance) {
          activityInstance.instance.startTime = Date.now() - 3600000; // Iniciada hace 60 minutos
        }

        mockState.currentDay.activityInstances.push(activityInstance);
        mockState.activeActivity = activityInstance;

        const activityManagement = new ActivityManagement(mockState);

        // Act
        await activityManagement.completeActivity(instanceId);

        // Assert
        const completedActivity = mockState.currentDay.activityInstances.find(
          (a) => a.instance?.id === instanceId
        ) as Activity;

        expect(completedActivity).toBeDefined();
        expect(completedActivity.status).toBe("completed");
        expect(completedActivity.instance).toBeDefined();

        // Verificar que se calcularon correctamente las métricas específicas de goalOriented
        if (completedActivity.type === "goalOriented" && completedActivity.instance) {
          expect(completedActivity.instance.actualMinutes).toBeDefined();
          expect(completedActivity.instance.actualMinutes).toBeCloseTo(60, 0);
          expect(completedActivity.instance.timeVariance).toBeDefined();
          expect(completedActivity.instance.timeVariance).toBeCloseTo(30, 0); // 60 real - 30 estimado
        }
      });
    });

    describe("Gestión de actividades de duración flexible (flexibleDuration)", () => {
      test("completeActivity - debe determinar correctamente si una actividad está dentro del rango esperado", async () => {
        // Arrange
        const mockState = createMockSharedState();
        const templateId = "flexibleDuration-template";
        const instanceId = "flexibleDuration-instance";
        const activityInstance = createMockActivityInstance(
          templateId,
          instanceId,
          "flexibleDuration"
        );

        // Configurar como en progreso
        activityInstance.status = "inProgress";
        if (activityInstance.instance) {
          activityInstance.instance.startTime = Date.now() - 1800000; // Iniciada hace 30 minutos
        }

        mockState.currentDay.activityInstances.push(activityInstance);
        mockState.activeActivity = activityInstance;

        const activityManagement = new ActivityManagement(mockState);

        // Act
        await activityManagement.completeActivity(instanceId);

        // Assert
        const completedActivity = mockState.currentDay.activityInstances.find(
          (a) => a.instance?.id === instanceId
        ) as Activity;

        expect(completedActivity).toBeDefined();
        expect(completedActivity.status).toBe("completed");
        expect(completedActivity.instance).toBeDefined();

        // Verificar que se calcularon correctamente las métricas específicas de flexibleDuration
        if (completedActivity.type === "flexibleDuration" && completedActivity.instance) {
          expect(completedActivity.instance.actualMinutes).toBeDefined();
          expect(completedActivity.instance.actualMinutes).toBeCloseTo(30, 0);
          expect(completedActivity.instance.withinExpectedRange).toBeDefined();
          expect(completedActivity.instance.withinExpectedRange).toBe(true); // 30 está entre 15-45
        }
      });
    });

    describe("Gestión de actividades con timeboxing", () => {
      test("completeActivity - debe evaluar correctamente los requisitos de tiempo mínimo", async () => {
        // Arrange
        const mockState = createMockSharedState();
        const templateId = "timeboxed-template";
        const instanceId = "timeboxed-instance";
        const activityInstance = createMockActivityInstance(templateId, instanceId, "timeboxed");

        // Configurar como en progreso
        activityInstance.status = "inProgress";
        if (activityInstance.instance) {
          activityInstance.instance.startTime = Date.now() - 1500000; // Iniciada hace 25 minutos
        }

        mockState.currentDay.activityInstances.push(activityInstance);
        mockState.activeActivity = activityInstance;

        const activityManagement = new ActivityManagement(mockState);

        // Act
        await activityManagement.completeActivity(instanceId);

        // Assert
        const completedActivity = mockState.currentDay.activityInstances.find(
          (a) => a.instance?.id === instanceId
        ) as Activity;

        expect(completedActivity).toBeDefined();
        expect(completedActivity.status).toBe("completed");
        expect(completedActivity.instance).toBeDefined();

        // Verificar que se calcularon correctamente las métricas específicas de timeboxed
        if (completedActivity.type === "timeboxed" && completedActivity.instance) {
          expect(completedActivity.instance.actualMinutes).toBeDefined();
          expect(completedActivity.instance.actualMinutes).toBeCloseTo(25, 0);
          expect(completedActivity.instance.metMinimumRequirement).toBeDefined();
          expect(completedActivity.instance.metMinimumRequirement).toBe(true); // 25 > 20 min
        }
      });
    });
  });

  // Tests para validación y manejo de errores
  describe("Validación y manejo de errores", () => {
    test("getActivityTemplate - debe devolver undefined para un ID inexistente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityManagement = new ActivityManagement(mockState);
      const nonExistentId = "non-existent-template";

      // Act
      const result = await activityManagement.getActivityTemplate(nonExistentId);

      // Assert
      expect(result).toBeUndefined();
    });

    test("updateActivityTemplate - debe rechazar actualizaciones para plantillas inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityManagement = new ActivityManagement(mockState);
      const nonExistentId = "non-existent-template";
      const templateUpdates = {
        id: nonExistentId,
        title: "Título actualizado",
      };

      // Act & Assert
      await expect(activityManagement.updateActivityTemplate(templateUpdates)).rejects.toThrow(
        /no existe/i
      );
    });

    test("startActivity - debe rechazar iniciar una actividad inexistente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const activityManagement = new ActivityManagement(mockState);
      const nonExistentId = "non-existent-activity";

      // Act & Assert
      await expect(activityManagement.startActivity(nonExistentId)).rejects.toThrow(/no existe/i);
    });

    test("startActivity - debe rechazar iniciar una actividad que ya está en progreso", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-already-started";
      const instanceId = "already-started-instance";
      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Ya está en progreso
      activityInstance.status = "inProgress";
      if (activityInstance.instance) {
        activityInstance.instance.startTime = Date.now() - 600000; // Iniciada hace 10 minutos
      }

      mockState.currentDay.activityInstances.push(activityInstance);
      mockState.activeActivity = activityInstance;

      const activityManagement = new ActivityManagement(mockState);

      // Act & Assert
      await expect(activityManagement.startActivity(instanceId)).rejects.toThrow(
        /ya está en progreso/i
      );
    });

    test("completeActivity - debe rechazar completar una actividad que no está en progreso", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-not-started";
      const instanceId = "not-started-instance";
      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Está en estado "todo", no "inProgress"
      activityInstance.status = "todo";

      mockState.currentDay.activityInstances.push(activityInstance);

      const activityManagement = new ActivityManagement(mockState);

      // Act & Assert
      await expect(activityManagement.completeActivity(instanceId)).rejects.toThrow(
        /no está en progreso/i
      );
    });

    test("interruptActivity - debe rechazar interrumpir una actividad que no está en progreso", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-not-started-interruption";
      const instanceId = "not-started-interruption-instance";
      const causeId = "interruption-cause-id";

      // Crear una causa de interrupción
      mockState.interruptionCauses[causeId] = {
        id: causeId,
        title: "Causa de prueba",
        occurrenceCount: 0,
      };

      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Está en estado "todo", no "inProgress"
      activityInstance.status = "todo";

      mockState.currentDay.activityInstances.push(activityInstance);

      const activityManagement = new ActivityManagement(mockState);

      const interruptionData: Omit<InterruptedActivity, "activityId"> = {
        timestamp: Date.now(),
        causeId: causeId,
        minutesBeforeInterruption: 20,
        notes: "Interrupción de prueba",
      };

      // Act & Assert
      await expect(
        activityManagement.interruptActivity(instanceId, interruptionData)
      ).rejects.toThrow(/no está en progreso/i);
    });

    test("interruptActivity - debe rechazar interrupciones con causas inexistentes", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const templateId = "template-for-invalid-cause";
      const instanceId = "invalid-cause-instance";
      const invalidCauseId = "non-existent-cause-id";

      const activityInstance = createMockActivityInstance(templateId, instanceId);

      // Configurar como en progreso
      activityInstance.status = "inProgress";
      if (activityInstance.instance) {
        activityInstance.instance.startTime = Date.now() - 1200000; // Iniciada hace 20 minutos
      }

      mockState.currentDay.activityInstances.push(activityInstance);
      mockState.activeActivity = activityInstance;

      const activityManagement = new ActivityManagement(mockState);

      const interruptionData: Omit<InterruptedActivity, "activityId"> = {
        timestamp: Date.now(),
        causeId: invalidCauseId, // Causa inexistente
        minutesBeforeInterruption: 20,
        notes: "Interrupción de prueba",
      };

      // Act & Assert
      await expect(
        activityManagement.interruptActivity(instanceId, interruptionData)
      ).rejects.toThrow(/causa de interrupción.*no existe/i);
    });
  });
});
