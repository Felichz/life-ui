import type {
  UUID,
  ISODateTimeString,
  ISystemCore,
  TimelineData,
  TimeDistributionData,
  SubjectiveVariablesData,
  ActivityStatistics,
  CompletedActivityRecord,
  InterruptionStatistics,
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

          return {
            id: activity.id,
            activityId: activity.id,
            timestamp: activity.endTime,
            position,
            isAvoidable: false,
            cause: undefined,
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

    // Crear mapa de plantillas para obtener los títulos
    const templatesMap = new Map(
      state.global.activityTemplates.map((template) => [template.id, template.title])
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
   * Genera datos para visualización de variables subjetivas
   * @param dayId ID opcional del día específico a analizar (si no se proporciona, usa todos los días)
   * @returns Datos formateados para gráficos de variables subjetivas
   */
  public getSubjectiveVariablesData(dayId?: UUID): SubjectiveVariablesData {
    const state = this.systemCore.getState();

    // Filtrar snapshots por día si se especifica
    const snapshots = state.global.subjectiveVariableSnapshots.filter(
      (snapshot) => !dayId || snapshot.dayId === dayId
    );

    // Ordenar snapshots por timestamp
    const sortedSnapshots = [...snapshots].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Obtener todas las variables del sistema
    const allVariables = state.global.subjectiveVariables;

    // Determinar rango de tiempo
    let timeRange = {
      start: new Date().toISOString(),
      end: new Date().toISOString(),
    };

    if (sortedSnapshots.length > 0) {
      timeRange = {
        start: sortedSnapshots[0].timestamp,
        end: sortedSnapshots[sortedSnapshots.length - 1].timestamp,
      };
    } else if (dayId) {
      // Si hay un día específico pero no hay snapshots, usar el inicio/fin del día
      const day = state.global.days.find((d) => d.id === dayId);
      if (day && day.startTime && day.endTime) {
        timeRange = {
          start: day.startTime,
          end: day.endTime,
        };
      }
    }

    // Crear mapas para búsqueda rápida de actividades y eventos
    const activitiesMap = new Map(
      state.global.completedActivityRecords.map((activity) => [activity.id, activity.templateTitle])
    );

    const eventsMap = new Map(
      state.global.eventInstances.map((event) => [event.id, event.templateName])
    );

    // Crear estructura de datos para cada variable
    const variables = allVariables.map((variable) => {
      // Filtrar valores para esta variable específica
      const variableSnapshots = sortedSnapshots
        .filter((snapshot) => snapshot.values.some((value) => value.variableId === variable.id))
        .map((snapshot) => {
          const valueObj = snapshot.values.find((v) => v.variableId === variable.id);

          // Obtener títulos de actividades relacionadas
          const relatedActivities = snapshot.relatedActivityIds
            .map((id) => activitiesMap.get(id) || "")
            .filter((title) => title !== "");

          // Obtener nombres de eventos relacionados
          const relatedEvents = snapshot.relatedEventIds
            .map((id) => eventsMap.get(id) || "")
            .filter((name) => name !== "");

          return {
            timestamp: snapshot.timestamp,
            value: valueObj ? valueObj.currentValue : 0,
            relatedActivities,
            relatedEvents,
          };
        });

      return {
        id: variable.id,
        name: variable.name,
        values: variableSnapshots,
      };
    });

    return {
      variables,
      timeRange,
    };
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

    // Schema v2+: causas de interrupción eliminadas del modelo.
    // Se preserva la interfaz pero siempre retorna undefined.
    let frequentInterruptionCauses:
      | { cause: string; count: number; percentage: number }[]
      | undefined;

    const interruptedActivities = activities.filter((activity) => activity.state === "interrupted");

    if (interruptedActivities.length > 0) {
      // Contar ocurrencias (sin causa, agrupamos como "Sin clasificar")
      const causeCounts = new Map<string, number>();

      interruptedActivities.forEach(() => {
        const cause = "Sin clasificar";
        causeCounts.set(cause, (causeCounts.get(cause) || 0) + 1);
      });

      // Convertir a array y ordenar por frecuencia
      frequentInterruptionCauses = Array.from(causeCounts.entries())
        .map(([cause, count]) => ({
          cause,
          count,
          percentage: (count / interruptedActivities.length) * 100,
        }))
        .sort((a, b) => b.count - a.count);
    }

    return {
      totalInstances,
      completedInstances,
      interruptedInstances,
      completionRate: Number(completionRate.toFixed(2)),
      averageDuration: Number(averageDuration.toFixed(2)),
      estimationAccuracy:
        estimationAccuracy !== undefined ? Number(estimationAccuracy.toFixed(2)) : undefined,
      frequentInterruptionCauses,
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
   * Calcula la tasa de interrupción de actividades
   * @returns Porcentaje de actividades interrumpidas sobre el total
   */
  public getInterruptionRate(): number {
    const stats = this.getActivityStats();
    return stats.totalInstances > 0
      ? Number(((stats.interruptedInstances / stats.totalInstances) * 100).toFixed(2))
      : 0;
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
   * Obtiene estadísticas de interrupciones
   *
   * Schema v2+: las interrupciones ya no se clasifican (evitable/innevitable)
   * ni se agrupan por causa. Se preserva la interfaz para no romper consumidores,
   * pero `topCauses` siempre viene vacío y los contadores de clasificación son 0.
   *
   * @returns Estadísticas detalladas sobre interrupciones
   */
  public getInterruptionStats(): InterruptionStatistics {
    const state = this.systemCore.getState();
    const activities = state.global.completedActivityRecords;

    const interruptedActivities = activities.filter((activity) => activity.state === "interrupted");

    const totalInterruptions = interruptedActivities.length;
    // Sin clasificación evitable/innevitable en schema v2+
    const avoidableInterruptions = 0;
    const unavoidableInterruptions = totalInterruptions;
    const avoidablePercentage = 0;

    return {
      totalInterruptions,
      avoidableInterruptions,
      unavoidableInterruptions,
      avoidablePercentage: Number(avoidablePercentage.toFixed(2)),
      topCauses: [],
    };
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
    const target = state.global.userPreferences.dailyTempoTarget || 1000;

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
    const target = state.global.userPreferences.dailyTempoTarget || 1000;
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
