import { SystemCore } from "../../index";
import type { ActivityType } from "../../../types";

/**
 * Integration tests for Flow 1: Day start
 *
 * These tests verify that the complete day start flow
 * works correctly, from different starting points.
 */
describe("Flow 1: Day start", () => {
  let system: SystemCore;

  beforeEach(() => {
    // Initialize the system (equivalent to opening the app)
    system = new SystemCore();

    // Clear state to ensure there is no active day
    system.clearState();
  });

  test("Day start - first use (no previous data)", () => {
    // Check preconditions
    expect(system.isDayActive()).toBe(false);
    expect(system.getState().global.days.length).toBe(0);

    // Start the day (equivalent to clicking "Comenzar día")
    system.startDay();

    // Verify the day started correctly
    expect(system.isDayActive()).toBe(true);
    expect(system.getCurrentDay()).not.toBeNull();
    expect(system.getCurrentDay()?.state).toBe("active");

    // Create the "Piloto Automático" system activity
    const pilotoAutoTemplate = system.createActivityTemplate({
      title: "Piloto Automático",
      description: "Estado por defecto cuando no hay otra actividad específica activa",
      type: "flexible-duration" as ActivityType,
      isSystemActivity: true,
      flexibleDurationSettings: {
        minimumDurationMinutes: 1,
        maximumDurationMinutes: 1440, // 24 hours
      },
    });

    // Create the "Por Hacer" block for the whole day (0-1439 minutes)
    const porHacerBlock = system.createTimeBlock("Por Hacer", 0, 1439);

    // Mark it as the default block
    system.updateTimeBlock(porHacerBlock.id, { isDefault: true });

    // Create a "Piloto Automático" instance in the "Por Hacer" block
    const pilotoAutoInstance = system.createActivityInstance(
      pilotoAutoTemplate.id,
      porHacerBlock.id
    );

    // Activate "Piloto Automático" as the initial activity
    const activePilotoAuto = system.activateActivity(pilotoAutoInstance.id);

    // Verify "Piloto Automático" is active
    const actividadActiva = system.getActiveActivity();
    expect(actividadActiva).not.toBeNull();
    expect(actividadActiva?.id).toBe(activePilotoAuto.id);

    // Verify the timeline has been initialized with the activity
    const timelineData = system.getTimelineData();
    expect(timelineData.activities.length).toBeGreaterThan(0);
    // Note: this check may need adjusting depending on the specific implementation
    expect(
      timelineData.activities.some(
        (a) => a.title.includes("Piloto") || a.id === activePilotoAuto.id
      )
    ).toBe(true);
  });

  test("Day start - with data from previous days", () => {
    // Prepare data from a previous day
    // Create a finished previous day
    const diaAnterior = system.startDay();

    // Create basic setup for the previous day
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

    // Create a completed activity to have historical data
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

    // Create an instance and activate it
    const meditacionInstance = system.createActivityInstance(
      actividadMeditacion.id,
      porHacerBlock.id
    );

    const activeMeditacion = system.activateActivity(meditacionInstance.id);

    // Complete the activity to have a record
    system.completeActivity(activeMeditacion.id, { satisfactionScore: 5 });

    // End the previous day
    system.endDay();

    // Verify there is no active day but previous data exists
    expect(system.isDayActive()).toBe(false);
    expect(system.getState().global.days.length).toBe(1);
    expect(system.getState().global.completedActivityRecords.length).toBeGreaterThan(0);

    // Start a new day
    system.startDay();

    // Verify the day started correctly
    expect(system.isDayActive()).toBe(true);
    expect(system.getCurrentDay()?.id).not.toBe(diaAnterior.id);

    // Create a Piloto Automático instance for the new day
    const pilotoAutoInstance = system.createActivityInstance(
      pilotoAutoTemplate.id,
      porHacerBlock.id
    );

    // Activate Piloto Automático
    const activePilotoAuto = system.activateActivity(pilotoAutoInstance.id);

    // Final checks
    expect(system.getActiveActivity()?.id).toBe(activePilotoAuto.id);

    // Verify we can access the previous day's analytics data
    const timeDistribution = system.getTimeDistributionData(diaAnterior.id);
    expect(timeDistribution.categories.length).toBeGreaterThan(0);
  });

  test("Alternative flow: Manage library without starting the day", () => {
    // Verify there is no active day
    expect(system.isDayActive()).toBe(false);

    // Simulate the user navigating to the activity library
    // Create an activity in the library
    const nuevaActividad = system.createActivityTemplate({
      title: "Nueva Actividad de Test",
      description: "Actividad creada sin iniciar el día",
      type: "clear-objective" as ActivityType,
      isSystemActivity: false,
      clearObjectiveSettings: {
        estimatedDurationMinutes: 30,
      },
    });

    // Verify the activity was created correctly
    const actividades = system.getActivityTemplates();
    expect(actividades.some((a) => a.id === nuevaActividad.id)).toBe(true);

    // Verify the day is still not active
    expect(system.isDayActive()).toBe(false);

    // Verify we can edit the activity
    const actividadActualizada = system.updateActivityTemplate(nuevaActividad.id, {
      title: "Actividad Actualizada",
      description: "Descripción actualizada",
    });

    expect(actividadActualizada.title).toBe("Actividad Actualizada");
    expect(actividadActualizada.description).toBe("Descripción actualizada");
  });
});
