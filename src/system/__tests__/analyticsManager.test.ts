import { AnalyticsManager } from "../analyticsManager";
import type {
  UUID,
  AppState,
  ISystemCore,
  ActivityTemplate,
  CompletedActivityRecord,
  Day,
  EventInstance,
  ActivityInstance,
  CurrentDayState,
} from "../../types";

// Mock del SystemCore: solo getState es necesario
const createMockSystemCore = (mockState: AppState): ISystemCore => {
  const mock = {
    getState: jest.fn().mockReturnValue(mockState),
    updateState: jest.fn(),
  };
  return mock as unknown as ISystemCore;
};

const createMockUUID = (id: number): UUID => `mock-uuid-${id}`;

const TODAY = new Date("2023-01-01T08:00:00Z");
const YESTERDAY = new Date("2022-12-31T08:00:00Z");

/**
 * Construye un AppState con datos de ejemplo para los analytics.
 * Schema v2+: sin variables subjetivas ni causas de interrupción.
 */
const createMockState = (includeActiveActivity: boolean = false): AppState => {
  const activityTemplates: ActivityTemplate[] = [
    {
      id: createMockUUID(1),
      title: "Programar",
      description: "Desarrollar código",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
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

  const completedActivityRecords: CompletedActivityRecord[] = [
    {
      id: createMockUUID(401),
      templateId: activityTemplates[0].id,
      templateTitle: activityTemplates[0].title,
      state: "completed",
      type: "clear-objective",
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
      startTime: new Date(TODAY.getTime() + 1 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 60,
      dayId: days[0].id,
      satisfactionScore: 9,
      temposAwarded: 78, // ceil(60 × 9 / 7) = 77.14 → 78
      beatEstimate: true,
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(402),
      templateId: activityTemplates[1].id,
      templateTitle: activityTemplates[1].title,
      state: "interrupted",
      type: "flexible-duration",
      flexibleDurationSettings: { minimumDurationMinutes: 30, maximumDurationMinutes: 90 },
      startTime: new Date(TODAY.getTime() + 2 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 2.25 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 15,
      dayId: days[0].id,
      createdAt: TODAY.toISOString(),
    },
    {
      id: createMockUUID(403),
      templateId: activityTemplates[2].id,
      templateTitle: activityTemplates[2].title,
      state: "completed",
      type: "timeboxing",
      timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 45 },
      startTime: new Date(TODAY.getTime() + 3 * 60 * 60 * 1000).toISOString(),
      endTime: new Date(TODAY.getTime() + 3.5 * 60 * 60 * 1000).toISOString(),
      durationMinutes: 30,
      dayId: days[0].id,
      satisfactionScore: 8,
      temposAwarded: 35, // ceil(30 × 8 / 7) = 34.29 → 35
      beatEstimate: false,
      createdAt: TODAY.toISOString(),
    },
  ];

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
  ];

  const appState: AppState = {
    global: {
      days,
      activityTemplates,
      eventTemplates: [],
      timeBlocks: [],
      userPreferences: {
        dailyTempoTarget: 100,
        updatedAt: TODAY.toISOString(),
      },
      completedActivityRecords,
      eventInstances,
    },
    currentDay: null,
  };

  if (includeActiveActivity) {
    const activeActivityInstance: ActivityInstance = {
      id: createMockUUID(601),
      templateId: activityTemplates[0].id,
      blockId: createMockUUID(701),
      order: 1,
      state: "active",
      startTime: new Date(TODAY.getTime() - 30 * 60 * 1000).toISOString(),
      clearObjectiveSettings: { estimatedDurationMinutes: 60 },
      createdAt: TODAY.toISOString(),
      updatedAt: TODAY.toISOString(),
    };

    const currentDayState: CurrentDayState = {
      day: days[0],
      activityInstances: [activeActivityInstance],
      activeActivityInstanceId: activeActivityInstance.id,
    };

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
    it("devuelve actividades, eventos e interrupciones cuando no se especifica dayId", () => {
      const timelineData = analyticsManager.getTimelineData();

      expect(timelineData.activities).toHaveLength(3);
      expect(timelineData.events).toHaveLength(2);
      expect(timelineData.interruptions).toHaveLength(1);
    });

    it("filtra por día cuando se especifica dayId", () => {
      const todayId = mockState.global.days[0].id;
      const timelineData = analyticsManager.getTimelineData(todayId);

      expect(timelineData.activities.every((a) => a.id !== undefined)).toBe(true);
      // Solo actividades del día actual
      const dayRecords = mockState.global.completedActivityRecords.filter(
        (r) => r.dayId === todayId
      );
      expect(timelineData.activities).toHaveLength(dayRecords.length);
    });

    it("calcula estimatedDuration e isWithinEstimation para actividades clear-objective", () => {
      const timelineData = analyticsManager.getTimelineData();

      const clearObjective = timelineData.activities.find(
        (a) => a.type === "clear-objective" && a.state === "completed"
      );
      expect(clearObjective?.estimatedDuration).toBe(60);
      // 60 min duración vs 60 min estimado => dentro de la estimación
      expect(clearObjective?.isWithinEstimation).toBe(true);
    });

    it("calcula isWithinEstimation=false para actividad flexible fuera de rango", () => {
      const timelineData = analyticsManager.getTimelineData();

      const interruptedFlexible = timelineData.activities.find(
        (a) => a.state === "interrupted" && a.type === "flexible-duration"
      );
      // 15 min contra rango [30,90] => fuera
      expect(interruptedFlexible?.isWithinEstimation).toBe(false);
    });

    it("incluye la actividad activa en el timeline cuando hay día activo", () => {
      const stateWithActive = createMockState(true);
      const manager = new AnalyticsManager(createMockSystemCore(stateWithActive));

      const timelineData = manager.getTimelineData();
      const activeInTimeline = timelineData.activities.find(
        (a) => a.id === stateWithActive.currentDay?.activeActivityInstanceId
      );
      expect(activeInTimeline).toBeDefined();
    });

    it("schema v2+: las interrupciones NO incluyen isAvoidable ni cause", () => {
      const timelineData = analyticsManager.getTimelineData();

      expect(timelineData.interruptions).toHaveLength(1);
      const interruption = timelineData.interruptions[0];
      expect(interruption).not.toHaveProperty("isAvoidable");
      expect(interruption).not.toHaveProperty("cause");
      // Schema v2+: id, activityId, timestamp, position
      expect(interruption).toHaveProperty("id");
      expect(interruption).toHaveProperty("activityId");
      expect(interruption).toHaveProperty("timestamp");
      expect(interruption).toHaveProperty("position");
    });
  });

  describe("getTimeDistributionData", () => {
    it("agrupa actividades por categoría (tipo de actividad)", () => {
      const distribution = analyticsManager.getTimeDistributionData();

      const names = distribution.categories.map((c) => c.name);
      expect(names).toContain("Objetivo Definido");
      expect(names).toContain("Duración Flexible");
      expect(names).toContain("Timeboxing");
    });

    it("calcula porcentajes que suman ~100%", () => {
      const distribution = analyticsManager.getTimeDistributionData();

      const totalPercentage = distribution.categories.reduce((sum, c) => sum + c.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it("filtra por día cuando se especifica dayId", () => {
      const todayId = mockState.global.days[0].id;
      const distribution = analyticsManager.getTimeDistributionData(todayId);

      const totalMinutes = distribution.categories.reduce((s, c) => s + c.totalMinutes, 0);
      expect(totalMinutes).toBe(105); // 60 + 15 + 30
    });
  });

  describe("getActivityStats", () => {
    it("calcula total/completed/interrupted y completionRate", () => {
      const stats = analyticsManager.getActivityStats();

      expect(stats.totalInstances).toBe(3);
      expect(stats.completedInstances).toBe(2);
      expect(stats.interruptedInstances).toBe(1);
      expect(stats.completionRate).toBeCloseTo(66.67, 1);
    });

    it("calcula completionRate=100 cuando todas están completadas", () => {
      const templateId = mockState.global.activityTemplates[0].id;
      const stats = analyticsManager.getActivityStats(templateId);

      expect(stats.totalInstances).toBe(1);
      expect(stats.completedInstances).toBe(1);
      expect(stats.interruptedInstances).toBe(0);
      expect(stats.completionRate).toBe(100);
    });

    it("NO incluye frequentInterruptionCauses en el shape (schema v2+)", () => {
      const stats = analyticsManager.getActivityStats();

      // schema v2+: campo eliminado
      expect(stats).not.toHaveProperty("frequentInterruptionCauses");
    });

    it("calcula estimationAccuracy solo para clear-objective", () => {
      const stats = analyticsManager.getActivityStats();

      // 60/60 estimado => 100%; la otra clear-objective no hay en este mock
      // Igual debe devolver un número definido
      expect(stats.estimationAccuracy).toBeDefined();
    });
  });

  describe("getCompletionRate", () => {
    it("devuelve porcentaje entre 0 y 100", () => {
      const rate = analyticsManager.getCompletionRate();

      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(100);
    });

    it("devuelve 0 cuando no hay actividades", () => {
      const emptyState = createMockState();
      emptyState.global.completedActivityRecords = [];
      const manager = new AnalyticsManager(createMockSystemCore(emptyState));

      expect(manager.getCompletionRate()).toBe(0);
    });
  });

  describe("getEstimationAccuracy", () => {
    it("devuelve 0 cuando no hay actividades con estimación", () => {
      const noEstimation = createMockState();
      noEstimation.global.completedActivityRecords =
        noEstimation.global.completedActivityRecords.map((r) => ({
          ...r,
          clearObjectiveSettings: undefined,
        }));
      const manager = new AnalyticsManager(createMockSystemCore(noEstimation));

      expect(manager.getEstimationAccuracy()).toBe(0);
    });
  });

  describe("getTempoSummary", () => {
    it("suma tempos solo de records completed del día", () => {
      const state = createMockState(true);
      // Override target para controlar el ratio
      state.global.userPreferences.dailyTempoTarget = 100;
      const manager = new AnalyticsManager(createMockSystemCore(state));

      // todayId es el día activo (mockState.global.days[0].id)
      const todayId = state.global.days[0].id;
      const summary = manager.getTempoSummary(todayId);

      // 78 (completed 1: ceil(60 × 9 / 7)) + 35 (completed 3: ceil(30 × 8 / 7)) = 113
      expect(summary.totalTempos).toBe(113);
      expect(summary.completedActivities).toBe(2);
    });

    it("calcula targetProgress sin capear", () => {
      const state = createMockState(true);
      state.global.userPreferences.dailyTempoTarget = 50; // target bajo
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const todayId = state.global.days[0].id;

      const summary = manager.getTempoSummary(todayId);

      // 113 / 50 = 2.26
      expect(summary.targetProgress).toBeCloseTo(2.26, 2);
      // progressBarValue capeado a 100
      expect(summary.progressBarValue).toBe(100);
      // displayPercent: 226% (sin capear)
      expect(summary.displayPercent).toBe(226);
    });

    it("devuelve ceros y lastReward undefined sin actividades", () => {
      const state = createMockState(true);
      state.global.completedActivityRecords = [];
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const todayId = state.global.days[0].id;

      const summary = manager.getTempoSummary(todayId);

      expect(summary.totalTempos).toBe(0);
      expect(summary.completedActivities).toBe(0);
      expect(summary.averageSatisfaction).toBe(0);
      expect(summary.lastReward).toBeUndefined();
    });

    it("lastReward es el último record completed", () => {
      const state = createMockState(true);
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const todayId = state.global.days[0].id;

      const summary = manager.getTempoSummary(todayId);

      // El último record completed en mockState es createMockUUID(403)
      expect(summary.lastReward?.recordId).toBe(createMockUUID(403));
    });
  });

  describe("getTempoTrends", () => {
    it("devuelve un punto por día con totalTempos, targetProgress y avg", () => {
      const state = createMockState();
      // Mantener solo el primer día en el rango y mapear sus records a ese día
      const todayId = state.global.days[0].id;
      state.global.days = [state.global.days[0]];
      state.global.completedActivityRecords = state.global.completedActivityRecords.map((r) => ({
        ...r,
        dayId: todayId,
      }));
      state.global.userPreferences.dailyTempoTarget = 100;
      const manager = new AnalyticsManager(createMockSystemCore(state));

      const trends = manager.getTempoTrends({
        from: YESTERDAY.toISOString(),
        to: TODAY.toISOString(),
      });

      expect(trends.length).toBe(1);
      // 78 (60min × 9/7) + 35 (30min × 8/7) = 113
      expect(trends[0].totalTempos).toBe(113);
      // 113 / 100 = 1.13
      expect(trends[0].targetProgress).toBeCloseTo(1.13, 2);
      // averageSatisfaction = (9 + 8) / 2 = 8.5
      expect(trends[0].averageSatisfaction).toBeCloseTo(8.5, 1);
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
