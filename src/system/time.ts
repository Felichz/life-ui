// Qualia Control - Time Management Module

import type { ActivityId, BlockId, SharedState } from "../types";
import type { Activity, TimeBlock } from "../types";

// Interfaz para extender el SharedState específicamente para esta implementación
interface TimeManagementState extends SharedState {
  timeBlocks?: Record<BlockId, TimeBlock>;
}

/**
 * Módulo para la gestión del tiempo y bloques de tiempo
 */
export class TimeManagement {
  private state: TimeManagementState;
  private notificationSystem?: { sendNotification: () => void };

  constructor(state: SharedState, notificationSystem?: { sendNotification: () => void }) {
    this.state = state as TimeManagementState;
    this.notificationSystem = notificationSystem;
  }

  /**
   * Gestión de bloques de tiempo y programación
   */

  /**
   * Crea un nuevo bloque de tiempo
   */
  public async createTimeBlock(block: Omit<TimeBlock, "id">): Promise<TimeBlock> {
    const id = `block-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const newBlock: TimeBlock = {
      ...block,
      id,
    };

    // Inicializar el objeto timeBlocks si no existe
    if (!this.state.timeBlocks) {
      this.state.timeBlocks = {};
    }

    this.state.timeBlocks[id] = newBlock;

    return newBlock;
  }

  /**
   * Actualiza un bloque de tiempo existente
   */
  public async updateTimeBlock(blockUpdates: Partial<TimeBlock> & { id: BlockId }): Promise<void> {
    // Verificar si el bloque existe
    if (!this.state.timeBlocks || !this.state.timeBlocks[blockUpdates.id]) {
      throw new Error(`El bloque con ID ${blockUpdates.id} no existe`);
    }

    // Actualizar el bloque con las propiedades proporcionadas
    this.state.timeBlocks[blockUpdates.id] = {
      ...this.state.timeBlocks[blockUpdates.id],
      ...blockUpdates,
    };
  }

  /**
   * Elimina un bloque de tiempo
   */
  public async removeTimeBlock(blockId: BlockId): Promise<void> {
    // Verificar si el bloque existe
    if (!this.state.timeBlocks || !this.state.timeBlocks[blockId]) {
      throw new Error(`El bloque con ID ${blockId} no existe`);
    }

    // Eliminar el bloque
    delete this.state.timeBlocks[blockId];
  }

  /**
   * Obtiene el bloque de tiempo actual basado en la hora actual
   */
  public async getCurrentBlock(): Promise<TimeBlock | undefined> {
    if (!this.state.timeBlocks) {
      return undefined;
    }

    const currentTime = new Date();
    const currentMinute = currentTime.getHours() * 60 + currentTime.getMinutes();

    // Buscar el bloque que incluye el minuto actual
    for (const blockId in this.state.timeBlocks) {
      const block = this.state.timeBlocks[blockId];
      if (block.startMinute <= currentMinute && block.endMinute >= currentMinute) {
        return block;
      }
    }

    return undefined;
  }

  /**
   * Gestión de timeboxes
   */

  /**
   * Valida si una actividad cumple con sus límites de timebox
   */
  public async validateTimeboxLimits(activity: Activity): Promise<boolean> {
    // Verificar que la actividad sea de tipo timeboxed
    if (activity.type !== "timeboxed") {
      throw new Error(`La actividad no es una actividad timeboxed`);
    }

    // Verificar que la configuración de timebox existe
    if (!activity.dynamicProps?.timeboxConfig) {
      throw new Error(`La actividad no tiene configuración de timebox`);
    }

    // Calcular el tiempo empleado en la actividad
    const timeSpent = await this.calculateTimeSpent(activity.instance?.id as string);

    const config = activity.dynamicProps.timeboxConfig;

    // Validar según el modo de timebox
    switch (config.mode) {
      case "minimum":
        return timeSpent >= (config.minimumMinutes || 0);

      case "maximum":
        return timeSpent <= (config.maximumMinutes || Infinity);

      case "range":
        return (
          timeSpent >= (config.minimumMinutes || 0) &&
          timeSpent <= (config.maximumMinutes || Infinity)
        );

      default:
        return true;
    }
  }

  /**
   * Calcula el tiempo empleado en una actividad
   */
  public async calculateTimeSpent(activityId: ActivityId): Promise<number> {
    // Buscar la actividad en las instancias del día actual
    const activity = this.state.currentDay.activityInstances.find(
      (act) => act.instance?.id === activityId
    );

    if (!activity) {
      throw new Error(`La actividad con ID ${activityId} no existe`);
    }

    if (!activity.instance?.startTime) {
      throw new Error(`La actividad no tiene tiempo de inicio`);
    }

    // Calcular minutos transcurridos desde el inicio de la actividad
    const startTime = activity.instance.startTime;
    const now = Date.now();
    const minutesSpent = (now - startTime) / (60 * 1000);

    return minutesSpent;
  }

  /**
   * Notifica cuando finaliza el timebox de una actividad
   */
  public async notifyTimeboxEnd(activityId: ActivityId): Promise<void> {
    // Buscar la actividad
    const activity = this.state.currentDay.activityInstances.find(
      (act) => act.instance?.id === activityId
    );

    if (!activity) {
      throw new Error(`La actividad con ID ${activityId} no existe`);
    }

    // Verificar si las notificaciones están habilitadas
    if (this.state.userSettings?.enableTimeboxNotifications && this.notificationSystem) {
      // Enviar notificación
      this.notificationSystem.sendNotification();
    }
  }
}
