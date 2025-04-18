import React from "react";
import { Box, Tooltip } from "@mui/material";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import WarningIcon from "@mui/icons-material/Warning";
import { calculatePosition, formatMinutesToTime } from "./TimelineUtils";
import type { TimelineData } from "../../../types";

interface TimelineMarkerProps {
  type: "event" | "interruption";
  position: number; // Minutos desde 00:00 (0-1439)
  data: TimelineData["events"][0] | TimelineData["interruptions"][0];
  verticalOffset?: number; // Desplazamiento vertical para evitar solapamiento
}

const TimelineMarker: React.FC<TimelineMarkerProps> = ({
  type,
  position,
  data,
  verticalOffset = 0,
}) => {
  // Calcular posición porcentual
  const positionPercent = calculatePosition(position);

  // Formato legible del tiempo
  const timeStr = formatMinutesToTime(position);

  // Generar contenido del tooltip según el tipo
  const getTooltipContent = () => {
    if (type === "event") {
      const event = data as TimelineData["events"][0];
      return `${event.name} (${timeStr})`;
    } else {
      const interruption = data as TimelineData["interruptions"][0];
      return `Interrupción${interruption.cause ? `: ${interruption.cause}` : ""} (${timeStr})`;
    }
  };

  // Texto para aria-label
  const ariaLabel =
    type === "event"
      ? `Evento ${(data as TimelineData["events"][0]).name} a las ${timeStr}`
      : `Interrupción${(data as TimelineData["interruptions"][0]).cause ? ` por ${(data as TimelineData["interruptions"][0]).cause}` : ""} a las ${timeStr}`;

  return (
    <Tooltip title={getTooltipContent()} arrow placement="top">
      <Box
        sx={{
          position: "absolute",
          left: `${positionPercent}%`,
          top: verticalOffset ? `${verticalOffset}px` : "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 2,
          cursor: "pointer",
        }}
        data-testid={`timeline-${type}-${data.id}`}
        role="listitem"
        aria-label={ariaLabel}
        tabIndex={0}
      >
        {type === "event" ? (
          <FiberManualRecordIcon
            sx={{
              color: "#2196f3", // Azul para eventos
              fontSize: "1rem",
            }}
            aria-hidden="true"
          />
        ) : (
          <WarningIcon
            sx={{
              color: "#f44336", // Rojo para interrupciones
              fontSize: "1.2rem",
            }}
            aria-hidden="true"
          />
        )}
      </Box>
    </Tooltip>
  );
};

export default TimelineMarker;
