import React from "react";

import type { Activity, ChallengeActivity, HobbyActivity, NeutralActivity } from "@core/types";
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
import { Input } from "@shadcn/input";
import { Label } from "@shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shadcn/select";

import { TimeSelector } from "../TimeSelector";
import {
  useActivityActions,
  useActivityEdit,
  useConstraintsManagement,
  useActivityProgress,
} from "./hooks";
import {
  formatMinuteToTime,
  formatConstraintPenalty,
  getStatusColor,
  getStatusLabel,
  getTypeLabel,
  getUnselectMessage,
  getCompleteMessage,
  getFailedConstraintsWarning,
  getEstimatedEndTime,
  isPropertyInherited,
} from "./utils";

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
  return <Badge variant="secondary">{getTypeLabel(type)}</Badge>;
};

const ChallengeDetails: React.FC<{ activity: ChallengeActivity }> = ({ activity }) => {
  const { progress } = useActivityProgress(activity);

  const activityConstraints = activity.constraintList;
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
            {activityConstraints.map((constraint) => {
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
  const { uiState } = useUiStateContext();
  if (activity.type !== "neutral" && activity.type !== "discount") return null;

  const { progress } = useActivityProgress(activity);

  const effectiveRate =
    activity.type === "discount"
      ? activity.tempoConsumptionRate * uiState.systemParams.passiveTempoConsumptionRate
      : 0;

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
      {activity.type === "discount" && (
        <div>
          <p>Tasa base: -{activity.tempoConsumptionRate} tempo/min</p>
          <p>Tasa efectiva: -{effectiveRate.toFixed(2)} tempo/min</p>
          <p className="text-xs text-muted-foreground mt-1">
            (Energía día: {uiState.systemParams.passiveTempoConsumptionRate * 100}%)
          </p>
        </div>
      )}
    </div>
  );
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
  const [isEditDialogOpen, setIsEditDialogOpen] = React.useState(false);
  const [isUnselectDialogOpen, setIsUnselectDialogOpen] = React.useState(false);

  const { isLoading, handleSelect, handleUnselect, handleCompleteChallenge, handleDelete } =
    useActivityActions(activity);

  const {
    editedTitle,
    editedAllowedTime,
    editedTempoReward,
    editedConsumptionRate,
    editedConstraints,
    setEditedTitle,
    setEditedAllowedTime,
    setEditedTempoReward,
    setEditedConsumptionRate,
    setEditedConstraints,
    handleUpdateActivity,
  } = useActivityEdit(activity);

  const {
    handleAddConstraint,
    handleUpdateConstraint,
    handleRemoveConstraint,
    handleUpdateConstraintPenalty,
  } = useConstraintsManagement(editedConstraints, setEditedConstraints);

  const isSelected = uiState.selectedActivity?.id === activity.id;
  const estimatedEndTime = getEstimatedEndTime(activity, isSelected, uiState.lastUpdateTimestamp);
  const isNeutral = activity.type === "neutral";
  const isHobby = activity.type === "discount";
  const isNeutralOrHobby = isNeutral || isHobby;

  const isAllowedTimeInherited = isPropertyInherited(
    activity,
    "allowedTime" as keyof typeof activity.inheritedProps
  );
  const isConsumptionRateInherited = isPropertyInherited(
    activity,
    "tempoConsumptionRate" as keyof typeof activity.inheritedProps
  );

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
              {isSelected && activity.status === "inProgress" && estimatedEndTime && (
                <Badge variant="outline">Finaliza: {estimatedEndTime}</Badge>
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
                <DialogDescription className="space-y-2">
                  {uiState.selectedActivity ? (
                    <>
                      <p>Ya hay una actividad en progreso. Al seleccionar esta nueva:</p>
                      <ul className="list-disc pl-5 space-y-1">
                        <li>
                          La actividad actual "{uiState.selectedActivity.title}" será deseleccionada
                        </li>
                        {(uiState.selectedActivity.type === "neutral" ||
                          uiState.selectedActivity.type === "discount") &&
                          uiState.selectedActivity.minutesActive <
                            uiState.selectedActivity.allowedTime && (
                            <li>
                              Se aplicará la compensación correspondiente por tiempo no utilizado
                              {uiState.selectedActivity.type === "neutral" ? (
                                <span className="text-green-500 font-medium">
                                  {" "}
                                  (+
                                  {uiState.selectedActivity.allowedTime -
                                    uiState.selectedActivity.minutesActive}{" "}
                                  tempos)
                                </span>
                              ) : (
                                uiState.selectedActivity.type === "discount" && (
                                  <span className="text-green-500 font-medium">
                                    {" "}
                                    (+
                                    {(
                                      (uiState.selectedActivity.allowedTime -
                                        uiState.selectedActivity.minutesActive) *
                                      (uiState.systemParams.passiveTempoConsumptionRate -
                                        uiState.systemParams.passiveTempoConsumptionRate *
                                          uiState.selectedActivity.tempoConsumptionRate)
                                    ).toFixed(1)}{" "}
                                    tempos)
                                  </span>
                                )
                              )}
                            </li>
                          )}
                        {(uiState.selectedActivity.type === "neutral" ||
                          uiState.selectedActivity.type === "discount") &&
                          uiState.selectedActivity.minutesActive >=
                            uiState.selectedActivity.allowedTime && (
                            <li>
                              La actividad actual se marcará como completada al haber usado todo su
                              tiempo
                            </li>
                          )}
                        <li>La nueva actividad "{activity.title}" se establecerá como activa</li>
                      </ul>
                    </>
                  ) : (
                    "¿Deseas comenzar esta actividad?"
                  )}
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
                  <DialogDescription>
                    {getUnselectMessage(activity, uiState.systemParams)}
                  </DialogDescription>
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
