import { EventManagement } from "../events";
import type {
  DiscreteEvent,
  EventId,
  EventTemplateId,
  InterruptionCause,
  InterruptionCauseId,
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
 * Crear una plantilla de evento discreto de prueba
 */
const createMockEventTemplate = (templateId: EventTemplateId): DiscreteEvent => ({
  templateId,
  title: `Event Template ${templateId}`,
  description: `Test event template ${templateId}`,
  tags: ["test", "event"],
  iconId: "event-icon",
});

/**
 * Crear una instancia de evento discreto de prueba
 */
const createMockEventInstance = (templateId: EventTemplateId, eventId: EventId): DiscreteEvent => {
  const template = createMockEventTemplate(templateId);
  return {
    ...template,
    instance: {
      id: eventId,
      timestamp: Date.now(),
    },
  };
};

/**
 * Crear una causa de interrupción de prueba
 */
const createMockInterruptionCause = (causeId: InterruptionCauseId): InterruptionCause => ({
  id: causeId,
  title: `Interruption Cause ${causeId}`,
  occurrenceCount: 0,
});

describe("EventManagement", () => {
  // Test para gestión de eventos discretos
  describe("Gestión de eventos discretos", () => {
    test("createEvent - debe crear un nuevo evento discreto", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);
      const templateId = "event-template-1";
      const newEvent = createMockEventTemplate(templateId);

      // Act
      const createdEvent = await eventManagement.createEvent(newEvent);

      // Assert
      expect(createdEvent).toBeDefined();
      expect(createdEvent.templateId).toBe(templateId);
      expect(createdEvent.title).toBe(newEvent.title);
      expect(createdEvent.instance).toBeDefined();
      expect(createdEvent.instance?.id).toBeDefined();
      expect(createdEvent.instance?.timestamp).toBeDefined();
      expect(mockState.currentDay.dayHistory.eventHistory).toContainEqual(createdEvent);
      expect(mockState.discreteEvents[templateId]).toBeDefined();
    });

    test("getEvents - debe obtener eventos en un rango de fechas", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const now = Date.now();
      const yesterdayEvent = createMockEventInstance("event-1", "instance-1");
      const todayEvent = createMockEventInstance("event-2", "instance-2");
      const tomorrowEvent = createMockEventInstance("event-3", "instance-3");

      // Configura las fechas para cada evento
      if (yesterdayEvent.instance) {
        yesterdayEvent.instance.timestamp = now - 86400000; // Ayer
      }
      if (todayEvent.instance) {
        todayEvent.instance.timestamp = now; // Hoy
      }
      if (tomorrowEvent.instance) {
        tomorrowEvent.instance.timestamp = now + 86400000; // Mañana
      }

      // Añade los eventos al historial
      mockState.currentDay.dayHistory.eventHistory = [yesterdayEvent, todayEvent, tomorrowEvent];

      // Act
      const events = await eventManagement.getEvents(now - 43200000, now + 43200000); // +/- 12 horas

      // Assert
      expect(events).toBeDefined();
      expect(events.length).toBe(1);
      expect(events[0].instance?.id).toBe("instance-2");
    });

    test("getEventById - debe obtener un evento por su ID", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const eventId = "specific-event-id";
      const event = createMockEventInstance("event-template", eventId);

      // Añade el evento al historial
      mockState.currentDay.dayHistory.eventHistory = [event];

      // Act
      const retrievedEvent = await eventManagement.getEventById(eventId);

      // Assert
      expect(retrievedEvent).toBeDefined();
      expect(retrievedEvent?.instance?.id).toBe(eventId);
      expect(retrievedEvent).toEqual(event);
    });

    test("updateEvent - debe actualizar un evento existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const eventId = "event-to-update";
      const event = createMockEventInstance("event-template", eventId);

      // Añade el evento al historial
      mockState.currentDay.dayHistory.eventHistory = [event];

      const eventUpdates = {
        id: eventId,
        title: "Título actualizado",
        description: "Descripción actualizada",
      };

      // Act
      await eventManagement.updateEvent(eventUpdates);

      // Assert
      const updatedEvent = mockState.currentDay.dayHistory.eventHistory.find(
        (e) => e.instance?.id === eventId
      );
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent?.title).toBe("Título actualizado");
      expect(updatedEvent?.description).toBe("Descripción actualizada");
      // Verifica que otras propiedades no se modificaron
      expect(updatedEvent?.tags).toEqual(event.tags);
      expect(updatedEvent?.iconId).toBe(event.iconId);
    });

    test("removeEvent - debe eliminar un evento existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const eventId = "event-to-remove";
      const event = createMockEventInstance("event-template", eventId);

      // Añade el evento al historial
      mockState.currentDay.dayHistory.eventHistory = [
        event,
        createMockEventInstance("other-template", "other-event"),
      ];

      // Act
      await eventManagement.removeEvent(eventId);

      // Assert
      expect(
        mockState.currentDay.dayHistory.eventHistory.find((e) => e.instance?.id === eventId)
      ).toBeUndefined();
      expect(mockState.currentDay.dayHistory.eventHistory.length).toBe(1);
    });
  });

  // Test para gestión de causas de interrupción
  describe("Gestión de causas de interrupción", () => {
    test("createInterruptionCause - debe crear una nueva causa de interrupción", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const newCause = {
        title: "Distracción por notificaciones",
        occurrenceCount: 0,
      };

      // Act
      const createdCause = await eventManagement.createInterruptionCause(newCause);

      // Assert
      expect(createdCause).toBeDefined();
      expect(createdCause.id).toBeDefined();
      expect(createdCause.title).toBe(newCause.title);
      expect(createdCause.occurrenceCount).toBe(0);
      expect(mockState.interruptionCauses[createdCause.id]).toBeDefined();
      expect(mockState.interruptionCauses[createdCause.id]).toEqual(createdCause);
    });

    test("getInterruptionCause - debe obtener una causa de interrupción por ID", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const causeId = "existing-cause";
      const existingCause = createMockInterruptionCause(causeId);

      // Añade la causa al estado
      mockState.interruptionCauses[causeId] = existingCause;

      // Act
      const retrievedCause = await eventManagement.getInterruptionCause(causeId);

      // Assert
      expect(retrievedCause).toBeDefined();
      expect(retrievedCause).toEqual(existingCause);
    });

    test("getInterruptionCauses - debe obtener todas las causas de interrupción", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      // Añade varias causas al estado
      const cause1 = createMockInterruptionCause("cause-1");
      const cause2 = createMockInterruptionCause("cause-2");
      const cause3 = createMockInterruptionCause("cause-3");

      mockState.interruptionCauses = {
        "cause-1": cause1,
        "cause-2": cause2,
        "cause-3": cause3,
      };

      // Act
      const causes = await eventManagement.getInterruptionCauses();

      // Assert
      expect(causes).toBeDefined();
      expect(causes.length).toBe(3);
      expect(causes).toContainEqual(cause1);
      expect(causes).toContainEqual(cause2);
      expect(causes).toContainEqual(cause3);
    });

    test("updateInterruptionCause - debe actualizar una causa de interrupción existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const causeId = "cause-to-update";
      const existingCause = createMockInterruptionCause(causeId);

      // Añade la causa al estado
      mockState.interruptionCauses[causeId] = existingCause;

      const causeUpdates = {
        id: causeId,
        title: "Título actualizado",
        occurrenceCount: 5,
      };

      // Act
      await eventManagement.updateInterruptionCause(causeUpdates);

      // Assert
      expect(mockState.interruptionCauses[causeId].title).toBe("Título actualizado");
      expect(mockState.interruptionCauses[causeId].occurrenceCount).toBe(5);
    });

    test("removeInterruptionCause - debe eliminar una causa de interrupción existente", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const eventManagement = new EventManagement(mockState);

      const causeId = "cause-to-remove";
      const existingCause = createMockInterruptionCause(causeId);

      // Añade la causa al estado y otra causa adicional
      mockState.interruptionCauses = {
        [causeId]: existingCause,
        "other-cause": createMockInterruptionCause("other-cause"),
      };

      // Act
      await eventManagement.removeInterruptionCause(causeId);

      // Assert
      expect(mockState.interruptionCauses[causeId]).toBeUndefined();
      expect(Object.keys(mockState.interruptionCauses).length).toBe(1);
      expect(mockState.interruptionCauses["other-cause"]).toBeDefined();
    });
  });
});
