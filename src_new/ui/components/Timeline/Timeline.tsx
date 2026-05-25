import React, { useMemo } from 'react';
import type { TimelineData } from "../../../types";
import { TimelineBar, TimelineMarker } from "./TimelineElements";
import { formatMinutesToTime } from "./TimelineUtils";
import "./Timeline.css";

interface TimelineProps {
    data: TimelineData;
    isLoading?: boolean;
}

export const Timeline: React.FC<TimelineProps> = ({ data, isLoading }) => {
    const { activities, events, interruptions } = data;

    // Pre-calcular las etiquetas de las horas
    const hourMarkers = useMemo(() => {
        const markers = [];
        for (let hour = 0; hour <= 24; hour += 2) {
            const is24 = hour === 24;
            const displayHour = is24 ? "24:00" : formatMinutesToTime(hour * 60);
            const position = (hour / 24) * 100;

            markers.push(
                <div key={`hour-${hour}`} className="timeline-hour-marker" style={{ left: `${position}%` }}>
                    <div className="timeline-hour-line-tick" />
                    <span className="timeline-hour-label">{displayHour}</span>
                </div>
            );
        }
        return markers;
    }, []);

    const hasData = activities.length > 0 || events.length > 0 || interruptions.length > 0;

    if (isLoading) {
        return (
            <div className="timeline-container loading">
                <div className="timeline-skeleton-pulse" />
            </div>
        );
    }

    return (
        <div className="timeline-container">
            {/* Container de la escala de horas */}
            <div className="timeline-scale">
                {hourMarkers}
            </div>

            <div className="timeline-divider" />

            {!hasData ? (
                <div className="timeline-empty-state">
                    <span>No hay datos registrados aún.</span>
                </div>
            ) : (
                <div className="timeline-tracks-wrapper">
                    {/* Fila principal para Actividades */}
                    <div className="timeline-track timeline-track-activities">
                        {activities.map(activity => (
                            <TimelineBar key={`act-${activity.id}`} activity={activity} />
                        ))}
                    </div>

                    {/* Fila para Eventos (Solo se renderiza si hay) */}
                    {events.length > 0 && (
                        <div className="timeline-track timeline-track-events">
                            {events.map(event => (
                                <TimelineMarker
                                    key={`evt-${event.id}`}
                                    type="event"
                                    data={event}
                                    position={event.position || (event as any).timestamp ? (new Date((event as any).timestamp).getHours() * 60 + new Date((event as any).timestamp).getMinutes()) / 1440 * 100 : 0}
                                />
                            ))}
                        </div>
                    )}

                    {/* Fila para Interrupciones */}
                    {interruptions.length > 0 && (
                        <div className="timeline-track timeline-track-interruptions">
                            {interruptions.map(interruption => (
                                <TimelineMarker
                                    key={`int-${interruption.id}`}
                                    type="interruption"
                                    data={interruption}
                                    position={interruption.position || 0}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
