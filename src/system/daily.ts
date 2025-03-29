// Qualia Control - Daily Summary & History Management Module

import type { DailySummary, DayState, History, PersistedState, SharedState } from "../types";

/**
 * Módulo para la gestión de resúmenes diarios e historial
 */
export class DailyManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Obtiene el resumen diario para una fecha específica
   */
  public async getDaySummary(date: number): Promise<DailySummary | undefined> {
    const persistedState = this.state as unknown as PersistedState;

    if (!persistedState.dayDatabase) {
      throw new Error("Error de acceso a la base de datos de días");
    }

    // Buscar un día cuyo rango de fechas incluya la fecha proporcionada
    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const startOfDay = targetDate.getTime();

    targetDate.setHours(23, 59, 59, 999);
    const endOfDay = targetDate.getTime();

    const dayState = persistedState.dayDatabase.find(
      (day) => day.startDate <= endOfDay && day.endDate >= startOfDay
    );

    return dayState?.daySummary;
  }

  /**
   * Obtiene resúmenes diarios en un rango de fechas
   */
  public async getDaySummaries(dateFrom: number, dateTo: number): Promise<DailySummary[]> {
    const persistedState = this.state as unknown as PersistedState;

    if (!persistedState.dayDatabase) {
      throw new Error("Error de acceso a la base de datos de días");
    }

    // Filtrar días cuyas fechas estén dentro del rango solicitado
    const daysInRange = persistedState.dayDatabase.filter(
      (day) => day.startDate <= dateTo && day.endDate >= dateFrom
    );

    // Ordenar por fecha (más reciente primero)
    daysInRange.sort((a, b) => b.startDate - a.startDate);

    // Extraer solo los resúmenes diarios
    return daysInRange.map((day) => day.daySummary);
  }

  /**
   * Calcula el resumen diario a partir del estado del día
   */
  public calculateDailySummary(dayState: DayState): DailySummary {
    if (!dayState) {
      throw new Error("Estado del día inválido");
    }

    // Calcular actividades completadas a partir del historial de satisfacción
    const satisfactionHistory = dayState.dayHistory.satisfactionHistory || [];
    const activitiesCompleted = satisfactionHistory.length;

    // Calcular actividades interrumpidas a partir del historial de interrupciones
    const interruptionHistory = dayState.dayHistory.interruptionHistory || [];
    const activitiesInterrupted = interruptionHistory.length;

    // Calcular tasa de finalización
    const totalActivities = activitiesCompleted + activitiesInterrupted;
    const completionRate = totalActivities > 0 ? activitiesCompleted / totalActivities : 0;

    // Calcular promedios de satisfacción y percepción de valor
    let averageSatisfaction = 0;
    let averageValuePerception = 0;

    if (activitiesCompleted > 0) {
      const totalSatisfaction = satisfactionHistory.reduce(
        (sum, entry) => sum + entry.satisfactionScore,
        0
      );

      const totalValue = satisfactionHistory.reduce((sum, entry) => sum + entry.valueScore, 0);

      averageSatisfaction = totalSatisfaction / activitiesCompleted;
      averageValuePerception = totalValue / activitiesCompleted;
    }

    // Calcular calidad general del impulso (momentum)
    const momentumHistory = dayState.dayHistory.momentumHistory || [];
    let overallMomentumQuality = 0;

    if (momentumHistory.length > 0) {
      const totalMomentum = momentumHistory.reduce((sum, entry) => sum + entry.value, 0);

      overallMomentumQuality = totalMomentum / momentumHistory.length;
    }

    // Crear y devolver el resumen diario
    return {
      activitiesCompleted,
      activitiesInterrupted,
      completionRate,
      averageSatisfaction,
      averageValuePerception,
      timeDistribution: dayState.timeDistribution,
      overallMomentumQuality,
    };
  }

  /**
   * Obtiene el historial completo del día actual
   */
  public getDayHistory(): History {
    return this.state.currentDay.dayHistory;
  }
}
