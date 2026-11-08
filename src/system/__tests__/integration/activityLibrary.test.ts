import { SystemCore } from "../../index";
import { UtilityService } from "../../utilityService";

/**
 * Integration tests for Flow 2: Creating and managing activities in the library
 *
 * These tests verify that the complete flow of creating and managing activities
 * in the library works correctly, mapping user actions to the System API.
 */
describe("Flow 2: Creating and managing activities in the library", () => {
  let system: SystemCore;

  beforeEach(() => {
    // Initialize the system (equivalent to opening the app)
    system = new SystemCore();

    // Clear state to start from scratch
    system.clearState();
  });

  afterEach(() => {
    // Restore all mocks after each test
    jest.restoreAllMocks();
  });

  test("Main flow: Creating a clear-objective activity", () => {
    // Check preconditions
    expect(system.getActivityTemplates().length).toBe(0);

    // Simulate creating a clear-objective activity
    // (Equivalent to filling in the form and clicking "Guardar actividad")
    system.createActivityTemplate({
      title: "Redactar informe de trabajo",
      description: "Escribir informe semanal para el jefe",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 45, // ~45 min estimate
      },
    });

    // Verify the activity was created correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verify the data is correct
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Redactar informe de trabajo");
    expect(actividadCreada.description).toBe("Escribir informe semanal para el jefe");
    expect(actividadCreada.type).toBe("clear-objective");
    expect(actividadCreada.clearObjectiveSettings?.estimatedDurationMinutes).toBe(45);

    // Verify the activity has timestamps
    expect(actividadCreada.createdAt).toBeDefined();
    expect(actividadCreada.updatedAt).toBeDefined();
  });

  test("Alternative flow A1: Creating a flexible-duration activity", () => {
    // Check preconditions
    expect(system.getActivityTemplates().length).toBe(0);

    // Simulate creating a flexible-duration activity
    system.createActivityTemplate({
      title: "Revisar correo electrónico",
      description: "Revisar bandeja de entrada y responder mensajes importantes",
      type: "flexible-duration",
      isSystemActivity: false,
      flexibleDurationSettings: {
        minimumDurationMinutes: 5,
        maximumDurationMinutes: 10,
      },
    });

    // Verify the activity was created correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verify the data is correct
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Revisar correo electrónico");
    expect(actividadCreada.type).toBe("flexible-duration");
    expect(actividadCreada.flexibleDurationSettings?.minimumDurationMinutes).toBe(5);
    expect(actividadCreada.flexibleDurationSettings?.maximumDurationMinutes).toBe(10);
  });

  test("Alternative flow A2: Creating a timeboxing activity", () => {
    // Check preconditions
    expect(system.getActivityTemplates().length).toBe(0);

    // Simulate creating a timeboxing activity (minimum time)
    system.createActivityTemplate({
      title: "Meditación diaria",
      description: "Sesión de meditación guiada",
      type: "timeboxing",
      isSystemActivity: false,
      timeboxingSettings: {
        type: "minimum-time",
        minimumDurationMinutes: 20,
      },
    });

    // Verify the activity was created correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verify the data is correct
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Meditación diaria");
    expect(actividadCreada.type).toBe("timeboxing");
    expect(actividadCreada.timeboxingSettings?.type).toBe("minimum-time");
    expect(actividadCreada.timeboxingSettings?.minimumDurationMinutes).toBe(20);
  });

  test("Alternative flow A3: Editing an existing activity", () => {
    // Mock the time function to guarantee different timestamps
    const mockGetTime = jest.spyOn(UtilityService, "getCurrentISODateTime");

    // Set the first timestamp for creation
    const timestamp1 = "2023-04-02T10:00:00.000Z";
    mockGetTime.mockReturnValue(timestamp1);

    // First create an activity to edit afterwards
    const actividadOriginal = system.createActivityTemplate({
      title: "Leer documentación",
      description: "Leer documentación técnica sobre React",
      type: "flexible-duration",
      isSystemActivity: false,
      flexibleDurationSettings: {
        minimumDurationMinutes: 15,
        maximumDurationMinutes: 30,
      },
    });

    // Save the ID for checks
    const actividadId = actividadOriginal.id;

    // Verify the activity was created correctly
    expect(system.getActivityTemplates().length).toBe(1);

    // Set the second timestamp for the update
    const timestamp2 = "2023-04-02T10:30:00.000Z";
    mockGetTime.mockReturnValue(timestamp2);

    // Simulate editing the activity
    // (Equivalent to changing the form fields and clicking "Guardar cambios")
    system.updateActivityTemplate(actividadId, {
      title: "Leer documentación avanzada",
      description: "Leer documentación técnica sobre React Hooks",
      flexibleDurationSettings: {
        minimumDurationMinutes: 20,
        maximumDurationMinutes: 45,
      },
    });

    // Verify the activity was updated correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verify the data was updated
    const actividadEditada = actividades[0];
    expect(actividadEditada.id).toBe(actividadId);
    expect(actividadEditada.title).toBe("Leer documentación avanzada");
    expect(actividadEditada.description).toBe("Leer documentación técnica sobre React Hooks");
    expect(actividadEditada.flexibleDurationSettings?.minimumDurationMinutes).toBe(20);
    expect(actividadEditada.flexibleDurationSettings?.maximumDurationMinutes).toBe(45);

    // Verify updatedAt was updated
    expect(actividadEditada.updatedAt).toBe(timestamp2);
    expect(actividadEditada.updatedAt).not.toBe(actividadOriginal.updatedAt);
  });

  test("Works with an active day", () => {
    // Start a day
    system.startDay();

    // Verify the day is active
    expect(system.isDayActive()).toBe(true);

    // Try to create an activity with an active day
    const nuevaActividad = system.createActivityTemplate({
      title: "Planificar sprint",
      description: "Planificar tareas para el próximo sprint",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
    });

    // Verify the activity was created correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);
    expect(actividades[0].title).toBe("Planificar sprint");

    // Verify it can be edited too
    const actividadActualizada = system.updateActivityTemplate(nuevaActividad.id, {
      title: "Planificar sprint semanal",
    });

    expect(actividadActualizada.title).toBe("Planificar sprint semanal");
  });

  test("Change activity type while editing", () => {
    // Create the initial activity with type clear-objective
    const actividadOriginal = system.createActivityTemplate({
      title: "Resolver problemas de matemáticas",
      description: "Ejercicios del capítulo 3",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 30,
      },
    });

    // Change the activity type to timeboxing
    const actividadActualizada = system.updateActivityTemplate(actividadOriginal.id, {
      type: "timeboxing",
      // The previous settings are removed
      clearObjectiveSettings: undefined,
      // The new settings are added
      timeboxingSettings: {
        type: "maximum-time",
        maximumDurationMinutes: 25,
      },
    });

    // Verify the type was updated correctly
    expect(actividadActualizada.type).toBe("timeboxing");
    expect(actividadActualizada.clearObjectiveSettings).toBeUndefined();
    expect(actividadActualizada.timeboxingSettings?.type).toBe("maximum-time");
    expect(actividadActualizada.timeboxingSettings?.maximumDurationMinutes).toBe(25);

    // Verify in the global state
    const actividadEnEstado = system.getActivityTemplates()[0];
    expect(actividadEnEstado.type).toBe("timeboxing");
  });
});
