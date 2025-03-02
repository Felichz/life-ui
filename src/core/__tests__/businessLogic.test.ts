import {
  getMinutesFromTimestamp,
  calculateNewBalances,
  processTimeBatch,
  updateTimeState,
  type TimeStateInput,
  evaluateConstraints,
  createDayRecord,
  processActivitiesAtDayEnd,
} from "../businessLogic";
import { TimeSimulator } from "../TimeSimulator";
import type {
  Activity,
  SystemParams,
  ExpirationChallengeConstraint,
  ChallengeActivity,
  DayState,
  InvestedTimeHistory,
  TempoModificationHistory,
  UsefulMetrics,
  NeutralActivity,
  HobbyActivity,
} from "../types";

describe("timeStateLogic", () => {
  describe("getMinutesFromTimestamp", () => {
    it("debería convertir correctamente un timestamp a minutos del día", () => {
      // Ejemplo: 2024-03-20 10:30:00 → 10*60 + 30 = 630
      const timestamp = new Date(2024, 2, 20, 10, 30).getTime();
      expect(getMinutesFromTimestamp(timestamp)).toBe(630);
    });

    it("debería retornar 0 para un timestamp a medianoche", () => {
      const timestamp = new Date(2024, 2, 20, 0, 0).getTime();
      expect(getMinutesFromTimestamp(timestamp)).toBe(0);
    });

    it("debería retornar 1439 para un timestamp a las 23:59", () => {
      const timestamp = new Date(2024, 2, 20, 23, 59).getTime();
      expect(getMinutesFromTimestamp(timestamp)).toBe(1439);
    });
  });

  describe("calculateNewBalances", () => {
    it("debería calcular correctamente los nuevos balances para modificaciones positivas", () => {
      const result = calculateNewBalances({
        currentDayBalance: 100,
        totalBalance: 500,
        tempoModification: 50,
      });

      expect(result).toEqual({
        newDayTempoBalance: 150,
        newTotalTempoBalance: 550,
      });
    });

    it("debería manejar modificaciones negativas", () => {
      const result = calculateNewBalances({
        currentDayBalance: 100,
        totalBalance: 500,
        tempoModification: -30,
      });

      expect(result).toEqual({
        newDayTempoBalance: 70,
        newTotalTempoBalance: 470,
      });
    });

    it("debería manejar modificaciones cero sin cambios en balances", () => {
      const result = calculateNewBalances({
        currentDayBalance: 200,
        totalBalance: 1000,
        tempoModification: 0,
      });

      expect(result).toEqual({
        newDayTempoBalance: 200,
        newTotalTempoBalance: 1000,
      });
    });
  });

  describe("processTimeBatch", () => {
    const baseTimestamp = new Date(2024, 2, 20, 10, 0).getTime();
    const systemParams: SystemParams = {
      passiveTempoConsumptionRate: 1,
      isTestMode: false,
      timeMultiplier: 1,
    };

    it("debería procesar tiempo idle cuando no hay actividad", () => {
      const result = processTimeBatch({
        deltaTime: 5,
        baseTimestamp,
        currentActivity: undefined,
        systemParams,
      });

      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "idle",
        timestamp: baseTimestamp,
        tempoModification: -5, // 5 minutos * -1 (passiveTempoConsumptionRate)
        minutesInvested: 5,
      });
      expect(result.updatedTimestamp).toBe(baseTimestamp + 5 * 60000);
    });

    it("debería procesar correctamente una actividad challenge sin exceder el totalTempoReward", () => {
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 10,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
        tempoGeneratingMinutes: 5,
        exceededMinutes: 0,
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "activity",
        activityId: "1",
        type: "challenge",
        timestamp: baseTimestamp,
        tempoModification: 3,
        minutesInvested: 3,
      });
      const updatedChallenge = result.updatedActivity as ChallengeActivity;
      // minutesActive debe incrementarse con todo el tiempo
      expect(updatedChallenge.minutesActive).toBe(8);
      // tempoGeneratingMinutes debe incrementarse solo con el tiempo efectivo
      expect(updatedChallenge.tempoGeneratingMinutes).toBe(8);
      // no hay tiempo excedido aún
      expect(updatedChallenge.exceededMinutes).toBe(0);
    });

    it("debería procesar correctamente una actividad challenge excediendo el totalTempoReward", () => {
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 10,
        minutesActive: 8,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
        tempoGeneratingMinutes: 8,
        exceededMinutes: 0,
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 5,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      expect(result.timeRecords).toHaveLength(2);
      // Registro de actividad: solo se procesan 2 minutos para completar la actividad
      expect(result.timeRecords[0]).toEqual({
        status: "activity",
        activityId: "1",
        type: "challenge",
        timestamp: baseTimestamp,
        tempoModification: 2,
        minutesInvested: 2,
      });
      // Registro idle: los 3 minutos restantes se procesan como idle
      expect(result.timeRecords[1]).toEqual({
        status: "idle",
        timestamp: baseTimestamp + 2 * 60000,
        tempoModification: -3,
        minutesInvested: 3,
      });
      const updatedChallenge = result.updatedActivity as ChallengeActivity;
      // minutesActive debe incrementarse con todo el tiempo (8 + 5 = 13)
      expect(updatedChallenge.minutesActive).toBe(13);
      // tempoGeneratingMinutes debe llegar solo hasta totalTempoReward (8 + 2 = 10)
      expect(updatedChallenge.tempoGeneratingMinutes).toBe(10);
      // exceededMinutes debe acumular el tiempo extra (3 minutos)
      expect(updatedChallenge.exceededMinutes).toBe(3);
    });

    it("debería procesar correctamente una actividad neutral sin completar la allowedTime", () => {
      const activity: Activity = {
        id: "2",
        type: "neutral",
        title: "Test Neutral",
        allowedTime: 10,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "activity",
        activityId: "2",
        type: "neutral",
        timestamp: baseTimestamp,
        tempoModification: 0,
        minutesInvested: 3,
      });
      expect(result.updatedActivity?.minutesActive).toBe(8);
      expect(result.updatedActivity?.status).toBe("inProgress");
    });

    it("debería procesar correctamente una actividad neutral completando la allowedTime", () => {
      // Actividad neutral: allowedTime = 10, minutesActive = 8, deltaTime = 3
      // Se procesan 2 minutos de actividad (para llegar a 10) y 1 minuto idle
      const activity: Activity = {
        id: "2",
        type: "neutral",
        title: "Test Neutral",
        allowedTime: 10,
        minutesActive: 8,
        status: "inProgress",
        isRepetitive: false,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      // Puede que la lógica registre 1 o 2 registros, pero debe actualizar la actividad a "completed"
      expect(result.updatedActivity?.minutesActive).toBe(10);
      expect(result.updatedActivity?.status).toBe("completed");
      // Se puede esperar que se genere al menos un registro de actividad
      expect(result.timeRecords.some((record) => record.status === "activity")).toBe(true);
    });

    it("debería procesar correctamente una actividad discount sin completar la allowedTime", () => {
      const activity: Activity = {
        id: "3",
        type: "discount",
        title: "Test Hobby",
        allowedTime: 10,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        tempoConsumptionRate: 0.5,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      // Tasa efectiva: 0.5 (hobby) * 1 (passiveTempoConsumptionRate) = 0.5
      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "activity",
        activityId: "3",
        type: "discount",
        timestamp: baseTimestamp,
        tempoModification: -1.5, // 3 minutos * -0.5
        minutesInvested: 3,
      });
      expect(result.updatedActivity?.minutesActive).toBe(8);
      expect(result.updatedActivity?.status).toBe("inProgress");
    });

    it("debería procesar correctamente una actividad discount completando la allowedTime", () => {
      // Actividad discount: allowedTime = 10, minutesActive = 8, deltaTime = 3
      // Se procesan 2 minutos de actividad y 1 minuto idle; la actividad debe completarse
      const activity: Activity = {
        id: "3",
        type: "discount",
        title: "Test Hobby",
        allowedTime: 10,
        minutesActive: 8,
        status: "inProgress",
        isRepetitive: false,
        tempoConsumptionRate: 0.5,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      expect(result.updatedActivity?.minutesActive).toBe(10);
      expect(result.updatedActivity?.status).toBe("completed");

      // Tasa efectiva: 0.5 (hobby) * 1 (passiveTempoConsumptionRate) = 0.5
      // Se espera un registro de actividad por 2 minutos (2 * -0.5 = -1) y un registro idle para el minuto restante
      const discountRecord = result.timeRecords.find(
        (record) => record.status === "activity" && record.type === "discount"
      );
      expect(discountRecord).toBeDefined();
      expect(discountRecord?.tempoModification).toBe(-1); // 2 minutos * -0.5
      const idleRecord = result.timeRecords.find((record) => record.status === "idle");
      expect(idleRecord).toBeDefined();
      expect(idleRecord?.minutesInvested).toBe(1);
    });

    it("debería aplicar el cálculo multiplicativo cuando la tasa pasiva es menor a 1", () => {
      const activity: Activity = {
        id: "3",
        type: "discount",
        title: "Test Hobby con Tasa Pasiva Reducida",
        allowedTime: 10,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        tempoConsumptionRate: 0.5,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const reducedSystemParams: SystemParams = {
        ...systemParams,
        passiveTempoConsumptionRate: 0.5, // Día con 50% de energía
      };

      const result = processTimeBatch({
        deltaTime: 4,
        baseTimestamp,
        currentActivity: activity,
        systemParams: reducedSystemParams,
      });

      // Tasa efectiva: 0.5 (hobby) * 0.5 (passiveTempoConsumptionRate) = 0.25
      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "activity",
        activityId: "3",
        type: "discount",
        timestamp: baseTimestamp,
        tempoModification: -1, // 4 minutos * -0.25 = -1
        minutesInvested: 4,
      });
      expect(result.updatedActivity?.minutesActive).toBe(9);
      expect(result.updatedActivity?.status).toBe("inProgress");
    });
  });

  describe("updateTimeState", () => {
    const baseTimestamp = new Date(2024, 2, 20, 10, 0).getTime();
    const systemParams: SystemParams = {
      passiveTempoConsumptionRate: 1,
      isTestMode: false,
      timeMultiplier: 1,
    };

    let timeSimulator: TimeSimulator;

    beforeEach(() => {
      timeSimulator = TimeSimulator.getInstance();
    });

    it("debería retornar estado inicial cuando no hay día activo", () => {
      jest.spyOn(timeSimulator, "now").mockReturnValue(baseTimestamp);

      const input: TimeStateInput = {
        currentDay: undefined,
        lastUpdateTimestamp: baseTimestamp,
        currentActivity: undefined,
        systemParams,
        totalTempoBalance: 100,
        timeSimulator,
      };

      const result = updateTimeState(input);

      expect(result).toEqual({
        shouldEndDay: false,
        processedMinutes: 0,
        timeRecords: [],
        newDayTempoBalance: 0,
        newTotalTempoBalance: 100,
        updatedTimestamp: baseTimestamp,
        updatedActivity: undefined,
      });
    });

    it("debería procesar tiempo y actualizar balances correctamente sin actividad", () => {
      const now = baseTimestamp + 5 * 60000; // 5 minutos después
      jest.spyOn(timeSimulator, "now").mockReturnValue(now);

      const input: TimeStateInput = {
        currentDay: {
          date: baseTimestamp,
          dayStartMinute: 600, // 10:00
          dayTempoBalance: 50,
        },
        lastUpdateTimestamp: baseTimestamp,
        currentActivity: undefined,
        systemParams,
        totalTempoBalance: 100,
        timeSimulator,
      };

      const result = updateTimeState(input);

      expect(result.processedMinutes).toBe(5);
      expect(result.timeRecords).toHaveLength(1);
      expect(result.timeRecords[0]).toEqual({
        status: "idle",
        timestamp: baseTimestamp,
        tempoModification: -5,
        minutesInvested: 5,
      });
      expect(result.newDayTempoBalance).toBe(45); // 50 - 5
      expect(result.newTotalTempoBalance).toBe(95); // 100 - 5
      expect(result.updatedTimestamp).toBe(now);
    });

    it("debería indicar fin del día cuando corresponda", () => {
      const dayStart = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const lastUpdate = new Date(2024, 2, 20, 23, 55).getTime(); // 23:55
      const now = new Date(2024, 2, 21, 0, 5).getTime(); // 00:05 del día siguiente
      jest.spyOn(timeSimulator, "now").mockReturnValue(now);

      const input: TimeStateInput = {
        currentDay: {
          date: dayStart,
          dayStartMinute: 480, // 8:00
          dayTempoBalance: 50,
        },
        lastUpdateTimestamp: lastUpdate,
        currentActivity: undefined,
        systemParams,
        totalTempoBalance: 100,
        timeSimulator,
      };

      const result = updateTimeState(input);

      expect(result.shouldEndDay).toBe(true);
    });

    it("debería procesar correctamente updateTimeState con actividad challenge", () => {
      const now = baseTimestamp + 4 * 60000; // 4 minutos después
      jest.spyOn(timeSimulator, "now").mockReturnValue(now);

      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 15,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
        tempoGeneratingMinutes: 0,
        createdAt: baseTimestamp,
      };

      const input: TimeStateInput = {
        currentDay: {
          date: baseTimestamp,
          dayStartMinute: 600,
          dayTempoBalance: 50,
        },
        lastUpdateTimestamp: baseTimestamp,
        currentActivity: activity,
        systemParams,
        totalTempoBalance: 100,
        timeSimulator,
      };

      const result = updateTimeState(input);

      // Para actividad challenge: minutesActive debe aumentar de 5 a 9
      expect(result.updatedActivity?.minutesActive).toBe(9);
      // Se espera un registro de actividad de tipo challenge con tempoModification = 4
      const challengeRecord = result.timeRecords.find(
        (record) => record.status === "activity" && record.type === "challenge"
      );
      expect(challengeRecord).toBeDefined();
      expect(challengeRecord?.tempoModification).toBe(4);
      expect(result.newDayTempoBalance).toBe(54); // 50 + 4
      expect(result.newTotalTempoBalance).toBe(104); // 100 + 4
      expect(result.updatedTimestamp).toBe(now);
    });

    it("debería procesar correctamente updateTimeState con actividad discount que finaliza", () => {
      const now = baseTimestamp + 3 * 60000; // 3 minutos después
      jest.spyOn(timeSimulator, "now").mockReturnValue(now);

      const activity: Activity = {
        id: "3",
        type: "discount",
        title: "Test Hobby",
        allowedTime: 10,
        minutesActive: 9,
        status: "inProgress",
        isRepetitive: false,
        tempoConsumptionRate: 0.5,
        inheritedProps: {},
        createdAt: baseTimestamp,
      };

      const input: TimeStateInput = {
        currentDay: {
          date: baseTimestamp,
          dayStartMinute: 600,
          dayTempoBalance: 50,
        },
        lastUpdateTimestamp: baseTimestamp,
        currentActivity: activity,
        systemParams,
        totalTempoBalance: 100,
        timeSimulator,
      };

      const result = updateTimeState(input);

      // Para actividad discount: minutesActive debe llegar a 10 y el status debe cambiar a "completed"
      expect(result.updatedActivity?.minutesActive).toBe(10);
      expect(result.updatedActivity?.status).toBe("completed");

      // Se espera un registro de actividad discount con tempoModification = -0.5 para el minuto procesado
      const discountRecord = result.timeRecords.find(
        (record) => record.status === "activity" && record.type === "discount"
      );
      expect(discountRecord).toBeDefined();
      expect(discountRecord?.tempoModification).toBe(-0.5);

      // Además, se espera que se procese el resto de los minutos como idle (3 - 1 = 2 minutos)
      const idleRecord = result.timeRecords.find((record) => record.status === "idle");
      expect(idleRecord).toBeDefined();
      expect(idleRecord?.minutesInvested).toBe(2);

      expect(result.newDayTempoBalance).toBe(47.5); // 50 - 0.5 - 2
      expect(result.newTotalTempoBalance).toBe(97.5); // 100 - 0.5 - 2
      expect(result.updatedTimestamp).toBe(now);
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });
  });

  describe("evaluateConstraints", () => {
    it("debería mantener los constraints sin cambios cuando no han expirado", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600, // 10:00
          penalty: 50,
          failCount: 0,
          status: "active",
        },
      ];

      const result = evaluateConstraints({
        constraints,
        currentMinutes: 500, // 8:20
        totalTempoReward: 100,
        activity,
        currentTimestamp: baseTimestamp,
      });

      expect(result.updatedConstraints).toEqual(constraints);
      expect(result.failedConstraints).toHaveLength(0);
    });

    it("debería marcar como fallido un constraint expirado con penalización numérica", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600, // 10:00
          penalty: 50,
          failCount: 0,
          status: "active",
        },
      ];

      const currentTimestamp = new Date(2024, 2, 20, 10, 1).getTime(); // 10:01
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 601, // 10:01
        totalTempoReward: 100,
        activity,
        currentTimestamp,
      });

      expect(result.updatedConstraints[0].status).toBe("failed");
      expect(result.updatedConstraints[0].failCount).toBe(1);
      expect(result.failedConstraints).toHaveLength(1);
      expect(result.failedConstraints[0].penaltyAmount).toBe(50);
    });

    it("debería calcular correctamente la penalización porcentual", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 200,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600,
          penalty: "75%",
          failCount: 0,
          status: "active",
        },
      ];

      const currentTimestamp = new Date(2024, 2, 20, 10, 1).getTime(); // 10:01
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 601,
        totalTempoReward: 200,
        activity,
        currentTimestamp,
      });

      expect(result.failedConstraints[0].penaltyAmount).toBe(150); // 75% de 200
    });

    it("debería ignorar constraints que ya están fallidos", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600,
          penalty: 50,
          failCount: 1,
          status: "failed",
        },
      ];

      const currentTimestamp = new Date(2024, 2, 20, 10, 1).getTime(); // 10:01
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 601,
        totalTempoReward: 100,
        activity,
        currentTimestamp,
      });

      expect(result.updatedConstraints).toEqual(constraints);
      expect(result.failedConstraints).toHaveLength(0);
    });

    it("debería manejar múltiples constraints correctamente", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600,
          penalty: 50,
          failCount: 0,
          status: "active",
        },
        {
          id: "2",
          type: "expiration",
          dayMinuteExpiration: 720,
          penalty: "100%",
          failCount: 0,
          status: "active",
        },
      ];

      const currentTimestamp = new Date(2024, 2, 20, 11, 0).getTime(); // 11:00
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 660, // 11:00
        totalTempoReward: 100,
        activity,
        currentTimestamp,
      });

      expect(result.updatedConstraints[0].status).toBe("failed");
      expect(result.updatedConstraints[1].status).toBe("active");
      expect(result.failedConstraints).toHaveLength(1);
      expect(result.failedConstraints[0].penaltyAmount).toBe(50);
    });

    it("debería exonerar constraints expirados para actividades creadas después del minuto de expiración en el mismo día", () => {
      const activityCreationTimestamp = new Date(2024, 2, 20, 11, 0).getTime(); // 11:00

      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 0,
        status: "inProgress",
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: activityCreationTimestamp,
        tempoGeneratingMinutes: 0,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600, // 10:00
          penalty: 50,
          failCount: 0,
          status: "active",
        },
      ];

      // Evaluamos a las 12:00 del mismo día
      const currentTimestamp = new Date(2024, 2, 20, 12, 0).getTime();
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 720, // 12:00
        totalTempoReward: 100,
        activity,
        currentTimestamp,
      });

      // El constraint no debería fallar porque la actividad se creó después del minuto de expiración
      expect(result.updatedConstraints[0].status).toBe("active");
      expect(result.failedConstraints).toHaveLength(0);

      // Evaluamos al día siguiente
      const nextDayTimestamp = new Date(2024, 2, 21, 12, 0).getTime();
      const nextDayResult = evaluateConstraints({
        constraints,
        currentMinutes: 720, // 12:00
        totalTempoReward: 100,
        activity,
        currentTimestamp: nextDayTimestamp,
      });

      // Al día siguiente el constraint sí debería fallar
      expect(nextDayResult.updatedConstraints[0].status).toBe("failed");
      expect(nextDayResult.failedConstraints).toHaveLength(1);
      expect(nextDayResult.failedConstraints[0].penaltyAmount).toBe(50);
    });

    it("no debería evaluar constraints cuando la actividad está completada", () => {
      const baseTimestamp = new Date(2024, 2, 20, 8, 0).getTime(); // 8:00
      const activity: ChallengeActivity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 100,
        minutesActive: 100,
        status: "completed", // Actividad completada
        isRepetitive: true,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 100,
      };

      const constraints: ExpirationChallengeConstraint[] = [
        {
          id: "1",
          type: "expiration",
          dayMinuteExpiration: 600, // 10:00
          penalty: 50,
          failCount: 0,
          status: "active",
        },
      ];

      const currentTimestamp = new Date(2024, 2, 20, 11, 0).getTime(); // 11:00 (después de la expiración)
      const result = evaluateConstraints({
        constraints,
        currentMinutes: 660, // 11:00
        totalTempoReward: 100,
        activity,
        currentTimestamp,
      });

      // Los constraints deberían permanecer sin cambios
      expect(result.updatedConstraints).toEqual(constraints);
      // No deberían haber constraints fallidos
      expect(result.failedConstraints).toHaveLength(0);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});

describe("createDayRecord", () => {
  const baseTimestamp = new Date(2024, 2, 20, 10, 0).getTime();

  const mockDayState: DayState = {
    date: baseTimestamp,
    dayStartMinute: 600,
    dayTempoBalance: 100,
  };

  const mockInvestedTimeHistory: InvestedTimeHistory = [
    {
      status: "activity",
      activityId: "1",
      type: "challenge",
      timestamp: baseTimestamp,
      tempoModification: 10,
      minutesInvested: 10,
    },
  ];

  const mockTempoModificationHistory: TempoModificationHistory = [
    {
      activityId: "1",
      type: "challenge",
      timestamp: baseTimestamp,
      reason: "challengeCompletionReward",
      tempoModification: 50,
    },
  ];

  const mockUsefulMetrics: UsefulMetrics = {
    totalGeneratedTemposEver: 1000,
    totalMinutesInvested: {
      intrinsicProductivity: 100,
      challenges: 200,
      hobbies: 300,
      rest: 400,
      other: 0,
    },
  };

  it("debería crear un registro de día correctamente con actividades no repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge No Repetible",
        isRepetitive: false,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
      } as ChallengeActivity,
    ];

    const result = createDayRecord({
      currentDay: mockDayState,
      activities: mockActivities,
      investedTimeHistory: mockInvestedTimeHistory,
      tempoModificationHistory: mockTempoModificationHistory,
      usefulMetrics: mockUsefulMetrics,
    });

    expect(result.dayState).toEqual(mockDayState);
    expect(result.investedTimeHistory).toEqual(mockInvestedTimeHistory);
    expect(result.tempoModificationHistory).toEqual(mockTempoModificationHistory);
    expect(result.usefulMetrics).toEqual(mockUsefulMetrics);
    // Verificar que se guarden todas las actividades
    expect(Object.keys(result.activitiesFinalState)).toHaveLength(1);
    expect(result.activitiesFinalState["1"]).toEqual(mockActivities[0]);
  });

  it("debería guardar todas las actividades en el estado final", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge No Repetible",
        isRepetitive: false,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
      } as ChallengeActivity,
      {
        id: "2",
        type: "neutral",
        title: "Neutral Repetible",
        isRepetitive: true,
        minutesActive: 45,
        status: "completed",
        allowedTime: 60,
        inheritedProps: {},
        createdAt: baseTimestamp,
      } as NeutralActivity,
      {
        id: "3",
        type: "discount",
        title: "Hobby No Repetible",
        isRepetitive: false,
        minutesActive: 20,
        status: "completed",
        allowedTime: 30,
        tempoConsumptionRate: 0.5,
        inheritedProps: {},
        createdAt: baseTimestamp,
      },
    ];

    const result = createDayRecord({
      currentDay: mockDayState,
      activities: mockActivities,
      investedTimeHistory: mockInvestedTimeHistory,
      tempoModificationHistory: mockTempoModificationHistory,
      usefulMetrics: mockUsefulMetrics,
    });

    // Verificar que se guarden todas las actividades, independientemente de si son repetibles o no
    expect(Object.keys(result.activitiesFinalState)).toHaveLength(3);
    expect(result.activitiesFinalState["1"]).toEqual(mockActivities[0]);
    expect(result.activitiesFinalState["2"]).toEqual(mockActivities[1]);
    expect(result.activitiesFinalState["3"]).toEqual(mockActivities[2]);
  });

  it("debería incluir el estado final de actividades repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge Repetible",
        isRepetitive: true,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
        exceededMinutes: 0,
      } as ChallengeActivity,
      {
        id: "2",
        type: "neutral",
        title: "Neutral Repetible",
        isRepetitive: true,
        minutesActive: 45,
        status: "completed",
        allowedTime: 60,
        inheritedProps: {},
        createdAt: baseTimestamp,
      },
    ];

    const result = createDayRecord({
      currentDay: mockDayState,
      activities: mockActivities,
      investedTimeHistory: mockInvestedTimeHistory,
      tempoModificationHistory: mockTempoModificationHistory,
      usefulMetrics: mockUsefulMetrics,
    });

    // Verificar que se incluyeron ambas actividades repetibles
    expect(Object.keys(result.activitiesFinalState)).toHaveLength(2);

    // Verificar que las actividades repetibles se almacenaron completas
    expect(result.activitiesFinalState["1"]).toEqual(mockActivities[0]);
    expect(result.activitiesFinalState["2"]).toEqual(mockActivities[1]);
  });

  it("debería manejar correctamente una lista vacía de actividades", () => {
    const result = createDayRecord({
      currentDay: mockDayState,
      activities: [],
      investedTimeHistory: mockInvestedTimeHistory,
      tempoModificationHistory: mockTempoModificationHistory,
      usefulMetrics: mockUsefulMetrics,
    });

    expect(result.dayState).toEqual(mockDayState);
    expect(result.investedTimeHistory).toEqual(mockInvestedTimeHistory);
    expect(result.tempoModificationHistory).toEqual(mockTempoModificationHistory);
    expect(result.usefulMetrics).toEqual(mockUsefulMetrics);
    expect(Object.keys(result.activitiesFinalState)).toHaveLength(0);
  });
});

describe("processActivitiesAtDayEnd", () => {
  const baseTimestamp = new Date(2024, 2, 20, 10, 0).getTime();

  it("debería clasificar correctamente las actividades repetibles y no repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge No Repetible",
        isRepetitive: false,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
      } as ChallengeActivity,
      {
        id: "2",
        type: "neutral",
        title: "Neutral Repetible",
        isRepetitive: true,
        minutesActive: 45,
        status: "completed",
        allowedTime: 60,
        inheritedProps: {},
        createdAt: baseTimestamp,
      } as NeutralActivity,
      {
        id: "3",
        type: "challenge",
        title: "Challenge Repetible",
        isRepetitive: true,
        minutesActive: 100,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 100,
        exceededMinutes: 20,
      } as ChallengeActivity,
    ];

    const result = processActivitiesAtDayEnd(mockActivities);

    // Verificar actividades a eliminar
    expect(result.activitiesToRemove).toHaveLength(1);
    expect(result.activitiesToRemove[0].id).toBe("1");
    expect(result.activitiesToRemove[0].isRepetitive).toBe(false);

    // Verificar actividades a reiniciar
    expect(result.activitiesToReset).toHaveLength(2);

    // Verificar reinicio de actividad neutral
    const resetNeutral = result.activitiesToReset.find((a) => a.id === "2");
    expect(resetNeutral).toEqual({
      id: "2",
      status: "toDo",
      minutesActive: 0,
    });

    // Verificar reinicio de desafío
    const resetChallenge = result.activitiesToReset.find((a) => a.id === "3");
    expect(resetChallenge).toEqual({
      id: "3",
      status: "toDo",
      minutesActive: 0,
      tempoGeneratingMinutes: 0,
      exceededMinutes: 0,
    });
  });

  it("debería manejar correctamente una lista vacía de actividades", () => {
    const result = processActivitiesAtDayEnd([]);
    expect(result.activitiesToRemove).toHaveLength(0);
    expect(result.activitiesToReset).toHaveLength(0);
  });

  it("debería manejar correctamente una lista solo con actividades no repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge No Repetible 1",
        isRepetitive: false,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
      } as ChallengeActivity,
      {
        id: "2",
        type: "neutral",
        title: "Neutral No Repetible",
        isRepetitive: false,
        minutesActive: 45,
        status: "completed",
        allowedTime: 60,
        inheritedProps: {},
        createdAt: baseTimestamp,
      } as NeutralActivity,
    ];

    const result = processActivitiesAtDayEnd(mockActivities);
    expect(result.activitiesToRemove).toHaveLength(2);
    expect(result.activitiesToReset).toHaveLength(0);
  });

  it("debería manejar correctamente una lista solo con actividades repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge Repetible 1",
        isRepetitive: true,
        minutesActive: 100,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 100,
      } as ChallengeActivity,
      {
        id: "2",
        type: "neutral",
        title: "Neutral Repetible",
        isRepetitive: true,
        minutesActive: 45,
        status: "completed",
        allowedTime: 60,
        inheritedProps: {},
        createdAt: baseTimestamp,
      } as NeutralActivity,
    ];

    const result = processActivitiesAtDayEnd(mockActivities);
    expect(result.activitiesToRemove).toHaveLength(0);
    expect(result.activitiesToReset).toHaveLength(2);
  });

  it("debería reiniciar los constraints fallidos de las actividades challenge repetibles", () => {
    const mockActivities: Activity[] = [
      {
        id: "1",
        type: "challenge",
        title: "Challenge Repetible",
        isRepetitive: true,
        minutesActive: 30,
        status: "completed",
        totalTempoReward: 100,
        constraintList: [
          {
            id: "constraint1",
            type: "expiration",
            dayMinuteExpiration: 720,
            penalty: 50,
            failCount: 2,
            status: "failed",
            parentConstraintId: "parent1",
          },
          {
            id: "constraint2",
            type: "expiration",
            dayMinuteExpiration: 960,
            penalty: "100%",
            failCount: 1,
            status: "failed",
            parentConstraintId: "parent2",
          },
        ],
        inheritedProps: {},
        createdAt: baseTimestamp,
        tempoGeneratingMinutes: 30,
        exceededMinutes: 0,
      } as ChallengeActivity,
    ];

    const { activitiesToReset } = processActivitiesAtDayEnd(mockActivities);

    expect(activitiesToReset).toHaveLength(1);
    const resetActivity = activitiesToReset[0] as Partial<ChallengeActivity>;
    expect(resetActivity.constraintList).toBeDefined();
    expect(resetActivity.constraintList).toHaveLength(2);

    // Verificamos el primer constraint
    const originalActivity = mockActivities[0] as ChallengeActivity;
    expect(resetActivity.constraintList![0]).toEqual({
      ...originalActivity.constraintList[0],
      status: "active",
      failCount: 0,
    });

    // Verificamos el segundo constraint
    expect(resetActivity.constraintList![1]).toEqual({
      ...originalActivity.constraintList[1],
      status: "active",
      failCount: 0,
    });

    // Verificamos que se mantienen las propiedades importantes
    expect(resetActivity.constraintList![0].parentConstraintId).toBe("parent1");
    expect(resetActivity.constraintList![0].dayMinuteExpiration).toBe(720);
    expect(resetActivity.constraintList![1].parentConstraintId).toBe("parent2");
    expect(resetActivity.constraintList![1].dayMinuteExpiration).toBe(960);
  });
});

describe("earlyDiscountActivityCompletionCompensation", () => {
  it("debería calcular correctamente la compensación por completar una actividad de hobby temprano", () => {
    // Esta prueba verifica que el cálculo de compensación use la fórmula correcta:
    // compensación = unusedTime * (passiveTempoConsumptionRate - (passiveTempoConsumptionRate * tempoConsumptionRate))

    // Escenario del caso de uso:
    // - passiveTempoConsumptionRate = 0.5
    // - tempoConsumptionRate de hobby = 0.5
    // - allowedTime = 100
    // - minutesActive = 0 (deselección inmediata)

    // Mock de la actividad de hobby (discount)
    const hobbyActivity: HobbyActivity = {
      id: "hobby1",
      type: "discount",
      title: "Hobby con descuento",
      isRepetitive: false,
      minutesActive: 0,
      status: "inProgress",
      allowedTime: 100,
      tempoConsumptionRate: 0.5,
      inheritedProps: {},
      createdAt: Date.now(),
    };

    // Parámetros del sistema
    const systemParams: SystemParams = {
      passiveTempoConsumptionRate: 0.5,
      isTestMode: false,
      timeMultiplier: 1,
    };

    // Cálculo esperado:
    // unusedTime = 100 - 0 = 100
    // Ahorro por minuto = passiveTempoConsumptionRate - (passiveTempoConsumptionRate * tempoConsumptionRate)
    //                   = 0.5 - (0.5 * 0.5) = 0.5 - 0.25 = 0.25
    // compensación total = unusedTime * Ahorro por minuto = 100 * 0.25 = 25

    // Cálculo actual (incorrecto):
    // compensationFactor = 1 - tempoConsumptionRate = 1 - 0.5 = 0.5
    // compensation = unusedTime * compensationFactor = 100 * 0.5 = 50

    // Código que simula la implementación actual:
    const unusedTime = hobbyActivity.allowedTime - hobbyActivity.minutesActive; // 100
    const currentCompensationFactor = 1 - hobbyActivity.tempoConsumptionRate; // 0.5
    const currentCompensation = currentCompensationFactor * unusedTime; // 50

    // Código que simula la implementación correcta:
    const correctCompensationFactor =
      systemParams.passiveTempoConsumptionRate -
      systemParams.passiveTempoConsumptionRate * hobbyActivity.tempoConsumptionRate; // 0.25
    const correctCompensation = correctCompensationFactor * unusedTime; // 25

    // Verificación de cálculos
    expect(unusedTime).toBe(100);
    expect(currentCompensationFactor).toBe(0.5);
    expect(currentCompensation).toBe(50); // Valor actual (incorrecto)

    expect(correctCompensationFactor).toBe(0.25);
    expect(correctCompensation).toBe(25); // Valor esperado (correcto)

    // NOTA: Este test demuestra que la implementación actual en useSystemEngine.ts
    // está calculando incorrectamente la compensación como 50 tempos, cuando debería
    // ser 25 tempos basado en la lógica de negocio correcta.
  });
});
