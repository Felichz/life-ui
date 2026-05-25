import { SystemCore } from "../SystemCore";
import { EventManager } from "../eventManager";
import { PersistenceManager } from "../persistenceManager";

// Mock localStorage para las pruebas
beforeEach(() => {
  // Limpiar localStorage simulado antes de cada prueba
  localStorage.clear();
});

describe("EventManager", () => {
  let systemCore: SystemCore;
  let eventManager: EventManager;

  beforeEach(() => {
    // Crear instancia limpia del sistema para cada prueba
    systemCore = new SystemCore();
    // Limpiar explícitamente el estado para evitar persistencia entre pruebas
    systemCore.clearState();
    eventManager = new EventManager(systemCore);
  });

  describe("Gestión de plantillas de eventos", () => {
    test("createEventTemplate crea una nueva plantilla de evento", () => {
      const template = eventManager.createEventTemplate("Tomar café");

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe("Tomar café");
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();

      // Verificar que se agregó al estado global
      const templates = eventManager.getEventTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template.id);
    });

    test("updateEventTemplate actualiza una plantilla existente", () => {
      // Crear plantilla
      const template = eventManager.createEventTemplate("Tomar café");

      // Actualizar plantilla
      const updatedTemplate = eventManager.updateEventTemplate(template.id, {
        name: "Tomar café con leche",
      });

      expect(updatedTemplate.id).toBe(template.id);
      expect(updatedTemplate.name).toBe("Tomar café con leche");

      // Verificar que se actualizó en el estado global
      const templates = eventManager.getEventTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("Tomar café con leche");
    });

    test("updateEventTemplate lanza error si la plantilla no existe", () => {
      expect(() => {
        eventManager.updateEventTemplate("non-existent-id", { name: "Test" });
      }).toThrow();
    });

    test("deleteEventTemplate elimina una plantilla", () => {
      // Crear plantilla
      const template = eventManager.createEventTemplate("Tomar café");

      // Verificar que existe
      expect(eventManager.getEventTemplates()).toHaveLength(1);

      // Eliminar plantilla
      eventManager.deleteEventTemplate(template.id);

      // Verificar que se eliminó
      expect(eventManager.getEventTemplates()).toHaveLength(0);
    });

    test("deleteEventTemplate lanza error si la plantilla no existe", () => {
      expect(() => {
        eventManager.deleteEventTemplate("non-existent-id");
      }).toThrow();
    });
  });

  describe("Gestión de instancias de eventos", () => {
    test("createEventInstance lanza error si no hay día activo", () => {
      // Crear plantilla
      const template = eventManager.createEventTemplate("Tomar café");

      // Intentar crear instancia sin día activo
      expect(() => {
        eventManager.createEventInstance(template.id);
      }).toThrow();
    });

    // Más pruebas que requieren un día activo y serían implementadas con DayManager
    // Se omiten ya que requieren interacción con otros módulos
  });
});
