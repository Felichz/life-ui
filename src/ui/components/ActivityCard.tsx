import React from "react";

import type {
  Activity,
  ChallengeActivity,
  HobbyActivity,
  NeutralActivity,
  ExpirationChallengeConstraint,
} from "@core/types";
import { Badge } from "@shadcn/badge";
import { Button } from "@shadcn/button";
import { Card, CardContent, CardFooter } from "@shadcn/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@shadcn/dialog";
import { useToast } from "@shadcn/hooks/use-toast";
import { Input } from "@shadcn/input";
import { Label } from "@shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shadcn/select";
import { v4 as uuidv4 } from "uuid";

import { TimeSelector } from "./TimeSelector";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

type ActivityStatus = "toDo" | "inProgress" | "completed";
type ActivityType = "challenge" | "neutral" | "discount";

interface ActivityCardProps {
  activity: Activity;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragEnd?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDragLeave?: (e: React.DragEvent<HTMLDivElement>) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void;
}

const StatusBadge: React.FC<{ status: ActivityStatus; activity?: Activity }> = ({
  status,
  activity,
}) => {
  const getStatusColor = (status: ActivityStatus, activity?: Activity) => {
    if (activity?.type === "challenge") {
      if (status === "completed") {
        return "bg-blue-500";
      }
      if (status === "inProgress") {
        const isGeneratingTempo =
          activity.minutesActive < (activity as ChallengeActivity).totalTempoReward;
        return isGeneratingTempo ? "bg-green-500" : "bg-red-500";
      }
    }

    switch (status) {
      case "toDo":
        return "";
      case "inProgress":
        return "bg-blue-500";
      case "completed":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusLabel = (status: ActivityStatus) => {
    switch (status) {
      case "toDo":
        return "Por hacer";
      case "inProgress":
        return "En progreso";
      case "completed":
        return "Completada";
      default:
        return "Desconocido";
    }
  };

  return (
    <Badge
      className={getStatusColor(status, activity)}
      variant={status === "toDo" ? "static" : undefined}
    >
      {getStatusLabel(status)}
    </Badge>
  );
};

const TypeBadge: React.FC<{ type: ActivityType }> = ({ type }) => {
  const getTypeLabel = (type: ActivityType) => {
    switch (type) {
      case "challenge":
        return "Desafío";
      case "neutral":
        return "Neutral";
      case "discount":
        return "Hobby";
      default:
        return "Desconocido";
    }
  };

  return <Badge variant="secondary">{getTypeLabel(type)}</Badge>;
};

const ChallengeDetails: React.FC<{ activity: ChallengeActivity }> = ({ activity }) => {
  const engine = useSystemEngineContext();
  const progress = engine.activity.calculateProgress(activity);

  const activityConstraints = activity.constraintList;

  const formatConstraintPenalty = (penalty: number | string | undefined) => {
    if (!penalty) return "Sin penalización";
    if (typeof penalty === "string") return penalty;
    return `-${penalty} tempos`;
  };

  const formatMinuteToTime = (minute: number) => {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  const isGeneratingTempo = activity.minutesActive < activity.totalTempoReward;
  const exceededMinutes = activity.exceededMinutes ?? 0;

  return (
    <div className="mt-2 text-sm">
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <div className="flex gap-2 items-center">
            <p>
              Progreso: {Math.min(activity.minutesActive, activity.totalTempoReward)}/
              {activity.totalTempoReward} minutos
            </p>
            {activity.status === "inProgress" && (
              <Badge className={isGeneratingTempo ? "bg-green-500" : "bg-red-500"}>
                {isGeneratingTempo ? "Generando Tempo" : "Consumo Pasivo"}
              </Badge>
            )}
          </div>
          <p>{Math.round(progress)}%</p>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              activity.status === "completed"
                ? "bg-blue-500"
                : isGeneratingTempo
                  ? "bg-green-500"
                  : "bg-red-500"
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {exceededMinutes > 0 && (
          <p className="text-red-500 mt-1">
            Tiempo excedido: {exceededMinutes} minutos (consumo pasivo de tempo)
          </p>
        )}
      </div>
      <p>Recompensa: +{activity.totalTempoReward} tempos</p>

      {activityConstraints.length > 0 && (
        <div className="mt-2">
          <p className="font-medium mb-1">Criterios de Aceptación:</p>
          <div className="space-y-2">
            {activityConstraints.map((constraint, index) => {
              if (constraint.type === "expiration") {
                return (
                  <div
                    key={constraint.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      constraint.status === "failed"
                        ? "bg-destructive/10 text-destructive"
                        : "bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span>Expira: {formatMinuteToTime(constraint.dayMinuteExpiration)}</span>
                      {constraint.status === "failed" && (
                        <Badge variant="destructive" className="text-[10px]">
                          Fallido
                        </Badge>
                      )}
                      {constraint.parentConstraintId && (
                        <Badge variant="outline" className="text-[10px]">
                          Heredado
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs">{formatConstraintPenalty(constraint.penalty)}</span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const NeutralOrHobbyDetails: React.FC<{ activity: NeutralActivity | HobbyActivity }> = ({
  activity,
}) => {
  const engine = useSystemEngineContext();
  if (activity.type !== "neutral" && activity.type !== "discount") return null;

  const progress = engine.activity.calculateProgress(activity);

  return (
    <div className="mt-2 text-sm">
      <div className="mb-2">
        <div className="flex justify-between mb-1">
          <p>
            Tiempo: {activity.minutesActive}/{activity.allowedTime} minutos
          </p>
          <p>{Math.round(progress)}%</p>
        </div>
        <div className="w-full bg-secondary rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      {activity.type === "discount" && <p>Tasa: -{activity.tempoConsumptionRate} tempo/min</p>}
    </div>
  );
};

const getUnselectMessage = (activity: Activity) => {
  if (activity.type === "challenge") {
    return "Al deseleccionar un desafío, podrás retomarlo más tarde desde donde lo dejaste.";
  }

  const remainingTime = activity.allowedTime - activity.minutesActive;

  if (activity.type === "neutral") {
    return (
      <>
        Recibirás una compensación de{" "}
        <span className="text-green-500 font-medium">+{remainingTime} tempos</span>.
      </>
    );
  }

  if (activity.type === "discount") {
    const compensation = remainingTime * activity.tempoConsumptionRate;
    const formattedCompensation = Number.isInteger(compensation)
      ? compensation.toString()
      : compensation.toFixed(1);

    return (
      <>
        Recibirás una compensación de{" "}
        <span className="text-green-500 font-medium">+{formattedCompensation} tempos</span> basada
        en el tiempo restante y la tasa de consumo.
      </>
    );
  }
};

const getCompleteMessage = (activity: ChallengeActivity) => {
  const remainingTempos = activity.totalTempoReward - activity.minutesActive;
  const isEarlyCompletion = activity.minutesActive < activity.totalTempoReward;

  if (isEarlyCompletion) {
    return (
      <>
        <p>¡Excelente! Has completado el desafío antes del tiempo estimado.</p>
        <p>
          Recibirás los{" "}
          <span className="text-green-500 font-medium">+{remainingTempos} tempos</span> restantes de
          inmediato, en lugar de esperar {remainingTempos} minutos más.
        </p>
      </>
    );
  }

  return (
    <>
      <p>Has excedido el tiempo estimado para este desafío.</p>
      <p>
        Ya has recibido el total de la recompensa ({activity.totalTempoReward} tempos) durante los
        primeros {activity.totalTempoReward} minutos.
      </p>
    </>
  );
};

const getFailedConstraintsWarning = (activity: ChallengeActivity) => {
  if (activity.constraintList.some((c) => c.status === "failed")) {
    return (
      <p className="text-destructive mt-2">
        ¡Atención! Hay criterios fallidos que pueden afectar la modificación de tempo final.
      </p>
    );
  }
  return null;
};

const ActivityCard: React.FC<ActivityCardProps> = ({
  activity,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}) => {
  const { uiState } = useUiStateContext();
  const engine = useSystemEngineContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isUnselectDialogOpen, setIsUnselectDialogOpen] = React.useState(false);
  const [editedTitle, setEditedTitle] = React.useState(activity.title);
  const [editedAllowedTime, setEditedAllowedTime] = React.useState(
    "allowedTime" in activity ? activity.allowedTime : 30
  );
  const [editedTempoReward, setEditedTempoReward] = React.useState(
    "totalTempoReward" in activity ? activity.totalTempoReward : 30
  );
  const [editedConsumptionRate, setEditedConsumptionRate] = React.useState(
    "tempoConsumptionRate" in activity ? activity.tempoConsumptionRate : 0.5
  );

  // Función para formatear minutos a formato de hora HH:MM
  const formatMinuteToTime = (minute: number) => {
    const hours = Math.floor(minute / 60);
    const minutes = minute % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  };

  // Separamos los constraints heredados de los personalizados
  const inheritedConstraints = React.useMemo(() => {
    if (activity.type !== "challenge") return [];
    return (activity as ChallengeActivity).constraintList.filter((c) => !!c.parentConstraintId);
  }, [activity]);

  const customConstraints = React.useMemo(() => {
    if (activity.type !== "challenge") return [];
    return (activity as ChallengeActivity).constraintList.filter((c) => !c.parentConstraintId);
  }, [activity]);

  // Solo inicializamos los constraints personalizados para edición
  const [editedConstraints, setEditedConstraints] =
    React.useState<ExpirationChallengeConstraint[]>(customConstraints);

  const isSelected = uiState.selectedActivity?.id === activity.id;

  const getEstimatedEndTime = React.useMemo(() => {
    if (!isSelected || activity.status !== "inProgress") return null;

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
  }, [isSelected, activity, uiState.lastUpdateTimestamp]);

  const isChallenge = activity.type === "challenge";
  const isNeutral = activity.type === "neutral";
  const isHobby = activity.type === "discount";
  const isNeutralOrHobby = isNeutral || isHobby;

  const isAllowedTimeInherited = React.useMemo(() => {
    return isNeutralOrHobby && activity.inheritedProps?.allowedTime !== undefined;
  }, [activity]);

  const isConsumptionRateInherited = React.useMemo(() => {
    return isHobby && activity.inheritedProps?.tempoConsumptionRate !== undefined;
  }, [activity]);

  const areConstraintsInherited = React.useMemo(() => {
    return isChallenge && activity.constraintList.some((c) => !!c.parentConstraintId);
  }, [activity]);

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setIsLoading(true);
      await action();
    } catch (error) {
      console.error("Error en la acción:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ha ocurrido un error al procesar la acción",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelect = () => handleAction(() => engine.activity.selectActivity(activity));
  const handleUnselect = async () => {
    try {
      setIsLoading(true);
      await engine.activity.unselectActivity();
      setIsUnselectDialogOpen(false);
    } catch (error) {
      console.error("Error en la acción:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ha ocurrido un error al procesar la acción",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteChallenge = (activity: ChallengeActivity) =>
    handleAction(() =>
      engine.activity.completeChallenge({
        activity,
      })
    );

  const handleDelete = () => handleAction(() => engine.activity.removeActivity(activity));

  const handleUpdateActivity = async () => {
    try {
      setIsLoading(true);

      const baseUpdates = {
        id: activity.id,
        title: editedTitle.trim(),
      };

      let activityUpdates: Partial<Activity> & { id: string };

      switch (activity.type) {
        case "challenge": {
          // Combinamos los constraints personalizados editados con los heredados originales
          const combinedConstraints = [
            ...editedConstraints,
            ...inheritedConstraints, // Mantenemos los constraints heredados sin cambios
          ];

          activityUpdates = {
            ...baseUpdates,
            totalTempoReward: editedTempoReward,
            constraintList: combinedConstraints,
          };
          break;
        }
        case "neutral":
          activityUpdates = {
            ...baseUpdates,
            allowedTime: editedAllowedTime,
          };
          break;
        case "discount":
          activityUpdates = {
            ...baseUpdates,
            allowedTime: editedAllowedTime,
            tempoConsumptionRate: editedConsumptionRate,
          };
          break;
        default:
          throw new Error("Tipo de actividad inválido");
      }

      // Validamos que los campos actualizados sean válidos
      const updatedActivity = { ...activity, ...activityUpdates };

      if (!engine.activity.validate(updatedActivity)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Los datos de la actividad son inválidos",
        });
        return;
      }

      await engine.activity.updateActivity(activityUpdates);
      setIsEditDialogOpen(false);

      toast({
        title: "Actividad actualizada",
        description: "La actividad se ha actualizado correctamente",
      });
    } catch (error) {
      console.error("Error al actualizar actividad:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la actividad",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConstraint = () => {
    const newConstraint: ExpirationChallengeConstraint = {
      id: uuidv4(),
      type: "expiration",
      dayMinuteExpiration: 0,
      penalty: 0,
      status: "active",
      failCount: 0,
    };
    setEditedConstraints([...editedConstraints, newConstraint]);
  };

  const handleUpdateConstraint = (
    index: number,
    updates: Partial<ExpirationChallengeConstraint>
  ) => {
    setEditedConstraints(
      editedConstraints.map((constraint, i) =>
        i === index ? { ...constraint, ...updates } : constraint
      )
    );
  };

  const handleRemoveConstraint = (index: number) => {
    setEditedConstraints(editedConstraints.filter((_, i) => i !== index));
  };

  const handleUpdateConstraintPenalty = (
    index: number,
    penalty: string,
    type: "fixed" | "percentage"
  ) => {
    setEditedConstraints(
      editedConstraints.map((constraint, i) =>
        i === index
          ? { ...constraint, penalty: type === "fixed" ? parseInt(penalty) : penalty }
          : constraint
      )
    );
  };

  return (
    <Card
      className={`w-full mb-4 ${
        activity.type === "challenge" &&
        (activity.status === "completed"
          ? "border-4 border-blue-500"
          : activity.status === "inProgress" &&
            (activity.minutesActive < activity.totalTempoReward
              ? "border-4 border-green-500"
              : "border-4 border-red-500"))
      } ${isSelected && activity.type !== "challenge" ? "border-4 border-blue-500" : ""}`}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold">{activity.title}</h3>
            <div className="flex gap-2 mt-1">
              <TypeBadge type={activity.type} />
              <StatusBadge status={activity.status} activity={activity} />
              {isSelected && activity.status === "inProgress" && getEstimatedEndTime && (
                <Badge variant="outline">Finaliza: {getEstimatedEndTime}</Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setIsEditDialogOpen(true)}>
            ✏️
          </Button>
        </div>

        {activity.type === "challenge" ? (
          <ChallengeDetails activity={activity as ChallengeActivity} />
        ) : (
          <NeutralOrHobbyDetails activity={activity as NeutralActivity | HobbyActivity} />
        )}
      </CardContent>

      <CardFooter className="px-4 pb-4 pt-0 flex gap-2">
        {activity.status === "toDo" && (
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="default" size="sm" disabled={isLoading}>
                Seleccionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirmar Selección</DialogTitle>
                <DialogDescription>
                  {uiState.selectedActivity
                    ? "Ya hay una actividad en progreso. Se deseleccionará la actividad actual y se seleccionará esta nueva."
                    : "¿Deseas comenzar esta actividad?"}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleSelect} disabled={isLoading}>
                  Confirmar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}

        {activity.status === "inProgress" && (
          <>
            <Dialog open={isUnselectDialogOpen} onOpenChange={setIsUnselectDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="secondary" size="sm" disabled={isLoading}>
                  Deseleccionar
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Confirmar Deselección</DialogTitle>
                  <DialogDescription>{getUnselectMessage(activity)}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={handleUnselect} disabled={isLoading}>
                    Confirmar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {activity.type === "challenge" && (
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="default" size="sm" disabled={isLoading}>
                    Completar
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Confirmar Completado</DialogTitle>
                    <DialogDescription className="space-y-2">
                      {getCompleteMessage(activity)}
                      {getFailedConstraintsWarning(activity)}
                    </DialogDescription>
                  </DialogHeader>
                  <DialogFooter>
                    <Button onClick={() => handleCompleteChallenge(activity)} disabled={isLoading}>
                      Confirmar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </>
        )}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" size="sm" disabled={isLoading}>
              Eliminar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogDescription>
                ¿Estás seguro de que deseas eliminar esta actividad?
                {activity.status === "inProgress" &&
                  " La actividad está en progreso, se deseleccionará antes de eliminarla."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleDelete} disabled={isLoading} variant="destructive">
                Eliminar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardFooter>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Actividad</DialogTitle>
            <DialogDescription>
              Modifica las propiedades de la actividad "{activity.title}"
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                placeholder="Título de la actividad"
              />
            </div>

            {isNeutralOrHobby && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="allowedTime">Tiempo Permitido (minutos)</Label>
                  {isAllowedTimeInherited && (
                    <Badge variant="outline" className="text-[10px]">
                      Heredado
                    </Badge>
                  )}
                </div>
                <Input
                  id="allowedTime"
                  type="number"
                  value={editedAllowedTime}
                  onChange={(e) => setEditedAllowedTime(Number(e.target.value))}
                  min={1}
                  max={960}
                  disabled={isAllowedTimeInherited}
                  className={isAllowedTimeInherited ? "bg-muted" : ""}
                />
              </div>
            )}

            {activity.type === "challenge" && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="tempoReward">Recompensa Total (tempos)</Label>
                  <Input
                    id="tempoReward"
                    type="number"
                    value={editedTempoReward}
                    onChange={(e) => setEditedTempoReward(Number(e.target.value))}
                    min={1}
                  />
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Criterios de Aceptación</Label>
                    <Button type="button" variant="outline" size="sm" onClick={handleAddConstraint}>
                      Agregar Criterio
                    </Button>
                  </div>

                  {/* Mostrar los constraints heredados primero, como elementos no editables */}
                  {inheritedConstraints.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          Criterios Heredados
                        </Badge>
                      </div>
                      {inheritedConstraints.map((constraint) => (
                        <div
                          key={constraint.id}
                          className="space-y-2 p-4 border rounded-lg bg-muted/50"
                        >
                          <div className="flex items-center justify-between">
                            <Label className="text-muted-foreground">Hora de Expiración</Label>
                            <div className="text-muted-foreground">
                              {formatMinuteToTime(constraint.dayMinuteExpiration)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-2">
                            <Label className="text-muted-foreground">Penalización</Label>
                            <div className="text-muted-foreground">
                              {typeof constraint.penalty === "number"
                                ? constraint.penalty
                                : constraint.penalty}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Luego mostrar los constraints personalizados que se pueden editar */}
                  {editedConstraints.map((constraint, index) => (
                    <div key={index} className="space-y-2 p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <Label>Hora de Expiración</Label>
                        <TimeSelector
                          value={constraint.dayMinuteExpiration}
                          onChange={(minutes) =>
                            handleUpdateConstraint(index, {
                              dayMinuteExpiration: minutes,
                            })
                          }
                          className="w-[230px]"
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        <Label>Penalización</Label>
                        <div className="flex items-center gap-2">
                          {typeof constraint.penalty === "number" && (
                            <Input
                              type="number"
                              min="0"
                              value={constraint.penalty}
                              onChange={(e) =>
                                handleUpdateConstraintPenalty(index, e.target.value, "fixed")
                              }
                              className="w-24"
                            />
                          )}
                          <Select
                            value={
                              typeof constraint.penalty === "string" ? constraint.penalty : "fixed"
                            }
                            onValueChange={(value) =>
                              handleUpdateConstraintPenalty(
                                index,
                                value === "fixed" ? "0" : value,
                                value === "fixed" ? "fixed" : "percentage"
                              )
                            }
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Tipo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="fixed">Valor Fijo</SelectItem>
                              <SelectItem value="100%">100%</SelectItem>
                              <SelectItem value="50%">50%</SelectItem>
                              <SelectItem value="25%">25%</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => handleRemoveConstraint(index)}
                        className="mt-2"
                      >
                        Eliminar Criterio
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}

            {activity.type === "discount" && (
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="consumptionRate">Tasa de Consumo (0-1)</Label>
                  {isConsumptionRateInherited && (
                    <Badge variant="outline" className="text-[10px]">
                      Heredado
                    </Badge>
                  )}
                </div>
                <Input
                  id="consumptionRate"
                  type="number"
                  value={editedConsumptionRate}
                  onChange={(e) => setEditedConsumptionRate(Number(e.target.value))}
                  min={0.1}
                  max={0.9}
                  step={0.1}
                  disabled={isConsumptionRateInherited}
                  className={isConsumptionRateInherited ? "bg-muted" : ""}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button onClick={handleUpdateActivity} disabled={isLoading}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ActivityCard;
