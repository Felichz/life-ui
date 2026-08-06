import type {
  AppState,
  ISystemCore,
  StateUpdater,
  GlobalState,
  Day,
  ActivityTemplate,
  ActivityInstance,
  CompletedActivityRecord,
  TimeBlock,
  DayMinutes,
  EventTemplate,
  EventInstance,
  TimelineData,
  TimeDistributionData,
  ActivityStatistics,
  UserPreferences,
  UUID,
  CompletionRequest,
  CompletionResult,
  TempoSummary,
  TempoTrendPoint,
  ISODateTimeString,
} from "../types";
import { PersistenceManager } from "./persistenceManager";
import { DayManager } from "./dayManager";
import { ActivityManager } from "./activityManager";
import { TimeBlockManager } from "./timeBlockManager";
import { EventManager } from "./eventManager";
import { AnalyticsManager } from "./analyticsManager";
import { UserPreferencesManager } from "./userPreferencesManager";
import { UtilityService } from "./utilityService";

export { PersistenceManager } from "./persistenceManager";

type StateChangeCallback = (newState: AppState) => void;

/**
 * Implementación del núcleo central del sistema Qualia Control
 * Actúa como orquestador principal y punto único de entrada para la manipulación del estado
 */
export class SystemCore implements ISystemCore {
  private state: AppState;
  private stateChangeCallbacks: StateChangeCallback[] = [];
  private persistenceManager: PersistenceManager;

  // Módulos del sistema
  private dayManager: DayManager;
  private activityManager: ActivityManager;
  private timeBlockManager: TimeBlockManager;
  private eventManager: EventManager;
  private analyticsManager: AnalyticsManager;
  private userPreferencesManager: UserPreferencesManager;

  /**
   * Constructor de SystemCore
   */
  constructor() {
    // Inicializar persistencia primero
    this.persistenceManager = new PersistenceManager();

    // Cargar estado o crear uno por defecto
    const savedState = this.loadStateFromStorage();
    this.state = savedState || this.createDefaultState();

    // Inicializar módulos con referencia a this
    this.dayManager = new DayManager(this);
    this.activityManager = new ActivityManager(this);
    this.timeBlockManager = new TimeBlockManager(this);
    this.eventManager = new EventManager(this);
    this.analyticsManager = new AnalyticsManager(this);
    this.userPreferencesManager = new UserPreferencesManager(this);

    this.initialize();
  }

  /**
   * Inicializa el sistema, actualizando estado si es necesario
   */
  private initialize(): void {
    // Puede extenderse con lógica adicional de inicialización si es necesario
  }

  /**
   * Obtiene el estado actual de la aplicación
   */
  public getState(): AppState {
    return this.state;
  }

  /**
   * Actualiza el estado de la aplicación utilizando una función actualizadora
   * @param updater Función que recibe el estado actual y devuelve el nuevo estado
   */
  public updateState(updater: StateUpdater): void {
    // Crear copia profunda para evitar mutaciones directas
    const currentState = JSON.parse(JSON.stringify(this.state)) as AppState;

    // Aplicar función actualizadora
    const newState = updater(currentState);

    // Actualizar estado
    this.state = newState;

    // Persistir el estado
    this.saveState();

    // Notificar a los observadores
    this.notifyStateChanged();
  }

  /**
   * Registra una función callback para recibir notificaciones de cambios de estado
   * @param callback Función a invocar cuando cambie el estado
   * @returns Función para cancelar la suscripción
   */
  public onStateChange(callback: StateChangeCallback): () => void {
    this.stateChangeCallbacks.push(callback);

    // Devolver función para eliminar el callback
    return () => {
      this.stateChangeCallbacks = this.stateChangeCallbacks.filter((cb) => cb !== callback);
    };
  }

  // ===============================================
  // Métodos de DayManager
  // ===============================================

  /**
   * Inicia un nuevo día de actividad
   */
  public startDay(): Day {
    const newDay = this.dayManager.startDay();
    // Asegurar que el bloque por defecto "Por Hacer" exista
    this.timeBlockManager.ensureDefaultBlockExists();
    return newDay;
  }

  /**
   * Finaliza el día activo
   */
  public endDay(): Day {
    return this.dayManager.endDay();
  }

  /**
   * Obtiene el día activo
   */
  public getCurrentDay(): Day | null {
    return this.dayManager.getCurrentDay();
  }

  /**
   * Verifica si hay un día activo
   */
  public isDayActive(): boolean {
    return this.dayManager.isDayActive();
  }

  // ===============================================
  // Métodos de ActivityManager
  // ===============================================

  /**
   * Crea una nueva plantilla de actividad
   */
  public createActivityTemplate(
    data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">
  ): ActivityTemplate {
    return this.activityManager.createActivityTemplate(data);
  }

  /**
   * Actualiza una plantilla de actividad existente
   */
  public updateActivityTemplate(id: UUID, data: Partial<ActivityTemplate>): ActivityTemplate {
    return this.activityManager.updateActivityTemplate(id, data);
  }

  /**
   * Elimina una plantilla de actividad
   */
  public deleteActivityTemplate(id: UUID): void {
    this.activityManager.deleteActivityTemplate(id);
  }

  /**
   * Obtiene todas las plantillas de actividad
   */
  public getActivityTemplates(): ActivityTemplate[] {
    return this.activityManager.getActivityTemplates();
  }

  /**
   * Crea una nueva instancia de actividad
   */
  public createActivityInstance(
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Pick<
      ActivityInstance,
      "clearObjectiveSettings" | "flexibleDurationSettings" | "timeboxingSettings"
    >
  ): ActivityInstance {
    return this.activityManager.createActivityInstance(templateId, blockId, dynamicSettings);
  }

  /**
   * Actualiza una instancia de actividad existente
   */
  public updateActivityInstance(id: UUID, data: Partial<ActivityInstance>): ActivityInstance {
    return this.activityManager.updateActivityInstance(id, data);
  }

  /**
   * Mueve una instancia de actividad a otro bloque
   */
  public moveActivityInstance(id: UUID, targetBlockId: UUID, newOrder?: number): ActivityInstance {
    return this.activityManager.moveActivityInstance(id, targetBlockId, newOrder);
  }

  /**
   * Elimina una instancia de actividad
   */
  public deleteActivityInstance(id: UUID): void {
    this.activityManager.deleteActivityInstance(id);
  }

  /**
   * Activa una actividad
   */
  public activateActivity(id: UUID): ActivityInstance {
    return this.activityManager.activateActivity(id);
  }

  /**
   * Solicita el cierre de una actividad: la UI usa esto para abrir el CompletionModal.
   */
  public requestCompletion(activityId: UUID): CompletionRequest {
    return this.activityManager.requestCompletion(activityId);
  }

  /**
   * Completa una actividad con auto-evaluación del usuario.
   * Calcula tempos en el core (la UI nunca recalcula la fórmula).
   */
  public completeActivity(
    activityId: UUID,
    assessment: { satisfactionScore: number; endTime?: ISODateTimeString }
  ): CompletionResult {
    return this.activityManager.completeActivity(activityId, assessment);
  }

  /**
   * Interrumpe una actividad. Schema v2+: sin pregunta evitable/causa.
   */
  public interruptActivity(activityId: UUID): CompletedActivityRecord {
    return this.activityManager.interruptActivity(activityId);
  }

  /**
   * Obtiene la actividad activa actualmente
   */
  public getActiveActivity(): ActivityInstance | null {
    return this.activityManager.getActiveActivity();
  }

  // ===============================================
  // Métodos de TimeBlockManager
  // ===============================================

  /**
   * Crea un nuevo bloque de tiempo
   */
  public createTimeBlock(name: string, startMinute: DayMinutes, endMinute: DayMinutes): TimeBlock {
    return this.timeBlockManager.createTimeBlock(name, startMinute, endMinute);
  }

  /**
   * Actualiza un bloque de tiempo existente
   */
  public updateTimeBlock(id: UUID, data: Partial<TimeBlock>): TimeBlock {
    return this.timeBlockManager.updateTimeBlock(id, data);
  }

  /**
   * Elimina un bloque de tiempo
   */
  public deleteTimeBlock(id: UUID, moveActivitiesToTodo: boolean = true): void {
    this.timeBlockManager.deleteTimeBlock(id, moveActivitiesToTodo);
  }

  /**
   * Obtiene todos los bloques de tiempo
   */
  public getTimeBlocks(): TimeBlock[] {
    return this.timeBlockManager.getTimeBlocks();
  }

  /**
   * Obtiene el bloque de tiempo actual según la hora del sistema
   */
  public getCurrentTimeBlock(): TimeBlock | null {
    return this.timeBlockManager.getCurrentTimeBlock();
  }

  /**
   * Verifica si un bloque de tiempo está disponible para asignar actividades
   */
  public isTimeBlockAvailable(blockId: UUID): boolean {
    return this.timeBlockManager.isTimeBlockAvailable(blockId);
  }

  /**
   * Verifica si un bloque de tiempo existe, ignorando restricciones horarias
   * Esta función permite colocar actividades en bloques fuera de su horario
   */
  public isTimeBlockExisting(blockId: UUID): boolean {
    return this.timeBlockManager.isTimeBlockExisting(blockId);
  }

  // ===============================================
  // Métodos de EventManager
  // ===============================================

  /**
   * Crea una nueva plantilla de evento
   */
  public createEventTemplate(name: string): EventTemplate {
    return this.eventManager.createEventTemplate(name);
  }

  /**
   * Actualiza una plantilla de evento existente
   */
  public updateEventTemplate(id: UUID, data: Partial<EventTemplate>): EventTemplate {
    return this.eventManager.updateEventTemplate(id, data);
  }

  /**
   * Elimina una plantilla de evento
   */
  public deleteEventTemplate(id: UUID): void {
    this.eventManager.deleteEventTemplate(id);
  }

  /**
   * Crea una nueva instancia de evento
   */
  public createEventInstance(templateId: UUID): EventInstance {
    return this.eventManager.createEventInstance(templateId);
  }

  /**
   * Obtiene instancias de eventos con filtros opcionales
   */
  public getEventInstances(filters?: {
    dayId?: UUID;
    since?: string;
    until?: string;
  }): EventInstance[] {
    return this.eventManager.getEventInstances(filters);
  }

  /**
   * Obtiene eventos recientes dentro de una ventana de tiempo
   */
  public getRecentEvents(minutesWindow?: number): EventInstance[] {
    return this.eventManager.getRecentEvents(minutesWindow);
  }

  // ===============================================
  // Métodos de AnalyticsManager
  // ===============================================

  /**
   * Genera datos para la visualización de línea de tiempo
   */
  public getTimelineData(dayId?: UUID): TimelineData {
    return this.analyticsManager.getTimelineData(dayId);
  }

  /**
   * Genera datos para gráficos de distribución de tiempo
   */
  public getTimeDistributionData(dayId?: UUID): TimeDistributionData {
    return this.analyticsManager.getTimeDistributionData(dayId);
  }

  /**
   * Obtiene estadísticas para un tipo de actividad específico
   */
  public getActivityStats(templateId?: UUID): ActivityStatistics {
    return this.analyticsManager.getActivityStats(templateId);
  }

  /**
   * Obtiene la tasa de completación de actividades
   */
  public getCompletionRate(): number {
    return this.analyticsManager.getCompletionRate();
  }

  /**
   * Schema v2+: resumen de tempos de un día
   */
  public getTempoSummary(dayId: UUID): TempoSummary {
    return this.analyticsManager.getTempoSummary(dayId);
  }

  /**
   * Schema v2+: tendencias de tempos en un rango
   */
  public getTempoTrends(range: {
    from: ISODateTimeString;
    to: ISODateTimeString;
  }): TempoTrendPoint[] {
    return this.analyticsManager.getTempoTrends(range);
  }

  /**
   * Obtiene la precisión de estimación de tiempos
   */
  public getEstimationAccuracy(): number {
    return this.analyticsManager.getEstimationAccuracy();
  }

  // ===============================================
  // Métodos de UserPreferencesManager
  // ===============================================

  /**
   * Actualiza las preferencias de usuario
   */
  public updateUserPreferences(preferences: Partial<UserPreferences>): UserPreferences {
    return this.userPreferencesManager.updateUserPreferences(preferences);
  }

  /**
   * Obtiene las preferencias de usuario actuales
   */
  public getUserPreferences(): UserPreferences {
    return this.userPreferencesManager.getUserPreferences();
  }

  /**
   * Schema v2+: actualiza el target diario de tempos
   */
  public updateDailyTempoTarget(target: number): UserPreferences {
    return this.userPreferencesManager.updateDailyTempoTarget(target);
  }

  // ===============================================
  // Métodos de PersistenceManager
  // ===============================================

  /**
   * Exporta todos los datos del sistema como JSON.
   * Pasa por el pipeline central de persistencia (sanitiza legacy fields +
   * schemaVersion actual), idéntico al formato que va a localStorage.
   */
  public exportData(): string {
    return this.persistenceManager.serialize(this.state);
  }

  /**
   * Importa datos del sistema desde JSON.
   * Pasa por el pipeline central (parse + validate + migrate + sanitize).
   * Si el JSON es v1/v2 con campos legacy, los archiva en `legacyArchive`
   * y elimina del shape principal.
   */
  public importData(jsonData: string): AppState {
    const migrated = this.persistenceManager.deserialize(jsonData);
    this.updateState(() => migrated);
    return this.state;
  }

  /**
   * Limpia el estado de la aplicación
   */
  public clearState(): void {
    this.persistenceManager.clearState();
    this.state = this.createDefaultState();
    this.notifyStateChanged();
  }

  /**
   * Notifica a todos los observadores registrados sobre un cambio de estado
   */
  private notifyStateChanged(): void {
    for (const callback of this.stateChangeCallbacks) {
      callback(this.state);
    }
  }

  /**
   * Crea un estado predeterminado con valores iniciales
   */
  private createDefaultState(): AppState {
    const timestamp = UtilityService.getCurrentISODateTime();

    const defaultGlobalState: GlobalState = {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      timeBlocks: [],
      userPreferences: {
        dailyTempoTarget: 100,
        updatedAt: timestamp,
      },
      completedActivityRecords: [],
      eventInstances: [],
      schemaVersion: 3,
    };

    return {
      global: defaultGlobalState,
      currentDay: null,
    };
  }

  /**
   * Carga el estado desde localStorage
   */
  private loadStateFromStorage(): AppState | null {
    return this.persistenceManager.loadState();
  }

  /**
   * Guarda el estado en localStorage
   */
  private saveState(): void {
    this.persistenceManager.saveState(this.state);
  }
}
