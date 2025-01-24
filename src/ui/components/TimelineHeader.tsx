import React from "react";

import { ResponsiveBar } from "@nivo/bar";

import { Button } from "./shadcn/button";
import { Card, CardContent } from "./shadcn/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./shadcn/dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./shadcn/tooltip";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import type { Activity, InvestedTimeRecord } from "@/core/types";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

const formatTime = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
};

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

const getActivityColor = (type: Activity["type"] | "idle"): string => {
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

const TimelineHeader: React.FC = () => {
  const { uiState } = useUiStateContext();
  const systemEngine = useSystemEngineContext();

  const { remainingTime, endTime, currentMinute } = systemEngine.day.calculateProgress(
    uiState.currentDay
  );

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

        <Dialog>
          <DialogTrigger asChild>
            <Button>Comenzar Día</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Comenzar Día</DialogTitle>
              <DialogDescription>
                ¿Deseas comenzar un nuevo día? Se iniciará con la hora actual y durará 960 minutos
                (16 horas).
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => systemEngine.day.startDay()}>Comenzar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Ordenamos y filtramos el historial para asegurar que está dentro del día actual
  const dayHistory = React.useMemo(() => {
    if (!uiState.currentDay) return [];

    const dayStartDate = new Date(uiState.currentDay.date);
    const dayEndDate = new Date(dayStartDate);
    dayEndDate.setMinutes(dayEndDate.getMinutes() + 960);

    return uiState.investedTimeHistory
      .filter((record) => {
        const recordDate = new Date(record.timestamp);
        return recordDate >= dayStartDate && recordDate <= dayEndDate;
      })
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [uiState.currentDay, uiState.investedTimeHistory]);

  // Transformamos los datos para el gráfico de Nivo
  const timelineData = React.useMemo(() => {
    if (!uiState.currentDay || !dayHistory.length) return [];

    const dayStartDate = new Date(uiState.currentDay.date);

    return dayHistory.map((segment: InvestedTimeRecord) => {
      const segmentDate = new Date(segment.timestamp);
      const minutesFromStart = Math.floor(
        (segmentDate.getTime() - dayStartDate.getTime()) / (1000 * 60)
      );

      const activity =
        segment.status === "activity"
          ? uiState.activities.find((a) => a.id === segment.activityId)
          : undefined;

      const type = segment.status === "activity" ? segment.type : ("idle" as const);

      return {
        id: segment.timestamp.toString(),
        minutesFromStart,
        duration: segment.minutesInvested,
        type,
        title: activity?.title || "Inactivo",
        tempoModification: segment.tempoModification,
        timeRange: formatTimeRange(minutesFromStart, segment.minutesInvested),
      };
    });
  }, [uiState.currentDay, dayHistory, uiState.activities]);

  return (
    <div className="flex flex-col gap-4">
      {/* Datos del Día */}
      <div className="flex justify-between items-center">
        <Card className="w-fit">
          <CardContent className="p-4">
            <div className="flex gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Tiempo Restante</p>
                <p className="text-lg font-semibold">{formatTime(remainingTime)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Finaliza</p>
                <p className="text-lg font-semibold">{endTime}</p>
              </div>
              {uiState.selectedActivity && (
                <div>
                  <p className="text-sm text-muted-foreground">Actividad Actual</p>
                  <p className="text-lg font-semibold">{uiState.selectedActivity.title}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

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

      {/* Timeline con Nivo Bar */}
      <div className="w-full relative">
        <div className="h-24 bg-secondary rounded-lg">
          <ResponsiveBar
            data={timelineData}
            keys={["duration"]}
            indexBy="minutesFromStart"
            layout="horizontal"
            valueScale={{ type: "linear", min: 0, max: 960 }}
            indexScale={{ type: "band", round: true }}
            colors={({ data }) => getActivityColor(data.type)}
            borderRadius={2}
            padding={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            axisTop={null}
            axisRight={null}
            axisBottom={null}
            axisLeft={null}
            enableGridY={false}
            enableLabel={false}
            tooltip={({ data }) => (
              <div className="bg-popover text-popover-foreground rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium">{data.title}</p>
                <p className="text-muted-foreground">{data.timeRange}</p>
                <p>Duración: {formatTime(data.duration)}</p>
                {data.tempoModification !== 0 && (
                  <p className="font-medium">
                    Tempo: {data.tempoModification > 0 ? "+" : ""}
                    {data.tempoModification}
                  </p>
                )}
              </div>
            )}
          />
          {/* Marcador de tiempo actual */}
          <div
            className="absolute h-full w-0.5 bg-red-500 z-10"
            style={{
              left: `${(Math.min(currentMinute, 960) / 960) * 100}%`,
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TimelineHeader;
