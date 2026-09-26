import { TimeBlockManager } from "../timeBlockManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState } from "../../types";

// Mock para SystemCore
jest.mock("../index");

// Mock para UtilityService
jest.mock("../utilityService");

describe("TimeBlockManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let timeBlockManager: TimeBlockManager;
  let mockAppState: AppState;
  let mockDefaultUUID: string;
  let mockUUID: string;
  let mockUUID2: string;
  let mockUUID3: string;
  let mockTimestamp: string;
  let mockCurrentMinutes: number;

  beforeEach(() => {
    // Configurar estado inicial de la aplicación
    mockAppState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        timeBlocks: [],
        userPreferences: {
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
      },
      currentDay: null,
    };

    // Configurar mocks
    mockDefaultUUID = "default-block-uuid";
    mockUUID = "test-uuid-123";
    mockUUID2 = "test-uuid-456";
    mockUUID3 = "test-uuid-789";
    mockTimestamp = "2023-01-01T12:00:00.000Z";
    mockCurrentMinutes = 720; // 12:00 PM

    // Configurar mocks para UtilityService
    jest.resetAllMocks();
    (UtilityService.generateUUID as jest.Mock).mockImplementation(() => {
      // Simular cada llamada consecutiva devolviendo un valor diferente
      if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 1) {
        return mockDefaultUUID;
      } else if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 2) {
        return mockUUID;
      } else if ((UtilityService.generateUUID as jest.Mock).mock.calls.length === 3) {
        return mockUUID2;
      } else {
        return mockUUID3;
      }
    });

    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
    (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);
    (UtilityService.formatTime as jest.Mock).mockImplementation((minutes) => {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
    });
    (UtilityService.parseTime as jest.Mock).mockImplementation((timeString) => {
      const [hours, minutes] = timeString.split(":").map(Number);
      return hours * 60 + minutes;
    });

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      mockAppState = updater(mockAppState);
    });

    // Crear instancia de TimeBlockManager
    timeBlockManager = new TimeBlockManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("constructor", () => {
    it("debe crear el bloque por defecto si no existe", () => {
      // Al instanciar TimeBlockManager, se debe crear el bloque por defecto
      expect(mockAppState.global.timeBlocks.length).toBe(1);
      expect(mockAppState.global.timeBlocks[0].isDefault).toBe(true);
      expect(mockAppState.global.timeBlocks[0].name).toBe("Por Hacer");
      expect(mockAppState.global.timeBlocks[0].id).toBe(mockDefaultUUID);
    });

    it("debe asegurar que el bloque por defecto exista al iniciar un nuevo día", () => {
      // Limpiar los bloques para simular un estado inicial sin bloques
      mockAppState.global.timeBlocks = [];

      // Simular inicialización de SystemCore y día activo
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [],
        activeActivityInstanceId: undefined,
      };

      // Preparar mock para isTimeBlockAvailable
      // Necesitamos sobrescribir el comportamiento para este test específico
      const isTimeBlockAvailableSpy = jest.spyOn(
        TimeBlockManager.prototype,
        "isTimeBlockAvailable"
      );
      isTimeBlockAvailableSpy.mockReturnValue(true);

      // Crear una nueva instancia de TimeBlockManager
      const newTimeBlockManager = new TimeBlockManager(systemCore);

      // Verificar que se creó el bloque por defecto
      expect(mockAppState.global.timeBlocks.length).toBe(1);
      expect(mockAppState.global.timeBlocks[0].isDefault).toBe(true);
      expect(mockAppState.global.timeBlocks[0].name).toBe("Por Hacer");

      // Verificar que el bloque por defecto está disponible
      const defaultBlock = newTimeBlockManager.getDefaultBlock();
      expect(defaultBlock).toBeDefined();
      expect(defaultBlock.isDefault).toBe(true);

      // Verificar que el bloque por defecto siempre está disponible
      expect(newTimeBlockManager.isTimeBlockAvailable(defaultBlock.id)).toBe(true);

      // Limpiar el spy
      isTimeBlockAvailableSpy.mockRestore();
    });
  });

  describe("createTimeBlock", () => {
    beforeEach(() => {
      // Resetear mocks específicamente para estos tests
      jest.restoreAllMocks();

      // Configurar estado inicial solo con el bloque por defecto
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      // Configurar explícitamente el primer UUID que se generará
      (UtilityService.generateUUID as jest.Mock)
        .mockReturnValueOnce(mockUUID)
        .mockReturnValueOnce(mockUUID2)
        .mockReturnValueOnce(mockUUID3);

      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    });

    it("debe crear un nuevo bloque de tiempo", () => {
      const result = timeBlockManager.createTimeBlock("Mañana", 360, 720);

      // Verificar que se haya generado el bloque correctamente
      expect(result).toEqual({
        id: mockUUID,
        name: "Mañana",
        startMinute: 360,
        endMinute: 720,
        isDefault: false,
        order: 1, // Orden 1 ya que el bloque por defecto tiene orden 0
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Verificar que se actualizó el estado global
      expect(systemCore.updateState).toHaveBeenCalled();
      expect(mockAppState.global.timeBlocks.length).toBe(2); // 1 default + 1 nuevo
      expect(mockAppState.global.timeBlocks[1]).toEqual(result);
    });

    it("debe asignar un orden incremental a nuevos bloques", () => {
      // Actualizar el mock de getState para que devuelva el estado actual,
      // de modo que refleje los cambios realizados por systemCore.updateState
      systemCore.getState.mockImplementation(() => mockAppState);

      // Crear primer bloque
      const block1 = timeBlockManager.createTimeBlock("Mañana", 360, 720);

      // Crear segundo bloque (no se solapa con el primero)
      const block2 = timeBlockManager.createTimeBlock("Tarde", 720, 1080);

      // Verificar que los órdenes son incrementales
      expect(block1.order).toBe(1); // Orden 1 después del bloque por defecto (orden 0)
      expect(block2.order).toBe(2); // Siguiente valor incremental
      expect(block1.id).toBe(mockUUID);
      expect(block2.id).toBe(mockUUID2);
    });

    it("debe lanzar error si el nombre está vacío", () => {
      expect(() => timeBlockManager.createTimeBlock("", 360, 720)).toThrow(
        "El nombre del bloque no puede estar vacío"
      );
    });

    it("debe lanzar error si los minutos están fuera de rango", () => {
      expect(() => timeBlockManager.createTimeBlock("Test", -10, 720)).toThrow(
        "Los minutos deben estar entre 0 y 1439"
      );

      expect(() => timeBlockManager.createTimeBlock("Test", 360, 1500)).toThrow(
        "Los minutos deben estar entre 0 y 1439"
      );
    });

    it("debe lanzar error si el inicio es mayor o igual al fin", () => {
      expect(() => timeBlockManager.createTimeBlock("Test", 720, 720)).toThrow(
        "La hora de inicio debe ser anterior a la hora de fin"
      );

      expect(() => timeBlockManager.createTimeBlock("Test", 800, 720)).toThrow(
        "La hora de inicio debe ser anterior a la hora de fin"
      );
    });

    it("debe lanzar error si hay solapamiento con otros bloques", () => {
      // Preparar el estado con un bloque "Mañana" ya existente
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Verificar que está el bloque en el estado
      expect(mockAppState.global.timeBlocks.length).toBe(2);
      expect(mockAppState.global.timeBlocks[1].name).toBe("Mañana");

      // Intentar crear un bloque que se solape (10:00 - 15:00)
      expect(() => timeBlockManager.createTimeBlock("Solapado", 600, 900)).toThrow(
        "El nuevo bloque se solapa con bloques existentes"
      );
    });
  });

  describe("updateTimeBlock", () => {
    let blockId: string;

    beforeEach(() => {
      // Resetear mocks para que se comporten como esperamos
      jest.restoreAllMocks();

      // Configurar estado con un bloque existente para actualizar
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      blockId = mockUUID;

      // Actualizar mockTimestamp para diferenciarlo
      mockTimestamp = "2023-01-01T13:00:00.000Z";
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);
    });

    it("debe actualizar un bloque existente", () => {
      const result = timeBlockManager.updateTimeBlock(blockId, { name: "Nueva Mañana" });

      // Verificar que se actualizó correctamente
      expect(result.name).toBe("Nueva Mañana");
      expect(result.updatedAt).toBe(mockTimestamp);

      // Verificar que no se modificaron otros campos
      expect(result.startMinute).toBe(360);
      expect(result.endMinute).toBe(720);
    });

    it("debe actualizar múltiples propiedades", () => {
      const result = timeBlockManager.updateTimeBlock(blockId, {
        name: "Nueva Mañana",
        startMinute: 300,
        endMinute: 660,
      });

      // Verificar que se actualizaron todas las propiedades
      expect(result.name).toBe("Nueva Mañana");
      expect(result.startMinute).toBe(300);
      expect(result.endMinute).toBe(660);
      expect(result.updatedAt).toBe(mockTimestamp);
    });

    it("debe lanzar error si el bloque no existe", () => {
      expect(() => timeBlockManager.updateTimeBlock("id-inexistente", { name: "Test" })).toThrow(
        "No se encontró el bloque con ID: id-inexistente"
      );
    });

    it("debe lanzar error si se intenta cambiar isDefault del bloque por defecto", () => {
      expect(() => timeBlockManager.updateTimeBlock(mockDefaultUUID, { isDefault: false })).toThrow(
        "No se puede convertir el bloque por defecto en un bloque regular"
      );
    });

    it("debe lanzar error si hay solapamiento con la actualización", () => {
      // Agregar otro bloque al estado
      mockAppState.global.timeBlocks.push({
        id: mockUUID2,
        name: "Tarde",
        startMinute: 720,
        endMinute: 1080,
        isDefault: false,
        order: 2,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });

      // Intentar expandir el primer bloque para que se solape
      expect(() => timeBlockManager.updateTimeBlock(blockId, { endMinute: 800 })).toThrow(
        "La actualización causa solapamiento con otros bloques"
      );
    });
  });

  describe("deleteTimeBlock", () => {
    let blockId: string;

    beforeEach(() => {
      // Configurar estado con un bloque existente para eliminar
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      blockId = mockUUID;
    });

    it("debe eliminar un bloque existente y mover actividades a 'Por Hacer' si moveActivitiesToTodo es true", () => {
      // Agregar actividades al bloque a eliminar
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [
          {
            id: "a1",
            templateId: "t1",
            blockId: blockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a2",
            templateId: "t2",
            blockId: blockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a3",
            templateId: "t3",
            blockId: mockDefaultUUID,
            order: 2,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ],
        activeActivityInstanceId: undefined,
      };

      // Eliminar el bloque y mover actividades
      timeBlockManager.deleteTimeBlock(blockId, true);

      // Las actividades deben estar ahora en el bloque por defecto
      const moved = mockAppState.currentDay!.activityInstances.filter(
        (a) => a.blockId === mockDefaultUUID
      );
      expect(moved.length).toBe(3); // a1, a2, a3
      expect(mockAppState.global.timeBlocks.find((b) => b.id === blockId)).toBeUndefined();
    });

    it("debe eliminar un bloque existente y eliminar actividades si moveActivitiesToTodo es false", () => {
      // Agregar actividades al bloque a eliminar
      mockAppState.currentDay = {
        day: {
          id: "day-id-123",
          state: "active",
          startTime: mockTimestamp,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        activityInstances: [
          {
            id: "a1",
            templateId: "t1",
            blockId: blockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a2",
            templateId: "t2",
            blockId: blockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: "a3",
            templateId: "t3",
            blockId: mockDefaultUUID,
            order: 2,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ],
        activeActivityInstanceId: undefined,
      };

      // Eliminar el bloque y eliminar actividades
      timeBlockManager.deleteTimeBlock(blockId, false);

      // Solo debe quedar la actividad en el bloque por defecto
      const remaining = mockAppState.currentDay!.activityInstances;
      expect(remaining.length).toBe(1);
      expect(remaining[0].id).toBe("a3");
      expect(mockAppState.global.timeBlocks.find((b) => b.id === blockId)).toBeUndefined();
    });

    it("debe lanzar error si el bloque no existe", () => {
      expect(() => timeBlockManager.deleteTimeBlock("id-inexistente")).toThrow(
        "No se encontró el bloque con ID: id-inexistente"
      );
    });

    it("debe lanzar error si se intenta eliminar el bloque por defecto", () => {
      expect(() => timeBlockManager.deleteTimeBlock(mockDefaultUUID)).toThrow(
        "No se puede eliminar el bloque por defecto"
      );
    });
  });

  describe("getTimeBlocks", () => {
    it("debe devolver todos los bloques ordenados por order", () => {
      // Crear un estado con varios bloques en desorden
      const bloques = [
        {
          id: mockDefaultUUID,
          name: "Por Hacer",
          startMinute: 0,
          endMinute: 0,
          isDefault: true,
          order: 0,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-noche",
          name: "Noche",
          startMinute: 1080,
          endMinute: 1439,
          isDefault: false,
          order: 3,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-tarde",
          name: "Tarde",
          startMinute: 720,
          endMinute: 1080,
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
        {
          id: "bloque-mañana",
          name: "Mañana",
          startMinute: 360,
          endMinute: 720,
          isDefault: false,
          order: 1,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        },
      ];

      // Los bloques están deliberadamente en orden incorrecto
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: bloques,
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Obtener los bloques ordenados
      const result = timeBlockManager.getTimeBlocks();

      // Verificar que están ordenados por order
      expect(result.length).toBe(4);
      expect(result[0].isDefault).toBe(true); // El bloque por defecto siempre es el primero (order 0)
      expect(result[1].name).toBe("Mañana");
      expect(result[2].name).toBe("Tarde");
      expect(result[3].name).toBe("Noche");
    });
  });

  describe("getTimeBlock", () => {
    it("debe devolver un bloque por su ID", () => {
      // Configurar estado con un bloque específico
      const bloque = {
        id: mockUUID,
        name: "Mañana",
        startMinute: 360,
        endMinute: 720,
        isDefault: false,
        order: 1,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };

      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            bloque,
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Obtener el bloque por ID
      const result = timeBlockManager.getTimeBlock(mockUUID);

      // Verificar que es el mismo bloque
      expect(result).toEqual(bloque);
    });

    it("debe devolver undefined si el bloque no existe", () => {
      const result = timeBlockManager.getTimeBlock("id-inexistente");
      expect(result).toBeUndefined();
    });
  });

  describe("getCurrentTimeBlock", () => {
    it("debe devolver el bloque actual según la hora del sistema", () => {
      // Configurar la hora actual como 14:30 (870 minutos)
      mockCurrentMinutes = 870;
      (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);

      // Configurar estado con bloques
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-mañana",
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-tarde",
              name: "Tarde",
              startMinute: 720,
              endMinute: 1080,
              isDefault: false,
              order: 2,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Obtener el bloque actual (debería ser "Tarde")
      const result = timeBlockManager.getCurrentTimeBlock();

      expect(result?.name).toBe("Tarde");
    });

    it("debe devolver null si no hay bloque para la hora actual", () => {
      // Configurar la hora actual como 05:00 (300 minutos)
      mockCurrentMinutes = 300;
      (UtilityService.getCurrentDayMinutes as jest.Mock).mockReturnValue(mockCurrentMinutes);

      // Configurar estado con bloques que no cubren la hora actual
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: "bloque-mañana",
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // No hay bloque para las 5:00
      const result = timeBlockManager.getCurrentTimeBlock();

      expect(result).toBe(null);
    });
  });

  describe("getDefaultBlock", () => {
    it("debe devolver el bloque por defecto", () => {
      // Resetear mocks para probar getDefaultBlock
      jest.restoreAllMocks();

      // Simular que el bloque por defecto ya existe
      (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockDefaultUUID);

      const mockAppStateWithDefault = {
        ...mockAppState,
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: mockDefaultUUID,
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
      };

      // Simular que el estado contiene el bloque por defecto
      systemCore.getState = jest.fn().mockReturnValue(mockAppStateWithDefault);

      // Obtener bloque por defecto
      const result = timeBlockManager.getDefaultBlock();

      // Verificar que es el bloque por defecto
      expect(result.isDefault).toBe(true);
      expect(result.name).toBe("Por Hacer");
      expect(result.id).toBe(mockDefaultUUID);
    });

    it("debe crear el bloque por defecto si no existe", () => {
      // Restablecer estado vacío
      mockAppState.global.timeBlocks = [];
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Configurar el mock de UUID para que devuelva el ID esperado
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValue("default-block-id");

      // Llamar a getDefaultBlock debería crear un bloque por defecto
      const result = timeBlockManager.getDefaultBlock();

      expect(result.id).toBe("default-block-id");
      expect(result.isDefault).toBe(true);
      expect(result.name).toBe("Por Hacer");
    });
  });

  describe("isTimeBlockAvailable", () => {
    let morningBlockId: string;
    let afternoonBlockId: string;

    beforeEach(() => {
      // Configurar tests con valores específicos
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce("default-block-id");
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce(mockUUID);
      (UtilityService.generateUUID as jest.Mock).mockReturnValueOnce(mockUUID2);
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

      // Crear un estado limpio con bloques predefinidos
      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [
            {
              id: "default-block-id",
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 0,
              isDefault: true,
              order: 0,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID,
              name: "Mañana",
              startMinute: 360,
              endMinute: 720,
              isDefault: false,
              order: 1,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
            {
              id: mockUUID2,
              name: "Tarde",
              startMinute: 720,
              endMinute: 1080,
              isDefault: false,
              order: 2,
              createdAt: mockTimestamp,
              updatedAt: mockTimestamp,
            },
          ],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
      morningBlockId = mockUUID;
      afternoonBlockId = mockUUID2;

      // Verificar que se crearon correctamente
      expect(mockAppState.global.timeBlocks.length).toBe(3);
      expect(mockAppState.global.timeBlocks[1].id).toBe(mockUUID);
      expect(mockAppState.global.timeBlocks[2].id).toBe(mockUUID2);
    });

    it("debe devolver true para el bloque por defecto", () => {
      const defaultBlock = timeBlockManager.getDefaultBlock();

      expect(timeBlockManager.isTimeBlockAvailable(defaultBlock.id)).toBe(true);
    });

    it("debe devolver true para el bloque actual", () => {
      // Afternoon comienza exactamente a las 12:00
      expect(timeBlockManager.isTimeBlockAvailable(afternoonBlockId)).toBe(true);
    });

    it("debe devolver false para un bloque no activo", () => {
      // Morning ya terminó a las 12:00
      expect(timeBlockManager.isTimeBlockAvailable(morningBlockId)).toBe(false);
    });

    it("debe devolver false para un ID inexistente", () => {
      expect(timeBlockManager.isTimeBlockAvailable("id-inexistente")).toBe(false);
    });
  });

  describe("createDefaultBlock", () => {
    it("debe crear un nuevo bloque por defecto", () => {
      // Restablecer estado vacío
      mockAppState.global.timeBlocks = [];
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // Configurar el mock de UUID para que devuelva el ID esperado
      jest.restoreAllMocks();
      (UtilityService.generateUUID as jest.Mock).mockReturnValue("default-block-id");
      (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

      // Crear bloque por defecto
      const result = timeBlockManager.createDefaultBlock();

      expect(result).toEqual({
        id: "default-block-id",
        name: "Por Hacer",
        startMinute: 0,
        endMinute: 1439, // Actualizado para reflejar el nuevo rango de "todo el día"
        isDefault: true,
        order: 0,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      });
    });

    it("debe devolver el bloque por defecto existente sin crear uno nuevo", () => {
      // Crear un estado con un bloque por defecto
      const existingDefault = {
        id: mockDefaultUUID,
        name: "Por Hacer",
        startMinute: 0,
        endMinute: 0,
        isDefault: true,
        order: 0,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      };

      mockAppState = {
        global: {
          ...mockAppState.global,
          timeBlocks: [existingDefault],
        },
        currentDay: null,
      };

      systemCore.getState = jest.fn().mockReturnValue(mockAppState);

      // El mock no debería usarse porque se devuelve el existente
      jest.restoreAllMocks();

      // Llamar a createDefaultBlock debería devolver el bloque existente
      const result = timeBlockManager.createDefaultBlock();

      // Debe devolver el existente, no crear uno nuevo
      expect(result.id).toBe(existingDefault.id);
      expect(mockAppState.global.timeBlocks.length).toBe(1);
    });
  });

  describe("convertMinutesToTimeString", () => {
    it("debe convertir minutos a formato de hora", () => {
      (UtilityService.formatTime as jest.Mock).mockReturnValue("12:30");

      const result = timeBlockManager.convertMinutesToTimeString(750);

      expect(result).toBe("12:30");
      expect(UtilityService.formatTime).toHaveBeenCalledWith(750);
    });
  });

  describe("convertTimeStringToMinutes", () => {
    it("debe convertir formato de hora a minutos", () => {
      (UtilityService.parseTime as jest.Mock).mockReturnValue(750);

      const result = timeBlockManager.convertTimeStringToMinutes("12:30");

      expect(result).toBe(750);
      expect(UtilityService.parseTime).toHaveBeenCalledWith("12:30");
    });
  });
});
