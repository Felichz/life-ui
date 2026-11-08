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
 * Analytics Manager
 * Responsible for processing system data to generate visualizations and reports
 * Transforms existing data without keeping its own state
 */
export class AnalyticsManager {
  private systemCore: ISystemCore;

  /**
   * AnalyticsManager constructor
   * @param systemCore Reference to the system core to access the data
   */
  constructor(systemCore: ISystemCore) {
    this.systemCore = systemCore;
  }

  /**
   * Generates data for the timeline visualization
   * @param dayId Optional ID of the specific day to analyze (if not provided, uses all days)
   * @returns Data formatted for the timeline visualization
   */
  public getTimelineData(dayId?: UUID): TimelineData {
    const state = this.systemCore.getState();

    // Filter completed activities by day if specified
    const completedActivities = state.global.completedActivityRecords.filter(
      (record) => !dayId || record.dayId === dayId
    );

    // Filter events by day if specified
    const events = state.global.eventInstances.filter((event) => !dayId || event.dayId === dayId);

    // Array to store all activities (completed and active)
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

    // Add the current active activity if it exists and belongs to the specified day (or if no day was specified)
    if (state.currentDay && state.currentDay.activeActivityInstanceId) {
      const currentDayId = state.currentDay.day.id;
      // Only include the active activity if no day was specified or it belongs to the specified day
      if (!dayId || dayId === currentDayId) {
        const activeActivityId = state.currentDay.activeActivityInstanceId;
        const activeActivity = state.currentDay.activityInstances.find(
          (a) => a.id === activeActivityId
        );

        if (activeActivity) {
          // Look up the template to get more information
          const template = state.global.activityTemplates.find(
            (t) => t.id === activeActivity.templateId
          );

          if (template && activeActivity && activeActivity.startTime) {
            // Compute the duration up to now (in minutes)
            const startTime = new Date(activeActivity.startTime);
            const now = new Date();
            const durationMinutes = Math.floor((now.getTime() - startTime.getTime()) / (1000 * 60));

            // Determine whether it is within the estimate (if applicable)
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

            // Add the active activity to the timeline
            timelineActivities.push({
              id: activeActivity.id,
              title: template.title,
              startTime: activeActivity.startTime,
              endTime: now.toISOString(), // Up to now
              durationMinutes,
              type: template.type,
              state: "completed" as "completed" | "interrupted", // Although it is active, we use "completed" for type compatibility
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
        // Compute the event's position in minutes from the start of the day
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
          // Compute the interruption's position in minutes from the start of the day
          const timestamp = new Date(activity.endTime);
          const position: DayMinutes = timestamp.getHours() * 60 + timestamp.getMinutes();

          // Schema v2+: no avoidable/unavoidable classification and no cause.
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
   * Generates data for time distribution charts
   * @param dayId Optional ID of the specific day to analyze (if not provided, uses all days)
   * @returns Data formatted for time distribution visualizations
   */
  public getTimeDistributionData(dayId?: UUID): TimeDistributionData {
    const state = this.systemCore.getState();

    // Filter activities by day if specified
    const activities = state.global.completedActivityRecords.filter(
      (record) => !dayId || record.dayId === dayId
    );

    // Group activities by type
    const activitiesByCategory = new Map<string, CompletedActivityRecord[]>();

    activities.forEach((activity) => {
      // Use the activity type as the category
      const category = this.getActivityCategoryName(activity.type);

      if (!activitiesByCategory.has(category)) {
        activitiesByCategory.set(category, []);
      }

      activitiesByCategory.get(category)?.push(activity);
    });

    // Compute total time for all activities
    const totalMinutes = activities.reduce((sum, activity) => sum + activity.durationMinutes, 0);

    // Generate category data
    const categories = Array.from(activitiesByCategory.entries()).map(
      ([name, categoryActivities]) => {
        // Compute total time for this category
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
   * Computes statistics for a specific activity or for all of them
   * @param templateId Optional activity template ID to filter by (if not provided, analyzes all)
   * @returns Activity statistics
   */
  public getActivityStats(templateId?: UUID): ActivityStatistics {
    const state = this.systemCore.getState();

    // Filter activities by template if specified
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

    // Compute the completion rate
    const completionRate = totalInstances > 0 ? (completedInstances / totalInstances) * 100 : 0;

    // Compute the average duration
    const averageDuration =
      totalInstances > 0
        ? activities.reduce((sum, activity) => sum + activity.durationMinutes, 0) / totalInstances
        : 0;

    // Compute estimation accuracy (only for activities with an estimate)
    let estimationAccuracy: number | undefined;

    const activitiesWithEstimation = activities.filter(
      (activity) => activity.clearObjectiveSettings?.estimatedDurationMinutes !== undefined
    );

    if (activitiesWithEstimation.length > 0) {
      const accuracySum = activitiesWithEstimation.reduce((sum, activity) => {
        const estimatedDuration = activity.clearObjectiveSettings?.estimatedDurationMinutes;
        if (estimatedDuration) {
          const actualDuration = activity.durationMinutes;
          // Compute the accuracy as a percentage (1 - relative difference)
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
   * Computes the activity completion rate
   * @returns Percentage of completed activities over the total
   */
  public getCompletionRate(): number {
    const stats = this.getActivityStats();
    return stats.completionRate;
  }

  /**
   * Computes the accuracy of the time estimates
   * @returns Average estimation accuracy percentage (0-100)
   */
  public getEstimationAccuracy(): number {
    const stats = this.getActivityStats();
    return stats.estimationAccuracy || 0;
  }

  /**
   * Gets the descriptive name for an activity category
   * @param type Activity type
   * @returns Descriptive name for the category
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
   * Tempo summary for a specific day
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
   * Tempo trends over a time range
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
