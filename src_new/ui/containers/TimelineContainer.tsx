import React, { useMemo } from 'react';
import { useSystemCore } from "../hooks/useSystemCore";
import { Timeline } from "../components/Timeline/Timeline";

export const TimelineContainer: React.FC = () => {
    const { getTimelineData, state } = useSystemCore();

    const timelineData = useMemo(() => {
        const currentDayId = state.currentDay?.day.id;
        if (!currentDayId) return null;
        return getTimelineData(currentDayId);
    }, [getTimelineData, state.currentDay?.day.id, state.global.completedActivityRecords, state.global.eventInstances]);

    if (!timelineData) return null;

    return <Timeline data={timelineData} />;
};

export default TimelineContainer;
