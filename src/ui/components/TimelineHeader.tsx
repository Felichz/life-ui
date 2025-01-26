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
  const progress = systemEngine.activity.calculateProgress(activity);

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
            <span
              className="text-xs px-2 py-1 rounded-full"
              style={{
                backgroundColor: getActivityTypeColor(activity.type) + "20",
                color: getActivityTypeColor(activity.type),
              }}
            >
              {getActivityTypeLabel(activity.type)}
            </span>
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

    // Creamos un único objeto que contendrá todos los segmentos
    const segments = dayHistory.map((segment: InvestedTimeRecord) => {
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
        minutesFromStart,
        duration: segment.minutesInvested,
        type,
        title: activity?.title || "Inactivo",
        tempoModification: segment.tempoModification,
        timeRange: formatTimeRange(minutesFromStart, segment.minutesInvested),
      };
    });

    type TimelineSegment = {
      timeline: string;
      totalSegments: number;
      [key: `segment_${number}`]: number;
      [key: `segment_${number}_start`]: number;
      [key: `segment_${number}_type`]: Activity["type"] | "idle";
      [key: `segment_${number}_title`]: string;
      [key: `segment_${number}_tempo`]: number;
      [key: `segment_${number}_range`]: string;
    };

    // Creamos un único objeto que representa toda la línea de tiempo
    return [
      segments.reduce<TimelineSegment>(
        (acc, segment, index) => ({
          ...acc,
          [`segment_${index}`]: segment.duration,
          [`segment_${index}_start`]: segment.minutesFromStart,
          [`segment_${index}_type`]: segment.type,
          [`segment_${index}_title`]: segment.title,
          [`segment_${index}_tempo`]: segment.tempoModification,
          [`segment_${index}_range`]: segment.timeRange,
        }),
        { timeline: "timeline", totalSegments: segments.length }
      ),
    ];
  }, [uiState.currentDay, dayHistory, uiState.activities]);

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
                  <p className="text-sm text-muted-foreground">Finaliza</p>
                  <p className="text-lg font-semibold">{endTime}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {uiState.selectedActivity && <SelectedActivityCard activity={uiState.selectedActivity} />}
        </div>

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
            keys={Array.from(
              { length: timelineData[0]?.totalSegments || 0 },
              (_, i) => `segment_${i}`
            )}
            indexBy="timeline"
            layout="horizontal"
            valueScale={{ type: "linear", min: 0, max: 960 }}
            indexScale={{ type: "band", round: true }}
            colors={(bar) => {
              const segmentIndex = parseInt(bar.id.toString().split("_")[1]);
              const type =
                timelineData[0]?.[`segment_${segmentIndex}_type` as keyof (typeof timelineData)[0]];
              return getActivityTypeColor(type as Activity["type"] | "idle");
            }}
            borderRadius={2}
            padding={0}
            margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
            axisTop={null}
            axisRight={null}
            axisBottom={null}
            axisLeft={null}
            enableGridY={false}
            enableLabel={false}
            role="application"
            ariaLabel="Timeline del día"
            barAriaLabel={(e) =>
              `${
                timelineData[0]?.[`segment_${e.id.toString().split("_")[1]}_title` as keyof object]
              } ${
                timelineData[0]?.[`segment_${e.id.toString().split("_")[1]}_range` as keyof object]
              }`
            }
            tooltip={({ id, ...rest }) => {
              const segmentIndex = parseInt(id.toString().split("_")[1]);
              return (
                <div className="bg-popover text-popover-foreground p-2 rounded-lg shadow-lg text-sm">
                  <p className="font-medium">
                    {timelineData[0]?.[`segment_${segmentIndex}_title` as keyof object]}
                  </p>
                  <p className="text-muted-foreground">
                    {timelineData[0]?.[`segment_${segmentIndex}_range` as keyof object]}
                  </p>
                  <p>
                    Tempo:{" "}
                    {(timelineData[0]?.[
                      `segment_${segmentIndex}_tempo` as keyof object
                    ] as number) > 0
                      ? "+"
                      : ""}
                    {timelineData[0]?.[`segment_${segmentIndex}_tempo` as keyof object]}
                  </p>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TimelineHeader;
