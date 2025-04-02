import { DayManager } from "../dayManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState } from "../../types";

// Mock para SystemCore
jest.mock("../index");

// Mock para UtilityService
jest.mock("../utilityService");

describe("DayManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let dayManager: DayManager;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;

  beforeEach(() => {
    // Configurar estado inicial de la aplicación
    mockAppState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: {
          hiddenSubjectiveVariableIds: [],
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
      },
      currentDay: null,
    };

    // Configurar mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      mockAppState = updater(mockAppState);
    });

    // Crear instancia de DayManager
    dayManager = new DayManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("startDay", () => {
    it("debe crear un nuevo día activo", () => {
      const result = dayManager.startDay();

      // Verificar que se haya generado el día correctamente
      expect(result).toEqual({
        id: mockUUID,
        state: "active",
        startTime: mockTimestamp,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Verificar que se actualizó el estado global
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.days.length).toBe(1);
      expect(mockAppState.global.days[0]).toEqual(result);

      // Verificar que se actualizó el día actual
      expect(mockAppState.currentDay).not.toBeNull();
      expect(mockAppState.currentDay?.day).toEqual(result);
    });

    it("debe lanzar un error si ya existe un día activo", () => {
      // Crear un día activo primero
      dayManager.startDay();

      // Intentar crear otro día activo
      expect(() => dayManager.startDay()).toThrow(
        "No se puede iniciar un nuevo día mientras hay un día activo"
      );
    });
  });

  describe("endDay", () => {
    it("debe finalizar el día activo", () => {
      // Crear un día activo
      const day = dayManager.startDay();

      // Mock para un timestamp diferente al finalizar
      const endTimestamp = "2023-01-01T18:00:00.000Z";
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(endTimestamp);

      // Finalizar el día
      const result = dayManager.endDay();

      // Verificar que se actualizó el día correctamente
      expect(result).toEqual({
        ...day,
        state: "inactive",
        endTime: endTimestamp,
        updatedAt: endTimestamp,
      });

      // Verificar que se actualizó el estado global
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.days.length).toBe(1);
      expect(mockAppState.global.days[0]).toEqual(result);

      // Verificar que se limpió el día actual
      expect(mockAppState.currentDay).toBeNull();
    });

    it("debe lanzar un error si no hay un día activo", () => {
      expect(() => dayManager.endDay()).toThrow("No hay un día activo para finalizar");
    });
  });

  describe("getCurrentDay", () => {
    it("debe devolver el día activo", () => {
      // Crear un día activo
      const day = dayManager.startDay();

      // Obtener el día activo
      const result = dayManager.getCurrentDay();

      // Verificar que se devolvió el día correcto
      expect(result).toEqual(day);
    });

    it("debe devolver null si no hay un día activo", () => {
      const result = dayManager.getCurrentDay();
      expect(result).toBeNull();
    });
  });

  describe("getDays", () => {
    it("debe devolver todos los días registrados", () => {
      // Crear un día activo
      const day = dayManager.startDay();

      // Obtener los días
      const result = dayManager.getDays();

      // Verificar que se devolvieron todos los días
      expect(result).toEqual([day]);
    });
  });

  describe("isDayActive", () => {
    it("debe devolver true si hay un día activo", () => {
      // Crear un día activo
      dayManager.startDay();

      // Verificar que isDayActive devuelve true
      expect(dayManager.isDayActive()).toBe(true);
    });

    it("debe devolver false si no hay un día activo", () => {
      expect(dayManager.isDayActive()).toBe(false);
    });
  });
});
