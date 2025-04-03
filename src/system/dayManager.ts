import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type { Day, UUID, ActivityInstance } from "../types";

/**
 * Gestor del ciclo de vida de los días de actividad en Qualia Control
 * Permite iniciar, finalizar y consultar información sobre los días
 */
export class DayManager {
  private systemCore: SystemCore;

  /**
   * Constructor de DayManager
   * @param systemCore Instancia del núcleo del sistema
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Inicia un nuevo día de actividad
   * @returns El día creado
   * @throws Error si ya existe un día activo
   */
  public startDay(): Day {
    // Verificar que no exista ya un día activo
    if (this.isDayActive()) {
      throw new Error("No se puede iniciar un nuevo día mientras hay un día activo");
    }

    // Generar datos para el nuevo día
    const id: UUID = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    // Crear objeto del día
    const newDay: Day = {
      id,
      state: "active",
      startTime: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Actualizar el estado global y el día actual
    this.systemCore.updateState((state) => {
      // Obtener actividades pendientes si existen en el estado global
      let pendingActivities: ActivityInstance[] = [];

      // Verificar si hay actividades pendientes en el estado global
      if (
        state.global.pendingActivityInstances &&
        state.global.pendingActivityInstances.length > 0
      ) {
        pendingActivities = [...state.global.pendingActivityInstances];

        // Limpiar las actividades pendientes después de recuperarlas
        state.global.pendingActivityInstances = [];
      }

      // Añadir día a la lista de días en el estado global
      state.global.days.push(newDay);

      // Establecer el día actual con las instancias pendientes
      state.currentDay = {
        day: newDay,
        activityInstances: pendingActivities,
        activeActivityInstanceId: undefined,
      };

      return state;
    });

    return newDay;
  }

  /**
   * Finaliza el día activo
   * @returns El día finalizado
   * @throws Error si no hay un día activo
   */
  public endDay(): Day {
    // Verificar que exista un día activo
    if (!this.isDayActive()) {
      throw new Error("No hay un día activo para finalizar");
    }

    const timestamp = UtilityService.getCurrentISODateTime();

    // Actualizar el estado
    let completedDay: Day | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        return state;
      }

      // Obtener referencia al día actual
      const currentDay = state.currentDay.day;

      // Guardar las actividades pendientes antes de limpiar el día actual
      // Nos aseguramos de que solo guardamos actividades que no están activas
      const pendingActivities = state.currentDay.activityInstances.filter(
        (instance) => instance.state !== "active"
      );

      // Inicializar el campo si no existe
      if (!state.global.pendingActivityInstances) {
        state.global.pendingActivityInstances = [];
      }

      // Guardar actividades pendientes en el estado global
      state.global.pendingActivityInstances = pendingActivities;

      // Actualizar el estado del día a inactivo y registrar hora de finalización
      const updatedDay: Day = {
        ...currentDay,
        state: "inactive",
        endTime: timestamp,
        updatedAt: timestamp,
      };

      // Guardar referencia para retornar
      completedDay = updatedDay;

      // Actualizar día en la lista global
      const dayIndex = state.global.days.findIndex((day) => day.id === currentDay.id);
      if (dayIndex >= 0) {
        state.global.days[dayIndex] = updatedDay;
      }

      // Limpiar día actual
      state.currentDay = null;

      return state;
    });

    if (!completedDay) {
      throw new Error("Error al finalizar el día");
    }

    return completedDay;
  }

  /**
   * Obtiene el día activo
   * @returns El día activo o null si no hay día activo
   */
  public getCurrentDay(): Day | null {
    const state = this.systemCore.getState();
    return state.currentDay ? state.currentDay.day : null;
  }

  /**
   * Obtiene todos los días registrados
   * @returns Lista de todos los días
   */
  public getDays(): Day[] {
    const state = this.systemCore.getState();
    return state.global.days;
  }

  /**
   * Verifica si hay un día activo
   * @returns true si hay un día activo, false en caso contrario
   */
  public isDayActive(): boolean {
    const state = this.systemCore.getState();
    return state.currentDay !== null;
  }
}
