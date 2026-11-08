import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type {
  ActivityTemplate,
  ActivityInstance,
  UUID,
  CompletedActivityRecord,
  CompletionRequest,
  CompletionResult,
  ISODateTimeString,
} from "../types";
import { CoreError } from "./errors";

/**
 * Activity lifecycle manager in LifeUI
 * Creates and manages activity templates, instances and completed activity records
 */
export class ActivityManager {
  private systemCore: SystemCore;

  /**
   * ActivityManager constructor
   * @param systemCore System core instance
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  // ===============================================
  // Template management
  // ===============================================

  /**
   * Creates a new activity template
   * @param data Data for the new template
   * @returns The created template
   */
  public createActivityTemplate(
    data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">
  ): ActivityTemplate {
    const id = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    const newTemplate: ActivityTemplate = {
      ...data,
      id,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    this.systemCore.updateState((state) => {
      return {
        ...state,
        global: {
          ...state.global,
          activityTemplates: [...state.global.activityTemplates, newTemplate],
        },
      };
    });

    return newTemplate;
  }

  /**
   * Updates an existing activity template
   * @param id ID of the template to update
   * @param data Data to update
   * @returns The updated template
   * @throws Error if the template does not exist
   */
  public updateActivityTemplate(id: UUID, data: Partial<ActivityTemplate>): ActivityTemplate {
    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedTemplate: ActivityTemplate | null = null;

    this.systemCore.updateState((state) => {
      const templateIndex = state.global.activityTemplates.findIndex(
        (template) => template.id === id
      );

      if (templateIndex === -1) {
        throw new CoreError("activity-template-not-found", `id ${id}`);
      }

      // Update the template
      const template = state.global.activityTemplates[templateIndex];
      updatedTemplate = {
        ...template,
        ...data,
        id, // Make sure the ID does not change
        updatedAt: timestamp,
      };

      // Build a new array with the updated template
      const updatedTemplates = [...state.global.activityTemplates];
      updatedTemplates[templateIndex] = updatedTemplate;

      return {
        ...state,
        global: {
          ...state.global,
          activityTemplates: updatedTemplates,
        },
      };
    });

    if (!updatedTemplate) {
      throw new CoreError("internal", `updating template ${id}`);
    }

    return updatedTemplate;
  }

  /**
   * Deletes an activity template
   * @param id ID of the template to delete
   * @throws Error if the template does not exist
   */
  public deleteActivityTemplate(id: UUID): void {
    this.systemCore.updateState((state) => {
      const templateIndex = state.global.activityTemplates.findIndex(
        (template) => template.id === id
      );

      if (templateIndex === -1) {
        throw new CoreError("activity-template-not-found", `id ${id}`);
      }

      // Check whether any instances use this template
      const hasInstances = state.currentDay?.activityInstances.some(
        (instance) => instance.templateId === id
      );

      if (hasInstances) {
        throw new CoreError("activity-template-in-use", `id ${id}`);
      }

      // Build a new array without the deleted template
      const updatedTemplates = state.global.activityTemplates.filter(
        (_, index) => index !== templateIndex
      );

      return {
        ...state,
        global: {
          ...state.global,
          activityTemplates: updatedTemplates,
        },
      };
    });
  }

  /**
   * Gets all activity templates
   * @returns List of templates
   */
  public getActivityTemplates(): ActivityTemplate[] {
    return this.systemCore.getState().global.activityTemplates;
  }

  /**
   * Gets a specific activity template
   * @param id ID of the template
   * @returns The template, or undefined if it does not exist
   */
  public getActivityTemplate(id: UUID): ActivityTemplate | undefined {
    return this.systemCore
      .getState()
      .global.activityTemplates.find((template) => template.id === id);
  }

  // ===============================================
  // Instance management
  // ===============================================

  /**
   * Creates a new activity instance from a template
   * @param templateId ID of the template
   * @param blockId ID of the time block
   * @param dynamicSettings Settings specific to this instance (optional)
   * @returns The created instance
   * @throws Error if the template does not exist or there is no active day
   */
  public createActivityInstance(
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Pick<
      ActivityInstance,
      "clearObjectiveSettings" | "flexibleDurationSettings" | "timeboxingSettings"
    >
  ): ActivityInstance {
    const state = this.systemCore.getState();

    // Check that there is an active day
    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }

    // Look up the template
    const template = this.getActivityTemplate(templateId);
    if (!template) {
      throw new CoreError("activity-template-not-found", `id ${templateId}`);
    }

    const id = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    // Determine the order within the block
    const blockInstances = state.currentDay.activityInstances.filter(
      (instance) => instance.blockId === blockId
    );

    const order =
      blockInstances.length > 0
        ? Math.max(...blockInstances.map((instance) => instance.order)) + 1
        : 0;

    // Create the base instance with properties from the template
    const baseInstance: ActivityInstance = {
      id,
      templateId,
      blockId,
      order,
      state: "instantiated",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Copy type-specific settings based on the activity type
    if (template.type === "clear-objective" && template.clearObjectiveSettings) {
      baseInstance.clearObjectiveSettings = {
        ...template.clearObjectiveSettings,
      };
    } else if (template.type === "flexible-duration" && template.flexibleDurationSettings) {
      baseInstance.flexibleDurationSettings = {
        ...template.flexibleDurationSettings,
      };
    } else if (template.type === "timeboxing" && template.timeboxingSettings) {
      baseInstance.timeboxingSettings = {
        ...template.timeboxingSettings,
      };
    }

    // Apply dynamic settings if present
    const newInstance: ActivityInstance = dynamicSettings
      ? { ...baseInstance, ...dynamicSettings }
      : baseInstance;

    // Update the state
    let createdInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }

      createdInstance = newInstance;

      return {
        ...state,
        currentDay: {
          ...state.currentDay,
          activityInstances: [...state.currentDay.activityInstances, newInstance],
        },
      };
    });

    if (!createdInstance) {
      throw new CoreError("internal", "creating activity instance");
    }

    return createdInstance;
  }

  /**
   * Updates an activity instance
   * @param id ID of the instance
   * @param data Data to update
   * @returns The updated instance
   * @throws Error if the instance does not exist or there is no active day
   */
  public updateActivityInstance(id: UUID, data: Partial<ActivityInstance>): ActivityInstance {
    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${id}`);
      }

      // Get the current instance
      const instance = state.currentDay.activityInstances[instanceIndex];

      // Do not allow state changes through this method
      if (data.state && data.state !== instance.state) {
        throw new CoreError("invalid-state-change");
      }

      // Update the instance
      updatedInstance = {
        ...instance,
        ...data,
        id, // Make sure the ID does not change
        updatedAt: timestamp,
      };

      // Build a new array with the updated instance
      const updatedInstances = [...state.currentDay.activityInstances];
      updatedInstances[instanceIndex] = updatedInstance;

      return {
        ...state,
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
        },
      };
    });

    if (!updatedInstance) {
      throw new CoreError("internal", `updating instance ${id}`);
    }

    return updatedInstance;
  }

  /**
   * Moves an activity instance to another block and/or changes its order
   * @param id ID of the instance
   * @param targetBlockId ID of the target block
   * @param newOrder New order within the block (optional)
   * @returns The updated instance
   * @throws Error if the instance does not exist or there is no active day
   */
  public moveActivityInstance(id: UUID, targetBlockId: UUID, newOrder?: number): ActivityInstance {
    let updatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }

      // Find the instance
      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${id}`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];

      // If it is the active activity, do not allow moving it
      if (
        state.currentDay.activeActivityInstanceId &&
        state.currentDay.activeActivityInstanceId === id
      ) {
        throw new CoreError("activity-is-active");
      }

      const timestamp = UtilityService.getCurrentISODateTime();
      const siblings = state.currentDay.activityInstances
        .filter((other) => other.blockId === targetBlockId && other.id !== id)
        .sort((a, b) => a.order - b.order);

      let updatedInstances: ActivityInstance[];

      if (newOrder !== undefined) {
        // `newOrder` is the visible position within the target block.
        // Insert there and renumber the block 0..n so the order is
        // never ambiguous (two instances with the same `order`).
        const position = Math.max(0, Math.min(newOrder, siblings.length));
        updatedInstance = {
          ...instance,
          blockId: targetBlockId,
          order: position,
          updatedAt: timestamp,
        };
        const sequence = [...siblings];
        sequence.splice(position, 0, updatedInstance);
        const orderById = new Map(sequence.map((item, index) => [item.id, index]));

        updatedInstances = state.currentDay.activityInstances.map((item) => {
          if (item.id === id) return updatedInstance as ActivityInstance;
          const nextOrder = orderById.get(item.id);
          return nextOrder !== undefined && nextOrder !== item.order
            ? { ...item, order: nextOrder }
            : item;
        });
      } else {
        // No explicit position: at the end of the target block
        const order =
          siblings.length > 0 ? Math.max(...siblings.map((other) => other.order)) + 1 : 0;
        updatedInstance = {
          ...instance,
          blockId: targetBlockId,
          order,
          updatedAt: timestamp,
        };
        updatedInstances = [...state.currentDay.activityInstances];
        updatedInstances[instanceIndex] = updatedInstance;
      }

      return {
        ...state,
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
        },
      };
    });

    if (!updatedInstance) {
      throw new CoreError("internal", `moving instance ${id}`);
    }

    return updatedInstance;
  }

  /**
   * Deletes an activity instance
   * @param id ID of the instance
   * @throws Error if the instance does not exist, is active, or there is no active day
   */
  public deleteActivityInstance(id: UUID): void {
    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }

      // Check whether it is the active activity
      if (state.currentDay.activeActivityInstanceId === id) {
        throw new CoreError("activity-is-active");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${id}`);
      }

      // Build a new array without the deleted instance
      const updatedInstances = state.currentDay.activityInstances.filter(
        (_, index) => index !== instanceIndex
      );

      return {
        ...state,
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
        },
      };
    });
  }

  /**
   * Gets all activity instances for the current day
   * @returns List of instances
   * @throws Error if there is no active day
   */
  public getActivityInstances(): ActivityInstance[] {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }

    // In the test, the updateState mockImplementation does not update the state correctly
    // Return a copy of the array to avoid unwanted mutations
    return [...state.currentDay.activityInstances];
  }

  /**
   * Gets a specific activity instance
   * @param id ID of the instance
   * @returns The instance, or undefined if it does not exist
   * @throws Error if there is no active day
   */
  public getActivityInstance(id: UUID): ActivityInstance | undefined {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }

    return state.currentDay.activityInstances.find((instance) => instance.id === id);
  }

  // ===============================================
  // State control
  // ===============================================

  /**
   * Activates an activity instance.
   *
   * Does NOT auto-complete the previous activity. If one is active, it throws -
   * the UI must close the previous one via `requestCompletion` + `completeActivity` first.
   *
   * @param id ID of the instance
   * @returns The activated instance
   * @throws Error if an activity is already active, the instance does not exist, or there is no active day
   */
  public activateActivity(id: UUID): ActivityInstance {
    const timestamp = UtilityService.getCurrentISODateTime();
    let activatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }

      if (state.currentDay.activeActivityInstanceId) {
        throw new CoreError("activity-already-running");
      }

      // Find the instance to activate
      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${id}`);
      }

      // Update the instance
      const instance = state.currentDay.activityInstances[instanceIndex];
      activatedInstance = {
        ...instance,
        state: "active",
        startTime: timestamp,
        updatedAt: timestamp,
      };

      // Build a new array with the activated instance
      const finalInstances = [...state.currentDay.activityInstances];
      finalInstances[instanceIndex] = activatedInstance;

      return {
        ...state,
        currentDay: {
          ...state.currentDay,
          activityInstances: finalInstances,
          activeActivityInstanceId: id,
        },
      };
    });

    if (!activatedInstance) {
      throw new CoreError("internal", `activating instance ${id}`);
    }

    return activatedInstance;
  }

  /**
   * Completion request: the UI uses this to get the info it needs to
   * show in the CompletionModal. Does NOT complete the activity; it only reads state.
   *
   * @param activityId ID of the active instance to close
   * @returns Data to show in the CompletionModal
   */
  public requestCompletion(activityId: UUID): CompletionRequest {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }
    if (state.currentDay.activeActivityInstanceId !== activityId) {
      throw new CoreError("not-the-active-activity");
    }

    const instance = state.currentDay.activityInstances.find((i) => i.id === activityId);
    if (!instance) {
      throw new CoreError("activity-instance-not-found", `id ${activityId}`);
    }
    const template = this.getActivityTemplate(instance.templateId);
    if (!template) {
      throw new CoreError("activity-template-not-found", `id ${instance.templateId}`);
    }

    const requestedAt = UtilityService.getCurrentISODateTime();
    const durationMinutes = instance.startTime
      ? this.calculateDuration(instance.startTime, requestedAt)
      : 0;

    const estimatedMinutes = this.resolveEstimatedMinutes(instance, template);

    const beatEstimate = UtilityService.calculateBeatEstimate(
      template.type,
      durationMinutes,
      estimatedMinutes
    );

    return {
      activityTitle: template.title,
      durationMinutes,
      estimatedMinutes,
      beatEstimate,
      requestedAt,
    };
  }

  /**
   * Completes the current active activity with the user's honest self-assessment.
   *
   * The core computes the tempos. The UI never recomputes the formula.
   * score === 0 -> 0 tempos. Bonus only if clear-objective + beat estimate.
   *
   * @param activityId ID of the instance to complete
   * @param assessment Self-assessment 0-10
   * @returns Result with the created record, tempos and the day's total
   */
  public completeActivity(
    activityId: UUID,
    assessment: { satisfactionScore: number; endTime?: ISODateTimeString }
  ): CompletionResult {
    // If the UI passes endTime (timestamp frozen when completion was requested),
    // use it. Otherwise fall back to "now". This keeps the duration from changing
    // between the modal preview and the final save.
    const timestamp = assessment.endTime || UtilityService.getCurrentISODateTime();
    const { satisfactionScore } = assessment;

    if (
      typeof satisfactionScore !== "number" ||
      satisfactionScore < 0 ||
      satisfactionScore > 10 ||
      !Number.isInteger(satisfactionScore)
    ) {
      throw new CoreError("invalid-satisfaction-score");
    }

    let resultRecord: CompletedActivityRecord | null = null;
    let beatEstimate = false;
    let temposAwarded = 0;
    let dailyTotal = 0;
    let target = 100;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }
      if (state.currentDay.activeActivityInstanceId !== activityId) {
        throw new CoreError("not-the-active-activity");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (i) => i.id === activityId
      );
      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${activityId}`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];
      const template = this.getActivityTemplate(instance.templateId);
      if (!template) {
        throw new CoreError("activity-template-not-found", `id ${instance.templateId}`);
      }

      const durationMinutes = instance.startTime
        ? this.calculateDuration(instance.startTime, timestamp)
        : 0;

      const estimatedMinutes = this.resolveEstimatedMinutes(instance, template);

      beatEstimate = UtilityService.calculateBeatEstimate(
        template.type,
        durationMinutes,
        estimatedMinutes
      );

      temposAwarded = UtilityService.calculateTemposAwarded(
        durationMinutes,
        satisfactionScore,
        estimatedMinutes
      );

      const completedRecord: CompletedActivityRecord = {
        id: UtilityService.generateUUID(),
        activityInstanceId: instance.id,
        templateId: instance.templateId,
        templateTitle: template.title,
        state: "completed",
        type: template.type,
        startTime: instance.startTime || timestamp,
        endTime: timestamp,
        durationMinutes,
        dayId: state.currentDay.day.id,
        satisfactionScore,
        temposAwarded,
        beatEstimate,
        createdAt: timestamp,
      };

      if (instance.clearObjectiveSettings) {
        completedRecord.clearObjectiveSettings = instance.clearObjectiveSettings;
      } else if (instance.flexibleDurationSettings) {
        completedRecord.flexibleDurationSettings = instance.flexibleDurationSettings;
      } else if (instance.timeboxingSettings) {
        completedRecord.timeboxingSettings = instance.timeboxingSettings;
      }

      resultRecord = completedRecord;
      target = state.global.userPreferences.dailyTempoTarget || 100;
      const dayId = state.currentDay.day.id;
      dailyTotal =
        state.global.completedActivityRecords
          .filter((r) => r.dayId === dayId && r.state === "completed")
          .reduce((sum, r) => sum + (r.temposAwarded || 0), 0) + temposAwarded;

      const updatedInstances = state.currentDay.activityInstances.filter(
        (_, idx) => idx !== instanceIndex
      );

      return {
        ...state,
        global: {
          ...state.global,
          completedActivityRecords: [...state.global.completedActivityRecords, completedRecord],
        },
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
          activeActivityInstanceId: undefined,
        },
      };
    });

    if (!resultRecord) {
      throw new CoreError("internal", `completing activity ${activityId}`);
    }

    return {
      record: resultRecord,
      temposAwarded,
      beatEstimate,
      dailyTempoTotal: dailyTotal,
      // Real uncapped ratio, consistent with TempoSummary.targetProgress.
      targetProgress: dailyTotal / target,
    };
  }

  /**
   * Interrupts the current active activity.
   *
   * Schema v2+: no longer asks avoidable/cause. It only records the interruption
   * with no tempos. No penalty. No moral judgment.
   *
   * @param activityId ID of the instance to interrupt
   * @returns Record of the interrupted activity
   */
  public interruptActivity(activityId: UUID): CompletedActivityRecord {
    const timestamp = UtilityService.getCurrentISODateTime();
    let interruptedRecord: CompletedActivityRecord | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new CoreError("no-active-day");
      }
      if (state.currentDay.activeActivityInstanceId !== activityId) {
        throw new CoreError("not-the-active-activity");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (i) => i.id === activityId
      );
      if (instanceIndex === -1) {
        throw new CoreError("activity-instance-not-found", `id ${activityId}`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];
      const template = this.getActivityTemplate(instance.templateId);
      if (!template) {
        throw new CoreError("activity-template-not-found", `id ${instance.templateId}`);
      }

      const durationMinutes = instance.startTime
        ? this.calculateDuration(instance.startTime, timestamp)
        : 0;

      const record: CompletedActivityRecord = {
        id: UtilityService.generateUUID(),
        activityInstanceId: instance.id,
        templateId: instance.templateId,
        templateTitle: template.title,
        state: "interrupted",
        type: template.type,
        startTime: instance.startTime || timestamp,
        endTime: timestamp,
        durationMinutes,
        dayId: state.currentDay.day.id,
        satisfactionScore: 0,
        temposAwarded: 0,
        beatEstimate: false,
        createdAt: timestamp,
      };

      if (instance.clearObjectiveSettings) {
        record.clearObjectiveSettings = instance.clearObjectiveSettings;
      } else if (instance.flexibleDurationSettings) {
        record.flexibleDurationSettings = instance.flexibleDurationSettings;
      } else if (instance.timeboxingSettings) {
        record.timeboxingSettings = instance.timeboxingSettings;
      }

      interruptedRecord = record;

      const updatedInstances = state.currentDay.activityInstances.filter(
        (_, idx) => idx !== instanceIndex
      );

      return {
        ...state,
        global: {
          ...state.global,
          completedActivityRecords: [...state.global.completedActivityRecords, record],
        },
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
          activeActivityInstanceId: undefined,
        },
      };
    });

    if (!interruptedRecord) {
      throw new CoreError("internal", `interrupting activity ${activityId}`);
    }

    return interruptedRecord;
  }

  /**
   * Gets the current active activity
   * @returns The active instance, or null if there is no active activity
   * @throws Error if there is no active day
   */
  public getActiveActivity(): ActivityInstance | null {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new CoreError("no-active-day");
    }

    if (!state.currentDay.activeActivityInstanceId) {
      return null;
    }

    return (
      state.currentDay.activityInstances.find(
        (instance) => instance.id === state.currentDay?.activeActivityInstanceId
      ) || null
    );
  }

  // ===============================================
  // System activities
  // ===============================================

  /**
   * Creates an instance of the "Piloto Automático" (autopilot) activity
   * @param blockId ID of the block to place the activity in
   * @returns The created instance
   * @throws Error if there is no active day
   */
  public createPilotAutomaticActivity(blockId: UUID): ActivityInstance {
    // Find the autopilot template, or create it if it does not exist
    let pilotTemplate = this.getActivityTemplates().find(
      (template) => template.isSystemActivity && template.title === "Piloto Automático"
    );

    if (!pilotTemplate) {
      // Create the system template if it does not exist
      pilotTemplate = this.createActivityTemplate({
        title: "Piloto Automático",
        description: "Actividad de sistema para registrar tiempo en piloto automático",
        type: "flexible-duration",
        isSystemActivity: true,
        flexibleDurationSettings: {
          minimumDurationMinutes: 15,
          maximumDurationMinutes: 480,
        },
      });
    }

    // Create the instance
    return this.createActivityInstance(pilotTemplate.id, blockId);
  }

  // ===============================================
  // Utility methods
  // ===============================================

  /**
   * Current point estimate for a clear-objective instance: the instance's
   * own (adjusted for today) or, if it has none, the template's.
   * Single source for requestCompletion (preview) and completeActivity (final),
   * so the completion preview never diverges from what is saved.
   */
  private resolveEstimatedMinutes(
    instance: ActivityInstance,
    template: ActivityTemplate
  ): number | undefined {
    if (template.type !== "clear-objective") return undefined;
    return (
      instance.clearObjectiveSettings?.estimatedDurationMinutes ??
      template.clearObjectiveSettings?.estimatedDurationMinutes
    );
  }

  /**
   * Computes the duration in minutes between two ISO timestamps
   * @param startTime Start time in ISO format
   * @param endTime End time in ISO format
   * @returns Duration in minutes
   */
  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    return Math.round(durationMs / (1000 * 60));
  }
}
