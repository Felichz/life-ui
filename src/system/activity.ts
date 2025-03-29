// Qualia Control - Activity Management Module

import type {
  Activity,
  ActivityId,
  ActivitySatisfaction,
  ActivityStatus,
  ActivityTemplateId,
  InterruptedActivity,
  SharedState,
} from "../types";

/**
 * Módulo para la gestión de actividades (plantillas e instancias)
 */
export class ActivityManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Gestión de plantillas de actividades
   */

  /**
   * Crea una nueva plantilla de actividad
   */
  public async createActivityTemplate(template: Omit<Activity, "id">): Promise<Activity> {
    const templateId = `template-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newTemplate = {
      ...template,
      templateId,
    };

    this.state.activityTemplates[templateId] = newTemplate as Activity;
    return newTemplate as Activity;
  }

  /**
   * Obtiene una plantilla de actividad por su ID
   */
  public async getActivityTemplate(templateId: ActivityTemplateId): Promise<Activity | undefined> {
    return this.state.activityTemplates[templateId];
  }

  /**
   * Actualiza una plantilla de actividad existente
   */
  public async updateActivityTemplate(
    templateUpdates: Partial<Activity> & { id: ActivityTemplateId }
  ): Promise<void> {
    const { id, ...updates } = templateUpdates;
    const existingTemplate = await this.getActivityTemplate(id);

    if (!existingTemplate) {
      throw new Error(`La plantilla con ID ${id} no existe`);
    }

    // Necesitamos mantener el tipo discriminado para preservar la integridad del tipo
    if (existingTemplate.type === "goalOriented") {
      this.state.activityTemplates[id] = {
        ...existingTemplate,
        ...updates,
        type: "goalOriented", // Preservar el tipo discriminado
      } as Activity;
    } else if (existingTemplate.type === "flexibleDuration") {
      this.state.activityTemplates[id] = {
        ...existingTemplate,
        ...updates,
        type: "flexibleDuration", // Preservar el tipo discriminado
      } as Activity;
    } else if (existingTemplate.type === "timeboxed") {
      this.state.activityTemplates[id] = {
        ...existingTemplate,
        ...updates,
        type: "timeboxed", // Preservar el tipo discriminado
      } as Activity;
    }
  }

  /**
   * Elimina una plantilla de actividad
   */
  public async removeActivityTemplate(templateId: ActivityTemplateId): Promise<void> {
    delete this.state.activityTemplates[templateId];
  }

  /**
   * Gestión de instancias de actividades
   */

  /**
   * Crea una nueva instancia de actividad
   */
  public async createActivity(activity: Omit<Activity, "id">): Promise<Activity> {
    const instanceId = `instance-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    let newActivity: Activity;

    // Crear la actividad de acuerdo a su tipo
    if (activity.type === "goalOriented") {
      newActivity = {
        ...activity,
        type: "goalOriented",
        instance: {
          id: instanceId,
        },
      } as Activity;
    } else if (activity.type === "flexibleDuration") {
      newActivity = {
        ...activity,
        type: "flexibleDuration",
        instance: {
          id: instanceId,
        },
      } as Activity;
    } else {
      newActivity = {
        ...activity,
        type: "timeboxed",
        instance: {
          id: instanceId,
        },
      } as Activity;
    }

    this.state.currentDay.activityInstances.push(newActivity);
    return newActivity;
  }

  /**
   * Inicia una actividad existente
   */
  public async startActivity(activityId: ActivityId): Promise<void> {
    const activityIndex = this.state.currentDay.activityInstances.findIndex(
      (activity) => activity.instance?.id === activityId
    );

    if (activityIndex === -1) {
      throw new Error(`La actividad con ID ${activityId} no existe`);
    }

    const activity = this.state.currentDay.activityInstances[activityIndex];

    if (activity.status === "inProgress") {
      throw new Error(`La actividad con ID ${activityId} ya está en progreso`);
    }

    // Actualizar estado de la actividad
    const updatedActivity = {
      ...activity,
      status: "inProgress" as ActivityStatus,
      instance: {
        ...activity.instance,
        startTime: Date.now(),
      },
    };

    // Reemplazar la actividad en el arreglo
    this.state.currentDay.activityInstances[activityIndex] = updatedActivity as Activity;

    // Actualizar la actividad activa
    this.state.activeActivity = updatedActivity as Activity;
  }

  /**
   * Completa una actividad existente
   */
  public async completeActivity(
    activityId: ActivityId,
    satisfactionData?: ActivitySatisfaction
  ): Promise<void> {
    const activityIndex = this.state.currentDay.activityInstances.findIndex(
      (activity) => activity.instance?.id === activityId
    );

    if (activityIndex === -1) {
      throw new Error(`La actividad con ID ${activityId} no existe`);
    }

    const activity = this.state.currentDay.activityInstances[activityIndex];

    if (activity.status !== "inProgress") {
      throw new Error(`La actividad con ID ${activityId} no está en progreso`);
    }

    const endTime = Date.now();

    if (activity.instance && activity.instance.startTime) {
      const elapsedMs = endTime - activity.instance.startTime;
      const elapsedMinutes = elapsedMs / 60000;

      let updatedActivity: Activity;

      // Actualizar la actividad según su tipo
      if (activity.type === "goalOriented") {
        const estimatedMinutes = activity.dynamicProps.estimatedMinutes || 0;
        updatedActivity = {
          ...activity,
          status: "completed" as ActivityStatus,
          instance: {
            ...activity.instance,
            endTime,
            minutes: elapsedMinutes,
            actualMinutes: elapsedMinutes,
            timeVariance: elapsedMinutes - estimatedMinutes,
          },
        } as Activity;
      } else if (activity.type === "flexibleDuration") {
        const minExpectedMinutes = activity.dynamicProps.minExpectedMinutes || 0;
        const maxExpectedMinutes = activity.dynamicProps.maxExpectedMinutes || 0;
        updatedActivity = {
          ...activity,
          status: "completed" as ActivityStatus,
          instance: {
            ...activity.instance,
            endTime,
            minutes: elapsedMinutes,
            actualMinutes: elapsedMinutes,
            withinExpectedRange:
              elapsedMinutes >= minExpectedMinutes && elapsedMinutes <= maxExpectedMinutes,
          },
        } as Activity;
      } else {
        // Timeboxed
        let metMinimumRequirement = false;

        if (activity.dynamicProps.timeboxConfig.mode === "minimum") {
          const minimumMinutes = activity.dynamicProps.timeboxConfig.minimumMinutes || 0;
          metMinimumRequirement = elapsedMinutes >= minimumMinutes;
        }

        updatedActivity = {
          ...activity,
          status: "completed" as ActivityStatus,
          instance: {
            ...activity.instance,
            endTime,
            minutes: elapsedMinutes,
            actualMinutes: elapsedMinutes,
            metMinimumRequirement,
          },
        } as Activity;
      }

      // Actualizar la actividad en el estado
      this.state.currentDay.activityInstances[activityIndex] = updatedActivity;

      // Registrar satisfacción si se proporcionó
      if (satisfactionData) {
        const satisfaction: ActivitySatisfaction = {
          ...satisfactionData,
          activityId,
          timestamp: endTime,
        };
        this.state.currentDay.dayHistory.satisfactionHistory.push(satisfaction);
      }
    }

    // Eliminar como actividad activa
    this.state.activeActivity = undefined;
  }

  /**
   * Interrumpe una actividad existente
   */
  public async interruptActivity(
    activityId: ActivityId,
    interruptionData: Omit<InterruptedActivity, "activityId">
  ): Promise<void> {
    const activityIndex = this.state.currentDay.activityInstances.findIndex(
      (activity) => activity.instance?.id === activityId
    );

    if (activityIndex === -1) {
      throw new Error(`La actividad con ID ${activityId} no existe`);
    }

    const activity = this.state.currentDay.activityInstances[activityIndex];

    if (activity.status !== "inProgress") {
      throw new Error(`La actividad con ID ${activityId} no está en progreso`);
    }

    // Verificar que la causa existe
    const causeId = interruptionData.causeId;
    if (!this.state.interruptionCauses[causeId]) {
      throw new Error(`La causa de interrupción con ID ${causeId} no existe`);
    }

    const endTime = Date.now();

    // Crear la actividad interrumpida
    if (activity.instance && activity.instance.startTime) {
      const elapsedMs = endTime - activity.instance.startTime;
      const elapsedMinutes = elapsedMs / 60000;

      const updatedActivity = {
        ...activity,
        status: "interrupted" as ActivityStatus,
        instance: {
          ...activity.instance,
          endTime,
          minutes: elapsedMinutes,
        },
      };

      // Actualizar la actividad en el estado
      this.state.currentDay.activityInstances[activityIndex] = updatedActivity as Activity;

      // Incrementar contador de la causa
      this.state.interruptionCauses[causeId].occurrenceCount++;

      // Registrar interrupción en el historial
      const interruption: InterruptedActivity = {
        ...interruptionData,
        activityId,
        timestamp: endTime,
      };
      this.state.currentDay.dayHistory.interruptionHistory.push(interruption);
    }

    // Eliminar como actividad activa
    this.state.activeActivity = undefined;
  }
}
