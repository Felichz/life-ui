import { AnalyticsManager } from "../analyticsManager";
import type {
  UUID,
  AppState,
  ISystemCore,
  ActivityTemplate,
  CompletedActivityRecord,
  Day,
  EventInstance,
  InterruptionCause,
  SubjectiveVariable,
  SubjectiveVariableSnapshot,
  ActivityInstance,
  CurrentDayState,
} from "../../types";

// Mock para systemCore (schema v2: muchos métodos, usamos as unknown as para flexibilidad de tests)
const createMockSystemCore = (mockState: AppState): ISystemCore => {
  const mock = {
    getState: jest.fn().mockReturnValue(mockState),
    updateState: jest.fn(),
  };
  return mock as unknown as ISystemCore;
};

// Funciones auxiliares para crear UUIDs de prueba
const createMockUUID = (id: number): UUID => `mock-uuid-${id}`;

// Fechas de prueba
const TODAY = new Date("2023-01-01T08:00:00Z");
const YESTERDAY = new Date("2022-12-31T08:00:00Z");

// Crear datos de prueba para el estado de la aplicación
const createMockState = (includeActiveActivity: boolean = false): AppState => {
  // Crear plantillas de actividad
  const activityTemplates: ActivityTemplate[] = [
    {
      id: createMockUUID(1),
      title: "Programar",
      description: "Desarrollar código",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
    {
      id: createMockUUID(2),
      title: "Leer documentación",
      description: "Leer documentación técnica",
      type: "flexible-duration",
      isSystemActivity: false,
      flexibleDurationSettings: {
        minimumDurationMinutes: 30,
        maximumDurationMinutes: 90,
      },
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
    {
      id: createMockUUID(3),
      title: "Reunión",
      description: "Reunión de equipo",
      type: "timeboxing",
      isSystemActivity: false,
      timeboxingSettings: {
        type: "maximum-time",
        maximumDurationMinutes: 45,
      },
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear días
  const days: Day[] = [
    {
      id: createMockUUID(100),
      state: "active",
      startTime: TODAY.toISOString(),
      endTime: new Date(TODAY.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      createdAt: TODAY.toISOString(),
      updatedAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(101),
      state: "inactive",
      startTime: YESTERDAY.toISOString(),
      endTime: new Date(YESTERDAY.getTime() + 8 * 60 * 60 * 1000).toISOString(),
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear causas de interrupción
  const interruptionCauses: InterruptionCause[] = [
    {
      id: createMockUUID(201),
      description: "Notificación",
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
    {
      id: createMockUUID(202),
      description: "Interrupción externa",
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear variables subjetivas
  const subjectiveVariables: SubjectiveVariable[] = [
    {
      id: createMockUUID(301),
      name: "Energía",
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
    {
      id: createMockUUID(302),
      name: "Foco",
      createdAt: YESTERDAY.toISOString(),
      updatedAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear actividades completadas
  const completedActivityRecords: CompletedActivityRecord[] = [
    // Día actual - Actividad completada con éxito
    {
      id: createMockUUID(401),
      templateId: activityTemplates[0].id,
      templateTitle: activityTemplates[0].title,
      state: "completed",
      type: "clear-objective",
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
      startTime: new Date(TODAY.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    // Día actual - Actividad interrumpida
    {
      id: createMockUUID(402),
      templateId: activityTemplates[1].id,
      templateTitle: activityTemplates[1].title,
      state: "interrupted",
      type: "flexible-duration",
      flexibleDurationSettings: {
        minimumDurationMinutes: 30,
        maximumDurationMinutes: 90,
      },
      startTime: new Date(TODAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 2.25 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 15,
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    // Día actual - Actividad completada con éxito
    {
      id: createMockUUID(403),
      templateId: activityTemplates[2].id,
      templateTitle: activityTemplates[2].title,
      state: "completed",
      type: "timeboxing",
      timeboxingSettings: {
        type: "maximum-time",
        maximumDurationMinutes: 45,
      },
      startTime: new Date(TODAY.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    // Día anterior - Actividad completada con éxito
    {
      id: createMockUUID(404),
      templateId: activityTemplates[0].id,
      templateTitle: activityTemplates[0].title,
      state: "completed",
      type: "clear-objective",
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
      startTime: new Date(YESTERDAY.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(YESTERDAY.getTime() + 1.75 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 45,
      dayId: days[1].id,
      createdAt: YESTERDAY.toISOString(),
    },
    // Día anterior - Actividad interrumpida
    {
      id: createMockUUID(405),
      templateId: activityTemplates[1].id,
      templateTitle: activityTemplates[1].title,
      state: "interrupted",
      type: "flexible-duration",
      flexibleDurationSettings: {
        minimumDurationMinutes: 30,
        maximumDurationMinutes: 90,
      },
      startTime: new Date(YESTERDAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(YESTERDAY.getTime() + 2.1 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 6,
      dayId: days[1].id,
      createdAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear eventos
  const eventInstances: EventInstance[] = [
    {
      id: createMockUUID(501),
      templateId: createMockUUID(601),
      templateName: "Inicio de sesión",
      timestamp: new Date(TODAY.getTime() + 0.5 * 60 * 60 * 1000).toISOString(),
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(502),
      templateId: createMockUUID(602),
      templateName: "Pausa",
      timestamp: new Date(TODAY.getTime() + 2.5 * 60 * 60 * 1000).toISOString(),
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(503),
      templateId: createMockUUID(601),
      templateName: "Inicio de sesión",
      timestamp: new Date(YESTERDAY.getTime() + 0.25 * 60 * 60 * 1000).toISOString(),
      dayId: days[1].id,
      createdAt: YESTERDAY.toISOString(),
    },
  ];

  // Crear snapshots de variables subjetivas
  const subjectiveVariableSnapshots: SubjectiveVariableSnapshot[] = [
    {
      id: createMockUUID(701),
      timestamp: new Date(TODAY.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      dayId: days[0].id,
      values: [
        {
          variableId: subjectiveVariables[0].id,
          variableName: subjectiveVariables[0].name,
          previousValue: 7,
          currentValue: 8,
        },
        {
          variableId: subjectiveVariables[1].id,
          variableName: subjectiveVariables[1].name,
          previousValue: 6,
          currentValue: 7,
        },
      ],
      relatedActivityIds: [completedActivityRecords[0].id],
      relatedEventIds: [eventInstances[0].id],
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(702),
      timestamp: new Date(TODAY.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      dayId: days[0].id,
      values: [
        {
          variableId: subjectiveVariables[0].id,
          variableName: subjectiveVariables[0].name,
          previousValue: 8,
          currentValue: 6,
        },
        {
          variableId: subjectiveVariables[1].id,
          variableName: subjectiveVariables[1].name,
          previousValue: 7,
          currentValue: 5,
        },
      ],
      relatedActivityIds: [completedActivityRecords[1].id],
      relatedEventIds: [eventInstances[1].id],
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(703),
      timestamp: new Date(YESTERDAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      dayId: days[1].id,
      values: [
        {
          variableId: subjectiveVariables[0].id,
          variableName: subjectiveVariables[0].name,
          previousValue: 5,
          currentValue: 6,
        },
        {
          variableId: subjectiveVariables[1].id,
          variableName: subjectiveVariables[1].name,
          previousValue: 5,
          currentValue: 7,
        },
      ],
      relatedActivityIds: [completedActivityRecords[3].id],
      relatedEventIds: [eventInstances[2].id],
      createdAt: YESTERDAY.toISOString(),
    },
  ];

  // Resultado final
  const appState: AppState = {
    global: {
      days,
      activityTemplates,
      eventTemplates: [],
      subjectiveVariables,
      interruptionCauses,
      timeBlocks: [],
      userPreferences: {
        hiddenSubjectiveVariableIds: [],
        updatedAt: TODAY.toISOString(),
      },
      completedActivityRecords,
      eventInstances,
      subjectiveVariableSnapshots,
    },
    currentDay: null,
  };

  // Si se solicita, añadir un día activo con una actividad activa
  if (includeActiveActivity) {
    // Crear una instancia de actividad activa
    const activeActivityInstance: ActivityInstance = {
      id: createMockUUID(601),
      templateId: activityTemplates[0].id, // Usar la primera plantilla
      blockId: createMockUUID(701), // ID de bloque ficticio
      order: 1,
      state: "active",
      startTime: new Date(TODAY.getTime() - 30 * 60 * 1000).toISOString(), // Empezó hace 30 minutos
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60, // Estimada para 60 minutos
      },
      createdAt: TODAY.toISOString(),
      updatedAt: TODAY.toISOString(),
    };

    // Crear estado del día actual
    const currentDayState: CurrentDayState = {
      day: days[0], // Usar el primer día (hoy)
      activityInstances: [activeActivityInstance],
      activeActivityInstanceId: activeActivityInstance.id,
    };

    // Añadir al estado
    appState.currentDay = currentDayState;
  }

  return appState;
};

describe("AnalyticsManager", () => {
  let mockState: AppState;
  let mockSystemCore: ISystemCore;
  let analyticsManager: AnalyticsManager;

  beforeEach(() => {
    mockState = createMockState();
    mockSystemCore = createMockSystemCore(mockState);
    analyticsManager = new AnalyticsManager(mockSystemCore);
  });

  describe("getTimelineData", () => {
    it("debería devolver todos los datos de timeline cuando no se especifica dayId", () => {
      const timelineData = analyticsManager.getTimelineData();

      // Verificar actividades
      expect(timelineData.activities).toHaveLength(5);

      // Verificar eventos
      expect(timelineData.events).toHaveLength(3);

      // Verificar interrupciones
      expect(timelineData.interruptions).toHaveLength(2);
    });

    it("debería filtrar datos por día cuando se especifica dayId", () => {
      const todayId = mockState.global.days[0].id;
      const timelineData = analyticsManager.getTimelineData(todayId);

      // Verificar que sólo se incluyen actividades del día especificado
      expect(timelineData.activities).toHaveLength(3);
      expect(
        timelineData.activities.every((a) => {
          const activity = mockState.global.completedActivityRecords.find((r) => r.id === a.id);
          return activity?.dayId === todayId;
        })
      ).toBe(true);

      // Verificar eventos del día
      expect(timelineData.events).toHaveLength(2);
      expect(
        timelineData.events.every((e) => {
          const event = mockState.global.eventInstances.find((ev) => ev.id === e.id);
          return event?.dayId === todayId;
        })
      ).toBe(true);

      // Verificar interrupciones del día
      expect(timelineData.interruptions).toHaveLength(1);
    });

    it("debería calcular correctamente las propiedades de estimación para actividades", () => {
      const timelineData = analyticsManager.getTimelineData();

      // Actividad con objetivo claro
      const clearObjectiveActivity = timelineData.activities.find(
        (a) => a.type === "clear-objective" && a.state === "completed"
      );
      expect(clearObjectiveActivity?.estimatedDuration).toBe(60);

      // La actividad flexible interrumpida no debería estar dentro de la estimación
      const interruptedActivity = timelineData.activities.find(
        (a) => a.state === "interrupted" && a.type === "flexible-duration"
      );
      expect(interruptedActivity?.isWithinEstimation).toBe(false);

      // La actividad de timeboxing completada debería estar dentro de la estimación
      const timeboxingActivity = timelineData.activities.find(
        (a) => a.type === "timeboxing" && a.state === "completed"
      );
      expect(timeboxingActivity?.isWithinEstimation).toBe(true);
    });

    it("debería incluir la actividad activa en el timeline cuando hay un día activo", () => {
      // Crear estado con actividad activa
      const stateWithActiveActivity = createMockState(true);
      const coreWithActiveActivity = createMockSystemCore(stateWithActiveActivity);
      const managerWithActiveActivity = new AnalyticsManager(coreWithActiveActivity);

      // Obtener datos del timeline
      const timelineData = managerWithActiveActivity.getTimelineData();

      // Verificar que hay una actividad activa en el timeline
      const activeActivityInTimeline = timelineData.activities.find(
        (a) => a.id === stateWithActiveActivity.currentDay?.activeActivityInstanceId
      );

      expect(activeActivityInTimeline).toBeDefined();

      // Nota: No verificamos la duración exacta porque depende de la hora del sistema
      // al momento de la ejecución del test. Simplemente verificamos que exista.
      if (activeActivityInTimeline) {
        expect(activeActivityInTimeline.durationMinutes).toBeGreaterThan(0);
      }
    });

    it("debería incluir la actividad activa solo cuando el dayId coincide", () => {
      // Crear estado con actividad activa
      const stateWithActiveActivity = createMockState(true);
      const coreWithActiveActivity = createMockSystemCore(stateWithActiveActivity);
      const managerWithActiveActivity = new AnalyticsManager(coreWithActiveActivity);

      // ID del día actual
      const currentDayId = stateWithActiveActivity.currentDay?.day.id;
      expect(currentDayId).toBeDefined();

      // Verificar que la actividad activa aparece cuando se filtra por el día correcto
      const timelineDataForToday = managerWithActiveActivity.getTimelineData(currentDayId);
      expect(
        timelineDataForToday.activities.some(
          (a) => a.id === stateWithActiveActivity.currentDay?.activeActivityInstanceId
        )
      ).toBe(true);

      // Verificar que la actividad activa NO aparece cuando se filtra por otro día
      const yesterdayId = stateWithActiveActivity.global.days[1].id; // El segundo día (ayer)
      const timelineDataForYesterday = managerWithActiveActivity.getTimelineData(yesterdayId);
      expect(
        timelineDataForYesterday.activities.some(
          (a) => a.id === stateWithActiveActivity.currentDay?.activeActivityInstanceId
        )
      ).toBe(false);
    });

    it("debería calcular correctamente el estado de estimación para actividades activas", () => {
      // Crear estado con actividad activa
      const stateWithActiveActivity = createMockState(true);
      const coreWithActiveActivity = createMockSystemCore(stateWithActiveActivity);
      const managerWithActiveActivity = new AnalyticsManager(coreWithActiveActivity);

      // Obtener datos del timeline
      const timelineData = managerWithActiveActivity.getTimelineData();

      // Encontrar la actividad activa en el timeline
      const activeActivityInTimeline = timelineData.activities.find(
        (a) => a.id === stateWithActiveActivity.currentDay?.activeActivityInstanceId
      );

      expect(activeActivityInTimeline).toBeDefined();

      if (activeActivityInTimeline) {
        // Verificar que tiene la información de estimación correcta
        expect(activeActivityInTimeline.estimatedDuration).toBe(60); // Configurado para 60 minutos

        // Nota: No podemos predecir con certeza isWithinEstimation porque depende
        // de la hora del sistema. Solo verificamos que el valor esté definido.
        expect(activeActivityInTimeline.isWithinEstimation !== undefined).toBe(true);
      }
    });
  });

  describe("getTimeDistributionData", () => {
    it("debería agrupar actividades por categoría", () => {
      const distributionData = analyticsManager.getTimeDistributionData();

      // Verificar que hay categorías para cada tipo de actividad
      expect(distributionData.categories.map((c) => c.name)).toContain("Objetivo Definido");
      expect(distributionData.categories.map((c) => c.name)).toContain("Duración Flexible");
      expect(distributionData.categories.map((c) => c.name)).toContain("Timeboxing");

      // Verificar que las categorías contienen las actividades correctas
      const clearObjectiveCategory = distributionData.categories.find(
        (c) => c.name === "Objetivo Definido"
      );
      expect(clearObjectiveCategory?.activities).toHaveLength(2);

      const flexibleCategory = distributionData.categories.find(
        (c) => c.name === "Duración Flexible"
      );
      expect(flexibleCategory?.activities).toHaveLength(2);

      const timeboxingCategory = distributionData.categories.find((c) => c.name === "Timeboxing");
      expect(timeboxingCategory?.activities).toHaveLength(1);
    });

    it("debería calcular correctamente los porcentajes", () => {
      const distributionData = analyticsManager.getTimeDistributionData();

      // Sumar todos los minutos para verificar porcentajes
      const totalMinutes = mockState.global.completedActivityRecords.reduce(
        (sum, record) => sum + record.durationMinutes,
        0
      );

      // Verificar que los porcentajes suman aproximadamente 100%
      const totalPercentage = distributionData.categories.reduce(
        (sum, category) => sum + category.percentage,
        0
      );
      expect(totalPercentage).toBeCloseTo(100, 1);

      // Verificar un porcentaje específico
      const clearObjectiveCategory = distributionData.categories.find(
        (c) => c.name === "Objetivo Definido"
      );
      const expectedPercentage = (105 / totalMinutes) * 100; // 60 + 45 = 105 minutos
      expect(clearObjectiveCategory?.percentage).toBeCloseTo(expectedPercentage, 1);
    });

    it("debería filtrar por día cuando se especifica dayId", () => {
      const todayId = mockState.global.days[0].id;
      const distributionData = analyticsManager.getTimeDistributionData(todayId);

      // Verificar que solo se incluyen actividades de hoy
      const totalActivities = distributionData.categories.reduce(
        (sum, category) => sum + category.activities.length,
        0
      );
      expect(totalActivities).toBe(3);

      // Verificar que las duraciones son correctas
      const totalMinutes = distributionData.categories.reduce(
        (sum, category) => sum + category.totalMinutes,
        0
      );
      expect(totalMinutes).toBe(105); // 60 + 15 + 30 = 105 minutos
    });
  });

  describe("getSubjectiveVariablesData", () => {
    it("debería incluir todas las variables aunque no tengan valores", () => {
      const variablesData = analyticsManager.getSubjectiveVariablesData();

      // Verificar que se incluyen todas las variables
      expect(variablesData.variables).toHaveLength(mockState.global.subjectiveVariables.length);
    });

    it("debería incluir actividades y eventos relacionados con cada valor", () => {
      const variablesData = analyticsManager.getSubjectiveVariablesData();

      // Verificar que la primera variable tiene valores con actividades y eventos relacionados
      const firstVariable = variablesData.variables[0];
      expect(firstVariable.values.some((v) => v.relatedActivities.length > 0)).toBe(true);
      expect(firstVariable.values.some((v) => v.relatedEvents.length > 0)).toBe(true);
    });

    it("debería filtrar por día cuando se especifica dayId", () => {
      const todayId = mockState.global.days[0].id;
      const variablesData = analyticsManager.getSubjectiveVariablesData(todayId);

      // Verificar que solo se incluyen valores de hoy
      const valuesCount = variablesData.variables.reduce(
        (sum, variable) => sum + variable.values.length,
        0
      );
      expect(valuesCount).toBe(4); // 2 variables x 2 snapshots

      // Verificar que el rango de tiempo es correcto
      expect(new Date(variablesData.timeRange.start).getDate()).toBe(TODAY.getDate());
    });
  });

  describe("getActivityStats", () => {
    it("debería calcular estadísticas para todas las actividades", () => {
      const stats = analyticsManager.getActivityStats();

      expect(stats.totalInstances).toBe(5);
      expect(stats.completedInstances).toBe(3);
      expect(stats.interruptedInstances).toBe(2);
      expect(stats.completionRate).toBeCloseTo(60, 1);
    });

    it("debería calcular estadísticas para una actividad específica", () => {
      const templateId = mockState.global.activityTemplates[0].id;
      const stats = analyticsManager.getActivityStats(templateId);

      expect(stats.totalInstances).toBe(2);
      expect(stats.completedInstances).toBe(2);
      expect(stats.interruptedInstances).toBe(0);
      expect(stats.completionRate).toBe(100);

      // Verificar duración promedio
      expect(stats.averageDuration).toBeCloseTo(52.5, 1); // (60 + 45) / 2 = 52.5
    });

    it("debería calcular precisión de estimación para actividades con estimación", () => {
      const templateId = mockState.global.activityTemplates[0].id;
      const stats = analyticsManager.getActivityStats(templateId);

      // Las actividades tienen 60 y 45 minutos con estimación de 60 minutos
      expect(stats.estimationAccuracy).toBeDefined();
      // Calculamos manualmente: ((1 - |60-60|/60) + (1 - |45-60|/60)) / 2 * 100 = (1 + 0.75) / 2 * 100 = 87.5
      expect(stats.estimationAccuracy).toBeCloseTo(87.5, 1);
    });

    it("debería identificar causas frecuentes de interrupción", () => {
      const stats = analyticsManager.getActivityStats();

      // Schema v2+: no hay causas configurables. Todas las interrupciones
      // se agrupan como "Sin clasificar".
      expect(stats.frequentInterruptionCauses).toBeDefined();
      expect(stats.frequentInterruptionCauses?.length).toBe(1);
      expect(stats.frequentInterruptionCauses?.[0].cause).toBe("Sin clasificar");
    });
  });

  describe("getCompletionRate", () => {
    it("debería calcular correctamente la tasa de finalización", () => {
      const rate = analyticsManager.getCompletionRate();

      // 3 completadas de 5 = 60%
      expect(rate).toBeCloseTo(60, 1);
    });
  });

  describe("getInterruptionRate", () => {
    it("debería calcular correctamente la tasa de interrupción", () => {
      const rate = analyticsManager.getInterruptionRate();

      // 2 interrumpidas de 5 = 40%
      expect(rate).toBeCloseTo(40, 1);
    });
  });

  describe("getEstimationAccuracy", () => {
    it("debería calcular correctamente la precisión de estimación", () => {
      const accuracy = analyticsManager.getEstimationAccuracy();

      // Sólo las actividades de "objetivo claro" tienen estimación
      expect(accuracy).toBeGreaterThan(0);
    });
  });

  describe("getInterruptionStats", () => {
    it("debería calcular estadísticas de interrupciones", () => {
      const stats = analyticsManager.getInterruptionStats();

      // Schema v2+: ya no se clasifica evitable/innevitable.
      expect(stats.totalInterruptions).toBe(2);
      expect(stats.avoidableInterruptions).toBe(0);
      expect(stats.unavoidableInterruptions).toBe(2);
      expect(stats.avoidablePercentage).toBe(0);
    });

    it("debería devolver lista vacía de causas (sin clasificación)", () => {
      const stats = analyticsManager.getInterruptionStats();

      // Schema v2+: no hay causas configurables, topCauses queda vacío.
      expect(stats.topCauses).toHaveLength(0);
    });
  });

  // Pruebas para casos límite
  describe("casos límite", () => {
    it("debería manejar correctamente un estado sin actividades", () => {
      // Crear un estado vacío
      const emptyState: AppState = {
        global: {
          days: [],
          activityTemplates: [],
          eventTemplates: [],
          subjectiveVariables: [],
          interruptionCauses: [],
          timeBlocks: [],
          userPreferences: {
            hiddenSubjectiveVariableIds: [],
            updatedAt: new Date().toISOString(),
          },
          completedActivityRecords: [],
          eventInstances: [],
          subjectiveVariableSnapshots: [],
        },
        currentDay: null,
      };

      const emptyCore = createMockSystemCore(emptyState);
      const emptyManager = new AnalyticsManager(emptyCore);

      // Verificar que se manejan los casos vacíos correctamente
      expect(emptyManager.getTimelineData().activities).toHaveLength(0);
      expect(emptyManager.getTimeDistributionData().categories).toHaveLength(0);
      expect(emptyManager.getCompletionRate()).toBe(0);
      expect(emptyManager.getInterruptionRate()).toBe(0);
      expect(emptyManager.getEstimationAccuracy()).toBe(0);
    });

    it("debería manejar correctamente un dayId inexistente", () => {
      const nonExistentDayId = "non-existent-id";

      // Verificar que se devuelven resultados vacíos
      expect(analyticsManager.getTimelineData(nonExistentDayId).activities).toHaveLength(0);
      expect(analyticsManager.getTimeDistributionData(nonExistentDayId).categories).toHaveLength(0);

      const variablesData = analyticsManager.getSubjectiveVariablesData(nonExistentDayId);
      expect(variablesData.variables.every((v) => v.values.length === 0)).toBe(true);
    });

    it("debería manejar correctamente un templateId inexistente", () => {
      const nonExistentTemplateId = "non-existent-template-id";
      const stats = analyticsManager.getActivityStats(nonExistentTemplateId);

      expect(stats.totalInstances).toBe(0);
      expect(stats.completedInstances).toBe(0);
      expect(stats.interruptedInstances).toBe(0);
      expect(stats.completionRate).toBe(0);
    });
  });

  // Schema v2+: tests específicos para tempos
  describe("getTempoSummary", () => {
    const tempoDayId = "tempo-day";
    const otherDayId = "other-day";

    const baseMock = () => {
      const records: CompletedActivityRecord[] = [
        {
          id: "t1",
          activityInstanceId: "i1",
          templateId: "tmpl-1",
          templateTitle: "Leer",
          state: "completed",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
          startTime: TODAY.toISOString(),
          endTime: TODAY.toISOString(),
          durationMinutes: 30,
          dayId: tempoDayId,
          satisfactionScore: 10,
          temposAwarded: 30,
          beatEstimate: false,
          createdAt: TODAY.toISOString(),
        },
        {
          id: "t2",
          activityInstanceId: "i2",
          templateId: "tmpl-2",
          templateTitle: "Ejercicio",
          state: "completed",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 60 },
          startTime: TODAY.toISOString(),
          endTime: TODAY.toISOString(),
          durationMinutes: 60,
          dayId: tempoDayId,
          satisfactionScore: 9,
          temposAwarded: 54,
          beatEstimate: false,
          createdAt: TODAY.toISOString(),
        },
        // Interrumpida: NO cuenta para tempos (pero cuenta como interrupción)
        {
          id: "t3",
          activityInstanceId: "i3",
          templateId: "tmpl-3",
          templateTitle: "Pausa",
          state: "interrupted",
          type: "flexible-duration",
          flexibleDurationSettings: { minimumDurationMinutes: 5, maximumDurationMinutes: 30 },
          startTime: TODAY.toISOString(),
          endTime: TODAY.toISOString(),
          durationMinutes: 10,
          dayId: tempoDayId,
          satisfactionScore: 0,
          temposAwarded: 0,
          beatEstimate: false,
          createdAt: TODAY.toISOString(),
        },
        // Otro día: no debe contar
        {
          id: "t4",
          activityInstanceId: "i4",
          templateId: "tmpl-1",
          templateTitle: "Otro día",
          state: "completed",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
          startTime: YESTERDAY.toISOString(),
          endTime: YESTERDAY.toISOString(),
          durationMinutes: 30,
          dayId: otherDayId,
          satisfactionScore: 10,
          temposAwarded: 30,
          beatEstimate: false,
          createdAt: YESTERDAY.toISOString(),
        },
      ];
      const baseState = createMockState(true);
      baseState.global.completedActivityRecords = records;
      baseState.global.userPreferences.dailyTempoTarget = 100; // target bajo para probar overTarget
      return baseState;
    };

    it("calcula totalTempos sumando solo records del día y completed", () => {
      const state = baseMock();
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      // Solo t1 (30) + t2 (54) = 84. t3 es interrupted (no cuenta), t4 es otro día
      expect(summary.totalTempos).toBe(84);
    });

    it("calcula targetProgress como ratio sin cap", () => {
      const state = baseMock();
      state.global.userPreferences.dailyTempoTarget = 50;
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      // 84 / 50 = 1.68
      expect(summary.targetProgress).toBeCloseTo(1.68, 2);
      // progressBarValue capeado a 100
      expect(summary.progressBarValue).toBe(100);
      // displayPercent: 168%
      expect(summary.displayPercent).toBe(168);
    });

    it("completedActivities cuenta solo completed", () => {
      const state = baseMock();
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      expect(summary.completedActivities).toBe(2); // t1 y t2
    });

    it("averageSatisfaction es el promedio del día", () => {
      const state = baseMock();
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      // Solo completed: (10 + 9) / 2 = 9.5
      expect(summary.averageSatisfaction).toBe(9.5);
    });

    it("lastReward es el último completed", () => {
      const state = baseMock();
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      // El último en la lista es t2 (Ejercicio, 54 tempos)
      expect(summary.lastReward?.activityTitle).toBe("Ejercicio");
      expect(summary.lastReward?.tempos).toBe(54);
    });

    it("devuelve ceros y undefined cuando no hay records", () => {
      const state = createMockState(true);
      state.global.completedActivityRecords = [];
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const summary = manager.getTempoSummary(tempoDayId);

      expect(summary.totalTempos).toBe(0);
      expect(summary.targetProgress).toBe(0);
      expect(summary.progressBarValue).toBe(0);
      expect(summary.displayPercent).toBe(0);
      expect(summary.completedActivities).toBe(0);
      expect(summary.averageSatisfaction).toBe(0);
      expect(summary.lastReward).toBeUndefined();
    });
  });

  describe("getTempoTrends", () => {
    it("devuelve un punto por día con totalTempos, targetProgress y avg", () => {
      const state = createMockState(true);
      state.global.days = [
        {
          id: "d1",
          state: "inactive",
          startTime: YESTERDAY.toISOString(),
          endTime: YESTERDAY.toISOString(),
          createdAt: YESTERDAY.toISOString(),
          updatedAt: YESTERDAY.toISOString(),
        },
        {
          id: "d2",
          state: "inactive",
          startTime: TODAY.toISOString(),
          endTime: TODAY.toISOString(),
          createdAt: TODAY.toISOString(),
          updatedAt: TODAY.toISOString(),
        },
      ];
      state.global.completedActivityRecords = [
        {
          id: "tr1",
          activityInstanceId: "i1",
          templateId: "t1",
          templateTitle: "A",
          state: "completed",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
          startTime: YESTERDAY.toISOString(),
          endTime: YESTERDAY.toISOString(),
          durationMinutes: 30,
          dayId: "d1",
          satisfactionScore: 8,
          temposAwarded: 24,
          beatEstimate: false,
          createdAt: YESTERDAY.toISOString(),
        },
        {
          id: "tr2",
          activityInstanceId: "i2",
          templateId: "t2",
          templateTitle: "B",
          state: "completed",
          type: "clear-objective",
          clearObjectiveSettings: { estimatedDurationMinutes: 60 },
          startTime: TODAY.toISOString(),
          endTime: TODAY.toISOString(),
          durationMinutes: 60,
          dayId: "d2",
          satisfactionScore: 10,
          temposAwarded: 60,
          beatEstimate: false,
          createdAt: TODAY.toISOString(),
        },
      ];
      state.global.userPreferences.dailyTempoTarget = 100;

      const manager = new AnalyticsManager(createMockSystemCore(state));
      const trends = manager.getTempoTrends({
        from: YESTERDAY.toISOString(),
        to: TODAY.toISOString(),
      });

      expect(trends.length).toBe(2);
      expect(trends[0].totalTempos).toBe(24);
      expect(trends[0].targetProgress).toBeCloseTo(0.24, 2);
      expect(trends[0].averageSatisfaction).toBe(8);
      expect(trends[1].totalTempos).toBe(60);
      expect(trends[1].averageSatisfaction).toBe(10);
    });

    it("filtra días fuera del rango", () => {
      const state = createMockState(true);
      state.global.days = [
        {
          id: "d1",
          state: "inactive",
          startTime: new Date("2020-01-01").toISOString(),
          endTime: new Date("2020-01-01").toISOString(),
          createdAt: new Date("2020-01-01").toISOString(),
          updatedAt: new Date("2020-01-01").toISOString(),
        },
      ];
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const trends = manager.getTempoTrends({
        from: YESTERDAY.toISOString(),
        to: TODAY.toISOString(),
      });
      expect(trends.length).toBe(0);
    });
  });
});
