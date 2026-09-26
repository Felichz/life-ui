import type {
  UUID,
  ISODateTimeString,
  ISystemCore,
  TimelineData,
  TimeDistributionData,
  ActivityStatistics,
  CompletedActivityRecord,
  DayMinutes,
  TempoSummary,
  TempoTrendPoint,
} from "../types";

/**
 * Gestor de Analíticas
 * Responsable de procesar datos del sistema para generar visualizaciones y reportes
 * Transforma los datos existentes sin mantener estado propio
 */
export class AnalyticsManager {
  private systemCore: ISystemCore;

  /**
   * Constructor del AnalyticsManager
   * @param systemCore Referencia al núcleo del sistema para acceder a los datos
   */
  constructor(systemCore: ISystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Genera datos para la visualización de línea de tiempo
   * @param dayId ID opcional del día específico a analizar (si no se proporciona, usa todos los días)
   * @returns Datos formateados para la visualización de timeline
   */
  public getTimelineData(dayId?: UUID): TimelineData {
    const state = this.systemCore.getState();

    // Filtrar actividades completadas por día si se especifica
    const completedActivities = state.global.completedActivityRecords.filter(
      (record) => !dayId || record.dayId === dayId
    );

    // Filtrar eventos por día si se especifica
    const events = state.global.eventInstances.filter((event) => !dayId || event.dayId === dayId);

    // Array para almacenar todas las actividades (completadas y activas)
    const timelineActivities = [
      ...completedActivities.map((activity) => {
        let isWithinEstimation: boolean | undefined;
        let estimatedDuration: number | undefined;

        if (activity.clearObjectiveSettings) {
          estimatedDuration = activity.clearObjectiveSettings.estimatedDurationMinutes;
          isWithinEstimation = activity.durationMinutes <= estimatedDuration;
        } else if (activity.flexibleDurationSettings) {
          const { minimumDurationMinutes, maximumDurationMinutes } =
            activity.flexibleDurationSettings;
          isWithinEstimation = true;

          if (
            minimumDurationMinutes !== undefined &&
            activity.durationMinutes < minimumDurationMinutes
          ) {
            isWithinEstimation = false;
          }
          if (
            maximumDurationMinutes !== undefined &&
            activity.durationMinutes > maximumDurationMinutes
          ) {
            isWithinEstimation = false;
          }
        } else if (activity.timeboxingSettings) {
          const { minimumDurationMinutes, maximumDurationMinutes } = activity.timeboxingSettings;
          isWithinEstimation = true;

          if (
            minimumDurationMinutes !== undefined &&
            activity.durationMinutes < minimumDurationMinutes
          ) {
            isWithinEstimation = false;
          }
          if (
            maximumDurationMinutes !== undefined &&
            activity.durationMinutes > maximumDurationMinutes
          ) {
            isWithinEstimation = false;
          }
        }

        return {
          id: activity.activityInstanceId || activity.id,
          title: activity.templateTitle,
          startTime: activity.startTime,
          endTime: activity.endTime,
          durationMinutes: activity.durationMinutes,
          type: activity.type,
          state: activity.state,
          estimatedDuration,
          isWithinEstimation,
        };
      }),
    ];

    // Añadir la actividad activa actual si existe y pertenece al día especificado (o si no se especificó día)
    if (state.currentDay && state.currentDay.activeActivityInstanceId) {
      const currentDayId = state.currentDay.day.id;
      // Solo incluir la actividad activa si no se especificó día o si pertenece al día especificado
      if (!dayId || dayId === currentDayId) {
        const activeActivityId = state.currentDay.activeActivityInstanceId;
        const activeActivity = state.currentDay.activityInstances.find(
          (a) => a.id === activeActivityId
        );

        if (activeActivity) {
          // Buscar la plantilla para obtener más información
          const template = state.global.activityTemplates.find(
            (t) => t.id === activeActivity.templateId
          );

          if (template && activeActivity && activeActivity.startTime) {
            // Calcular duración hasta el momento actual (en minutos)
            const startTime = new Date(activeActivity.startTime);
            const now = new Date();
            const durationMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));

            // Determinar si está dentro de la estimación (si aplica)
            let isWithinEstimation: boolean | undefined;
            let estimatedDuration: number | undefined;

            if (activeActivity.clearObjectiveSettings) {
              estimatedDuration = activeActivity.clearObjectiveSettings.estimatedDurationMinutes;
              isWithinEstimation = durationMinutes <= estimatedDuration;
            } else if (activeActivity.flexibleDurationSettings) {
              const { minimumDurationMinutes, maximumDurationMinutes } =
                activeActivity.flexibleDurationSettings;
              isWithinEstimation = true;

              if (
                minimumDurationMinutes !== undefined &&
                durationMinutes < minimumDurationMinutes
              ) {
                isWithinEstimation = false;
              }
              if (
                maximumDurationMinutes !== undefined &&
                durationMinutes > maximumDurationMinutes
              ) {
                isWithinEstimation = false;
              }
            } else if (activeActivity.timeboxingSettings) {
              const { minimumDurationMinutes, maximumDurationMinutes } =
                activeActivity.timeboxingSettings;
              isWithinEstimation = true;

              if (
                minimumDurationMinutes !== undefined &&
                durationMinutes < minimumDurationMinutes
              ) {
                isWithinEstimation = false;
              }
              if (
                maximumDurationMinutes !== undefined &&
                durationMinutes > maximumDurationMinutes
              ) {
                isWithinEstimation = false;
              }
            }

            // Añadir actividad activa al timeline
            timelineActivities.push({
              id: activeActivity.id,
              title: template.title,
              startTime: activeActivity.startTime,
              endTime: now.toISOString(), // Hasta el momento actual
              durationMinutes,
              type: template.type,
              state: "completed" as "completed" | "interrupted", // Aunque está activa, usamos "completed" para compatibilidad de tipos
              estimatedDuration,
              isWithinEstimation,
            });
          }
        }
      }
    }

    return {
      activities: timelineActivities,
      events: events.map((event) => {
        // Calcular la posición del evento en minutos desde el inicio del día
        const timestamp = new Date(event.timestamp);
        const position: DayMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();

        return {
          id: event.id,
          name: event.templateName,
          timestamp: event.timestamp,
          position,
        };
      }),
      interruptions: completedActivities
        .filter((activity) => activity.state === "interrupted")
        .map((activity) => {
          // Calcular la posición de la interrupción en minutos desde el inicio del día
          const timestamp = new Date(activity.endTime);
          const position: DayMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();

          // Schema v2+: sin clasificación evitable/innevitable ni causa.
          return {
            id: activity.id,
            activityId: activity.id,
            timestamp: activity.endTime,
            position,
          };
        }),
    };
  }

  /**
   * Genera datos para gráficos de distribución de tiempo
   * @param dayId ID opcional del día específico a analizar (si no se proporciona, usa todos los días)
   * @returns Datos formateados para visualizaciones de distribución de tiempo
   */
  public getTimeDistributionData(dayId?: UUID): TimeDistributionData {
    const state = this.systemCore.getState();

    // Filtrar actividades por día si se especifica
    const activities = state.global.completedActivityRecords.filter(
      (record) => !dayId || record.dayId === dayId
    );

    // Agrupar actividades por tipo
    const activitiesByCategory = new Map<string, CompletedActivityRecord[]>();

    activities.forEach((activity) => {
      // Usar el tipo de actividad como categoría
      const category = this.getActivityCategoryName(activity.type);

      if (!activitiesByCategory.has(category)) {
        activitiesByCategory.set(category, []);
      }

      activitiesByCategory.get(category)?.push(activity);
    });

    // Calcular tiempo total para todas las actividades
    const totalMinutes = activities.reduce((sum, activity) => sum + activity.durationMinutes, 0);

    // Generar datos de categorías
    const categories = Array.from(activitiesByCategory.entries()).map(
      ([name, categoryActivities]) => {
        // Calcular tiempo total para esta categoría
        const categoryMinutes = categoryActivities.reduce(
          (sum, activity) => sum + activity.durationMinutes,
          0
        );
        const categoryPercentage = totalMinutes > 0 ? (categoryMinutes / totalMinutes) * 100 : 0;

        return {
          name,
          totalMinutes: categoryMinutes,
          percentage: Number(categoryPercentage.toFixed(2)),
          activities: categoryActivities.map((activity) => {
            const activityPercentage =
              totalMinutes > 0 ? (activity.durationMinutes / totalMinutes) * 100 : 0;

            return {
              id: activity.id,
              title: activity.templateTitle,
              minutes: activity.durationMinutes,
              percentage: Number(activityPercentage.toFixed(2)),
            };
          }),
        };
      }
    );

    return { categories };
  }

  /**
   * Calcula estadísticas para una actividad específica o todas
   * @param templateId ID opcional de la plantilla de actividad para filtrar (si no se proporciona, analiza todas)
   * @returns Estadísticas de actividad
   */
  public getActivityStats(templateId?: UUID): ActivityStatistics {
    const state = this.systemCore.getState();

    // Filtrar actividades por plantilla si se especifica
    const activities = state.global.completedActivityRecords.filter(
      (record) => !templateId || record.templateId === templateId
    );

    const totalInstances = activities.length;
    const completedInstances = activities.filter(
      (activity) => activity.state === "completed"
    ).length;
    const interruptedInstances = activities.filter(
      (activity) => activity.state === "interrupted"
    ).length;

    // Calcular tasa de completación
    const completionRate = totalInstances > 0 ? (completedInstances / totalInstances) * 100 : 0;

    // Calcular duración promedio
    const averageDuration =
      totalInstances > 0
        ? activities.reduce((sum, activity) => sum + activity.durationMinutes, 0) / totalInstances
        : 0;

    // Calcular precisión de estimación (solo para actividades con estimación)
    let estimationAccuracy: number | undefined;

    const activitiesWithEstimation = activities.filter(
      (activity) => activity.clearObjectiveSettings?.estimatedDurationMinutes !== undefined
    );

    if (activitiesWithEstimation.length > 0) {
      const accuracySum = activitiesWithEstimation.reduce((sum, activity) => {
        const estimatedDuration = activity.clearObjectiveSettings?.estimatedDurationMinutes;
        if (estimatedDuration) {
          const actualDuration = activity.durationMinutes;
          // Calcular la precisión como porcentaje (1 - diferencia relativa)
          const accuracy = Math.max(
            0,
            100 - Math.abs(((actualDuration - estimatedDuration) / estimatedDuration) * 100)
          );
          return sum + accuracy;
        }
        return sum;
      }, 0);

      estimationAccuracy = accuracySum / activitiesWithEstimation.length;
    }

    return {
      totalInstances,
      completedInstances,
      interruptedInstances,
      completionRate: Number(completionRate.toFixed(2)),
      averageDuration: Number(averageDuration.toFixed(2)),
      estimationAccuracy:
        estimationAccuracy !== undefined ? Number(estimationAccuracy.toFixed(2)) : undefined,
    };
  }

  /**
   * Calcula la tasa de finalización de actividades
   * @returns Porcentaje de actividades completadas sobre el total
   */
  public getCompletionRate(): number {
    const stats = this.getActivityStats();
    return stats.completionRate;
  }

  /**
   * Calcula la precisión de las estimaciones de tiempo
   * @returns Porcentaje promedio de precisión de estimación (0-100)
   */
  public getEstimationAccuracy(): number {
    const stats = this.getActivityStats();
    return stats.estimationAccuracy || 0;
  }

  /**
   * Obtiene el nombre descriptivo para una categoría de actividad
   * @param type Tipo de actividad
   * @returns Nombre descriptivo para la categoría
   */
  private getActivityCategoryName(type: string): string {
    switch (type) {
      case "clear-objective":
        return "Objetivo Definido";
      case "flexible-duration":
        return "Duración Flexible";
      case "timeboxing":
        return "Timeboxing";
      default:
        return "Otros";
    }
  }

  /**
   * Resumen de tempos de un día específico
   */
  public getTempoSummary(dayId: UUID): TempoSummary {
    const state = this.systemCore.getState();
    const target = state.global.userPreferences.dailyTempoTarget || 100;

    const dayRecords = state.global.completedActivityRecords.filter(
      (r) => r.dayId === dayId && r.state === "completed"
    );

    const totalTempos = dayRecords.reduce((sum, r) => sum + (r.temposAwarded || 0), 0);
    const completedActivities = dayRecords.length;
    const averageSatisfaction =
      completedActivities > 0
        ? dayRecords.reduce((sum, r) => sum + (r.satisfactionScore || 0), 0) / completedActivities
        : 0;

    const last = dayRecords[dayRecords.length - 1];

    return {
      totalTempos,
      target,
      targetProgress: totalTempos / target,
      progressBarValue: Math.min(100, (totalTempos / target) * 100),
      displayPercent: Math.round((totalTempos / target) * 100),
      completedActivities,
      averageSatisfaction,
      lastReward: last
        ? {
            recordId: last.id,
            activityTitle: last.templateTitle,
            tempos: last.temposAwarded || 0,
          }
        : undefined,
    };
  }

  /**
   * Tendencias de tempos en un rango temporal
   */
  public getTempoTrends(range: {
    from: ISODateTimeString;
    to: ISODateTimeString;
  }): TempoTrendPoint[] {
    const state = this.systemCore.getState();
    const target = state.global.userPreferences.dailyTempoTarget || 100;
    const fromMs = new Date(range.from).getTime();
    const toMs = new Date(range.to).getTime();

    const daysInRange = state.global.days.filter((d) => {
      const created = new Date(d.createdAt).getTime();
      return created >= fromMs && created <= toMs;
    });

    return daysInRange.map((day) => {
      const records = state.global.completedActivityRecords.filter(
        (r) => r.dayId === day.id && r.state === "completed"
      );
      const totalTempos = records.reduce((sum, r) => sum + (r.temposAwarded || 0), 0);
      const avg =
        records.length > 0
          ? records.reduce((sum, r) => sum + (r.satisfactionScore || 0), 0) / records.length
          : 0;

      return {
        date: day.createdAt,
        totalTempos,
        targetProgress: totalTempos / target,
        averageSatisfaction: avg,
      };
    });
  }
}
