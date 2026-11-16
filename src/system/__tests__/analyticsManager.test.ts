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

// SystemCore mock: only getState is needed
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
 * Builds an AppState with sample data for the analytics.
 * Schema v2+: no subjective variables or interruption causes.
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
    it("returns activities, events and interruptions when no dayId is specified", () => {
      const timelineData = analyticsManager.getTimelineData();

      expect(timelineData.activities).toHaveLength(3);
      expect(timelineData.events).toHaveLength(2);
      expect(timelineData.interruptions).toHaveLength(1);
    });

    it("filters by day when dayId is specified", () => {
      const todayId = mockState.global.days[0].id;
      const timelineData = analyticsManager.getTimelineData(todayId);

      expect(timelineData.activities.every((a) => a.id !== undefined)).toBe(true);
      // Only activities from the current day
      const dayRecords = mockState.global.completedActivityRecords.filter(
        (r) => r.dayId === todayId
      );
      expect(timelineData.activities).toHaveLength(dayRecords.length);
    });

    it("computes estimatedDuration and isWithinEstimation for clear-objective activities", () => {
      const timelineData = analyticsManager.getTimelineData();

      const clearObjective = timelineData.activities.find(
        (a) => a.type === "clear-objective" && a.state === "completed"
      );
      expect(clearObjective?.estimatedDuration).toBe(60);
      // 60 min duration vs 60 min estimate => within the estimate
      expect(clearObjective?.isWithinEstimation).toBe(true);
    });

    it("computes isWithinEstimation=false for an out-of-range flexible activity", () => {
      const timelineData = analyticsManager.getTimelineData();

      const interruptedFlexible = timelineData.activities.find(
        (a) => a.state === "interrupted" && a.type === "flexible-duration"
      );
      // 15 min against range [30,90] => outside
      expect(interruptedFlexible?.isWithinEstimation).toBe(false);
    });

    it("includes the active activity in the timeline when there is an active day", () => {
      const stateWithActive = createMockState(true);
      const manager = new AnalyticsManager(createMockSystemCore(stateWithActive));

      const timelineData = manager.getTimelineData();
      const activeInTimeline = timelineData.activities.find(
        (a) => a.id === stateWithActive.currentDay?.activeActivityInstanceId
      );
      expect(activeInTimeline).toBeDefined();
    });

    it("schema v2+: interruptions do NOT include isAvoidable or cause", () => {
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
    it("groups activities by category (activity type)", () => {
      const distribution = analyticsManager.getTimeDistributionData();

      const names = distribution.categories.map((c) => c.name);
      expect(names).toContain("Objetivo Definido");
      expect(names).toContain("Duración Flexible");
      expect(names).toContain("Timeboxing");
    });

    it("computes percentages that add up to ~100%", () => {
      const distribution = analyticsManager.getTimeDistributionData();

      const totalPercentage = distribution.categories.reduce((sum, c) => sum + c.percentage, 0);
      expect(totalPercentage).toBeCloseTo(100, 1);
    });

    it("filters by day when dayId is specified", () => {
      const todayId = mockState.global.days[0].id;
      const distribution = analyticsManager.getTimeDistributionData(todayId);

      const totalMinutes = distribution.categories.reduce((s, c) => s + c.totalMinutes, 0);
      expect(totalMinutes).toBe(105); // 60 + 15 + 30
    });
  });

  describe("getActivityStats", () => {
    it("computes total/completed/interrupted and completionRate", () => {
      const stats = analyticsManager.getActivityStats();

      expect(stats.totalInstances).toBe(3);
      expect(stats.completedInstances).toBe(2);
      expect(stats.interruptedInstances).toBe(1);
      expect(stats.completionRate).toBeCloseTo(66.67, 1);
    });

    it("computes completionRate=100 when all are completed", () => {
      const templateId = mockState.global.activityTemplates[0].id;
      const stats = analyticsManager.getActivityStats(templateId);

      expect(stats.totalInstances).toBe(1);
      expect(stats.completedInstances).toBe(1);
      expect(stats.interruptedInstances).toBe(0);
      expect(stats.completionRate).toBe(100);
    });

    it("does NOT include frequentInterruptionCauses in the shape (schema v2+)", () => {
      const stats = analyticsManager.getActivityStats();

      // schema v2+: field removed
      expect(stats).not.toHaveProperty("frequentInterruptionCauses");
    });

    it("computes estimationAccuracy only for clear-objective", () => {
      const stats = analyticsManager.getActivityStats();

      // 60/60 estimate => 100%; there is no other clear-objective in this mock
      // It must still return a defined number
      expect(stats.estimationAccuracy).toBeDefined();
    });
  });

  describe("getCompletionRate", () => {
    it("returns a percentage between 0 and 100", () => {
      const rate = analyticsManager.getCompletionRate();

      expect(rate).toBeGreaterThan(0);
      expect(rate).toBeLessThanOrEqual(100);
    });

    it("returns 0 when there are no activities", () => {
      const emptyState = createMockState();
      emptyState.global.completedActivityRecords = [];
      const manager = new AnalyticsManager(createMockSystemCore(emptyState));

      expect(manager.getCompletionRate()).toBe(0);
    });
  });

  describe("getEstimationAccuracy", () => {
    it("returns 0 when there are no activities with an estimate", () => {
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

  describe("getDaySummary", () => {
    it("counts the day's tasks done and not done, and the minutes of what was done", () => {
      const state = createMockState(true);
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const todayId = state.global.days[0].id;

      const summary = manager.getDaySummary(todayId);

      // Two closed as done (60 and 30 minutes), one closed as not done
      expect(summary).toEqual({ completed: 2, notCompleted: 1, minutesDone: 90 });
    });

    it("returns zeros for a day with nothing closed", () => {
      const state = createMockState(true);
      state.global.completedActivityRecords = [];
      const manager = new AnalyticsManager(createMockSystemCore(state));
      const todayId = state.global.days[0].id;

      expect(manager.getDaySummary(todayId)).toEqual({
        completed: 0,
        notCompleted: 0,
        minutesDone: 0,
      });
    });
  });

  describe("getDayTrends", () => {
    it("returns one point per day with what was done and not done", () => {
      const state = createMockState();
      // Keep only the first day in the range and map its records to that day
      const todayId = state.global.days[0].id;
      state.global.days = [state.global.days[0]];
      state.global.completedActivityRecords = state.global.completedActivityRecords.map((r) => ({
        ...r,
        dayId: todayId,
      }));
      const manager = new AnalyticsManager(createMockSystemCore(state));

      const trends = manager.getDayTrends({
        from: YESTERDAY.toISOString(),
        to: TODAY.toISOString(),
      });

      expect(trends.length).toBe(1);
      expect(trends[0].completed).toBe(2);
      expect(trends[0].notCompleted).toBe(1);
    });

    it("filters out days outside the range", () => {
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

      const trends = manager.getDayTrends({
        from: YESTERDAY.toISOString(),
        to: TODAY.toISOString(),
      });

      expect(trends.length).toBe(0);
    });
  });
});
