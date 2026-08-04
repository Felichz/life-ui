import { createContext, useContext, useEffect, useRef, useState, useMemo } from "react";
import type { ReactNode } from "react";
import { SystemCore } from "../../system";
import type { AppState, ISystemCore } from "../../types";

// Interfaz de contexto que expone SystemCore y su estado
interface SystemContextType {
  core: ISystemCore;
  state: AppState;
}

// Crear el contexto con un valor predeterminado
export const SystemContext = createContext<SystemContextType | undefined>(undefined);

// Props para el SystemProvider
interface SystemProviderProps {
  children: ReactNode;
}

/**
 * SystemProvider - Componente que proporciona acceso global al estado del sistema
 * y sus operaciones a través del Context API de React
 */
export const SystemProvider = ({ children }: SystemProviderProps) => {
  // Referencia a la instancia única de SystemCore
  const coreRef = useRef<ISystemCore>(new SystemCore());

  // Estado local que forzará actualizaciones de la UI cuando cambie el estado del core
  const [state, setState] = useState<AppState>(coreRef.current.getState());

  useEffect(() => {
    // Suscribirse a cambios en el estado del SystemCore
    const unsubscribe = coreRef.current.onStateChange((newState) => {
      setState(newState);
    });

    // Limpieza de suscripción al desmontar
    return () => unsubscribe();
  }, []);

  // Valor del contexto que expone el core y su estado actual
  const contextValue = useMemo(() => {
    return {
      core: coreRef.current,
      state,
    };
  }, [state]);

  return <SystemContext.Provider value={contextValue}>{children}</SystemContext.Provider>;
};

/**
 * Hook personalizado que proporciona acceso al SystemCore y su estado
 * Lanza un error si se utiliza fuera del SystemProvider
 */
export const useSystemCore = () => {
  const context = useContext(SystemContext);

  if (context === undefined) {
    throw new Error("useSystemCore debe ser usado dentro de un SystemProvider");
  }

  const { core, state } = context;

  // Devolver estado actual y todas las operaciones del SystemCore
  return {
    // Estado actual
    state,

    // Métodos de DayManager
    startDay: core.startDay.bind(core),
    endDay: core.endDay.bind(core),
    getCurrentDay: core.getCurrentDay.bind(core),
    isDayActive: core.isDayActive.bind(core),

    // Métodos de ActivityManager
    createActivityTemplate: core.createActivityTemplate.bind(core),
    updateActivityTemplate: core.updateActivityTemplate.bind(core),
    deleteActivityTemplate: core.deleteActivityTemplate.bind(core),
    getActivityTemplates: core.getActivityTemplates.bind(core),
    createActivityInstance: core.createActivityInstance.bind(core),
    updateActivityInstance: core.updateActivityInstance.bind(core),
    moveActivityInstance: core.moveActivityInstance.bind(core),
    deleteActivityInstance: core.deleteActivityInstance.bind(core),
    activateActivity: core.activateActivity.bind(core),
    requestCompletion: core.requestCompletion.bind(core),
    completeActivity: core.completeActivity.bind(core),
    interruptActivity: core.interruptActivity.bind(core),
    getActiveActivity: core.getActiveActivity.bind(core),

    // Métodos de TimeBlockManager
    createTimeBlock: core.createTimeBlock.bind(core),
    updateTimeBlock: core.updateTimeBlock.bind(core),
    deleteTimeBlock: core.deleteTimeBlock.bind(core),
    getTimeBlocks: core.getTimeBlocks.bind(core),
    getCurrentTimeBlock: core.getCurrentTimeBlock.bind(core),
    isTimeBlockAvailable: core.isTimeBlockAvailable.bind(core),
    isTimeBlockExisting: core.isTimeBlockExisting.bind(core),

    // Métodos de SubjectiveVariableManager
    createSubjectiveVariable: core.createSubjectiveVariable.bind(core),
    updateSubjectiveVariable: core.updateSubjectiveVariable.bind(core),
    deleteSubjectiveVariable: core.deleteSubjectiveVariable.bind(core),
    createSnapshot: core.createSnapshot.bind(core),
    getSnapshots: core.getSnapshots.bind(core),
    getLatestValues: core.getLatestValues.bind(core),
    canUpdateVariables: core.canUpdateVariables.bind(core),

    // Métodos de EventManager
    createEventTemplate: core.createEventTemplate.bind(core),
    updateEventTemplate: core.updateEventTemplate.bind(core),
    deleteEventTemplate: core.deleteEventTemplate.bind(core),
    createEventInstance: core.createEventInstance.bind(core),
    getEventInstances: core.getEventInstances.bind(core),
    getRecentEvents: core.getRecentEvents.bind(core),

    // Métodos de InterruptionManager
    createInterruptionCause: core.createInterruptionCause.bind(core),
    updateInterruptionCause: core.updateInterruptionCause.bind(core),
    deleteInterruptionCause: core.deleteInterruptionCause.bind(core),
    getInterruptionCauses: core.getInterruptionCauses.bind(core),
    getInterruptionStatistics: core.getInterruptionStatistics.bind(core),

    // Métodos de AnalyticsManager
    getTimelineData: core.getTimelineData.bind(core),
    getTimeDistributionData: core.getTimeDistributionData.bind(core),
    getSubjectiveVariablesData: core.getSubjectiveVariablesData.bind(core),
    getActivityStats: core.getActivityStats.bind(core),
    getCompletionRate: core.getCompletionRate.bind(core),
    getInterruptionRate: core.getInterruptionRate.bind(core),
    getEstimationAccuracy: core.getEstimationAccuracy.bind(core),
    getTempoSummary: core.getTempoSummary.bind(core),
    getTempoTrends: core.getTempoTrends.bind(core),

    // Métodos de UserPreferencesManager
    updateUserPreferences: core.updateUserPreferences.bind(core),
    getUserPreferences: core.getUserPreferences.bind(core),
    toggleVariableVisibility: core.toggleVariableVisibility.bind(core),
    isVariableVisible: core.isVariableVisible.bind(core),
    updateDailyTempoTarget: core.updateDailyTempoTarget.bind(core),

    // Métodos de PersistenceManager
    exportData: core.exportData.bind(core),
    importData: core.importData.bind(core),
    clearState: core.clearState.bind(core),
  };
};
