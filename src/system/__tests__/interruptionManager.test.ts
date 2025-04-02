import { SystemCore } from "../index";
import { InterruptionManager } from "../interruptionManager";

describe("InterruptionManager", () => {
  let systemCore: SystemCore;
  let interruptionManager: InterruptionManager;

  beforeEach(() => {
    // Crear instancia limpia del sistema para cada prueba
    systemCore = new SystemCore();
    // Limpiar completamente el estado para asegurar aislamiento entre pruebas
    systemCore.clearState();
    interruptionManager = new InterruptionManager(systemCore);
  });

  describe("Gestión de causas de interrupción", () => {
    test("createInterruptionCause crea una nueva causa de interrupción", () => {
      const cause = interruptionManager.createInterruptionCause("Notificación de email");

      expect(cause).toBeDefined();
      expect(cause.id).toBeDefined();
      expect(cause.description).toBe("Notificación de email");
      expect(cause.createdAt).toBeDefined();
      expect(cause.updatedAt).toBeDefined();

      // Verificar que se agregó al estado global
      const causes = interruptionManager.getInterruptionCauses();
      expect(causes).toHaveLength(1);
      expect(causes[0].id).toBe(cause.id);
    });

    test("updateInterruptionCause actualiza una causa existente", () => {
      // Crear causa
      const cause = interruptionManager.createInterruptionCause("Notificación de email");

      // Actualizar causa
      const updatedCause = interruptionManager.updateInterruptionCause(cause.id, {
        description: "Notificación de WhatsApp",
      });

      expect(updatedCause.id).toBe(cause.id);
      expect(updatedCause.description).toBe("Notificación de WhatsApp");

      // Verificar que se actualizó en el estado global
      const causes = interruptionManager.getInterruptionCauses();
      expect(causes).toHaveLength(1);
      expect(causes[0].description).toBe("Notificación de WhatsApp");
    });

    test("updateInterruptionCause lanza error si la causa no existe", () => {
      expect(() => {
        interruptionManager.updateInterruptionCause("non-existent-id", { description: "Test" });
      }).toThrow();
    });

    test("deleteInterruptionCause elimina una causa", () => {
      // Crear causa
      const cause = interruptionManager.createInterruptionCause("Notificación de email");

      // Verificar que existe
      expect(interruptionManager.getInterruptionCauses()).toHaveLength(1);

      // Eliminar causa
      interruptionManager.deleteInterruptionCause(cause.id);

      // Verificar que se eliminó
      expect(interruptionManager.getInterruptionCauses()).toHaveLength(0);
    });

    test("deleteInterruptionCause lanza error si la causa no existe", () => {
      expect(() => {
        interruptionManager.deleteInterruptionCause("non-existent-id");
      }).toThrow();
    });

    test("deleteInterruptionCause lanza error si la causa está en uso", () => {
      // Crear causa
      const cause = interruptionManager.createInterruptionCause("Notificación de email");

      // Simular que está en uso añadiendo un registro de actividad interrumpida
      systemCore.updateState((state) => {
        state.global.completedActivityRecords.push({
          id: "activity-1",
          templateId: "template-1",
          templateTitle: "Actividad Test",
          state: "interrupted",
          type: "clear-objective",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          durationMinutes: 15,
          dayId: "day-1",
          createdAt: new Date().toISOString(),
          interruptionData: {
            isAvoidable: true,
            causeId: cause.id,
            causeDescription: cause.description,
          },
        });
        return state;
      });

      // Intentar eliminar, debería fallar
      expect(() => {
        interruptionManager.deleteInterruptionCause(cause.id);
      }).toThrow();
    });
  });

  describe("Estadísticas de interrupciones", () => {
    beforeEach(() => {
      // Limpiar estado para asegurar aislamiento entre pruebas
      systemCore.clearState();

      // Preparar datos para las pruebas de estadísticas
      const cause1 = interruptionManager.createInterruptionCause("Notificación de email");
      const cause2 = interruptionManager.createInterruptionCause("Llamada telefónica");

      // Añadir registros de actividades interrumpidas
      systemCore.updateState((state) => {
        // Asegurar que el array está vacío antes de añadir los registros de prueba
        state.global.completedActivityRecords = [];

        // Actividad 1 - Interrumpida por causa1
        state.global.completedActivityRecords.push({
          id: "activity-1",
          templateId: "template-1",
          templateTitle: "Actividad 1",
          state: "interrupted",
          type: "clear-objective",
          startTime: "2023-01-01T10:00:00Z",
          endTime: "2023-01-01T10:15:00Z",
          durationMinutes: 15,
          dayId: "day-1",
          createdAt: "2023-01-01T10:15:00Z",
          interruptionData: {
            isAvoidable: true,
            causeId: cause1.id,
            causeDescription: cause1.description,
          },
        });

        // Actividad 2 - Interrumpida por causa2
        state.global.completedActivityRecords.push({
          id: "activity-2",
          templateId: "template-1",
          templateTitle: "Actividad 2",
          state: "interrupted",
          type: "clear-objective",
          startTime: "2023-01-01T11:00:00Z",
          endTime: "2023-01-01T11:10:00Z",
          durationMinutes: 10,
          dayId: "day-1",
          createdAt: "2023-01-01T11:10:00Z",
          interruptionData: {
            isAvoidable: true,
            causeId: cause2.id,
            causeDescription: cause2.description,
          },
        });

        // Actividad 3 - Interrumpida sin causa (inevitable)
        state.global.completedActivityRecords.push({
          id: "activity-3",
          templateId: "template-2",
          templateTitle: "Actividad 3",
          state: "interrupted",
          type: "clear-objective",
          startTime: "2023-01-01T12:00:00Z",
          endTime: "2023-01-01T12:05:00Z",
          durationMinutes: 5,
          dayId: "day-1",
          createdAt: "2023-01-01T12:05:00Z",
          interruptionData: {
            isAvoidable: false,
          },
        });

        // Actividad 4 - Completada (no es interrupción)
        state.global.completedActivityRecords.push({
          id: "activity-4",
          templateId: "template-2",
          templateTitle: "Actividad 4",
          state: "completed",
          type: "clear-objective",
          startTime: "2023-01-01T13:00:00Z",
          endTime: "2023-01-01T13:30:00Z",
          durationMinutes: 30,
          dayId: "day-1",
          createdAt: "2023-01-01T13:30:00Z",
        });

        return state;
      });
    });

    test("getInterruptionStatistics devuelve estadísticas correctas sin filtros", () => {
      const stats = interruptionManager.getInterruptionStatistics();

      expect(stats.totalInterruptions).toBe(3);
      expect(stats.avoidableInterruptions).toBe(2);
      expect(stats.unavoidableInterruptions).toBe(1);
      expect(stats.avoidablePercentage).toBeCloseTo(66.67, 1);
      expect(stats.topCauses).toHaveLength(2);
    });

    test("getInterruptionStatistics devuelve estadísticas correctas con filtro de día", () => {
      const stats = interruptionManager.getInterruptionStatistics({ dayId: "day-1" });

      expect(stats.totalInterruptions).toBe(3);
      expect(stats.avoidableInterruptions).toBe(2);

      // Con un día diferente no debería encontrar interrupciones
      const emptyStats = interruptionManager.getInterruptionStatistics({
        dayId: "non-existent-day",
      });
      expect(emptyStats.totalInterruptions).toBe(0);
    });

    test("getInterruptionStatistics devuelve estadísticas correctas con filtros de tiempo", () => {
      const stats = interruptionManager.getInterruptionStatistics({
        since: "2023-01-01T11:00:00Z",
        until: "2023-01-01T12:30:00Z",
      });

      expect(stats.totalInterruptions).toBe(2);
    });

    test("getInterruptionsByActivity devuelve las actividades interrumpidas correctas", () => {
      const interruptions = interruptionManager.getInterruptionsByActivity("template-1");

      expect(interruptions).toHaveLength(2);
      expect(interruptions[0].templateTitle).toBe("Actividad 1");
      expect(interruptions[1].templateTitle).toBe("Actividad 2");

      // Para una plantilla con solo 1 interrupción
      const singleInterruption = interruptionManager.getInterruptionsByActivity("template-2");
      expect(singleInterruption).toHaveLength(1);
      expect(singleInterruption[0].templateTitle).toBe("Actividad 3");

      // Para una plantilla sin interrupciones
      const noInterruptions =
        interruptionManager.getInterruptionsByActivity("non-existent-template");
      expect(noInterruptions).toHaveLength(0);
    });

    test("getTopInterruptionCauses devuelve las causas más frecuentes", () => {
      const topCauses = interruptionManager.getTopInterruptionCauses();

      expect(topCauses).toHaveLength(2);

      // Ambas causas tienen 1 interrupción, así que el orden podría variar
      // pero podemos verificar que ambas causas estén presentes
      const descriptions = topCauses.map((item) => item.cause.description);
      expect(descriptions).toContain("Notificación de email");
      expect(descriptions).toContain("Llamada telefónica");

      // Verificar que los conteos sean correctos
      expect(topCauses[0].count).toBe(1);
      expect(topCauses[1].count).toBe(1);

      // Limitar a 1 causa
      const limitedCauses = interruptionManager.getTopInterruptionCauses(1);
      expect(limitedCauses).toHaveLength(1);
    });
  });
});
