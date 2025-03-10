import React, { useState, useEffect, useMemo } from "react";

import PassiveTempoConsumptionRatioModal from "./PassiveTempoConsumptionRatioModal";
import { Badge } from "./shadcn/badge";
import { Button } from "./shadcn/button";
import { Card, CardContent } from "./shadcn/card";
import { ThemeToggle } from "./theme-toggle";
import Timeline from "./Timeline";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import type { Activity } from "@/core/types";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

// Componente para el progress bar circular
const MinuteProgressCircle: React.FC = () => {
  const [progress, setProgress] = useState(0);
  const systemEngine = useSystemEngineContext();
  const { uiState } = useUiStateContext();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const updateProgress = () => {
      // Obtener el progreso actual del minuto (0-100%)
      const currentProgress = systemEngine.time.getMinuteProgress();
      setProgress(currentProgress);

      // Calcular cuánto tiempo falta para el próximo segundo
      const timeUntilNextUpdate = Math.max(16, systemEngine.time.getTimeUntilNextSecond());

      // Programar la próxima actualización
      timeoutId = setTimeout(() => {
        updateProgress();
      }, timeUntilNextUpdate);
    };

    // Iniciar la cadena de actualizaciones
    updateProgress();

    return () => {
      // Limpiar el timeout al desmontar
      clearTimeout(timeoutId);
    };
  }, [uiState.systemParams.timeMultiplier]);

  // Calcular propiedades del círculo
  const radius = 15;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width="36" height="36" viewBox="0 0 40 40">
        {/* Círculo de fondo */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeOpacity="0.2"
          strokeWidth="5"
        />
        {/* Círculo de progreso */}
        <circle
          cx="20"
          cy="20"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 20 20)"
        />
      </svg>
    </div>
  );
};

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
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

const getActivityTypeLabel = (type: Activity["type"]): string => {
  switch (type) {
    case "challenge":
      return "Desafío";
    case "neutral":
      return "Neutral";
    case "discount":
      return "Hobby";
  }
};

const SelectedActivityCard: React.FC<{ activity: Activity }> = ({ activity }) => {
  const systemEngine = useSystemEngineContext();
  const { uiState } = useUiStateContext();
  const progress = systemEngine.activity.calculateProgress(activity);

  const getEstimatedEndTime = React.useMemo(() => {
    if (activity.status !== "inProgress") return null;

    let minutesToAdd = 0;

    if (activity.type === "challenge") {
      minutesToAdd = activity.totalTempoReward - activity.minutesActive;
      if (minutesToAdd <= 0) return null;
    } else if ("allowedTime" in activity) {
      minutesToAdd = activity.allowedTime - activity.minutesActive;
    }

    if (minutesToAdd <= 0) return null;

    const endTime = new Date(uiState.lastUpdateTimestamp + minutesToAdd * 60000);
    return endTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
  }, [activity, uiState.lastUpdateTimestamp]);

  const getActivityDetails = () => {
    switch (activity.type) {
      case "challenge":
        return {
          timeLabel: "Tiempo Estimado",
          timeValue: `${activity.minutesActive}/${activity.totalTempoReward}m`,
          extraLabel: "Recompensa",
          extraValue: `+${activity.totalTempoReward} tempos`,
        };
      case "neutral":
      case "discount":
        return {
          timeLabel: "Tiempo Permitido",
          timeValue: `${activity.minutesActive}/${activity.allowedTime}m`,
          extraLabel: activity.type === "discount" ? "Consumo" : undefined,
          extraValue:
            activity.type === "discount"
              ? `-${activity.tempoConsumptionRate} tempo/min`
              : undefined,
        };
    }
  };

  const details = getActivityDetails();

  return (
    <Card className="w-[300px]">
      <CardContent className="p-4">
        <div className="space-y-4">
          <div>
            <h3 className="font-semibold text-lg">{activity.title}</h3>
            <div className="flex gap-2 items-center">
              <span
                className="text-xs px-2 py-1 rounded-full"
                style={{
                  backgroundColor: getActivityTypeColor(activity.type) + "20",
                  color: getActivityTypeColor(activity.type),
                }}
              >
                {getActivityTypeLabel(activity.type)}
              </span>
              {getEstimatedEndTime && (
                <Badge variant="outline">Finaliza: {getEstimatedEndTime}</Badge>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{details.timeLabel}</span>
              <span className="font-medium">{details.timeValue}</span>
            </div>
            {details.extraLabel && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{details.extraLabel}</span>
                <span className="font-medium">{details.extraValue}</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full transition-all duration-500"
                style={{
                  width: `${progress}%`,
                  backgroundColor: getActivityTypeColor(activity.type),
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Progreso</span>
              <span>{progress.toFixed(0)}%</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const TimelineHeader: React.FC = () => {
  const { uiState } = useUiStateContext();
  const systemEngine = useSystemEngineContext();
  const [showEnergyModal, setShowEnergyModal] = useState(false);

  const { remainingTime, endTime, currentMinute } = systemEngine.day.calculateProgress(
    uiState.currentDay
  );

  const formatCurrentDateTime = (date: Date): string => {
    return date.toLocaleString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Obtener la tasa de consumo del día anterior (si existe)
  const getPreviousDayRate = () => {
    // Obtenemos la tasa de consumo actual como valor por defecto
    return uiState.systemParams.passiveTempoConsumptionRate;
  };

  const handleStartDay = async (rate?: number) => {
    if (rate !== undefined) {
      // Primero actualizamos el parámetro de tasa de consumo
      await systemEngine.updateSystemParams({
        ...uiState.systemParams,
        passiveTempoConsumptionRate: rate,
      });
    }
    // Luego iniciamos el día
    await systemEngine.day.startDay();
  };

  const handleConfirmEnergyRate = async (rate: number) => {
    await handleStartDay(rate);
  };

  if (!uiState.currentDay) {
    return (
      <div className="flex justify-between items-center p-4">
        <Card className="w-fit">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tempo Total</p>
                <p className="text-lg font-semibold">{uiState.totalTempoBalance}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button onClick={() => setShowEnergyModal(true)}>Comenzar Día</Button>

          {/* Modal para establecer la tasa de consumo de energía */}
          <PassiveTempoConsumptionRatioModal
            isOpen={showEnergyModal}
            onClose={() => setShowEnergyModal(false)}
            onConfirm={handleConfirmEnergyRate}
            previousDayRate={getPreviousDayRate()}
          />
        </div>
      </div>
    );
  }

  const currentDateTime = new Date(uiState.lastUpdateTimestamp);

  return (
    <div className="flex flex-col gap-4">
      {/* Datos del Día */}
      <div className="flex justify-between items-center">
        <div className="flex gap-4 items-center">
          <Card className="w-fit">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tiempo Restante</p>
                  <p className="text-lg font-semibold">{formatTime(remainingTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hora Actual</p>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-semibold">
                      {formatCurrentDateTime(currentDateTime)}
                    </p>
                    <MinuteProgressCircle />
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Finaliza</p>
                  <p className="text-lg font-semibold">{endTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {uiState.selectedActivity && <SelectedActivityCard activity={uiState.selectedActivity} />}
        </div>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Card className="w-fit">
            <CardContent className="p-4">
              <div className="flex gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Tempo del Día</p>
                  <p className="text-lg font-semibold">{uiState.currentDay.dayTempoBalance}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tempo Total</p>
                  <p className="text-lg font-semibold">{uiState.totalTempoBalance}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Timeline */}
      <Timeline
        dayStartDate={new Date(uiState.currentDay.date)}
        currentMinute={currentMinute}
        investedTimeHistory={uiState.investedTimeHistory}
        activities={uiState.activities}
        tempoModificationHistory={uiState.tempoModificationHistory}
      />
    </div>
  );
};

export default TimelineHeader;
