import { UtilityService } from "./utilityService";
import type { SystemCore } from "./index";
import type {
  ActivityTemplate,
  ActivityInstance,
  UUID,
  CompletedActivityRecord,
  ActivityType,
  ActivityState,
  TimeboxingType,
} from "../types";

/**
 * Gestor del ciclo de vida de actividades en Qualia Control
 * Permite crear y gestionar plantillas de actividad, instancias y registros de actividades completadas
 */
export class ActivityManager {
  private systemCore: SystemCore;

  /**
   * Constructor de ActivityManager
   * @param systemCore Instancia del núcleo del sistema
   */
  constructor(systemCore: SystemCore) {
    this.systemCore = systemCore;
  }

  // ===============================================
  // Gestión de plantillas
  // ===============================================

  /**
   * Crea una nueva plantilla de actividad
   * @param data Datos para la nueva plantilla
   * @returns La plantilla creada
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
   * Actualiza una plantilla de actividad existente
   * @param id ID de la plantilla a actualizar
   * @param data Datos a actualizar
   * @returns La plantilla actualizada
   * @throws Error si la plantilla no existe
   */
  public updateActivityTemplate(id: UUID, data: Partial<ActivityTemplate>): ActivityTemplate {
    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedTemplate: ActivityTemplate | null = null;

    this.systemCore.updateState((state) => {
      const templateIndex = state.global.activityTemplates.findIndex(
        (template) => template.id === id
      );

      if (templateIndex === -1) {
        throw new Error(`Plantilla de actividad con ID ${id} no encontrada`);
      }

      // Actualizar la plantilla
      const template = state.global.activityTemplates[templateIndex];
      updatedTemplate = {
        ...template,
        ...data,
        id, // Asegurar que el ID no cambie
        updatedAt: timestamp,
      };

      // Crear nuevo array con la plantilla actualizada
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
      throw new Error(`Error al actualizar la plantilla ${id}`);
    }

    return updatedTemplate;
  }

  /**
   * Elimina una plantilla de actividad
   * @param id ID de la plantilla a eliminar
   * @throws Error si la plantilla no existe
   */
  public deleteActivityTemplate(id: UUID): void {
    this.systemCore.updateState((state) => {
      const templateIndex = state.global.activityTemplates.findIndex(
        (template) => template.id === id
      );

      if (templateIndex === -1) {
        throw new Error(`Plantilla de actividad con ID ${id} no encontrada`);
      }

      // Verificar si hay instancias usando esta plantilla
      const hasInstances = state.currentDay?.activityInstances.some(
        (instance) => instance.templateId === id
      );

      if (hasInstances) {
        throw new Error(`No se puede eliminar la plantilla ${id} porque tiene instancias activas`);
      }

      // Crear nuevo array sin la plantilla eliminada
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
   * Obtiene todas las plantillas de actividad
   * @returns Lista de plantillas
   */
  public getActivityTemplates(): ActivityTemplate[] {
    return this.systemCore.getState().global.activityTemplates;
  }

  /**
   * Obtiene una plantilla de actividad específica
   * @param id ID de la plantilla
   * @returns La plantilla o undefined si no existe
   */
  public getActivityTemplate(id: UUID): ActivityTemplate | undefined {
    return this.systemCore
      .getState()
      .global.activityTemplates.find((template) => template.id === id);
  }

  // ===============================================
  // Gestión de instancias
  // ===============================================

  /**
   * Crea una nueva instancia de actividad a partir de una plantilla
   * @param templateId ID de la plantilla
   * @param blockId ID del bloque de tiempo
   * @param dynamicSettings Configuraciones específicas para esta instancia (opcional)
   * @returns La instancia creada
   * @throws Error si la plantilla no existe o no hay día activo
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

    // Verificar que existe un día activo
    if (!state.currentDay) {
      throw new Error("No hay un día activo para crear instancias");
    }

    // Buscar la plantilla
    const template = this.getActivityTemplate(templateId);
    if (!template) {
      throw new Error(`Plantilla con ID ${templateId} no encontrada`);
    }

    const id = UtilityService.generateUUID();
    const timestamp = UtilityService.getCurrentISODateTime();

    // Determinar el orden dentro del bloque
    const blockInstances = state.currentDay.activityInstances.filter(
      (instance) => instance.blockId === blockId
    );

    const order =
      blockInstances.length > 0
        ? Math.max(...blockInstances.map((instance) => instance.order)) + 1
        : 0;

    // Crear la instancia base con propiedades de la plantilla
    const baseInstance: ActivityInstance = {
      id,
      templateId,
      blockId,
      order,
      state: "instantiated",
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    // Copiar configuraciones específicas según el tipo de actividad
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

    // Aplicar configuraciones dinámicas si existen
    const newInstance: ActivityInstance = dynamicSettings
      ? { ...baseInstance, ...dynamicSettings }
      : baseInstance;

    // Actualizar el estado
    let createdInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo para crear instancias");
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
      throw new Error("Error al crear la instancia de actividad");
    }

    return createdInstance;
  }

  /**
   * Actualiza una instancia de actividad
   * @param id ID de la instancia
   * @param data Datos a actualizar
   * @returns La instancia actualizada
   * @throws Error si la instancia no existe o no hay día activo
   */
  public updateActivityInstance(id: UUID, data: Partial<ActivityInstance>): ActivityInstance {
    const timestamp = UtilityService.getCurrentISODateTime();
    let updatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      // Obtener la instancia actual
      const instance = state.currentDay.activityInstances[instanceIndex];

      // No permitir cambios de estado a través de este método
      if (data.state && data.state !== instance.state) {
        throw new Error("No se puede cambiar el estado directamente. Use los métodos específicos.");
      }

      // Actualizar la instancia
      updatedInstance = {
        ...instance,
        ...data,
        id, // Asegurar que el ID no cambie
        updatedAt: timestamp,
      };

      // Crear nuevo array con la instancia actualizada
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
      throw new Error(`Error al actualizar la instancia ${id}`);
    }

    return updatedInstance;
  }

  /**
   * Mueve una instancia de actividad a otro bloque y/o cambia su orden
   * @param id ID de la instancia
   * @param targetBlockId ID del bloque destino
   * @param newOrder Nuevo orden dentro del bloque (opcional)
   * @returns La instancia actualizada
   * @throws Error si la instancia no existe o no hay día activo
   */
  public moveActivityInstance(id: UUID, targetBlockId: UUID, newOrder?: number): ActivityInstance {
    let updatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      // Buscar la instancia
      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];

      // Si es la actividad activa, no permitir moverla
      if (
        state.currentDay.activeActivityInstanceId &&
        state.currentDay.activeActivityInstanceId === id
      ) {
        throw new Error("No se puede mover una actividad activa");
      }

      // Determinar el nuevo orden
      let order: number;
      if (newOrder !== undefined) {
        order = newOrder;
      } else {
        // Si no se proporciona un orden, ponerla al final del bloque destino
        const blockInstances = state.currentDay.activityInstances.filter(
          (instance) => instance.blockId === targetBlockId && instance.id !== id
        );
        order =
          blockInstances.length > 0
            ? Math.max(...blockInstances.map((instance) => instance.order)) + 1
            : 0;
      }

      // Actualizar la instancia
      const timestamp = UtilityService.getCurrentISODateTime();
      updatedInstance = {
        ...instance,
        blockId: targetBlockId,
        order,
        updatedAt: timestamp,
      };

      // Crear nuevo array con la instancia actualizada
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
      throw new Error(`Error al mover la instancia ${id}`);
    }

    return updatedInstance;
  }

  /**
   * Elimina una instancia de actividad
   * @param id ID de la instancia
   * @throws Error si la instancia no existe, está activa o no hay día activo
   */
  public deleteActivityInstance(id: UUID): void {
    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      // Verificar si es la actividad activa
      if (state.currentDay.activeActivityInstanceId === id) {
        throw new Error("No se puede eliminar una actividad activa");
      }

      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      // Crear nuevo array sin la instancia eliminada
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
   * Obtiene todas las instancias de actividad del día actual
   * @returns Lista de instancias
   * @throws Error si no hay día activo
   */
  public getActivityInstances(): ActivityInstance[] {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new Error("No hay un día activo");
    }

    // En el test, la función mockImplementation del updateState no está modificando el estado correctamente
    // Devolvemos una copia del array para evitar modificaciones no deseadas
    return [...state.currentDay.activityInstances];
  }

  /**
   * Obtiene una instancia de actividad específica
   * @param id ID de la instancia
   * @returns La instancia o undefined si no existe
   * @throws Error si no hay día activo
   */
  public getActivityInstance(id: UUID): ActivityInstance | undefined {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new Error("No hay un día activo");
    }

    return state.currentDay.activityInstances.find((instance) => instance.id === id);
  }

  // ===============================================
  // Control de estado
  // ===============================================

  /**
   * Activa una instancia de actividad
   * @param id ID de la instancia
   * @returns La instancia activada
   * @throws Error si la instancia no existe o no hay día activo
   */
  public activateActivity(id: UUID): ActivityInstance {
    const timestamp = UtilityService.getCurrentISODateTime();
    let activatedInstance: ActivityInstance | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      let updatedInstances = [...state.currentDay.activityInstances];
      let completedRecords = [...state.global.completedActivityRecords];

      // Finalizar actividad activa previa si existe
      if (state.currentDay.activeActivityInstanceId) {
        const activeInstanceId = state.currentDay.activeActivityInstanceId;
        const activeInstanceIndex = updatedInstances.findIndex(
          (instance) => instance.id === activeInstanceId
        );

        if (activeInstanceIndex !== -1) {
          const activeInstance = updatedInstances[activeInstanceIndex];

          // Crear registro de actividad completada
          const completedRecord: CompletedActivityRecord = {
            id: UtilityService.generateUUID(),
            templateId: activeInstance.templateId,
            templateTitle:
              this.getActivityTemplate(activeInstance.templateId)?.title || "Desconocida",
            state: "completed",
            type: this.getActivityTemplate(activeInstance.templateId)?.type || "clear-objective",
            startTime: activeInstance.startTime || timestamp,
            endTime: timestamp,
            durationMinutes: activeInstance.startTime
              ? this.calculateDuration(activeInstance.startTime, timestamp)
              : 0,
            dayId: state.currentDay.day.id,
            createdAt: timestamp,
          };

          // Añadir configuraciones específicas según el tipo
          if (activeInstance.clearObjectiveSettings) {
            completedRecord.clearObjectiveSettings = activeInstance.clearObjectiveSettings;
          } else if (activeInstance.flexibleDurationSettings) {
            completedRecord.flexibleDurationSettings = activeInstance.flexibleDurationSettings;
          } else if (activeInstance.timeboxingSettings) {
            completedRecord.timeboxingSettings = activeInstance.timeboxingSettings;
          }

          // Agregar el registro a la lista de actividades completadas
          completedRecords = [...completedRecords, completedRecord];

          // Eliminar la instancia activa
          updatedInstances = updatedInstances.filter((_, index) => index !== activeInstanceIndex);
        }
      }

      // Buscar la instancia a activar
      const instanceIndex = updatedInstances.findIndex((instance) => instance.id === id);

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      // Actualizar la instancia
      const instance = updatedInstances[instanceIndex];
      activatedInstance = {
        ...instance,
        state: "active",
        startTime: timestamp,
        updatedAt: timestamp,
      };

      // Crear nuevo array con la instancia activada
      const finalInstances = [...updatedInstances];
      finalInstances[instanceIndex] = activatedInstance;

      return {
        ...state,
        global: {
          ...state.global,
          completedActivityRecords: completedRecords,
        },
        currentDay: {
          ...state.currentDay,
          activityInstances: finalInstances,
          activeActivityInstanceId: id,
        },
      };
    });

    if (!activatedInstance) {
      throw new Error(`Error al activar la instancia ${id}`);
    }

    return activatedInstance;
  }

  /**
   * Completa la actividad activa actual
   * @param id ID de la instancia a completar
   * @returns Registro de la actividad completada
   * @throws Error si la instancia no existe, no está activa o no hay día activo
   */
  public completeActivity(id: UUID): CompletedActivityRecord {
    const timestamp = UtilityService.getCurrentISODateTime();
    let completedRecord: CompletedActivityRecord | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      // Verificar que sea la actividad activa
      if (state.currentDay.activeActivityInstanceId !== id) {
        throw new Error("Solo se puede completar la actividad activa actual");
      }

      // Buscar la instancia
      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];
      const template = this.getActivityTemplate(instance.templateId);

      if (!template) {
        throw new Error(`Plantilla con ID ${instance.templateId} no encontrada`);
      }

      // Crear registro de actividad completada
      completedRecord = {
        id: UtilityService.generateUUID(),
        templateId: instance.templateId,
        templateTitle: template.title,
        state: "completed",
        type: template.type,
        startTime: instance.startTime || timestamp,
        endTime: timestamp,
        durationMinutes: instance.startTime
          ? this.calculateDuration(instance.startTime, timestamp)
          : 0,
        dayId: state.currentDay.day.id,
        createdAt: timestamp,
      };

      // Añadir configuraciones específicas según el tipo
      if (instance.clearObjectiveSettings) {
        completedRecord.clearObjectiveSettings = instance.clearObjectiveSettings;
      } else if (instance.flexibleDurationSettings) {
        completedRecord.flexibleDurationSettings = instance.flexibleDurationSettings;
      } else if (instance.timeboxingSettings) {
        completedRecord.timeboxingSettings = instance.timeboxingSettings;
      }

      // Eliminar la instancia de la lista
      const updatedInstances = state.currentDay.activityInstances.filter(
        (_, index) => index !== instanceIndex
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

    if (!completedRecord) {
      throw new Error(`Error al completar la actividad ${id}`);
    }

    return completedRecord;
  }

  /**
   * Interrumpe la actividad activa actual
   * @param id ID de la instancia a interrumpir
   * @param isAvoidable Indica si la interrupción era evitable
   * @param causeId ID de la causa de interrupción (solo para interrupciones evitables)
   * @returns Registro de la actividad interrumpida
   * @throws Error si la instancia no existe, no está activa o no hay día activo
   */
  public interruptActivity(
    id: UUID,
    isAvoidable: boolean,
    causeId?: UUID
  ): CompletedActivityRecord {
    const timestamp = UtilityService.getCurrentISODateTime();
    let interruptedRecord: CompletedActivityRecord | null = null;

    this.systemCore.updateState((state) => {
      if (!state.currentDay) {
        throw new Error("No hay un día activo");
      }

      // Verificar que sea la actividad activa
      if (state.currentDay.activeActivityInstanceId !== id) {
        throw new Error("Solo se puede interrumpir la actividad activa actual");
      }

      // Buscar la instancia
      const instanceIndex = state.currentDay.activityInstances.findIndex(
        (instance) => instance.id === id
      );

      if (instanceIndex === -1) {
        throw new Error(`Instancia de actividad con ID ${id} no encontrada`);
      }

      const instance = state.currentDay.activityInstances[instanceIndex];
      const template = this.getActivityTemplate(instance.templateId);

      if (!template) {
        throw new Error(`Plantilla con ID ${instance.templateId} no encontrada`);
      }

      // Si es interrupción evitable, verificar que se proporcione un causeId
      if (isAvoidable && !causeId) {
        throw new Error("Se requiere un causeId para interrupciones evitables");
      }

      // Buscar causa de interrupción si aplica
      let causeDescription: string | undefined;
      if (isAvoidable && causeId) {
        const cause = state.global.interruptionCauses.find((cause) => cause.id === causeId);

        if (!cause) {
          throw new Error(`Causa de interrupción con ID ${causeId} no encontrada`);
        }

        causeDescription = cause.description;
      }

      // Crear registro de actividad interrumpida
      interruptedRecord = {
        id: UtilityService.generateUUID(),
        templateId: instance.templateId,
        templateTitle: template.title,
        state: "interrupted",
        type: template.type,
        startTime: instance.startTime || timestamp,
        endTime: timestamp,
        durationMinutes: instance.startTime
          ? this.calculateDuration(instance.startTime, timestamp)
          : 0,
        dayId: state.currentDay.day.id,
        interruptionData: {
          isAvoidable,
          causeId,
          causeDescription,
        },
        createdAt: timestamp,
      };

      // Añadir configuraciones específicas según el tipo
      if (instance.clearObjectiveSettings) {
        interruptedRecord.clearObjectiveSettings = instance.clearObjectiveSettings;
      } else if (instance.flexibleDurationSettings) {
        interruptedRecord.flexibleDurationSettings = instance.flexibleDurationSettings;
      } else if (instance.timeboxingSettings) {
        interruptedRecord.timeboxingSettings = instance.timeboxingSettings;
      }

      // Eliminar la instancia de la lista
      const updatedInstances = state.currentDay.activityInstances.filter(
        (_, index) => index !== instanceIndex
      );

      return {
        ...state,
        global: {
          ...state.global,
          completedActivityRecords: [...state.global.completedActivityRecords, interruptedRecord],
        },
        currentDay: {
          ...state.currentDay,
          activityInstances: updatedInstances,
          activeActivityInstanceId: undefined,
        },
      };
    });

    if (!interruptedRecord) {
      throw new Error(`Error al interrumpir la actividad ${id}`);
    }

    return interruptedRecord;
  }

  /**
   * Obtiene la actividad activa actual
   * @returns La instancia activa o null si no hay actividad activa
   * @throws Error si no hay día activo
   */
  public getActiveActivity(): ActivityInstance | null {
    const state = this.systemCore.getState();

    if (!state.currentDay) {
      throw new Error("No hay un día activo");
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
  // Actividades del sistema
  // ===============================================

  /**
   * Crea una instancia de la actividad "Piloto Automático"
   * @param blockId ID del bloque donde colocar la actividad
   * @returns La instancia creada
   * @throws Error si no hay día activo
   */
  public createPilotAutomaticActivity(blockId: UUID): ActivityInstance {
    // Buscar la plantilla de Piloto Automático o crearla si no existe
    let pilotTemplate = this.getActivityTemplates().find(
      (template) => template.isSystemActivity && template.title === "Piloto Automático"
    );

    if (!pilotTemplate) {
      // Crear la plantilla del sistema si no existe
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

    // Crear la instancia
    return this.createActivityInstance(pilotTemplate.id, blockId);
  }

  // ===============================================
  // Métodos de utilidad
  // ===============================================

  /**
   * Calcula la duración en minutos entre dos timestamps ISO
   * @param startTime Tiempo de inicio en formato ISO
   * @param endTime Tiempo de fin en formato ISO
   * @returns Duración en minutos
   */
  private calculateDuration(startTime: string, endTime: string): number {
    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    return Math.round(durationMs / (1000 * 60));
  }
}
