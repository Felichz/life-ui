import React, { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import type { AppState, ISystemCore } from "../../types";
import { SystemCore } from "../../system/SystemCore";

// Create context with undefined as initial value
const SystemContext = createContext<ISystemCore | undefined>(undefined);
const StateContext = createContext<AppState | undefined>(undefined);

interface SystemProviderProps {
    children: ReactNode;
}

/**
 * SystemProvider wraps the application to provide access to the SystemCore
 * and its reactive state using React Context.
 */
export const SystemProvider: React.FC<SystemProviderProps> = ({ children }) => {
    // Use a ref to keep a singleton instance of SystemCore across re-renders
    const coreRef = useRef<ISystemCore>(new SystemCore());

    // State to hold and trigger react re-renders
    const [appState, setAppState] = useState<AppState>(coreRef.current.getState());

    useEffect(() => {
        // Subscribe to state changes from the core
        const unsubscribe = coreRef.current.onStateChange((newState) => {
            setAppState(newState);
        });

        // Cleanup subscription on unmount
        return () => {
            unsubscribe();
        };
    }, []);

    return (
        <SystemContext.Provider value={coreRef.current}>
            <StateContext.Provider value={appState}>
                {children}
            </StateContext.Provider>
        </SystemContext.Provider>
    );
};

/**
 * Hook to access the SystemCore singleton.
 * To get reactive state, use the state hook instead.
 */
export const useSystemCoreAPI = (): ISystemCore => {
    const context = useContext(SystemContext);
    if (context === undefined) {
        throw new Error("useSystemCoreAPI must be used within a SystemProvider");
    }
    return context;
};

/**
 * Hook to access the reactive AppState.
 */
export const useAppState = (): AppState => {
    const context = useContext(StateContext);
    if (context === undefined) {
        throw new Error("useAppState must be used within a SystemProvider");
    }
    return context;
};

/**
 * Utility hook that provides both the API and the current reactive state.
 * Emulates the original app's useSystemCore.
 */
export const useSystemCore = () => {
    const api = useSystemCoreAPI();
    const state = useAppState();

    // Return a bound object that matches the ISystemCore interface 
    // but with the reactive state already injected, allowing direct access in UI.
    return {
        ...api,
        state,

        // Bind methods to ensure 'this' context is preserved
        startDay: api.startDay.bind(api),
        endDay: api.endDay.bind(api),
        isDayActive: api.isDayActive.bind(api),

        createActivityTemplate: api.createActivityTemplate.bind(api),
        updateActivityTemplate: api.updateActivityTemplate.bind(api),
        deleteActivityTemplate: api.deleteActivityTemplate.bind(api),
        getActivityTemplates: api.getActivityTemplates.bind(api),
        createActivityInstance: api.createActivityInstance.bind(api),
        updateActivityInstance: api.updateActivityInstance.bind(api),
        moveActivityInstance: api.moveActivityInstance.bind(api),
        activateActivity: api.activateActivity.bind(api),
        completeActivity: api.completeActivity.bind(api),
        interruptActivity: api.interruptActivity.bind(api),

        createTimeBlock: api.createTimeBlock.bind(api),
        updateTimeBlock: api.updateTimeBlock.bind(api),
        deleteTimeBlock: api.deleteTimeBlock.bind(api),
        getTimeBlocks: api.getTimeBlocks.bind(api),
        getCurrentTimeBlock: api.getCurrentTimeBlock.bind(api),
        isTimeBlockAvailable: api.isTimeBlockAvailable.bind(api),

        getDays: api.getDays.bind(api),
        getEventTemplates: api.getEventTemplates.bind(api),
        createEventTemplate: api.createEventTemplate.bind(api),
        deleteEventTemplate: api.deleteEventTemplate.bind(api),
        createEventInstance: api.createEventInstance.bind(api),

        createSnapshot: api.createSnapshot.bind(api),
        canUpdateVariables: api.canUpdateVariables.bind(api),
        getLatestValues: api.getLatestValues.bind(api),

        getTimelineData: api.getTimelineData.bind(api),
        getTimeDistributionData: api.getTimeDistributionData.bind(api),
        getSubjectiveVariablesData: api.getSubjectiveVariablesData.bind(api),
        getCompletionRate: api.getCompletionRate.bind(api),
    };
};
