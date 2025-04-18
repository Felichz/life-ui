import React from "react";
import { Box, Typography, Divider } from "@mui/material";
import TimelineBar from "./TimelineBar";
import TimelineMarker from "./TimelineMarker";
import { formatMinutesToTime } from "./TimelineUtils";
import type { TimelineData } from "../../../types";

interface TimelineProps {
  activities: TimelineData["activities"];
  events: TimelineData["events"];
  interruptions: TimelineData["interruptions"];
}

const Timeline: React.FC<TimelineProps> = ({ activities, events, interruptions }) => {
  // Altura total necesaria para todas las barras (40px por barra + 8px de espacio)
  const totalBarHeight = activities.length * (40 + 8);

  // Verificar si hay elementos para mostrar
  const hasElements = activities.length > 0 || events.length > 0 || interruptions.length > 0;

  // Generar marcadores de hora (cada 3 horas)
  const hourMarkers = [];

  for (let hour = 0; hour <= 24; hour += 3) {
    const minutes = hour * 60;
    const position = (minutes / 1440) * 100;

    // Asegurar que el valor de minutos esté en el rango válido (0-1439)
    const validMinutes = Math.min(Math.max(0, minutes), 1439);

    hourMarkers.push(
      <Box
        key={`hour-${hour}`}
        sx={{
          position: "absolute",
          left: `${position}%`,
          top: 0,
          height: "12px",
          width: "1px",
          backgroundColor: "divider",
        }}
        role="presentation"
      />
    );

    hourMarkers.push(
      <Typography
        key={`hour-label-${hour}`}
        variant="caption"
        sx={{
          position: "absolute",
          left: `${position}%`,
          top: "15px",
          transform: "translateX(-50%)",
          color: "text.secondary",
        }}
        role="presentation"
        aria-hidden="true"
      >
        {hour < 24 ? formatMinutesToTime(validMinutes) : "24:00"}
      </Typography>
    );
  }

  return (
    <Box
      sx={{ width: "100%", position: "relative" }}
      data-testid="timeline"
      role="region"
      aria-label="Línea de tiempo de actividades"
    >
      {/* Escala de tiempo */}
      <Box sx={{ height: "40px", width: "100%", position: "relative", mb: 2 }} role="presentation">
        {hourMarkers}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {/* Contenido principal del timeline */}
      {!hasElements ? (
        <Typography color="text.secondary" align="center" sx={{ py: 4 }} role="status">
          No hay datos de timeline disponibles
        </Typography>
      ) : (
        <Box
          sx={{ position: "relative", height: totalBarHeight + 60 }}
          role="list"
          aria-label="Actividades y eventos registrados"
        >
          {/* Barras de actividades */}
          {activities.map((activity, index) => (
            <TimelineBar key={activity.id} activity={activity} index={index} />
          ))}

          {/* Marcadores de eventos */}
          <Box
            sx={{ position: "relative", height: "30px", mt: totalBarHeight + 10 }}
            role="list"
            aria-label="Eventos registrados"
          >
            {events.map((event, index) => (
              <TimelineMarker
                key={event.id}
                type="event"
                position={event.position}
                data={event}
                verticalOffset={index % 2 === 0 ? 0 : 15}
              />
            ))}
          </Box>

          {/* Marcadores de interrupciones */}
          <Box
            sx={{ position: "relative", height: "30px", mt: 1 }}
            role="list"
            aria-label="Interrupciones registradas"
          >
            {interruptions.map((interruption, index) => (
              <TimelineMarker
                key={interruption.id}
                type="interruption"
                position={interruption.position}
                data={interruption}
                verticalOffset={index % 2 === 0 ? 0 : 15}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default Timeline;
