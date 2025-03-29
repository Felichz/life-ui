// Qualia Control - System Layer
// Main System class that integrates all business logic modules

import type {
  Activity,
  ActivityId,
  ActivitySatisfaction,
  ActivityTemplateId,
  BlockId,
  CustomVariable,
  CustomVariableId,
  DailySummary,
  DayState,
  DiscreteEvent,
  EventId,
  History,
  InterruptedActivity,
  InterruptionCause,
  InterruptionCauseId,
  SharedState,
  SnapshotId,
  TimeBlock,
  UserSettings,
  VariableSnapshot,
} from "../types";

// Importa los módulos del sistema
import { ActivityManagement } from "./activity";
import { TimeManagement } from "./time";
import { VariableManagement } from "./variables";
import { EventManagement } from "./events";
import { DailyManagement } from "./daily";
import { SettingsManagement } from "./settings";
import { MomentumManagement } from "./momentum";

/**
 * Sistema principal que integra todos los módulos de la lógica de negocio
 * para la aplicación Qualia Control
 */
export class System {
  private static instance: System;

  // Estado compartido del sistema
  private state: SharedState;

  // Módulos del sistema
  private activityManagement: ActivityManagement;
  private timeManagement: TimeManagement;
  private variableManagement: VariableManagement;
  private eventManagement: EventManagement;
  private dailyManagement: DailyManagement;
  private settingsManagement: SettingsManagement;
  private momentumManagement: MomentumManagement;

  private constructor() {
    // Inicializar estado y módulos
    this.state = this.initializeState();

    this.activityManagement = new ActivityManagement(this.state);
    this.timeManagement = new TimeManagement(this.state);
    this.variableManagement = new VariableManagement(this.state);
    this.eventManagement = new EventManagement(this.state);
    this.dailyManagement = new DailyManagement(this.state);
    this.settingsManagement = new SettingsManagement(this.state);
    this.momentumManagement = new MomentumManagement(this.state);
  }

  /**
   * Obtiene la instancia única del sistema (patrón Singleton)
   */
  public static getInstance(): System {
    if (!System.instance) {
      System.instance = new System();
    }
    return System.instance;
  }

  /**
   * Inicializa el estado del sistema
   */
  private initializeState(): SharedState {
    // TO DO: Implementar inicialización del estado
    return {} as SharedState;
  }

  /**
   * Actualiza el estado global del sistema
   */
  public async updateSystemState(): Promise<void> {
    // TO DO: Implementar actualización del estado global
  }

  /**
   * Métodos de Activity Management
   */
  // Activity Templates
  public async createActivityTemplate(template: Omit<Activity, "id">): Promise<Activity> {
    return this.activityManagement.createActivityTemplate(template);
  }

  public async getActivityTemplate(templateId: ActivityTemplateId): Promise<Activity | undefined> {
    return this.activityManagement.getActivityTemplate(templateId);
  }

  public async updateActivityTemplate(
    templateUpdates: Partial<Activity> & { id: ActivityTemplateId }
  ): Promise<void> {
    return this.activityManagement.updateActivityTemplate(templateUpdates);
  }

  public async removeActivityTemplate(templateId: ActivityTemplateId): Promise<void> {
    return this.activityManagement.removeActivityTemplate(templateId);
  }

  // Activity Instances
  public async createActivity(activity: Omit<Activity, "id">): Promise<Activity> {
    return this.activityManagement.createActivity(activity);
  }

  public async startActivity(activityId: ActivityId): Promise<void> {
    return this.activityManagement.startActivity(activityId);
  }

  public async completeActivity(
    activityId: ActivityId,
    satisfactionData?: ActivitySatisfaction
  ): Promise<void> {
    return this.activityManagement.completeActivity(activityId, satisfactionData);
  }

  public async interruptActivity(
    activityId: ActivityId,
    interruptionData: Omit<InterruptedActivity, "activityId">
  ): Promise<void> {
    return this.activityManagement.interruptActivity(activityId, interruptionData);
  }

  /**
   * Métodos de Time Management
   */
  // Time Blocks & Scheduling
  public async createTimeBlock(block: Omit<TimeBlock, "id">): Promise<TimeBlock> {
    return this.timeManagement.createTimeBlock(block);
  }

  public async updateTimeBlock(blockUpdates: Partial<TimeBlock> & { id: BlockId }): Promise<void> {
    return this.timeManagement.updateTimeBlock(blockUpdates);
  }

  public async removeTimeBlock(blockId: BlockId): Promise<void> {
    return this.timeManagement.removeTimeBlock(blockId);
  }

  public async getCurrentBlock(): Promise<TimeBlock | undefined> {
    return this.timeManagement.getCurrentBlock();
  }

  // Timebox Management
  public async validateTimeboxLimits(activity: Activity): Promise<boolean> {
    return this.timeManagement.validateTimeboxLimits(activity);
  }

  public async calculateTimeSpent(activityId: ActivityId): Promise<number> {
    return this.timeManagement.calculateTimeSpent(activityId);
  }

  public async notifyTimeboxEnd(activityId: ActivityId): Promise<void> {
    return this.timeManagement.notifyTimeboxEnd(activityId);
  }

  /**
   * Métodos de Custom Variables & Snapshots
   */
  public async createCustomVariable(variable: Omit<CustomVariable, "id">): Promise<CustomVariable> {
    return this.variableManagement.createCustomVariable(variable);
  }

  public async getCustomVariable(
    variableId: CustomVariableId
  ): Promise<CustomVariable | undefined> {
    return this.variableManagement.getCustomVariable(variableId);
  }

  public async updateCustomVariable(
    variableUpdates: Partial<CustomVariable> & { id: CustomVariableId }
  ): Promise<void> {
    return this.variableManagement.updateCustomVariable(variableUpdates);
  }

  public async removeCustomVariable(variableId: CustomVariableId): Promise<void> {
    return this.variableManagement.removeCustomVariable(variableId);
  }

  public async createVariableSnapshot(
    snapshot: Omit<VariableSnapshot, "id">
  ): Promise<VariableSnapshot> {
    return this.variableManagement.createVariableSnapshot(snapshot);
  }

  public async getVariableSnapshots(dateFrom: number, dateTo: number): Promise<VariableSnapshot[]> {
    return this.variableManagement.getVariableSnapshots(dateFrom, dateTo);
  }

  public async getVariableSnapshotById(
    snapshotId: SnapshotId
  ): Promise<VariableSnapshot | undefined> {
    return this.variableManagement.getVariableSnapshotById(snapshotId);
  }

  /**
   * Métodos de Events & Interruptions
   */
  public async createEvent(event: Omit<DiscreteEvent, "id">): Promise<DiscreteEvent> {
    return this.eventManagement.createEvent(event);
  }

  public async getEvents(dateFrom: number, dateTo: number): Promise<DiscreteEvent[]> {
    return this.eventManagement.getEvents(dateFrom, dateTo);
  }

  public async getEventById(eventId: EventId): Promise<DiscreteEvent | undefined> {
    return this.eventManagement.getEventById(eventId);
  }

  public async updateEvent(eventUpdates: Partial<DiscreteEvent> & { id: EventId }): Promise<void> {
    return this.eventManagement.updateEvent(eventUpdates);
  }

  public async removeEvent(eventId: EventId): Promise<void> {
    return this.eventManagement.removeEvent(eventId);
  }

  public async createInterruptionCause(
    cause: Omit<InterruptionCause, "id">
  ): Promise<InterruptionCause> {
    return this.eventManagement.createInterruptionCause(cause);
  }

  public async getInterruptionCause(
    causeId: InterruptionCauseId
  ): Promise<InterruptionCause | undefined> {
    return this.eventManagement.getInterruptionCause(causeId);
  }

  public async getInterruptionCauses(): Promise<InterruptionCause[]> {
    return this.eventManagement.getInterruptionCauses();
  }

  public async updateInterruptionCause(
    causeUpdates: Partial<InterruptionCause> & { id: InterruptionCauseId }
  ): Promise<void> {
    return this.eventManagement.updateInterruptionCause(causeUpdates);
  }

  public async removeInterruptionCause(causeId: InterruptionCauseId): Promise<void> {
    return this.eventManagement.removeInterruptionCause(causeId);
  }

  /**
   * Métodos de Daily Summary & History
   */
  public async getDaySummary(date: number): Promise<DailySummary | undefined> {
    return this.dailyManagement.getDaySummary(date);
  }

  public async getDaySummaries(dateFrom: number, dateTo: number): Promise<DailySummary[]> {
    return this.dailyManagement.getDaySummaries(dateFrom, dateTo);
  }

  public calculateDailySummary(dayState: DayState): DailySummary {
    return this.dailyManagement.calculateDailySummary(dayState);
  }

  public getDayHistory(): History {
    return this.dailyManagement.getDayHistory();
  }

  /**
   * Métodos de Settings Management
   */
  public async getUserSettings(): Promise<UserSettings> {
    return this.settingsManagement.getUserSettings();
  }

  public async updateUserSettings(settingsUpdates: Partial<UserSettings>): Promise<void> {
    return this.settingsManagement.updateUserSettings(settingsUpdates);
  }

  /**
   * Métodos de Momentum Calculation
   */
  public async calculateMomentum(): Promise<number> {
    return this.momentumManagement.calculateMomentum();
  }

  public async updateMomentum(): Promise<void> {
    return this.momentumManagement.updateMomentum();
  }
}

// Exporta una instancia única del sistema
export const system = System.getInstance();
