import React from 'react';
import type { TimelineData } from "../../../types";
import { formatMinutesToTime, calculatePosition } from "./TimelineUtils";
import "./Timeline.css";

type TimelineActivityData = TimelineData["activities"][0];
type TimelineEventData = TimelineData["events"][0];
type TimelineInterruptionData = TimelineData["interruptions"][0];

interface TimelineBarProps {
    activity: TimelineActivityData;
}

export const TimelineBar: React.FC<TimelineBarProps> = ({ activity }) => {
    const startDate = new Date(activity.startTime);
    const startMinute = startDate.getHours() * 60 + startDate.getMinutes();

    // Guarantee minimum width for very short activities so they are visible
    const displayDuration = Math.max(15, activity.durationMinutes || 0);
    const { left, width } = calculatePosition(startMinute, displayDuration);

    // Determinamos el estilo según el estado de la actividad (active now mapped as completed but with 0 duration if just started)
    let stateClass = "timeline-bar-completed";
    if (activity.state === "interrupted") stateClass = "timeline-bar-interrupted";

    return (
        <div
            className={`timeline-bar ${stateClass}`}
            style={{ left, width }}
            title={`${activity.title} (${formatMinutesToTime(startMinute)} - ${formatMinutesToTime(startMinute + activity.durationMinutes)})`}
        >
            {parseFloat(width) > 5 && (
                <span className="timeline-bar-label">{activity.title}</span>
            )}
        </div>
    );
};

interface TimelineMarkerProps {
    data: TimelineEventData | TimelineInterruptionData;
    position: number; // 0 a 100 percentage
    type: "event" | "interruption";
}

export const TimelineMarker: React.FC<TimelineMarkerProps> = ({ data, position, type }) => {
    const title = type === "event"
        ? (data as TimelineEventData).name
        : `Interrupted Activity ID: ${(data as TimelineInterruptionData).activityId}`;

    // Para evitar que los marcadores en los bordes se salgan de la pantalla
    const boundedPosition = Math.max(0, Math.min(position, 100));

    return (
        <div
            className={`timeline-marker marker-${type}`}
            style={{ left: `${boundedPosition}%` }}
            title={title}
        >
            <div className="timeline-marker-dot"></div>
            <div className="timeline-marker-line"></div>
        </div>
    );
};
