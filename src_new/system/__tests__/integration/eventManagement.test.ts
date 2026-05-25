import { SystemCore } from "../../SystemCore";
import type { TimelineData } from "../../../types";
import { UtilityService } from "../../utilityService";
import { SubjectiveVariableManager } from "../../subjectiveVariableManager";

/**
 * Tests de integración para el Flujo 5: Manejo de eventos puntuales
 *
 * Estos tests verifican que el flujo completo de manejo de eventos
 * funcione correctamente, desde diferentes puntos de partida.
 */
describe("Flujo 5: Manejo de eventos puntuales", () => {
  let system: SystemCore;

  beforeEach(() => {
    // Inicializar el sistema (equivalente a abrir la aplicación)
    system = new SystemCore();

    // Limpiar estado para partir de cero
    system.clearState();

    // Iniciar un día (precondición: hay un día activo)
    system.startDay();
  });

  test("Flujo principal: Creación de eventos y registro con actualización de variables", () => {
    // Verificar precondiciones
    expect(system.isDayActive()).toBe(true);

    // Paso 1-8: El usuario crea eventos en la biblioteca
    // El usuario hace clic en "Gestionar biblioteca de eventos"
    // El sistema muestra la interfaz de gestión de eventos
    // El usuario hace clic en "Nuevo evento"
    // El sistema muestra un formulario con campo Nombre del evento
    // El usuario ingresa "Tomar café"
    // El usuario hace clic en "Guardar evento"
    const cafeEvent = system.createEventTemplate("Tomar café");

    // Verificar que el evento se ha creado correctamente
    expect(cafeEvent).toBeDefined();
    expect(cafeEvent.name).toBe("Tomar café");

    // El usuario repite los pasos para crear eventos adicionales
    const medicacionEvent = system.createEventTemplate("Tomar medicación para dolor de cabeza");

    // Verificar que el segundo evento se ha creado correctamente
    expect(medicacionEvent).toBeDefined();
    expect(medicacionEvent.name).toBe("Tomar medicación para dolor de cabeza");

    // Paso 9-10: El usuario vuelve a la vista principal del día
    // El usuario identifica el evento "Tomar café" en la barra de eventos de acceso rápido
    // (Esto es parte de la UI, pero aquí validamos que podemos recuperar los eventos)
    const eventosDisponibles = system.getState().global.eventTemplates;
    expect(eventosDisponibles.length).toBe(2);
    expect(eventosDisponibles.some((e) => e.id === cafeEvent.id)).toBe(true);

    // Paso 11-12: El usuario hace clic en el evento "Tomar café"
    // El sistema registra el evento en el momento actual
    const cafeInstance = system.createEventInstance(cafeEvent.id);

    // Verificar que la instancia de evento se ha creado correctamente
    expect(cafeInstance).toBeDefined();
    expect(cafeInstance.templateId).toBe(cafeEvent.id);
    expect(cafeInstance.templateName).toBe("Tomar café");
    expect(cafeInstance.dayId).toBe(system.getCurrentDay()?.id);

    // Paso 13-14: El sistema muestra un modal para actualizar variables subjetivas
    // El usuario actualiza sus variables subjetivas

    // Primero crear algunas variables subjetivas
    const energiaVariable = system.createSubjectiveVariable("Nivel de energía");
    const concentracionVariable = system.createSubjectiveVariable("Concentración");

    // Comprobar que las variables se crearon correctamente
    expect(energiaVariable).toBeDefined();
    expect(concentracionVariable).toBeDefined();

    // Simular que el usuario puede actualizar variables (sin restricción temporal)
    jest.spyOn(SubjectiveVariableManager.prototype, "canUpdateVariables").mockReturnValue(true);

    // El usuario actualiza las variables subjetivas
    const snapshot = system.createSnapshot(
      [
        { variableId: energiaVariable.id, currentValue: 8 },
        { variableId: concentracionVariable.id, currentValue: 7 },
      ],
      [], // no hay actividades relacionadas
      [cafeInstance.id] // relacionado con el evento de café
    );

    // Verificar que el snapshot se ha creado correctamente
    expect(snapshot).not.toBeNull();
    if (snapshot) {
      expect(snapshot.relatedEventIds).toContain(cafeInstance.id);
      expect(snapshot.values.length).toBe(2);
      expect(snapshot.values.find((v) => v.variableId === energiaVariable.id)?.currentValue).toBe(
        8
      );
    }

    // Paso 15-16: El sistema registra el evento en el timeline
    // Comprobar que el evento aparece en el timeline
    const timelineData: TimelineData = system.getTimelineData();

    expect(timelineData.events.length).toBe(1);
    expect(timelineData.events[0].id).toBe(cafeInstance.id);
    expect(timelineData.events[0].name).toBe("Tomar café");
  });

  test("Flujo alternativo A1: Registro de evento sin actualizar variables", () => {
    // Crear evento en la biblioteca
    const cafeEvent = system.createEventTemplate("Tomar café");

    // El usuario registra el evento
    const cafeInstance = system.createEventInstance(cafeEvent.id);

    // Verificar que la instancia se creó correctamente
    expect(cafeInstance).toBeDefined();

    // Paso 13: El usuario hace clic en "Omitir actualización de variables"
    // (No se llama a createSnapshot, simulando que el usuario omite la actualización)

    // Verificar que no hay snapshots creados
    expect(system.getState().global.subjectiveVariableSnapshots.length).toBe(0);

    // Verificar que el evento aparece en el timeline
    const timelineData = system.getTimelineData();
    expect(timelineData.events.length).toBe(1);
    expect(timelineData.events[0].id).toBe(cafeInstance.id);
  });

  test("Flujo alternativo A2: Consulta de eventos históricos", () => {
    // Alternativa: En lugar de mockear Date.now, vamos a modificar directamente los timestamps
    // de los eventos y usar un tiempo explícito para la prueba

    // Crear evento en la biblioteca
    const cafeEvent = system.createEventTemplate("Tomar café");

    // Definir timestamps específicos para nuestros eventos
    // El primer evento ocurrió hace 40 minutos
    const now = new Date();
    const fortyMinutesAgo = new Date(now.getTime() - 40 * 60 * 1000);
    const timestamp1 = fortyMinutesAgo.toISOString();

    // El segundo evento ocurrió hace 10 minutos (dentro de la ventana de 30 minutos)
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    const timestamp2 = tenMinutesAgo.toISOString();

    // Insertar directamente en el estado los eventos con timestamps específicos
    system.updateState((state) => {
      // Crear instancias de eventos con timestamps controlados
      state.global.eventInstances.push({
        id: "event-instance-1",
        templateId: cafeEvent.id,
        templateName: cafeEvent.name,
        timestamp: timestamp1,
        dayId: state.currentDay!.day.id,
        createdAt: timestamp1,
      });

      state.global.eventInstances.push({
        id: "event-instance-2",
        templateId: cafeEvent.id,
        templateName: cafeEvent.name,
        timestamp: timestamp2,
        dayId: state.currentDay!.day.id,
        createdAt: timestamp2,
      });

      return state;
    });

    // Verificar que ambas instancias se crearon con los timestamps correctos
    const instances = system.getEventInstances();
    expect(instances.length).toBe(2);

    // Verificar que el timeline muestra ambos eventos
    const timelineData = system.getTimelineData();
    expect(timelineData.events.length).toBe(2);

    // Verificar que podemos obtener eventos recientes (en una ventana de tiempo)
    const recentEvents = system.getRecentEvents(30); // últimos 30 minutos

    // El evento que ocurrió hace 10 minutos debería estar, pero no el de hace 40 minutos
    expect(recentEvents.length).toBe(1);
    expect(recentEvents[0].id).toBe("event-instance-2");
  });

  test("Asociar variables subjetivas a eventos específicos", () => {
    // Crear eventos en la biblioteca
    const cafeEvent = system.createEventTemplate("Tomar café");
    const ejercicioEvent = system.createEventTemplate("Hacer ejercicio");

    // Registrar instancias de eventos
    const cafeInstance = system.createEventInstance(cafeEvent.id);
    const ejercicioInstance = system.createEventInstance(ejercicioEvent.id);

    // Crear variables subjetivas
    const energiaVariable = system.createSubjectiveVariable("Nivel de energía");
    const estresVariable = system.createSubjectiveVariable("Nivel de estrés");

    // Permitir actualizar variables
    jest.spyOn(SubjectiveVariableManager.prototype, "canUpdateVariables").mockReturnValue(true);

    // Tomar café afecta nivel de energía positivamente
    const snapshotCafe = system.createSnapshot(
      [
        { variableId: energiaVariable.id, currentValue: 8 },
        { variableId: estresVariable.id, currentValue: 5 },
      ],
      [], // sin actividades relacionadas
      [cafeInstance.id] // relacionado con tomar café
    );

    // Cambiar timestamp para permitir otro snapshot
    jest.spyOn(UtilityService, "getCurrentISODateTime").mockReturnValue("2023-04-02T11:30:00.000Z");

    // Ejercicio afecta energía y reduce estrés
    const snapshotEjercicio = system.createSnapshot(
      [
        { variableId: energiaVariable.id, currentValue: 9 },
        { variableId: estresVariable.id, currentValue: 3 },
      ],
      [], // sin actividades relacionadas
      [ejercicioInstance.id] // relacionado con ejercicio
    );

    // Verificar que los snapshots se relacionaron correctamente
    expect(snapshotCafe?.relatedEventIds).toContain(cafeInstance.id);
    expect(snapshotEjercicio?.relatedEventIds).toContain(ejercicioInstance.id);

    // Obtener datos de variables subjetivas para visualización
    const subjectiveData = system.getSubjectiveVariablesData();

    // Verificar que los datos incluyen las variables y sus valores
    expect(subjectiveData.variables.length).toBe(2); // energía y estrés

    // Verificar que cada variable tiene dos valores (uno por cada snapshot)
    const energiaData = subjectiveData.variables.find((v) => v.name === "Nivel de energía");
    const estresData = subjectiveData.variables.find((v) => v.name === "Nivel de estrés");

    expect(energiaData?.values.length).toBe(2);
    expect(estresData?.values.length).toBe(2);
  });
});
