import React, { useState, useEffect, useRef } from "react";

import { ResponsiveBullet } from "@nivo/bullet";
import type { BulletRectsItemProps, BulletMarkersItemProps } from "@nivo/bullet";

import { Tooltip, TooltipContent, TooltipTrigger } from "./shadcn/tooltip";
import { useTheme } from "../providers/theme-provider";

import type {
  Activity,
  InvestedTimeHistory,
  TempoModificationHistory,
  TempoModificationRecord,
} from "@/core/types";

interface TimelineProps {
  dayStartDate: Date;
  currentMinute: number;
  investedTimeHistory: InvestedTimeHistory;
  activities: Activity[];
  tempoModificationHistory: TempoModificationHistory;
}

interface MarkerCluster {
  centerMinute: number;
  modifications: {
    record: TempoModificationRecord;
    minute: number;
  }[];
  netModification: number;
  index?: number;
}

const getActivityTypeColor = (
  type: Activity["type"] | "idle" | "remaining",
  isDark: boolean
): string => {
  switch (type) {
    case "challenge":
      return "#3b82f6"; // blue-500
    case "neutral":
      return "#10b981"; // emerald-500
    case "discount":
      return "#8b5cf6"; // violet-500
    case "idle":
      return isDark ? "#374151" : "#94a3b8"; // dark: gray-700, light: slate-400
    case "remaining":
      return isDark ? "#1f2937" : "#e5e7eb"; // dark: gray-800, light: gray-200
    default:
      return isDark ? "#374151" : "#94a3b8"; // dark: gray-700, light: slate-400
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

const getTempoModificationReasonMessage = (reason: TempoModificationRecord["reason"]): string => {
  switch (reason) {
    case "challengeCompletionReward":
      return "Recompensa por completar desafío antes";
    case "challengeCriteriaFailed":
      return "Penalización por fallar criterios";
    case "earlyNeutralActivityCompletionCompensation":
      return "Compensación por terminar actividad neutral antes";
    case "earlyDiscountActivityCompletionCompensation":
      return "Compensación por terminar actividad de descuento antes";
    default:
      return "Modificación de tempo";
  }
};

const Timeline: React.FC<TimelineProps> = ({
  dayStartDate,
  currentMinute,
  investedTimeHistory,
  activities,
  tempoModificationHistory,
}) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // Referencia y estado para el ancho del contenedor
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [animatingClusters, setAnimatingClusters] = useState<Record<string, boolean>>({});
  const prevClustersRef = useRef<MarkerCluster[]>([]);

  // Función para agrupar marcadores cercanos basada en píxeles
  const getMarkerClusters = React.useMemo((): MarkerCluster[] => {
    // Umbral en píxeles para agrupar
    const PIXEL_THRESHOLD = 20;
    // Si no tenemos ancho, usamos un valor por defecto
    const effectiveWidth = Math.max(containerWidth - 40, 100); // Restamos los márgenes
    const clusters: MarkerCluster[] = [];

    // Convertimos todos los registros a minutos y ordenamos
    const modifications = tempoModificationHistory
      .map((record) => ({
        record,
        minute: Math.floor((record.timestamp - dayStartDate.getTime()) / 60000),
      }))
      .sort((a, b) => a.minute - b.minute);

    modifications.forEach((mod) => {
      // Calcular la posición en píxeles del marker
      const modPixel = (mod.minute * effectiveWidth) / 960;
      let added = false;

      for (const cluster of clusters) {
        // Calculamos la posición en píxeles del centro del cluster
        const clusterPixel = (cluster.centerMinute * effectiveWidth) / 960;

        if (Math.abs(modPixel - clusterPixel) <= PIXEL_THRESHOLD) {
          // Añadir al cluster existente
          cluster.modifications.push(mod);
          cluster.netModification += mod.record.tempoModification;
          // Recalcular el centro como promedio
          const totalMinutes = cluster.modifications.reduce((sum, m) => sum + m.minute, 0);
          cluster.centerMinute = Math.floor(totalMinutes / cluster.modifications.length);
          added = true;
          break;
        }
      }

      if (!added) {
        // Crear nuevo cluster
        clusters.push({
          centerMinute: mod.minute,
          modifications: [mod],
          netModification: mod.record.tempoModification,
        });
      }
    });

    return clusters;
  }, [tempoModificationHistory, dayStartDate, containerWidth]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Establecer el ancho inicial
    setContainerWidth(containerRef.current.getBoundingClientRect().width);

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Detectar cambios en los clusters
  useEffect(() => {
    const currentClusters = getMarkerClusters;
    const newAnimatingClusters: Record<string, boolean> = {};

    // Comparar clusters actuales con anteriores
    currentClusters.forEach((cluster: MarkerCluster) => {
      const prevCluster = prevClustersRef.current.find(
        (prev) => prev.centerMinute === cluster.centerMinute
      );

      if (!prevCluster || prevCluster.modifications.length !== cluster.modifications.length) {
        // Cluster nuevo o modificado
        newAnimatingClusters[cluster.centerMinute] = true;
      }
    });

    if (Object.keys(newAnimatingClusters).length > 0) {
      setAnimatingClusters(newAnimatingClusters);
      // Limpiar las animaciones después de que terminen
      setTimeout(() => {
        setAnimatingClusters({});
      }, 300); // Duración de la animación
    }

    prevClustersRef.current = currentClusters;
  }, [getMarkerClusters]);

  // Estado para rastrear qué marker está en hover
  const [hoveredMarkerId, setHoveredMarkerId] = useState<number | null>(null);

  // Ordenamos los clusters por cantidad de modificaciones para el renderizado
  const sortedClusters = React.useMemo(() => {
    return getMarkerClusters
      .map((cluster, index) => ({ ...cluster, index }))
      .sort((a, b) => {
        // Si hay un cluster en hover, siempre va último (se renderiza encima)
        if (hoveredMarkerId === a.index) return 1;
        if (hoveredMarkerId === b.index) return -1;
        // Si no, ordenamos por cantidad de modificaciones
        return a.modifications.length - b.modifications.length;
      });
  }, [getMarkerClusters, hoveredMarkerId]);

  // Actualizamos bulletData para usar los clusters ordenados
  const bulletData = React.useMemo(() => {
    // Ordenamos el historial por timestamp
    const sortedHistory = [...investedTimeHistory].sort((a, b) => a.timestamp - b.timestamp);

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

    // Reemplazamos los markers con los centros de los clusters ordenados
    const markers = sortedClusters.map((cluster) => cluster.centerMinute);

    return [
      {
        id: "",
        ranges,
        measures: [],
        markers,
      },
    ];
  }, [investedTimeHistory, dayStartDate, sortedClusters]);

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
      const record = investedTimeHistory.find((h) => {
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
            fill={getActivityTypeColor(type, isDark)}
            opacity={startMinute > currentMinute ? 0.3 : 1}
            className="transition-opacity duration-200 hover:opacity-80"
          />
        </TooltipTrigger>
        <TooltipContent className="bg-popover border-border shadow-lg">
          <div className="space-y-1">
            <p className="font-medium text-popover-foreground">{title}</p>
            <p className="text-sm text-muted-foreground">
              {formatTimeRange(dayStartDate, startMinute, endMinute - startMinute)}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  /* Agrego una constante para la altura interna del gráfico (asumiendo h-24 con márgenes de 20px arriba y abajo -> 96 - 40 = 56) */
  const CHART_INNER_HEIGHT = 56;

  const CustomMarker = ({
    x,
    size,
    onMouseEnter,
    onMouseMove,
    onMouseLeave,
    data,
  }: BulletMarkersItemProps) => {
    const markerMinute = data.value;

    // Encontrar el cluster correspondiente
    const cluster = sortedClusters.find((c) => c.centerMinute === markerMinute);
    if (!cluster) return null;

    const isHovered = hoveredMarkerId === cluster.index;
    const isMultiple = cluster.modifications.length > 1;
    const baseRadius = size / 3;
    const smallRadius = baseRadius * 0.6; // Radio para los marcadores pequeños
    const clusterRadius = baseRadius * (1 + Math.min(cluster.modifications.length * 0.2, 1));
    const hoverRadius = clusterRadius * 1.5;

    // Color basado en la modificación neta (para el círculo grande)
    const markerColor = cluster.netModification >= 0 ? "#10b981" : "#ef4444";

    const handleMouseEnter = (e: React.MouseEvent<SVGGElement>) => {
      setHoveredMarkerId(cluster.index);
      e.stopPropagation();
      if (onMouseEnter) onMouseEnter(data, e as unknown as React.MouseEvent<SVGLineElement>);
    };

    const handleMouseMove = (e: React.MouseEvent<SVGGElement>) => {
      e.stopPropagation();
      if (onMouseMove) onMouseMove(data, e as unknown as React.MouseEvent<SVGLineElement>);
    };

    const handleMouseLeave = (e: React.MouseEvent<SVGGElement>) => {
      setHoveredMarkerId(null);
      e.stopPropagation();
      if (onMouseLeave) onMouseLeave(data, e as unknown as React.MouseEvent<SVGLineElement>);
    };

    // Calcular posiciones y colores para los marcadores pequeños
    const getSmallMarkerPositions = () => {
      const positions: { x: number; y: number; color: string }[] = [];
      const numMarkers = cluster.modifications.length;

      // Distribuir en forma circular
      const radius = clusterRadius * 0.6;
      cluster.modifications.forEach((mod, i) => {
        const angle = (i * 2 * Math.PI) / numMarkers;
        positions.push({
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          color: mod.record.tempoModification >= 0 ? "#10b981" : "#ef4444",
        });
      });
      return positions;
    };

    return (
      <Tooltip delayDuration={100}>
        <TooltipTrigger asChild>
          <g
            transform={`translate(${x}, ${CHART_INNER_HEIGHT / 2})`}
            onMouseEnter={handleMouseEnter}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ cursor: "pointer" }}
          >
            {/* Círculo principal o de fondo */}
            <circle
              cx={0}
              cy={0}
              r={isHovered ? hoverRadius : clusterRadius}
              fill={markerColor}
              opacity={isMultiple && !isHovered ? 0.4 : 1}
              stroke={
                isHovered || isMultiple
                  ? "#ffffff"
                  : markerColor === "#10b981"
                    ? "#059669"
                    : "#dc2626"
              }
              strokeWidth={1.5}
              style={{
                transition: "all 0.2s ease",
                filter: isHovered
                  ? "drop-shadow(0 2px 4px rgb(0 0 0 / 0.3))"
                  : "drop-shadow(0 1px 2px rgb(0 0 0 / 0.2))",
              }}
            />

            {/* Marcadores pequeños (solo si es múltiple y no está en hover) */}
            {isMultiple &&
              !isHovered &&
              getSmallMarkerPositions().map((pos, index) => (
                <circle
                  key={index}
                  cx={pos.x}
                  cy={pos.y}
                  r={smallRadius}
                  fill={pos.color}
                  stroke={pos.color === "#10b981" ? "#059669" : "#dc2626"}
                  strokeWidth={1}
                  style={{
                    transition: "all 0.2s ease",
                  }}
                />
              ))}

            {/* Indicador de cantidad en hover */}
            {isHovered && isMultiple && (
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#ffffff"
                fontSize={clusterRadius * 1.2}
                fontWeight="bold"
              >
                {cluster.modifications.length}
              </text>
            )}
          </g>
        </TooltipTrigger>
        <TooltipContent
          className="bg-popover border-border shadow-lg"
          style={{
            animation: "fadeInScale 0.2s cubic-bezier(0.4, 0, 0.2, 1) forwards",
          }}
        >
          <div className="space-y-2 max-w-xs">
            {cluster.modifications.map((mod, index) => (
              <div
                key={index}
                className={`${index > 0 ? "pt-2 border-t border-border" : ""}`}
                style={{
                  animation: `fadeInSlide 0.2s cubic-bezier(0.4, 0, 0.2, 1) ${index * 0.05}s both`,
                }}
              >
                <p className="font-medium text-popover-foreground">
                  {getTempoModificationReasonMessage(mod.record.reason)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Valor: {mod.record.tempoModification}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(mod.record.timestamp).toLocaleTimeString("es-ES", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            ))}
            {isMultiple && (
              <div
                className="pt-2 border-t border-border"
                style={{
                  animation: "fadeIn 0.3s cubic-bezier(0.4, 0, 0.2, 1) 0.2s both",
                }}
              >
                <p className="font-medium text-sm text-popover-foreground">
                  Balance neto: {cluster.netModification}
                </p>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  // Generamos las etiquetas para el eje X
  const numTicks = 16;
  const ticks = Array.from({ length: numTicks + 1 }, (_, i) => {
    const tickDate = new Date(dayStartDate.getTime() + i * 3600000); // 3600000 ms = 1 hora
    return tickDate.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  });

  return (
    <div ref={containerRef} className="w-full relative">
      <style>
        {`
          @keyframes fadeInScale {
            from {
              opacity: 0;
              transform: scale(0.8);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }

          @keyframes fadeIn {
            from {
              opacity: 0;
            }
            to {
              opacity: 1;
            }
          }

          @keyframes fadeInSlide {
            from {
              opacity: 0;
              transform: translateY(5px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}
      </style>
      <div className="w-full h-24">
        <ResponsiveBullet
          data={bulletData}
          maxValue={960}
          margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
          spacing={0}
          titleAlign="start"
          rangeComponent={CustomRange}
          markerComponent={CustomMarker}
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
      <div className="absolute bottom-0 left-0 w-full flex justify-between px-4 text-xs">
        {ticks.map((tick, index) => (
          <span key={index}>{tick}</span>
        ))}
      </div>
    </div>
  );
};

export default Timeline;
