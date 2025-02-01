import React from "react";

import { Card, CardContent } from "./shadcn/card";
import { ScrollArea } from "./shadcn/scroll-area";

import type { TempoModificationRecord } from "@/core/types";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

const NotificationsFeed: React.FC = () => {
  const { uiState } = useUiStateContext();

  const sortedNotifications = React.useMemo(() => {
    return [...uiState.tempoModificationHistory].sort((a, b) => b.timestamp - a.timestamp);
  }, [uiState.tempoModificationHistory]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
  };

  const getModificationIcon = (amount: number) => {
    if (amount > 0) return <span className="text-green-500">+</span>;
    if (amount < 0) return <span className="text-red-500">-</span>;
    return <span className="text-gray-500">=</span>;
  };

  const getReasonText = (record: TempoModificationRecord) => {
    switch (record.reason) {
      case "challengeCompletionReward":
        return "Recompensa por completar desafío";
      case "challengeCriteriaFailed":
        return "Penalización por fallar criterios";
      case "earlyNeutralActivityCompletionCompensation":
        return "Compensación por terminar actividad neutral antes";
      case "earlyDiscountActivityCompletionCompensation":
        return "Compensación por terminar hobby antes";
      default:
        return "Modificación de tempo";
    }
  };

  return (
    <Card className="h-full">
      <CardContent className="p-4">
        <h3 className="text-lg font-semibold mb-4">Notificaciones</h3>
        <ScrollArea className="h-[calc(100vh-10rem)]">
          <div className="space-y-4">
            {sortedNotifications.map((record, index) => (
              <Card
                key={index}
                className={`p-3 ${
                  record.tempoModification > 0
                    ? "border-3 border-green-500"
                    : record.tempoModification < 0
                      ? "border-3 border-red-500"
                      : ""
                }`}
              >
                <div className="flex items-start gap-2">
                  <div className="text-xl font-bold">
                    {getModificationIcon(record.tempoModification)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{getReasonText(record)}</p>
                    <p
                      className={`text-sm ${record.tempoModification > 0 ? "text-green-500" : record.tempoModification < 0 ? "text-red-500" : "text-muted-foreground"}`}
                    >
                      {formatTime(record.timestamp)} • {record.tempoModification > 0 ? "+" : ""}
                      {record.tempoModification} tempos
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Actividad: {record.activityId}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
            {sortedNotifications.length === 0 && (
              <p className="text-center text-muted-foreground">No hay notificaciones</p>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default NotificationsFeed;
