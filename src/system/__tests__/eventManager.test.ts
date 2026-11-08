import { SystemCore } from "../index";
import { EventManager } from "../eventManager";

// Mock localStorage for the tests
beforeEach(() => {
  // Clear the mocked localStorage before each test
  localStorage.clear();
});

describe("EventManager", () => {
  let systemCore: SystemCore;
  let eventManager: EventManager;

  beforeEach(() => {
    // Create a clean system instance for each test
    systemCore = new SystemCore();
    // Explicitly clear the state to avoid persistence between tests
    systemCore.clearState();
    eventManager = new EventManager(systemCore);
  });

  describe("Event template management", () => {
    test("createEventTemplate creates a new event template", () => {
      const template = eventManager.createEventTemplate("Tomar café");

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(template.name).toBe("Tomar café");
      expect(template.createdAt).toBeDefined();
      expect(template.updatedAt).toBeDefined();

      // Check that it was added to the global state
      const templates = eventManager.getEventTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].id).toBe(template.id);
    });

    test("updateEventTemplate updates an existing template", () => {
      // Create a template
      const template = eventManager.createEventTemplate("Tomar café");

      // Update the template
      const updatedTemplate = eventManager.updateEventTemplate(template.id, {
        name: "Tomar café con leche",
      });

      expect(updatedTemplate.id).toBe(template.id);
      expect(updatedTemplate.name).toBe("Tomar café con leche");

      // Check that it was updated in the global state
      const templates = eventManager.getEventTemplates();
      expect(templates).toHaveLength(1);
      expect(templates[0].name).toBe("Tomar café con leche");
    });

    test("updateEventTemplate throws if the template does not exist", () => {
      expect(() => {
        eventManager.updateEventTemplate("non-existent-id", { name: "Test" });
      }).toThrow();
    });

    test("deleteEventTemplate deletes a template", () => {
      // Create a template
      const template = eventManager.createEventTemplate("Tomar café");

      // Check that it exists
      expect(eventManager.getEventTemplates()).toHaveLength(1);

      // Delete the template
      eventManager.deleteEventTemplate(template.id);

      // Check that it was deleted
      expect(eventManager.getEventTemplates()).toHaveLength(0);
    });

    test("deleteEventTemplate throws if the template does not exist", () => {
      expect(() => {
        eventManager.deleteEventTemplate("non-existent-id");
      }).toThrow();
    });
  });

  describe("Event instance management", () => {
    test("createEventInstance throws if there is no active day", () => {
      // Create a template
      const template = eventManager.createEventTemplate("Tomar café");

      // Try to create an instance without an active day
      expect(() => {
        eventManager.createEventInstance(template.id);
      }).toThrow();
    });

    // More tests need an active day and would be implemented with DayManager
    // They are omitted because they require interaction with other modules
  });
});
