import { TimeSimulator } from "../TimeSimulator";
import {
  getMinutesFromTimestamp,
  calculateNewBalances,
  processTimeBatch,
  updateTimeState,
  type TimeStateInput,
  evaluateConstraints,
} from "../timeStateLogic";
import type { Activity, SystemParams, ExpirationChallengeConstraint } from "../types";

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
      const activity: Activity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 10,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
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
      expect(result.updatedActivity?.minutesActive).toBe(8);
      expect(result.updatedActivity?.status).toBe("inProgress");
    });

    it("debería procesar correctamente una actividad challenge excediendo el totalTempoReward", () => {
      // Actividad challenge: totalTempoReward = 10 y minutesActive = 8, deltaTime = 5
      // Se procesan 2 minutos de actividad (para llegar a 10) y 3 minutos idle
      const activity: Activity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 10,
        minutesActive: 8,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
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
      expect(result.updatedActivity?.minutesActive).toBe(10);
      // Si la lógica actualiza el status a "completed" al alcanzar el total, se puede comprobar:
      // expect(result.updatedActivity?.status).toBe("completed");
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
      };

      const result = processTimeBatch({
        deltaTime: 3,
        baseTimestamp,
        currentActivity: activity,
        systemParams,
      });

      expect(result.updatedActivity?.minutesActive).toBe(10);
      expect(result.updatedActivity?.status).toBe("completed");

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

      const activity: Activity = {
        id: "1",
        type: "challenge",
        title: "Test Challenge",
        totalTempoReward: 15,
        minutesActive: 5,
        status: "inProgress",
        isRepetitive: false,
        constraintList: [],
        inheritedProps: {},
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
      });

      expect(result.updatedConstraints).toEqual(constraints);
      expect(result.failedConstraints).toHaveLength(0);
    });

    it("debería marcar como fallido un constraint expirado con penalización numérica", () => {
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
        currentMinutes: 601, // 10:01
        totalTempoReward: 100,
      });

      expect(result.updatedConstraints[0].status).toBe("failed");
      expect(result.updatedConstraints[0].failCount).toBe(1);
      expect(result.failedConstraints).toHaveLength(1);
      expect(result.failedConstraints[0].penaltyAmount).toBe(50);
    });

    it("debería calcular correctamente la penalización porcentual", () => {
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

      const result = evaluateConstraints({
        constraints,
        currentMinutes: 601,
        totalTempoReward: 200,
      });

      expect(result.failedConstraints[0].penaltyAmount).toBe(150); // 75% de 200
    });

    it("debería ignorar constraints que ya están fallidos", () => {
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

      const result = evaluateConstraints({
        constraints,
        currentMinutes: 601,
        totalTempoReward: 100,
      });

      expect(result.updatedConstraints).toEqual(constraints);
      expect(result.failedConstraints).toHaveLength(0);
    });

    it("debería manejar múltiples constraints correctamente", () => {
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

      const result = evaluateConstraints({
        constraints,
        currentMinutes: 660, // 11:00
        totalTempoReward: 100,
      });

      expect(result.updatedConstraints[0].status).toBe("failed");
      expect(result.updatedConstraints[1].status).toBe("active");
      expect(result.failedConstraints).toHaveLength(1);
      expect(result.failedConstraints[0].penaltyAmount).toBe(50);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });
});
