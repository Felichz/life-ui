import { DailyManagement } from "../daily";
import type { DailySummary, DayState, PersistedState, SharedState } from "../../types";

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
 * Crea un resumen diario de prueba con valores predeterminados
 */
const createMockDailySummary = (overrides: Partial<DailySummary> = {}): DailySummary => ({
  activitiesCompleted: 5,
  activitiesInterrupted: 2,
  completionRate: 0.7,
  averageSatisfaction: 8.5,
  averageValuePerception: 7.8,
  timeDistribution: {
    objective: 30,
    flexible: 25,
    timebox: 20,
    autopilot: 15,
    consciousRest: 5,
    meditation: 5,
  },
  overallMomentumQuality: 75,
  ...overrides,
});

/**
 * Crea un estado del día de prueba con valores predeterminados
 */
const createMockDayState = (date: number, overrides: Partial<DayState> = {}): DayState => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return {
    startDate: startOfDay.getTime(),
    endDate: endOfDay.getTime(),
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
    daySummary: createMockDailySummary(),
    ...overrides,
  };
};

describe("DailyManagement", () => {
  describe("Obtención de resúmenes", () => {
    test("getDaySummary - debe obtener un resumen diario para una fecha específica", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const testDate = Date.now();
      const dailyManagement = new DailyManagement(mockState);

      // Añadir un día a la base de datos simulada
      const mockPersistedState = mockState as unknown as PersistedState;
      mockPersistedState.dayDatabase = [createMockDayState(testDate)];

      // Act
      const summary = await dailyManagement.getDaySummary(testDate);

      // Assert
      expect(summary).toBeDefined();
      expect(summary?.activitiesCompleted).toBe(5);
      expect(summary?.activitiesInterrupted).toBe(2);
      expect(summary?.completionRate).toBe(0.7);
      expect(summary?.overallMomentumQuality).toBe(75);
    });

    test("getDaySummary - debe devolver undefined para una fecha sin datos", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const testDate = Date.now();
      const nonExistentDate = testDate - 86400000 * 7; // 7 días antes
      const dailyManagement = new DailyManagement(mockState);

      // Añadir un día a la base de datos simulada
      const mockPersistedState = mockState as unknown as PersistedState;
      mockPersistedState.dayDatabase = [createMockDayState(testDate)];

      // Act
      const summary = await dailyManagement.getDaySummary(nonExistentDate);

      // Assert
      expect(summary).toBeUndefined();
    });

    test("getDaySummaries - debe obtener resúmenes en un rango de fechas", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const baseDate = Date.now();
      const dailyManagement = new DailyManagement(mockState);

      // Crear varios días de prueba
      const day1 = createMockDayState(baseDate);
      const day2 = createMockDayState(baseDate - 86400000); // 1 día antes
      const day3 = createMockDayState(baseDate - 86400000 * 2); // 2 días antes
      const day4 = createMockDayState(baseDate - 86400000 * 10); // 10 días antes (fuera del rango)

      // Personalizar algunos datos para diferenciarlos
      day1.daySummary.activitiesCompleted = 10;
      day2.daySummary.activitiesCompleted = 5;
      day3.daySummary.activitiesCompleted = 8;

      // Añadir días a la base de datos simulada
      const mockPersistedState = mockState as unknown as PersistedState;
      mockPersistedState.dayDatabase = [day1, day2, day3, day4];

      // Act
      const dateFrom = baseDate - 86400000 * 3; // 3 días antes
      const dateTo = baseDate;
      const summaries = await dailyManagement.getDaySummaries(dateFrom, dateTo);

      // Assert
      expect(summaries).toBeDefined();
      expect(summaries.length).toBe(3); // Solo los 3 días dentro del rango
      expect(summaries[0].activitiesCompleted).toBe(10); // día 1
      expect(summaries[1].activitiesCompleted).toBe(5); // día 2
      expect(summaries[2].activitiesCompleted).toBe(8); // día 3
    });

    test("getDaySummaries - debe devolver un array vacío si no hay datos en el rango", async () => {
      // Arrange
      const mockState = createMockSharedState();
      const baseDate = Date.now();
      const dailyManagement = new DailyManagement(mockState);

      // Crear un día de prueba
      const day1 = createMockDayState(baseDate);

      // Añadir día a la base de datos simulada
      const mockPersistedState = mockState as unknown as PersistedState;
      mockPersistedState.dayDatabase = [day1];

      // Act
      const dateFrom = baseDate - 86400000 * 10; // 10 días antes
      const dateTo = baseDate - 86400000 * 5; // 5 días antes
      const summaries = await dailyManagement.getDaySummaries(dateFrom, dateTo);

      // Assert
      expect(summaries).toBeDefined();
      expect(summaries.length).toBe(0);
    });
  });

  describe("Cálculo de resúmenes", () => {
    test("calculateDailySummary - debe calcular correctamente el resumen de un día", () => {
      // Arrange
      const mockState = createMockSharedState();
      const dailyManagement = new DailyManagement(mockState);

      // Crear un estado del día con datos para calcular
      const dayState = createMockDayState(Date.now());

      // Añadir actividades completadas e interrumpidas
      const completedActivities = 8;
      const interruptedActivities = 2;
      const totalActivities = completedActivities + interruptedActivities;

      // Añadir datos de satisfacción
      const satisfactionScores = [9, 8, 7, 10, 8, 9, 7, 8]; // 8 valores para actividades completadas
      const valueScores = [8, 7, 9, 9, 7, 8, 6, 7]; // 8 valores para actividades completadas

      // Configurar puntuaciones de satisfacción
      dayState.dayHistory.satisfactionHistory = satisfactionScores.map((score, index) => ({
        activityId: `activity-${index}`,
        timestamp: Date.now(),
        satisfactionScore: score,
        valueScore: valueScores[index],
      }));

      // Configurar historial de interrupciones (2 interrupciones)
      dayState.dayHistory.interruptionHistory = [
        {
          activityId: "activity-interrupted-1",
          timestamp: Date.now() - 20000,
          causeId: "cause1",
          minutesBeforeInterruption: 15,
        },
        {
          activityId: "activity-interrupted-2",
          timestamp: Date.now() - 10000,
          causeId: "cause2",
          minutesBeforeInterruption: 8,
        },
      ];

      // Configurar distribución de tiempo
      dayState.timeDistribution = {
        objective: 40,
        flexible: 20,
        timebox: 15,
        autopilot: 10,
        consciousRest: 10,
        meditation: 5,
      };

      // Configurar momentum
      dayState.dayHistory.momentumHistory = [
        { timestamp: Date.now() - 10000, value: 60 },
        { timestamp: Date.now() - 5000, value: 70 },
        { timestamp: Date.now(), value: 80 },
      ];

      // Act
      const summary = dailyManagement.calculateDailySummary(dayState);

      // Assert
      expect(summary).toBeDefined();
      expect(summary.activitiesCompleted).toBe(completedActivities);
      expect(summary.activitiesInterrupted).toBe(interruptedActivities);
      expect(summary.completionRate).toBe(completedActivities / totalActivities);

      // Verificar cálculos de satisfacción
      const expectedAvgSatisfaction =
        satisfactionScores.reduce((sum, score) => sum + score, 0) / satisfactionScores.length;
      const expectedAvgValue =
        valueScores.reduce((sum, score) => sum + score, 0) / valueScores.length;
      expect(summary.averageSatisfaction).toBeCloseTo(expectedAvgSatisfaction, 2);
      expect(summary.averageValuePerception).toBeCloseTo(expectedAvgValue, 2);

      // Verificar distribución de tiempo
      expect(summary.timeDistribution).toEqual(dayState.timeDistribution);

      // Verificar momentum
      expect(summary.overallMomentumQuality).toBeCloseTo(70, 2); // Promedio de [60, 70, 80]
    });

    test("calculateDailySummary - debe manejar correctamente un día sin actividades", () => {
      // Arrange
      const mockState = createMockSharedState();
      const dailyManagement = new DailyManagement(mockState);

      // Crear un estado del día vacío
      const dayState = createMockDayState(Date.now());

      // Vaciar los historiales
      dayState.dayHistory.satisfactionHistory = [];
      dayState.dayHistory.momentumHistory = [];
      dayState.dayHistory.interruptionHistory = []; // Asegurar que el historial de interrupciones también esté vacío

      // Act
      const summary = dailyManagement.calculateDailySummary(dayState);

      // Assert
      expect(summary).toBeDefined();
      expect(summary.activitiesCompleted).toBe(0);
      expect(summary.activitiesInterrupted).toBe(0);
      expect(summary.completionRate).toBe(0);
      expect(summary.averageSatisfaction).toBe(0);
      expect(summary.averageValuePerception).toBe(0);
      expect(summary.overallMomentumQuality).toBe(0);
    });
  });

  describe("Historial del día", () => {
    test("getDayHistory - debe obtener el historial completo del día actual", () => {
      // Arrange
      const mockState = createMockSharedState();
      const dailyManagement = new DailyManagement(mockState);

      // Configurar datos de historial en el estado
      mockState.currentDay.dayHistory = {
        variableHistory: [
          {
            id: "var1",
            timestamp: Date.now(),
            variables: [],
            relatedActivityIds: [],
            relatedEventIds: [],
          },
        ],
        activityHistory: [],
        eventHistory: [],
        interruptionHistory: [
          {
            activityId: "act1",
            timestamp: Date.now(),
            causeId: "cause1",
            minutesBeforeInterruption: 10,
          },
        ],
        satisfactionHistory: [
          { activityId: "act2", timestamp: Date.now(), satisfactionScore: 8, valueScore: 7 },
        ],
        momentumHistory: [{ timestamp: Date.now(), value: 75 }],
      };

      // Act
      const history = dailyManagement.getDayHistory();

      // Assert
      expect(history).toBeDefined();
      expect(history).toEqual(mockState.currentDay.dayHistory);
      expect(history.variableHistory.length).toBe(1);
      expect(history.interruptionHistory.length).toBe(1);
      expect(history.satisfactionHistory.length).toBe(1);
      expect(history.momentumHistory.length).toBe(1);
    });
  });

  describe("Manejo de errores", () => {
    test("getDaySummary - debe manejar errores de acceso a la base de datos", async () => {
      // Arrange
      const mockState = createMockSharedState();
      // Simular que no hay acceso a la base de datos
      const mockStateWithNoDayDb = {
        ...mockState,
        dayDatabase: null,
      } as unknown as PersistedState;

      const dailyManagement = new DailyManagement(mockStateWithNoDayDb);

      // Act & Assert
      await expect(dailyManagement.getDaySummary(Date.now())).rejects.toThrow(/base de datos/i);
    });

    test("getDaySummaries - debe manejar errores de acceso a la base de datos", async () => {
      // Arrange
      const mockState = createMockSharedState();
      // Simular que no hay acceso a la base de datos
      const mockStateWithNoDayDb = {
        ...mockState,
        dayDatabase: null,
      } as unknown as PersistedState;

      const dailyManagement = new DailyManagement(mockStateWithNoDayDb);

      // Act & Assert
      await expect(
        dailyManagement.getDaySummaries(Date.now() - 86400000, Date.now())
      ).rejects.toThrow(/base de datos/i);
    });

    test("calculateDailySummary - debe lanzar error si el estado del día es inválido", () => {
      // Arrange
      const mockState = createMockSharedState();
      const dailyManagement = new DailyManagement(mockState);

      // Act & Assert
      expect(() => dailyManagement.calculateDailySummary(null as unknown as DayState)).toThrow(
        /estado del día inválido/i
      );
    });
  });
});
