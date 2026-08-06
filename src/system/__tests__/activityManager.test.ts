import { ActivityManager } from "../activityManager";
import { SystemCore } from "../index";
import { UtilityService } from "../utilityService";
import type { AppState, ActivityTemplate, TimeBlock } from "../../types";

// Mock para SystemCore
jest.mock("../index");

// Mock para UtilityService
jest.mock("../utilityService");

describe("ActivityManager", () => {
  let systemCore: jest.Mocked<SystemCore>;
  let activityManager: ActivityManager;
  let mockAppState: AppState;
  let mockUUID: string;
  let mockTimestamp: string;
  let mockTemplateId: string;
  let mockBlockId: string;
  let mockDayId: string;

  // Función auxiliar para configurar un día activo
  const setupActiveDay = () => {
    mockDayId = "day-id-123";
    mockAppState.currentDay = {
      day: {
        id: mockDayId,
        state: "active",
        startTime: mockTimestamp,
        createdAt: mockTimestamp,
        updatedAt: mockTimestamp,
      },
      activityInstances: [],
      activeActivityInstanceId: undefined,
    };
  };

  // Función auxiliar para configurar una plantilla de actividad
  const setupActivityTemplate = (
    type: "clear-objective" | "flexible-duration" | "timeboxing" = "clear-objective"
  ): ActivityTemplate => {
    mockTemplateId = "template-id-123";
    const template: ActivityTemplate = {
      id: mockTemplateId,
      title: "Test Activity",
      description: "Test description",
      type,
      isSystemActivity: false,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    // Configurar settings según el tipo
    if (type === "clear-objective") {
      template.clearObjectiveSettings = {
        estimatedDurationMinutes: 30,
      };
    } else if (type === "flexible-duration") {
      template.flexibleDurationSettings = {
        minimumDurationMinutes: 15,
        maximumDurationMinutes: 60,
      };
    } else if (type === "timeboxing") {
      template.timeboxingSettings = {
        type: "both",
        minimumDurationMinutes: 20,
        maximumDurationMinutes: 45,
      };
    }

    mockAppState.global.activityTemplates.push(template);
    return template;
  };

  // Función auxiliar para configurar un bloque de tiempo
  const setupTimeBlock = (): TimeBlock => {
    mockBlockId = "block-id-123";
    const timeBlock: TimeBlock = {
      id: mockBlockId,
      name: "Test Block",
      startMinute: 540, // 9:00 AM
      endMinute: 720, // 12:00 PM
      isDefault: false,
      order: 1,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    mockAppState.global.timeBlocks.push(timeBlock);
    return timeBlock;
  };

  beforeEach(() => {
    // Configurar estado inicial de la aplicación
    mockAppState = {
      global: {
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        timeBlocks: [],
        userPreferences: {
          dailyTempoTarget: 1000,
          updatedAt: "2023-01-01T00:00:00.000Z",
        },
        completedActivityRecords: [],
        eventInstances: [],
      },
      currentDay: null,
    };

    // Configurar mocks
    mockUUID = "test-uuid-123";
    mockTimestamp = "2023-01-01T12:00:00.000Z";

    (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
    (UtilityService.getCurrentISODateTime as jest.Mock).mockReturnValue(mockTimestamp);

    // Usar implementaciones reales para las funciones de cálculo de tempos
    // (auto-mock las habría dejado como undefined)
    const actualUtilityService = jest.requireActual("../utilityService")
      .UtilityService as typeof UtilityService;
    (UtilityService.calculateBeatEstimate as jest.Mock).mockImplementation(
      actualUtilityService.calculateBeatEstimate
    );
    (UtilityService.calculateTemposAwarded as jest.Mock).mockImplementation(
      actualUtilityService.calculateTemposAwarded
    );

    systemCore = new SystemCore() as jest.Mocked<SystemCore>;
    systemCore.getState = jest.fn().mockReturnValue(mockAppState);

    // Este es el problema: la implementación del mock no está usando el mismo objeto para actualizar
    systemCore.updateState = jest.fn().mockImplementation((updater) => {
      // Creamos una copia profunda del estado para evitar mutaciones inesperadas
      const stateCopy = JSON.parse(JSON.stringify(mockAppState));

      // Actualizar el estado mockAppState que se usa en todas las pruebas
      mockAppState = updater(stateCopy);

      // También retornar el objeto mockAppState que se usa en systemCore.getState
      systemCore.getState = jest.fn().mockReturnValue(mockAppState);
    });

    // Crear instancia de ActivityManager
    activityManager = new ActivityManager(systemCore);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ===============================================
  // Pruebas de Gestión de Plantillas
  // ===============================================

  describe("Gestión de plantillas", () => {
    describe("createActivityTemplate", () => {
      it("debe crear una nueva plantilla de actividad", () => {
        const templateData = {
          title: "Nueva Actividad",
          description: "Descripción de prueba",
          type: "clear-objective" as const,
          isSystemActivity: false,
          clearObjectiveSettings: {
            estimatedDurationMinutes: 30,
          },
        };

        const result = activityManager.createActivityTemplate(templateData);

        // Verificar que se creó la plantilla correctamente
        expect(result).toEqual({
          ...templateData,
          id: mockUUID,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Verificar que se actualizó el estado global
        expect(systemCore.updateState).toHaveBeenCalled();
        expect(mockAppState.global.activityTemplates.length).toBe(1);
        expect(mockAppState.global.activityTemplates[0]).toEqual(result);
      });
    });

    describe("updateActivityTemplate", () => {
      it("debe actualizar una plantilla existente", () => {
        // Crear una plantilla primero
        const template = setupActivityTemplate();

        // Datos para actualizar
        const updateData = {
          title: "Título Actualizado",
          description: "Descripción actualizada",
        };

        const result = activityManager.updateActivityTemplate(template.id, updateData);

        // Verificar que se actualizó correctamente
        expect(result).toEqual({
          ...template,
          ...updateData,
          updatedAt: mockTimestamp,
        });

        // Verificar que se actualizó en el estado global
        expect(mockAppState.global.activityTemplates[0]).toEqual(result);
      });

      it("debe lanzar un error si la plantilla no existe", () => {
        expect(() => {
          activityManager.updateActivityTemplate("non-existent-id", { title: "Test" });
        }).toThrow("Plantilla de actividad con ID non-existent-id no encontrada");
      });
    });

    describe("deleteActivityTemplate", () => {
      it("debe eliminar una plantilla existente", () => {
        // Crear una plantilla primero
        const template = setupActivityTemplate();

        activityManager.deleteActivityTemplate(template.id);

        // Verificar que se eliminó la plantilla
        expect(mockAppState.global.activityTemplates.length).toBe(0);
      });

      it("debe lanzar un error si la plantilla no existe", () => {
        expect(() => {
          activityManager.deleteActivityTemplate("non-existent-id");
        }).toThrow("Plantilla de actividad con ID non-existent-id no encontrada");
      });

      it("debe lanzar un error si la plantilla tiene instancias activas", () => {
        // Crear una plantilla
        const template = setupActivityTemplate();

        // Configurar día activo y crear una instancia
        setupActiveDay();
        mockAppState.currentDay!.activityInstances.push({
          id: "instance-id-123",
          templateId: template.id,
          blockId: "block-id-123",
          order: 0,
          state: "instantiated",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        expect(() => {
          activityManager.deleteActivityTemplate(template.id);
        }).toThrow(
          `No se puede eliminar la plantilla ${template.id} porque tiene instancias activas`
        );
      });
    });

    describe("getActivityTemplates", () => {
      it("debe devolver todas las plantillas", () => {
        // Crear varias plantillas
        const template1 = setupActivityTemplate("clear-objective");

        // Resetear el mockUUID para crear un ID diferente
        mockUUID = "template-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const template2 = setupActivityTemplate("flexible-duration");

        const result = activityManager.getActivityTemplates();

        expect(result).toEqual([template1, template2]);
      });
    });

    describe("getActivityTemplate", () => {
      it("debe devolver una plantilla específica", () => {
        // Crear una plantilla
        const template = setupActivityTemplate();

        const result = activityManager.getActivityTemplate(template.id);

        expect(result).toEqual(template);
      });

      it("debe devolver undefined si la plantilla no existe", () => {
        const result = activityManager.getActivityTemplate("non-existent-id");

        expect(result).toBeUndefined();
      });
    });
  });

  // ===============================================
  // Pruebas de Gestión de Instancias
  // ===============================================

  describe("Gestión de instancias", () => {
    beforeEach(() => {
      // Configurar plantilla, bloque y día activo para todas las pruebas
      setupActivityTemplate();
      setupTimeBlock();
      setupActiveDay();
    });

    describe("createActivityInstance", () => {
      it("debe crear una instancia a partir de una plantilla", () => {
        const result = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Verificar que se creó la instancia correctamente
        expect(result).toEqual({
          id: mockUUID,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "instantiated",
          clearObjectiveSettings: {
            estimatedDurationMinutes: 30,
          },
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Verificar que se actualizó el estado
        expect(mockAppState.currentDay?.activityInstances.length).toBe(1);
        expect(mockAppState.currentDay?.activityInstances[0]).toEqual(result);
      });

      it("debe aplicar configuraciones dinámicas", () => {
        const dynamicSettings = {
          clearObjectiveSettings: {
            estimatedDurationMinutes: 45, // Valor diferente al de la plantilla
          },
        };

        const result = activityManager.createActivityInstance(
          mockTemplateId,
          mockBlockId,
          dynamicSettings
        );

        // Verificar que se aplicaron las configuraciones dinámicas
        expect(result.clearObjectiveSettings?.estimatedDurationMinutes).toBe(45);
      });

      it("debe lanzar un error si no hay día activo", () => {
        // Quitar el día activo
        mockAppState.currentDay = null;

        expect(() => {
          activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        }).toThrow("No hay un día activo para crear instancias");
      });

      it("debe lanzar un error si la plantilla no existe", () => {
        expect(() => {
          activityManager.createActivityInstance("non-existent-template", mockBlockId);
        }).toThrow("Plantilla con ID non-existent-template no encontrada");
      });
    });

    describe("updateActivityInstance", () => {
      it("debe actualizar una instancia existente", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Datos para actualizar
        const updateData = {
          clearObjectiveSettings: {
            estimatedDurationMinutes: 60,
          },
        };

        const result = activityManager.updateActivityInstance(instance.id, updateData);

        // Verificar que se actualizó correctamente
        expect(result.clearObjectiveSettings?.estimatedDurationMinutes).toBe(60);
        expect(result.updatedAt).toBe(mockTimestamp);
      });

      it("debe lanzar un error si se intenta cambiar el estado directamente", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Intentar cambiar el estado directamente
        expect(() => {
          activityManager.updateActivityInstance(instance.id, { state: "active" });
        }).toThrow("No se puede cambiar el estado directamente. Use los métodos específicos.");
      });
    });

    describe("moveActivityInstance", () => {
      it("debe mover una instancia a otro bloque", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Crear otro bloque
        mockUUID = "new-block-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);
        const newBlockId = mockUUID;
        mockAppState.global.timeBlocks.push({
          id: newBlockId,
          name: "New Block",
          startMinute: 780,
          endMinute: 900,
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Mover la instancia
        const result = activityManager.moveActivityInstance(instance.id, newBlockId);

        // Verificar que se movió correctamente
        expect(result.blockId).toBe(newBlockId);
        expect(result.order).toBe(0); // Primer elemento en el nuevo bloque
      });

      it("debe permitir especificar un nuevo orden", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Mover la instancia especificando un orden
        const result = activityManager.moveActivityInstance(instance.id, mockBlockId, 5);

        // Verificar que se actualizó el orden
        expect(result.order).toBe(5);
      });

      it("debe lanzar un error si se intenta mover una actividad activa", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activar la instancia
        activityManager.activateActivity(instance.id);

        // Intentar mover la actividad activa
        expect(() => {
          activityManager.moveActivityInstance(instance.id, "new-block-id");
        }).toThrow("No se puede mover una actividad activa");
      });
    });

    describe("deleteActivityInstance", () => {
      it("debe eliminar una instancia", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        activityManager.deleteActivityInstance(instance.id);

        // Verificar que se eliminó la instancia
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
      });

      it("debe lanzar un error si se intenta eliminar una actividad activa", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activar la instancia
        activityManager.activateActivity(instance.id);

        // Intentar eliminar la actividad activa
        expect(() => {
          activityManager.deleteActivityInstance(instance.id);
        }).toThrow("No se puede eliminar una actividad activa");
      });
    });

    describe("getActivityInstances", () => {
      it("debe devolver todas las instancias", () => {
        // Crear varias instancias
        const instance1 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Cambiar el mockUUID para crear un ID diferente
        mockUUID = "instance-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const instance2 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.getActivityInstances();

        expect(result).toEqual([instance1, instance2]);
      });

      it("debe lanzar un error si no hay día activo", () => {
        // Quitar el día activo
        mockAppState.currentDay = null;

        expect(() => {
          activityManager.getActivityInstances();
        }).toThrow("No hay un día activo");
      });
    });

    describe("getActivityInstance", () => {
      it("debe devolver una instancia específica", () => {
        // Crear una instancia
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.getActivityInstance(instance.id);

        expect(result).toEqual(instance);
      });

      it("debe devolver undefined si la instancia no existe", () => {
        const result = activityManager.getActivityInstance("non-existent-id");

        expect(result).toBeUndefined();
      });
    });
  });

  // ===============================================
  // Pruebas de Control de Estado
  // ===============================================

  describe("Control de estado", () => {
    beforeEach(() => {
      // Configurar plantilla, bloque y día activo para todas las pruebas
      setupActivityTemplate();
      setupTimeBlock();
      setupActiveDay();
    });

    describe("activateActivity", () => {
      it("debe activar una instancia de actividad", () => {
        // Crear una instancia primero
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        const result = activityManager.activateActivity(instance.id);

        // Verificar que se activó correctamente
        expect(result.state).toBe("active");
        expect(result.startTime).toBe(mockTimestamp);

        // Verificar que se actualizó el ID de la actividad activa
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBe(instance.id);
      });

      it("lanza error si ya hay una actividad activa (la UI debe cerrarla antes)", () => {
        // Crear dos instancias
        const instance1 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        mockUUID = "instance-id-456";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const instance2 = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        // Activar la primera instancia
        activityManager.activateActivity(instance1.id);

        // Intentar activar la segunda instancia con la primera aún activa: debe lanzar error
        // (la UI debe cerrar la primera vía completeActivity/interruptActivity antes)
        expect(() => {
          activityManager.activateActivity(instance2.id);
        }).toThrow(/Hay una actividad activa/);

        // Verificar que la primera sigue activa (no se cerró automáticamente)
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBe(instance1.id);
        expect(mockAppState.currentDay?.activityInstances.length).toBe(2);
      });
    });

    describe("completeActivity", () => {
      beforeEach(() => {
        // Configurar plantilla, bloque y día activo
        setupActivityTemplate();
        setupTimeBlock();
        setupActiveDay();
      });

      it("debe completar la actividad activa y crear un registro", () => {
        // Crear una instancia
        const instanceId = "instance-id-123";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z", // 30 minutos antes de mockTimestamp
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });

        // Marcar como actividad activa
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        // Completar la actividad
        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 8 });

        // Verificar que se creó el registro de actividad completada
        expect(result).toBeDefined();
        expect(result.record.state).toBe("completed");
        expect(result.record.templateId).toBe(mockTemplateId);
        expect(result.record.dayId).toBe(mockDayId);
        expect(result.record.satisfactionScore).toBe(8);
        expect(result.temposAwarded).toBeGreaterThan(0);

        // Verificar que la instancia se eliminó del día actual
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();

        // Verificar que el registro se agregó a completedActivityRecords
        expect(mockAppState.global.completedActivityRecords.length).toBe(1);
        expect(mockAppState.global.completedActivityRecords[0]).toEqual(result.record);
      });

      it("debe completar solo la actividad activa sin afectar a otras actividades", () => {
        // Crear varias instancias de actividad en diferentes bloques
        const activeInstanceId = "active-instance-id";
        const otherInstanceId1 = "other-instance-id-1";
        const otherInstanceId2 = "other-instance-id-2";

        // Crear un segundo bloque
        const otherBlockId = "other-block-id";
        mockAppState.global.timeBlocks.push({
          id: otherBlockId,
          name: "Otro Bloque",
          startMinute: 780, // 13:00
          endMinute: 900, // 15:00
          isDefault: false,
          order: 2,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });

        // Crear tres instancias: una activa y dos inactivas
        mockAppState.currentDay!.activityInstances = [
          {
            id: activeInstanceId,
            templateId: mockTemplateId,
            blockId: mockBlockId,
            order: 0,
            state: "active",
            startTime: "2023-01-01T11:30:00.000Z",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: otherInstanceId1,
            templateId: mockTemplateId,
            blockId: mockBlockId,
            order: 1,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
          {
            id: otherInstanceId2,
            templateId: mockTemplateId,
            blockId: otherBlockId,
            order: 0,
            state: "instantiated",
            createdAt: mockTimestamp,
            updatedAt: mockTimestamp,
          },
        ];

        // Marcar la actividad activa
        mockAppState.currentDay!.activeActivityInstanceId = activeInstanceId;

        // Completar la actividad activa
        activityManager.completeActivity(activeInstanceId, { satisfactionScore: 7 });

        // Verificar que solo la actividad activa se eliminó
        expect(mockAppState.currentDay?.activityInstances.length).toBe(2);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();

        // Verificar que las otras actividades siguen existiendo
        const remainingIds = mockAppState.currentDay!.activityInstances.map((i) => i.id);
        expect(remainingIds).toContain(otherInstanceId1);
        expect(remainingIds).toContain(otherInstanceId2);
        expect(remainingIds).not.toContain(activeInstanceId);

        // Verificar que se agregó exactamente un registro a completedActivityRecords
        expect(mockAppState.global.completedActivityRecords.length).toBe(1);
        expect(mockAppState.global.completedActivityRecords[0].templateId).toBe(mockTemplateId);
      });

      it("debe lanzar un error si se intenta completar una actividad no activa", () => {
        // Crear una instancia sin activarla
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        expect(() => {
          activityManager.completeActivity(instance.id, { satisfactionScore: 8 });
        }).toThrow("Solo se puede completar la actividad activa actual");
      });

      it("debe calcular tempos correctamente: clear-objective score 10 = 130%", () => {
        // 30 min estimado, 30 min real → score 10 = 130% × 30 = 39
        const instanceId = "instance-no-bonus";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        expect(result.beatEstimate).toBe(false);
        // Fórmula MVP v3: score 10 × 130% × 30 estimado = 39
        expect(result.temposAwarded).toBe(39);
        expect(result.record.beatEstimate).toBe(false);
        expect(result.record.temposAwarded).toBe(39);
      });

      it("debe usar el estimado (no la duración) cuando hay beat", () => {
        // 30 min estimado, 20 min real (66%) → beat, score 10 = 130% × 30 = 39
        // El beat ya no otorga +5 bonus, pero el score sí recompensa más
        const instanceId = "instance-bonus";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:40:00.000Z", // 20 min antes de mockTimestamp
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        expect(result.beatEstimate).toBe(true);
        // Fórmula MVP v3: score 10 × 130% × 30 estimado (no 20 real) = 39
        expect(result.temposAwarded).toBe(39);
        expect(result.record.beatEstimate).toBe(true);
      });

      it("debe NO dar bonus para timeboxing aunque batiera el estimado", () => {
        // Cambiar plantilla a timeboxing
        mockAppState.global.activityTemplates[0].type = "timeboxing";
        mockAppState.global.activityTemplates[0].clearObjectiveSettings = undefined;
        mockAppState.global.activityTemplates[0].timeboxingSettings = {
          type: "minimum-time",
          minimumDurationMinutes: 15,
        };

        const instanceId = "instance-timeboxing";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z", // 15 min antes
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 10 });

        // timeboxing NUNCA tiene beatEstimate (no hay estimado en el mismo sentido)
        expect(result.beatEstimate).toBe(false);
        // Fórmula MVP v3: score 10 × 130% × 15 duración (no hay estimado) = 20
        expect(result.temposAwarded).toBe(20);
      });

      it("score 0 → 0 tempos totales, aunque haya beat", () => {
        // 30 min estimado, 20 min real (66%) → beat disponible, pero score 0
        const instanceId = "instance-zero";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:40:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const result = activityManager.completeActivity(instanceId, { satisfactionScore: 0 });

        // Fórmula MVP v3: score 0-6 = 0 tempos
        expect(result.temposAwarded).toBe(0);
      });

      it("usa endTime congelado: la duración no cambia entre request y confirm", () => {
        // Bloqueante 6 de Codex: endTime debe preservarse desde requestCompletion.
        // Setup: actividad activa con startTime hace 20 min.
        const instanceId = "instance-frozen";
        const startTime = "2023-01-01T11:40:00.000Z"; // 20 min antes de mockTimestamp (12:00)
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime,
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
          clearObjectiveSettings: { estimatedDurationMinutes: 30 },
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        // requestCompletion congela requestedAt = mockTimestamp (= 20 min)
        const request = activityManager.requestCompletion(instanceId);
        expect(request.durationMinutes).toBe(20);

        // El usuario permanece 5 minutos en el modal (cambiamos Date.now virtualmente)
        // Después completeActivity con endTime congelado: debe usar el endTime del request
        const result = activityManager.completeActivity(instanceId, {
          satisfactionScore: 10,
          endTime: request.requestedAt, // congelado
        });

        // La duración debe ser la del request (20), no la del "ahora" (25)
        expect(result.record.durationMinutes).toBe(20);
        expect(result.record.endTime).toBe(mockTimestamp); // respeta endTime pasado
      });

      it("lanza error con score inválido (< 0)", () => {
        const instanceId = "instance-invalid";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        expect(() => {
          activityManager.completeActivity(instanceId, { satisfactionScore: -1 });
        }).toThrow("satisfactionScore debe ser un entero entre 0 y 10");
      });

      it("lanza error con score fraccionario (no entero)", () => {
        const instanceId = "instance-fractional";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        expect(() => {
          activityManager.completeActivity(instanceId, { satisfactionScore: 7.5 });
        }).toThrow("satisfactionScore debe ser un entero entre 0 y 10");
      });
    });

    describe("requestCompletion", () => {
      beforeEach(() => {
        setupActivityTemplate();
        setupTimeBlock();
        setupActiveDay();
      });

      it("devuelve datos correctos para clear-objective", () => {
        const instanceId = "req-1";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:30:00.000Z", // 30 min antes
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.activityTitle).toBe("Test Activity");
        expect(req.durationMinutes).toBe(30);
        expect(req.estimatedMinutes).toBe(30);
        // 30 min real, 30 estimado → 100% → no bonus
        expect(req.beatEstimate).toBe(false);
        expect(req.requestedAt).toBeDefined();
      });

      it("marca beatEstimate=true cuando se bate el estimado", () => {
        const instanceId = "req-2";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z", // 15 min antes, 50% del estimado
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.durationMinutes).toBe(15);
        expect(req.beatEstimate).toBe(true);
      });

      it("beatEstimate=false para timeboxing aunque bata el estimado", () => {
        mockAppState.global.activityTemplates[0].type = "timeboxing";
        mockAppState.global.activityTemplates[0].clearObjectiveSettings = undefined;
        mockAppState.global.activityTemplates[0].timeboxingSettings = {
          type: "minimum-time",
          minimumDurationMinutes: 15,
        };

        const instanceId = "req-3";
        mockAppState.currentDay!.activityInstances.push({
          id: instanceId,
          templateId: mockTemplateId,
          blockId: mockBlockId,
          order: 0,
          state: "active",
          startTime: "2023-01-01T11:45:00.000Z",
          createdAt: mockTimestamp,
          updatedAt: mockTimestamp,
        });
        mockAppState.currentDay!.activeActivityInstanceId = instanceId;

        const req = activityManager.requestCompletion(instanceId);

        expect(req.beatEstimate).toBe(false);
      });

      it("lanza error si no hay actividad activa", () => {
        expect(() => activityManager.requestCompletion("non-existent")).toThrow();
      });
    });

    describe("interruptActivity", () => {
      it("debe interrumpir la actividad activa (sin pregunta evitable)", () => {
        // Crear y activar una instancia
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        activityManager.activateActivity(instance.id);

        // Cambiar el mockUUID para el registro interrumpido
        mockUUID = "interrupted-id-123";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        const result = activityManager.interruptActivity(instance.id);

        // Schema v2+: ya no hay interruptionData. Tempos=0 siempre.
        expect(result.state).toBe("interrupted");
        expect(result.templateId).toBe(mockTemplateId);
        expect(result.temposAwarded).toBe(0);
        expect(result.satisfactionScore).toBe(0);
        expect(result.beatEstimate).toBe(false);

        // Verificar que se eliminó la instancia
        expect(mockAppState.currentDay?.activityInstances.length).toBe(0);
        expect(mockAppState.currentDay?.activeActivityInstanceId).toBeUndefined();
      });

      it("debe lanzar error si la actividad no está activa", () => {
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);

        expect(() => {
          activityManager.interruptActivity(instance.id);
        }).toThrow("Solo se puede interrumpir la actividad activa actual");
      });
    });

    describe("getActiveActivity", () => {
      it("debe devolver la actividad activa", () => {
        // Crear y activar una instancia
        const instance = activityManager.createActivityInstance(mockTemplateId, mockBlockId);
        const activatedInstance = activityManager.activateActivity(instance.id);

        const result = activityManager.getActiveActivity();

        expect(result).toEqual(activatedInstance);
      });

      it("debe devolver null si no hay actividad activa", () => {
        const result = activityManager.getActiveActivity();

        expect(result).toBeNull();
      });
    });
  });

  // ===============================================
  // Pruebas de Actividades del Sistema
  // ===============================================

  describe("Actividades del sistema", () => {
    beforeEach(() => {
      // Configurar bloque y día activo
      setupTimeBlock();
      setupActiveDay();
    });

    describe("createPilotAutomaticActivity", () => {
      it("debe crear una actividad de Piloto Automático", () => {
        // Preparar mockUUID para la plantilla
        mockUUID = "pilot-template-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        // Crear la actividad de Piloto Automático
        const result = activityManager.createPilotAutomaticActivity(mockBlockId);

        // Verificar que se creó la plantilla del sistema
        const template = mockAppState.global.activityTemplates[0];
        expect(template.title).toBe("Piloto Automático");
        expect(template.isSystemActivity).toBe(true);
        expect(template.type).toBe("flexible-duration");

        // Verificar que se creó la instancia correctamente
        expect(result.templateId).toBe(template.id);
      });

      it("debe reutilizar la plantilla existente si ya existe", () => {
        // Crear una plantilla de Piloto Automático
        const pilotTemplate = activityManager.createActivityTemplate({
          title: "Piloto Automático",
          description: "Actividad de sistema para registrar tiempo en piloto automático",
          type: "flexible-duration",
          isSystemActivity: true,
          flexibleDurationSettings: {
            minimumDurationMinutes: 15,
            maximumDurationMinutes: 480,
          },
        });

        // Cambiar mockUUID para la instancia
        mockUUID = "pilot-instance-id";
        (UtilityService.generateUUID as jest.Mock).mockReturnValue(mockUUID);

        // Crear la actividad de Piloto Automático
        const result = activityManager.createPilotAutomaticActivity(mockBlockId);

        // Verificar que se reutilizó la plantilla existente
        expect(result.templateId).toBe(pilotTemplate.id);

        // Verificar que no se creó una nueva plantilla
        expect(mockAppState.global.activityTemplates.length).toBe(1);
      });
    });
  });
});
