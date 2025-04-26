import React, { useEffect, useState, useRef } from "react";
import { Typography, Box } from "@mui/material";
import TimerIcon from "@mui/icons-material/Timer";

interface ActivityTimerProps {
  startTime: string;
  "data-testid"?: string;
}

/**
 * Componente que muestra un cronómetro en tiempo real basado en startTime
 */
const ActivityTimer: React.FC<ActivityTimerProps> = ({
  startTime,
  "data-testid": testId = "activity-timer",
}) => {
  const [elapsed, setElapsed] = useState<number>(0);
  const startTimeMs = useRef<number>(new Date(startTime).getTime());
  const requestRef = useRef<number | null>(null);

  // Actualizar startTimeMs cuando cambia startTime
  useEffect(() => {
    startTimeMs.current = new Date(startTime).getTime();
  }, [startTime]);

  // Función para formatear milisegundos a formato MM:SS
  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Función de animación para actualizar el tiempo transcurrido
  const updateTimer = (): void => {
    setElapsed(Date.now() - startTimeMs.current);
    requestRef.current = requestAnimationFrame(updateTimer);
  };

  // Efecto para iniciar y limpiar el timer
  useEffect(() => {
    // Iniciar animación
    requestRef.current = requestAnimationFrame(updateTimer);

    // Limpiar animación al desmontar o cambiar startTime
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    };
  }, [startTime]); // Solo depende de startTime

  return (
    <Box display="flex" alignItems="center" gap={0.5} data-testid={testId}>
      <TimerIcon fontSize="small" color="primary" />
      <Typography variant="body2" fontWeight="medium">
        {formatTime(elapsed)}
      </Typography>
    </Box>
  );
};

export default ActivityTimer;
