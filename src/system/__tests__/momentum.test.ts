import { MomentumManagement } from "../momentum";
import type { Activity, SharedState } from "../../types";

// Definición mínima de estructuras para los tests
const createTestActivity = (overrides: Partial<Activity> = {}): Activity => {
  // Definimos la actividad base con tipo goalOriented
  const baseActivity: Activity = {
    title: "Test Activity",
    description: "",
    type: "goalOriented",
    tags: [],
    iconId: "",
    templateId: "template-1",
    status: "completed",
    dynamicProps: {
      estimatedMinutes: 30,
    },
    instance: {
      id: "activity-1",
      startTime: Math.floor(Date.now() / 1000) - 1800, // hace 30 minutos
      endTime: Math.floor(Date.now() / 1000) - 60, // finalizó hace 1 minuto
      actualMinutes: 30,
      type: "goalOriented",
    },
  } as Activity;

  // Aplicamos los overrides
  return { ...baseActivity, ...overrides } as Activity;
};

const createTestSatisfaction = (activityId: string, score: number) => ({
  activityId,
  timestamp: Math.floor(Date.now() / 1000) - 60,
  satisfactionScore: score, // en escala 1-10
  valueScore: score,
  notes: "",
});

const createMockState = (): SharedState => ({
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

describe("MomentumManagement", () => {
  let state: SharedState;
  let momentumManagement: MomentumManagement;
  let now: number;

  beforeEach(() => {
    now = Math.floor(Date.now() / 1000);
    // Definir un estado mock con la estructura correcta
    state = createMockState();
    momentumManagement = new MomentumManagement(state);
  });

  test("calculateMomentum devuelve 0 cuando no hay actividades completadas", async () => {
    const momentum = await momentumManagement.calculateMomentum();
    expect(momentum).toBe(0);
  });

  test("calculateMomentum devuelve el valor esperado para una actividad completada", async () => {
    // Creamos una actividad completada con valores conocidos
    const activity = createTestActivity();
    state.currentDay.dayHistory.activityHistory.push(activity);

    // Agregamos un registro de satisfacción para la actividad (por ejemplo, 8 de 10)
    state.currentDay.dayHistory.satisfactionHistory.push(
      createTestSatisfaction(activity.instance!.id, 8)
    );

    // Calcular manualmente lo esperado:
    // - deltaTime = now - activity.instance.endTime ≈ 60 segundos.
    // - decay = exp(-λ * deltaTime), con λ = 0.001 => exp(-0.06) ≈ 0.94176.
    // - computeActivityScore para la actividad:
    //      * estimatedMinutes = 30, actualMinutes = 30 => ratio = 30/30 = 1, eficiencia = 1/1 = 1.
    //      * penalty = 1 (no interrumpida).
    //      * satisfacción = 8/10 = 0.8.
    //   => score = 1 * 1 * 0.8 = 0.8.
    // Entonces, numerator = 0.94176 * 0.8 ≈ 0.75341 y denominator = 0.94176.
    // rawMomentum = 0.75341 / 0.94176 ≈ 0.8, y normalizado: 0.8 * 100 = 80.
    //
    // Debido a la variación en Date.now() y ejecución, usamos toBeCloseTo.

    const momentum = await momentumManagement.calculateMomentum();
    expect(momentum).toBeCloseTo(80, 0); // tolerancia de 0 decimales
  });

  test("calculateMomentum considera correctamente múltiples actividades", async () => {
    // Creamos dos actividades completadas:
    const activity1 = createTestActivity({
      instance: {
        id: "activity-1",
        startTime: now - 2000,
        endTime: now - 100, // finalizó hace 100 segundos
        actualMinutes: 30,
        type: "goalOriented",
      },
    });
    const activity2 = createTestActivity({
      instance: {
        id: "activity-2",
        startTime: now - 4000,
        endTime: now - 300, // finalizó hace 300 segundos
        actualMinutes: 30,
        type: "goalOriented",
      },
    });
    state.currentDay.dayHistory.activityHistory.push(activity1, activity2);

    // Satisfacción: actividad1 con 8, actividad2 con 6
    state.currentDay.dayHistory.satisfactionHistory.push(createTestSatisfaction("activity-1", 8));
    state.currentDay.dayHistory.satisfactionHistory.push(createTestSatisfaction("activity-2", 6));

    // Calculamos individualmente:
    // Para activity1:
    //   deltaTime1 = 100, decay1 = exp(-0.001 * 100) = exp(-0.1) ≈ 0.9048, score1 = 0.8.
    // Para activity2:
    //   deltaTime2 = 300, decay2 = exp(-0.001 * 300) = exp(-0.3) ≈ 0.7408, score2 = 6/10 = 0.6.
    // Numerator = (0.9048 * 0.8) + (0.7408 * 0.6) = 0.72384 + 0.44448 = 1.16832.
    // Denom = 0.9048 + 0.7408 = 1.6456.
    // rawMomentum ≈ 1.16832 / 1.6456 ≈ 0.71, normalizado = 71.
    const momentum = await momentumManagement.calculateMomentum();
    expect(momentum).toBeCloseTo(71, 0);
  });

  test("updateMomentum añade un nuevo registro al historial de momentum", async () => {
    // ARRANGE: Preparamos el entorno de prueba
    // Espiamos Date.now para tener un timestamp predecible
    const mockTimestamp = 1617123456000; // Un timestamp fijo para la prueba
    const expectedTimestampSeconds = Math.floor(mockTimestamp / 1000);
    jest.spyOn(Date, "now").mockImplementation(() => mockTimestamp);

    // Verificamos el estado inicial del historial de momentum
    expect(state.currentDay.dayHistory.momentumHistory.length).toBe(0);

    // Creamos una actividad completada con valores conocidos que deberían resultar
    // en un momentum aproximado de 80 (según cálculos previos)
    const activity = createTestActivity({
      instance: {
        id: "activity-test",
        startTime: expectedTimestampSeconds - 1800, // Iniciada hace 30 minutos
        endTime: expectedTimestampSeconds - 60, // Finalizada hace 1 minuto
        actualMinutes: 30,
        type: "goalOriented",
      },
    });
    state.currentDay.dayHistory.activityHistory.push(activity);

    // Agregamos un registro de satisfacción con valor 8 para la actividad
    state.currentDay.dayHistory.satisfactionHistory.push(
      createTestSatisfaction("activity-test", 8)
    );

    // ACT: Ejecutamos la función que estamos probando
    await momentumManagement.updateMomentum();

    // ASSERT: Verificamos que el resultado es el esperado

    // 1. Debe haberse añadido exactamente un registro al historial
    expect(state.currentDay.dayHistory.momentumHistory.length).toBe(1);

    // 2. Obtenemos el registro añadido
    const momentumRecord = state.currentDay.dayHistory.momentumHistory[0];

    // 3. Verificamos que tiene la estructura correcta
    expect(momentumRecord).toMatchObject({
      timestamp: expectedTimestampSeconds,
      value: expect.any(Number),
    });

    // 4. Verificamos que el valor está en el rango correcto y es aproximadamente
    // lo que esperamos según los cálculos manuales
    expect(momentumRecord.value).toBeGreaterThan(0);
    expect(momentumRecord.value).toBeLessThanOrEqual(100);
    expect(momentumRecord.value).toBeCloseTo(80, 0);

    // Limpiamos nuestro mock
    jest.restoreAllMocks();
  });
});
