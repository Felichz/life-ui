import { SystemCore } from "../../index";
import type { ActivityType } from "../../../types";

/**
 * Tests de integración para el Flujo 1: Inicio del día
 *
 * Estos tests verifican que el flujo completo de inicio de día
 * funcione correctamente, desde diferentes puntos de partida.
 */
describe("Flujo 1: Inicio del día", () => {
  let system: SystemCore;

  beforeEach(() => {
    // Inicializar el sistema (equivalente a abrir la aplicación)
    system = new SystemCore();

    // Limpiar estado para asegurar que no hay día activo
    system.clearState();
  });

  test("Inicio del día - primer uso (sin datos previos)", () => {
    // Verificar precondiciones
    expect(system.isDayActive()).toBe(false);
    expect(system.getState().global.days.length).toBe(0);

    // Iniciar el día (equivalente a hacer clic en "Comenzar día")
    system.startDay();

    // Verificar que el día se haya iniciado correctamente
    expect(system.isDayActive()).toBe(true);
    expect(system.getCurrentDay()).not.toBeNull();
    expect(system.getCurrentDay()?.state).toBe("active");

    // Crear actividad de sistema "Piloto Automático"
    const pilotoAutoTemplate = system.createActivityTemplate({
      title: "Piloto Automático",
      description: "Estado por defecto cuando no hay otra actividad específica activa",
      type: "flexible-duration" as ActivityType,
      isSystemActivity: true,
      flexibleDurationSettings: {
        minimumDurationMinutes: 1,
        maximumDurationMinutes: 1440, // 24 horas
      },
    });

    // Crear bloque "Por Hacer" para todo el día (0-1439 minutos)
    const porHacerBlock = system.createTimeBlock("Por Hacer", 0, 1439);

    // Marcarlo como bloque por defecto
    system.updateTimeBlock(porHacerBlock.id, { isDefault: true });

    // Crear instancia de "Piloto Automático" en el bloque "Por Hacer"
    const pilotoAutoInstance = system.createActivityInstance(
      pilotoAutoTemplate.id,
      porHacerBlock.id
    );

    // Activar "Piloto Automático" como actividad inicial
    const activePilotoAuto = system.activateActivity(pilotoAutoInstance.id);

    // Verificar que "Piloto Automático" está activo
    const actividadActiva = system.getActiveActivity();
    expect(actividadActiva).not.toBeNull();
    expect(actividadActiva?.id).toBe(activePilotoAuto.id);

    // Verificar que el timeline se ha inicializado con la actividad
    const timelineData = system.getTimelineData();
    expect(timelineData.activities.length).toBeGreaterThan(0);
    // Nota: Puede ser necesario ajustar esta verificación según la implementación específica
    expect(
      timelineData.activities.some(
        (a) => a.title.includes("Piloto") || a.id === activePilotoAuto.id
      )
    ).toBe(true);
  });

  test("Inicio del día - con datos de días anteriores", () => {
    // Preparar datos de un día anterior
    // Crear un día previo finalizado
    const diaAnterior = system.startDay();

    // Crear configuración básica para el día anterior
    const pilotoAutoTemplate = system.createActivityTemplate({
      title: "Piloto Automático",
      description: "Estado por defecto",
      type: "flexible-duration" as ActivityType,
      isSystemActivity: true,
      flexibleDurationSettings: {
        minimumDurationMinutes: 1,
        maximumDurationMinutes: 1440,
      },
    });

    const porHacerBlock = system.createTimeBlock("Por Hacer", 0, 1439);
    system.updateTimeBlock(porHacerBlock.id, { isDefault: true });

    // Crear alguna actividad completada para tener datos históricos
    const actividadMeditacion = system.createActivityTemplate({
      title: "Meditación",
      description: "Actividad de meditación",
      type: "timeboxing" as ActivityType,
      isSystemActivity: true,
      timeboxingSettings: {
        type: "minimum-time",
        minimumDurationMinutes: 15,
      },
    });

    // Crear instancia y activarla
    const meditacionInstance = system.createActivityInstance(
      actividadMeditacion.id,
      porHacerBlock.id
    );

    const activeMeditacion = system.activateActivity(meditacionInstance.id);

    // Completar la actividad para tener un registro
    system.completeActivity(activeMeditacion.id, { satisfactionScore: 5 });

    // Finalizar el día anterior
    system.endDay();

    // Verificar que no hay día activo pero existen datos previos
    expect(system.isDayActive()).toBe(false);
    expect(system.getState().global.days.length).toBe(1);
    expect(system.getState().global.completedActivityRecords.length).toBeGreaterThan(0);

    // Iniciar nuevo día
    system.startDay();

    // Verificar que el día se ha iniciado correctamente
    expect(system.isDayActive()).toBe(true);
    expect(system.getCurrentDay()?.id).not.toBe(diaAnterior.id);

    // Crear instancia de Piloto Automático para el nuevo día
    const pilotoAutoInstance = system.createActivityInstance(
      pilotoAutoTemplate.id,
      porHacerBlock.id
    );

    // Activar Piloto Automático
    const activePilotoAuto = system.activateActivity(pilotoAutoInstance.id);

    // Verificaciones finales
    expect(system.getActiveActivity()?.id).toBe(activePilotoAuto.id);

    // Verificar que podemos acceder a los datos analíticos del día anterior
    const timeDistribution = system.getTimeDistributionData(diaAnterior.id);
    expect(timeDistribution.categories.length).toBeGreaterThan(0);
  });

  test("Flujo alternativo: Gestionar biblioteca sin iniciar día", () => {
    // Verificar que no hay día activo
    expect(system.isDayActive()).toBe(false);

    // Simular que el usuario navega a la biblioteca de actividades
    // Crear una actividad en la biblioteca
    const nuevaActividad = system.createActivityTemplate({
      title: "Nueva Actividad de Test",
      description: "Actividad creada sin iniciar el día",
      type: "clear-objective" as ActivityType,
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 30,
      },
    });

    // Verificar que la actividad se creó correctamente
    const actividades = system.getActivityTemplates();
    expect(actividades.some((a) => a.id === nuevaActividad.id)).toBe(true);

    // Verificar que el día sigue sin estar activo
    expect(system.isDayActive()).toBe(false);

    // Verificar que podemos editar la actividad
    const actividadActualizada = system.updateActivityTemplate(nuevaActividad.id, {
      title: "Actividad Actualizada",
      description: "Descripción actualizada",
    });

    expect(actividadActualizada.title).toBe("Actividad Actualizada");
    expect(actividadActualizada.description).toBe("Descripción actualizada");
  });
});
