import React from "react";
import { Box, Tooltip } from "@mui/material";
import {
  calculatePosition,
  convertISOtoMinutes,
  formatMinutesToTime,
  formatDuration,
  getActivityColor,
} from "./TimelineUtils";
import type { TimelineData } from "../../../types";

interface TimelineBarProps {
  activity: TimelineData["activities"][0];
  index: number;
}

const TimelineBar: React.FC<TimelineBarProps> = ({ activity, index }) => {
  // Convertir tiempos ISO a minutos del día
  const startMinutes = convertISOtoMinutes(activity.startTime);
  const endMinutes = convertISOtoMinutes(activity.endTime);

  // Calcular posiciones para CSS
  const startPercent = calculatePosition(startMinutes);
  const endPercent = calculatePosition(endMinutes);
  const width = endPercent - startPercent;

  // Color basado en estado y si está dentro de la estimación
  const barColor = getActivityColor(activity.state, activity.isWithinEstimation);

  // Formatos legibles para el tooltip y atributos aria
  const startFormatted = formatMinutesToTime(startMinutes);
  const endFormatted = formatMinutesToTime(endMinutes);
  const durationFormatted = formatDuration(activity.durationMinutes);

  // Calcular estado de estimación para el atributo data
  const getEstimationState = () => {
    if (activity.state === "interrupted") return "interrupted"; // Si se interrumpe, no aplica estimación

    // Lógica basada en isWithinEstimation y tipo de actividad
    switch (activity.type) {
      case "clear-objective":
        return activity.isWithinEstimation ? "within" : "exceeded";
      case "flexible-duration":
        return activity.isWithinEstimation ? "within-range" : "outside-range"; // Asumiendo que isWithinEstimation funciona para flexible
      case "timeboxing":
        // Para timeboxing, 'isWithinEstimation' podría significar que se cumplió el mínimo.
        // O podríamos necesitar una lógica más específica si hay diferentes sub-estados.
        // Por ahora, asumimos que 'isWithinEstimation' True = 'timebox-met'
        return activity.isWithinEstimation ? "timebox-met" : "timebox-not-met";
      default:
        return "unknown";
    }
  };
  const estimationState = getEstimationState();

  // Tooltip con información detallada
  const tooltipContent = () => {
    let estimationInfo = "";
    if (activity.estimatedDuration !== undefined) {
      const estimatedFormatted = formatDuration(activity.estimatedDuration);
      const diffMinutes = activity.durationMinutes - activity.estimatedDuration;
      const diffFormatted = formatDuration(Math.abs(diffMinutes));

      if (diffMinutes > 0) {
        estimationInfo = `\nExcedió estimación por ${diffFormatted}`;
      } else if (diffMinutes < 0) {
        estimationInfo = `\nCompletado ${diffFormatted} antes de lo estimado`;
      } else {
        estimationInfo = "\nCompletado exactamente en tiempo estimado";
      }
    }

    return `${activity.title}
${startFormatted} - ${endFormatted}
Duración: ${durationFormatted}${estimationInfo}
Estado: ${activity.state === "completed" ? "Completado" : "Interrumpido"}`;
  };

  // Información para aria-label
  const ariaLabel = `Actividad ${activity.title}: ${startFormatted} a ${endFormatted}, duración ${durationFormatted}, ${activity.state === "completed" ? "completada" : "interrumpida"}`;

  return (
    <Tooltip title={tooltipContent()} arrow placement="top">
      <Box
        sx={{
          position: "absolute",
          left: `${startPercent}%`,
          top: 0, // Siempre en la parte superior del contenedor
          width: `${width}%`,
          height: "100%", // Ocupa toda la altura del contenedor padre
          backgroundColor: barColor,
          borderRadius: "4px",
          zIndex: 1,
          cursor: "pointer",
          "&:hover": {
            filter: "brightness(1.1)",
          },
        }}
        data-testid={`timeline-bar-${activity.id}`}
        data-state={activity.state}
        data-estimation-state={estimationState}
        role="listitem"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {/* Barra de estimación si existe */}
        {activity.estimatedDuration && (
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              width: `${(activity.estimatedDuration / 1440) * 100}%`,
              height: "100%",
              borderRight: "2px dashed rgba(255, 255, 255, 0.7)",
              zIndex: 2,
            }}
            data-testid={`timeline-bar-estimation-${activity.id}`}
            role="presentation"
            aria-label={`Estimación: ${formatDuration(activity.estimatedDuration)}`}
            aria-hidden="true"
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default TimelineBar;
