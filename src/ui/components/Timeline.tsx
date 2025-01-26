import React from "react";

import type { Activity, InvestedTimeRecord } from "@/core/types";

interface TimelineSegment {
  minutesFromStart: number;
  duration: number;
  type: Activity["type"] | "idle";
  title: string;
  tempoModification: number;
  timeRange: string;
}

interface TimelineProps {
  dayStartDate: Date;
  currentMinute: number;
  history: InvestedTimeRecord[];
  activities: Activity[];
}

const formatTimeRange = (startMinute: number, duration: number): string => {
  const startDate = new Date();
  startDate.setHours(Math.floor(startMinute / 60), startMinute % 60);

  const endDate = new Date(startDate);
  endDate.setMinutes(endDate.getMinutes() + duration);

  return `${startDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const getActivityTypeColor = (type: Activity["type"] | "idle"): string => {
  switch (type) {
    case "challenge":
      return "#3b82f6"; // blue-500
    case "neutral":
      return "#10b981"; // emerald-500
    case "discount":
      return "#8b5cf6"; // violet-500
    case "idle":
    default:
      return "#94a3b8"; // slate-400
  }
};

const Timeline: React.FC<TimelineProps> = ({
  dayStartDate,
  currentMinute,
  history,
  activities,
}) => {
  const [hoveredSegment, setHoveredSegment] = React.useState<TimelineSegment | null>(null);
  const [tooltipPosition, setTooltipPosition] = React.useState({ x: 0, y: 0 });

  // Transformar el historial en segmentos para la línea de tiempo
  const segments = React.useMemo(() => {
    return history
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((segment): TimelineSegment => {
        const segmentDate = new Date(segment.timestamp);
        const minutesFromStart = Math.floor(
          (segmentDate.getTime() - dayStartDate.getTime()) / (1000 * 60)
        );

        const activity =
          segment.status === "activity"
            ? activities.find((a) => a.id === segment.activityId)
            : undefined;

        const type = segment.status === "activity" ? segment.type : "idle";

        return {
          minutesFromStart,
          duration: segment.minutesInvested,
          type,
          title: activity?.title || "Inactivo",
          tempoModification: segment.tempoModification,
          timeRange: formatTimeRange(minutesFromStart, segment.minutesInvested),
        };
      });
  }, [history, activities, dayStartDate]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const totalWidth = rect.width;
    const minute = Math.floor((x / totalWidth) * 960);

    // Encontrar el segmento correspondiente a este minuto
    const segment = segments.find(
      (s) => minute >= s.minutesFromStart && minute < s.minutesFromStart + s.duration
    );

    if (segment) {
      setHoveredSegment(segment);
      setTooltipPosition({
        x: e.clientX,
        y: e.clientY,
      });
    } else {
      setHoveredSegment(null);
    }
  };

  const handleMouseLeave = () => {
    setHoveredSegment(null);
  };

  return (
    <div className="relative w-full flex justify-center">
      {/* Contenedor principal de la línea de tiempo */}
      <div className="w-[85%]">
        {/* Fondo y contenedor de segmentos */}
        <div
          className="w-full h-8 bg-secondary rounded-lg relative"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          {/* Segmentos de tiempo */}
          {segments.map((segment, index) => {
            const left = (segment.minutesFromStart / 960) * 100;
            const width = (segment.duration / 960) * 100;

            return (
              <div
                key={index}
                className="absolute h-full"
                style={{
                  left: `${left}%`,
                  width: `${width}%`,
                  backgroundColor: getActivityTypeColor(segment.type),
                  opacity: segment.minutesFromStart > currentMinute ? 0.3 : 1,
                }}
              />
            );
          })}

          {/* Marcador del minuto actual */}
          <div
            className="absolute h-full w-0.5 bg-foreground"
            style={{
              left: `${(currentMinute / 960) * 100}%`,
              opacity: 0.5,
            }}
          />
        </div>

        {/* Tooltip - Ahora fuera del contenedor con overflow */}
        {hoveredSegment && (
          <div
            className="fixed z-50 bg-popover text-popover-foreground p-2 rounded-lg shadow-lg text-sm"
            style={{
              left: tooltipPosition.x,
              top: tooltipPosition.y - 80,
              transform: "translateX(-50%)",
            }}
          >
            <p className="font-medium">{hoveredSegment.title}</p>
            <p className="text-muted-foreground">{hoveredSegment.timeRange}</p>
            <p>
              Tempo: {hoveredSegment.tempoModification > 0 ? "+" : ""}
              {hoveredSegment.tempoModification}
            </p>
          </div>
        )}

        {/* Escala de tiempo */}
        <div className="w-full flex justify-between text-xs text-muted-foreground px-2 mt-1 relative">
          {Array.from({ length: 17 }, (_, i) => i).map((hour) => {
            const minute = hour * 60;
            const date = new Date(dayStartDate);
            date.setMinutes(date.getMinutes() + minute);
            const time = date.toLocaleTimeString("es-ES", {
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={hour}
                className="absolute"
                style={{
                  left: `${(minute / 960) * 100}%`,
                  transform: "translateX(-50%)",
                }}
              >
                {time}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Timeline;
