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
  // Configuración de alturas y espaciado
  const headerHeight = 30; // Altura para los marcadores de hora
  const barHeight = 30; // Altura para la sección de actividades
  const markersHeight = 20; // Altura para cada sección de marcadores
  const dividerHeight = 5; // Espacio para el divisor

  // Calcular altura total, manteniendo un tamaño compacto
  const totalHeight =
    headerHeight +
    dividerHeight +
    barHeight +
    (events.length > 0 ? markersHeight : 0) +
    (interruptions.length > 0 ? markersHeight : 0);

  // Verificar si hay elementos para mostrar
  const hasElements = activities.length > 0 || events.length > 0 || interruptions.length > 0;

  // Generar marcadores de hora (cada 2 horas)
  const hourMarkers = [];

  for (let hour = 0; hour <= 24; hour += 2) {
    const minutes = hour * 60;
    const position = (minutes / 1440) * 100;
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
          fontSize: "0.7rem",
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
      sx={{
        width: "100%",
        position: "relative",
        height: hasElements ? totalHeight : headerHeight + dividerHeight,
        maxHeight: "150px", // Limitar altura máxima
      }}
      data-testid="timeline"
      role="region"
      aria-label="Línea de tiempo de actividades"
    >
      {/* Escala de tiempo */}
      <Box sx={{ height: headerHeight, width: "100%", position: "relative" }} role="presentation">
        {hourMarkers}
      </Box>

      <Divider sx={{ my: 0.5 }} />

      {/* Contenido principal del timeline */}
      {!hasElements ? (
        <Typography color="text.secondary" align="center" sx={{ py: 0.5 }} role="status">
          No hay datos de timeline disponibles
        </Typography>
      ) : (
        <>
          {/* Barras de actividades - todas alineadas en la misma línea vertical */}
          <Box sx={{ position: "relative", height: barHeight, width: "100%" }}>
            {activities.map((activity, index) => (
              <TimelineBar
                key={activity.id}
                activity={activity}
                index={0} // Índice 0 para que todas estén en la misma posición vertical
              />
            ))}
          </Box>

          {/* Marcadores de eventos - todos alineados en la misma línea vertical */}
          {events.length > 0 && (
            <Box sx={{ position: "relative", height: markersHeight, width: "100%" }}>
              {events.map((event, index) => (
                <TimelineMarker
                  key={event.id}
                  type="event"
                  position={event.position}
                  data={event}
                  verticalOffset={0} // Sin desplazamiento vertical
                />
              ))}
            </Box>
          )}

          {/* Marcadores de interrupciones - todos alineados en la misma línea vertical */}
          {interruptions.length > 0 && (
            <Box sx={{ position: "relative", height: markersHeight, width: "100%" }}>
              {interruptions.map((interruption, index) => (
                <TimelineMarker
                  key={interruption.id}
                  type="interruption"
                  position={interruption.position}
                  data={interruption}
                  verticalOffset={0} // Sin desplazamiento vertical
                />
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

export default Timeline;
