import { SystemCore } from "../../SystemCore";
import { UtilityService } from "../../utilityService";

/**
 * Tests de integración para el Flujo 2: Creación y gestión de actividades en la biblioteca
 *
 * Estos tests verifican que el flujo completo de creación y gestión de actividades
 * en la biblioteca funcione correctamente, mapeando las acciones de usuario a la API de System.
 */
describe("Flujo 2: Creación y gestión de actividades en la biblioteca", () => {
  let system: SystemCore;

  beforeEach(() => {
    // Inicializar el sistema (equivalente a abrir la aplicación)
    system = new SystemCore();

    // Limpiar estado para partir de cero
    system.clearState();
  });

  afterEach(() => {
    // Restaurar todos los mocks después de cada prueba
    jest.restoreAllMocks();
  });

  test("Flujo principal: Creación de actividad con objetivo claro", () => {
    // Verificar precondiciones
    expect(system.getActivityTemplates().length).toBe(0);

    // Simular la creación de una actividad con objetivo claro
    // (Equivalente a completar el formulario y hacer clic en "Guardar actividad")
    system.createActivityTemplate({
      title: "Redactar informe de trabajo",
      description: "Escribir informe semanal para el jefe",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 45, // ~45 min de estimación
      },
    });

    // Verificar que la actividad se creó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verificar que los datos son correctos
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Redactar informe de trabajo");
    expect(actividadCreada.description).toBe("Escribir informe semanal para el jefe");
    expect(actividadCreada.type).toBe("clear-objective");
    expect(actividadCreada.clearObjectiveSettings?.estimatedDurationMinutes).toBe(45);

    // Verificar que la actividad tiene timestamps
    expect(actividadCreada.createdAt).toBeDefined();
    expect(actividadCreada.updatedAt).toBeDefined();
  });

  test("Flujo alternativo A1: Creación de actividad con duración flexible", () => {
    // Verificar precondiciones
    expect(system.getActivityTemplates().length).toBe(0);

    // Simular la creación de una actividad con duración flexible
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

    // Verificar que la actividad se creó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verificar que los datos son correctos
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Revisar correo electrónico");
    expect(actividadCreada.type).toBe("flexible-duration");
    expect(actividadCreada.flexibleDurationSettings?.minimumDurationMinutes).toBe(5);
    expect(actividadCreada.flexibleDurationSettings?.maximumDurationMinutes).toBe(10);
  });

  test("Flujo alternativo A2: Creación de actividad con timeboxing", () => {
    // Verificar precondiciones
    expect(system.getActivityTemplates().length).toBe(0);

    // Simular la creación de una actividad con timeboxing (tiempo mínimo)
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

    // Verificar que la actividad se creó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verificar que los datos son correctos
    const actividadCreada = actividades[0];
    expect(actividadCreada.title).toBe("Meditación diaria");
    expect(actividadCreada.type).toBe("timeboxing");
    expect(actividadCreada.timeboxingSettings?.type).toBe("minimum-time");
    expect(actividadCreada.timeboxingSettings?.minimumDurationMinutes).toBe(20);
  });

  test("Flujo alternativo A3: Edición de una actividad existente", () => {
    // Mock para la función de tiempo para garantizar timestamps diferentes
    const mockGetTime = jest.spyOn(UtilityService, "getCurrentISODateTime");

    // Configurar primer timestamp para la creación
    const timestamp1 = "2023-04-02T10:00:00.000Z";
    mockGetTime.mockReturnValue(timestamp1);

    // Crear primero una actividad para luego editarla
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

    // Guardar el ID para verificaciones
    const actividadId = actividadOriginal.id;

    // Verificar que la actividad se creó correctamente
    expect(system.getActivityTemplates().length).toBe(1);

    // Configurar segundo timestamp para la actualización
    const timestamp2 = "2023-04-02T10:30:00.000Z";
    mockGetTime.mockReturnValue(timestamp2);

    // Simular la edición de la actividad
    // (Equivalente a modificar los campos en el formulario y hacer clic en "Guardar cambios")
    system.updateActivityTemplate(actividadId, {
      title: "Leer documentación avanzada",
      description: "Leer documentación técnica sobre React Hooks",
      flexibleDurationSettings: {
        minimumDurationMinutes: 20,
        maximumDurationMinutes: 45,
      },
    });

    // Verificar que la actividad se actualizó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);

    // Verificar que los datos se actualizaron
    const actividadEditada = actividades[0];
    expect(actividadEditada.id).toBe(actividadId);
    expect(actividadEditada.title).toBe("Leer documentación avanzada");
    expect(actividadEditada.description).toBe("Leer documentación técnica sobre React Hooks");
    expect(actividadEditada.flexibleDurationSettings?.minimumDurationMinutes).toBe(20);
    expect(actividadEditada.flexibleDurationSettings?.maximumDurationMinutes).toBe(45);

    // Verificar que updatedAt se actualizó
    expect(actividadEditada.updatedAt).toBe(timestamp2);
    expect(actividadEditada.updatedAt).not.toBe(actividadOriginal.updatedAt);
  });

  test("Verificar funcionamiento con día activo", () => {
    // Iniciar un día
    system.startDay();

    // Verificar que el día está activo
    expect(system.isDayActive()).toBe(true);

    // Intentar crear una actividad con día activo
    const nuevaActividad = system.createActivityTemplate({
      title: "Planificar sprint",
      description: "Planificar tareas para el próximo sprint",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 60,
      },
    });

    // Verificar que la actividad se creó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.length).toBe(1);
    expect(actividades[0].title).toBe("Planificar sprint");

    // Verificar que se puede editar también
    const actividadActualizada = system.updateActivityTemplate(nuevaActividad.id, {
      title: "Planificar sprint semanal",
    });

    expect(actividadActualizada.title).toBe("Planificar sprint semanal");
  });

  test("Cambiar tipo de actividad durante edición", () => {
    // Crear actividad inicial con tipo clear-objective
    const actividadOriginal = system.createActivityTemplate({
      title: "Resolver problemas de matemáticas",
      description: "Ejercicios del capítulo 3",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 30,
      },
    });

    // Cambiar el tipo de actividad a timeboxing
    const actividadActualizada = system.updateActivityTemplate(actividadOriginal.id, {
      type: "timeboxing",
      // Se eliminan las configuraciones anteriores
      clearObjectiveSettings: undefined,
      // Se añaden las nuevas configuraciones
      timeboxingSettings: {
        type: "maximum-time",
        maximumDurationMinutes: 25,
      },
    });

    // Verificar que el tipo se actualizó correctamente
    expect(actividadActualizada.type).toBe("timeboxing");
    expect(actividadActualizada.clearObjectiveSettings).toBeUndefined();
    expect(actividadActualizada.timeboxingSettings?.type).toBe("maximum-time");
    expect(actividadActualizada.timeboxingSettings?.maximumDurationMinutes).toBe(25);

    // Verificar en el estado global
    const actividadEnEstado = system.getActivityTemplates()[0];
    expect(actividadEnEstado.type).toBe("timeboxing");
  });
});
