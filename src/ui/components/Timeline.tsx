import React from "react";

import { ResponsiveBullet } from "@nivo/bullet";
import type { BulletRectsItemProps } from "@nivo/bullet";

import { Tooltip, TooltipContent, TooltipTrigger } from "./shadcn/tooltip";

import type { Activity, InvestedTimeRecord } from "@/core/types";

interface TimelineProps {
  dayStartDate: Date;
  currentMinute: number;
  history: InvestedTimeRecord[];
  activities: Activity[];
}

const getActivityTypeColor = (type: Activity["type"] | "idle" | "remaining"): string => {
  switch (type) {
    case "challenge":
      return "#3b82f6"; // blue-500
    case "neutral":
      return "#10b981"; // emerald-500
    case "discount":
      return "#8b5cf6"; // violet-500
    case "idle":
      return "#94a3b8"; // slate-400
    case "remaining":
      return "#e5e7eb"; // gray-200
    default:
      return "#94a3b8"; // slate-400
  }
};

const formatTimeRange = (baseDate: Date, startMinute: number, duration: number): string => {
  const startDate = new Date(baseDate.getTime() + startMinute * 60000);
  const endDate = new Date(startDate.getTime() + duration * 60000);
  return `${startDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })} - ${endDate.toLocaleTimeString("es-ES", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
};

const Timeline: React.FC<TimelineProps> = ({
  dayStartDate,
  currentMinute,
  history,
  activities,
}) => {
  // Transformamos el historial en datos para el bullet chart
  const bulletData = React.useMemo(() => {
    // Ordenamos el historial por timestamp
    const sortedHistory = [...history].sort((a, b) => a.timestamp - b.timestamp);

    // Creamos los rangos a partir de los registros reales
    const ranges: number[] = [];
    let lastEndMinute = 0;

    sortedHistory.forEach((record) => {
      const startMinute = Math.floor(
        (new Date(record.timestamp).getTime() - dayStartDate.getTime()) / 60000
      );

      ranges.push(startMinute);
      ranges.push(startMinute + record.minutesInvested);
      lastEndMinute = startMinute + record.minutesInvested;
    });

    // Agregamos el rango del tiempo restante del día
    ranges.push(lastEndMinute);
    ranges.push(960);

    return [
      {
        id: "",
        ranges,
        measures: [],
        markers: [],
      },
    ];
  }, [history, dayStartDate]);

  const CustomRange = ({ x, y, width, height, data }: BulletRectsItemProps) => {
    const startMinute = data.v0;
    const endMinute = data.v1;

    // Si es el último rango (tiempo restante), lo manejamos de forma diferente
    const isRemainingTime =
      endMinute === 960 && startMinute === bulletData[0].ranges[bulletData[0].ranges.length - 2];

    let type: Activity["type"] | "idle" | "remaining" = "idle";
    let title = "Inactivo";

    if (isRemainingTime) {
      type = "remaining";
      title = "Tiempo Restante";
    } else {
      const record = history.find((h) => {
        const recordStartMinute = Math.floor(
          (new Date(h.timestamp).getTime() - dayStartDate.getTime()) / 60000
        );
        return (
          startMinute === recordStartMinute && endMinute === recordStartMinute + h.minutesInvested
        );
      });

      if (!record) {
        return null;
      }

      type = record.status === "activity" ? record.type : "idle";
      const activity =
        record.status === "activity"
          ? activities.find((a) => a.id === record.activityId)
          : undefined;
      title = activity?.title || "Inactivo";
    }

    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <rect
            x={x}
            y={y}
            width={width}
            height={height}
            fill={getActivityTypeColor(type)}
            opacity={startMinute > currentMinute ? 0.3 : 1}
            className="transition-opacity duration-200 hover:opacity-80"
          />
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-medium">{title}</p>
            <p className="text-sm text-muted-foreground">
              {formatTimeRange(dayStartDate, startMinute, endMinute - startMinute)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Generamos las etiquetas para el eje X de forma que se muestren 16 horas,
  // comenzando desde el instante exacto de inicio del día (dayStartDate)
  const numTicks = 16;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const tickDate = new Date(dayStartDate.getTime() + i * 3600000); // 3600000 ms = 1 hora
    return tickDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  });

  return (
    <div className="w-full relative">
      {/* Contenedor del gráfico sin espacio extra para el eje X */}
      <div className="w-full h-24">
        <ResponsiveBullet
          data={bulletData}
          maxValue={960}
          // Reducimos el margen inferior para que no se reserve espacio para el eje
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          spacing={0}
          titleAlign="start"
          rangeComponent={CustomRange}
          rangeBorderWidth={0}
          animate={false}
          tooltip={() => null}
          theme={{
            axis: {
              domain: { line: { stroke: "transparent" } },
              ticks: { line: { stroke: "transparent" }, text: { fill: "transparent" } },
            },
          }}
        />
      </div>
      {/* Eje X personalizado posicionado absolutamente */}
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-4 text-xs">
        {ticks.map((tick, index) => (
          <span key={index}>{tick}</span>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
