import React from "react";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@shadcn/accordion";
import { Badge } from "@shadcn/badge";
import { Button } from "@shadcn/button";
import { Checkbox } from "@shadcn/checkbox";
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
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@shadcn/hover-card";
import { Input } from "@shadcn/input";
import { Label } from "@shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@shadcn/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@shadcn/tooltip";

import ActivityCard from "./ActivityCard";
import { TimeSelector } from "./TimeSelector";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import type {
  Board,
  CreateActivityBaseInput,
  CreateActivityInput,
  CreateBoardInput,
  ExpirationChallengeConstraint,
  ChallengeActivity,
  NeutralActivity,
  HobbyActivity,
  BoardChallengeConstraint,
} from "@/core/types";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

interface BoardItemProps {
  board: Board;
  level?: number;
}

const BoardPropertiesInfo: React.FC<{ board: Board }> = ({ board }) => {
  const formatConstraint = (constraint: BoardChallengeConstraint) => {
    return `Expira: ${constraint.dayMinuteExpiration}min, Penalización: ${constraint.penalty}`;
  };

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <div className="inline-flex items-center justify-center w-6 h-6 rounded-full hover:bg-accent hover:text-accent-foreground cursor-help">
          ℹ️
        </div>
      </HoverCardTrigger>
      <HoverCardContent className="w-80">
        <div className="space-y-4">
          <h4 className="font-semibold">Propiedades Heredables</h4>

          {/* Desafíos */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Desafíos</h5>
            {board.activityProps.challenge ? (
              <div className="text-sm space-y-1">
                <p>Repetible: {board.activityProps.challenge.isRepetitive ? "Sí" : "No"}</p>
                {board.constraintList?.length > 0 ? (
                  <div>
                    <p>Criterios de Aceptación:</p>
                    <ul className="list-disc list-inside">
                      {board.constraintList.map((constraint) => (
                        <li key={constraint.id} className="text-xs">
                          {formatConstraint(constraint)}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <p className="text-muted-foreground">Sin criterios definidos</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin propiedades definidas</p>
            )}
          </div>

          {/* Neutral */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Actividades Neutrales</h5>
            {board.activityProps.neutral ? (
              <div className="text-sm space-y-1">
                <p>Repetible: {board.activityProps.neutral.isRepetitive ? "Sí" : "No"}</p>
                {board.activityProps.neutral.allowedTime && (
                  <p>Tiempo Permitido: {board.activityProps.neutral.allowedTime} minutos</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin propiedades definidas</p>
            )}
          </div>

          {/* Hobby */}
          <div className="space-y-2">
            <h5 className="text-sm font-medium">Hobbies</h5>
            {board.activityProps.discount ? (
              <div className="text-sm space-y-1">
                <p>Repetible: {board.activityProps.discount.isRepetitive ? "Sí" : "No"}</p>
                {board.activityProps.discount.allowedTime && (
                  <p>Tiempo Permitido: {board.activityProps.discount.allowedTime} minutos</p>
                )}
                {board.activityProps.discount.tempoConsumptionRate && (
                  <p>Tasa de Consumo: {board.activityProps.discount.tempoConsumptionRate}</p>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">Sin propiedades definidas</p>
            )}
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
};

const BoardItem: React.FC<BoardItemProps> = ({ board, level = 0 }) => {
  const engine = useSystemEngineContext();
  const { uiState } = useUiStateContext();
  const { toast } = useToast();
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [newTitle, setNewTitle] = React.useState(board.title);
  const [isEditingProps, setIsEditingProps] = React.useState(false);
  const [editedProps, setEditedProps] = React.useState({
    ...board.activityProps,
    constraintList: board.constraintList,
  });
  const [newActivityType, setNewActivityType] = React.useState<
    "neutral" | "challenge" | "discount"
  >("neutral");
  const [newActivityTitle, setNewActivityTitle] = React.useState("");
  const [newActivityAllowedTime, setNewActivityAllowedTime] = React.useState(30);
  const [newActivityTempoReward, setNewActivityTempoReward] = React.useState(30);
  const [newActivityConsumptionRate, setNewActivityConsumptionRate] = React.useState(0.5);
  const [newActivityIsRepetitive, setNewActivityIsRepetitive] = React.useState(false);
  const [newActivityConstraints, setNewActivityConstraints] = React.useState<
    Omit<ExpirationChallengeConstraint, "parentConstraintId">[]
  >([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreateActivityDialogOpen, setIsCreateActivityDialogOpen] = React.useState(false);

  const childBoards = React.useMemo(() => {
    if (!board.childrenBoards) return [];
    return board.childrenBoards
      .map((id) => uiState.boards.find((b) => b.id === id))
      .filter((b): b is Board => b !== undefined);
  }, [board.childrenBoards, uiState.boards]);

  const activities = React.useMemo(() => {
    return engine.board.getActivities(board.id);
  }, [board.id, engine.board, uiState.activities]);

  const handleCreateActivity = async () => {
    try {
      setIsLoading(true);

      // Obtenemos las propiedades heredadas del tablero
      const inheritedProps = board.activityProps;

      const baseActivity: CreateActivityBaseInput = {
        title: newActivityTitle.trim(),
        status: "toDo" as const,
        minutesActive: 0,
        parentBoardId: board.id,
        type: newActivityType,
        isRepetitive:
          inheritedProps.challenge?.isRepetitive ??
          inheritedProps.neutral?.isRepetitive ??
          inheritedProps.discount?.isRepetitive ??
          newActivityIsRepetitive,
      };

      let newActivity: CreateActivityInput;

      switch (newActivityType) {
        case "challenge":
          newActivity = {
            ...baseActivity,
            type: "challenge",
            totalTempoReward: newActivityTempoReward,
            constraintList: newActivityConstraints,
            isRepetitive: inheritedProps.challenge?.isRepetitive ?? false,
          };
          break;
        case "neutral":
          newActivity = {
            ...baseActivity,
            type: "neutral",
            allowedTime: inheritedProps.neutral?.allowedTime ?? newActivityAllowedTime,
            isRepetitive: inheritedProps.neutral?.isRepetitive ?? false,
          };
          break;
        case "discount":
          newActivity = {
            ...baseActivity,
            type: "discount",
            allowedTime: inheritedProps.discount?.allowedTime ?? newActivityAllowedTime,
            tempoConsumptionRate:
              inheritedProps.discount?.tempoConsumptionRate ?? newActivityConsumptionRate,
            isRepetitive: inheritedProps.discount?.isRepetitive ?? false,
          };
          break;
        default:
          throw new Error("Tipo de actividad inválido");
      }

      if (!engine.activity.validate(newActivity)) {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Los datos de la actividad son inválidos",
        });
        return;
      }

      await engine.activity.createActivity(newActivity);

      // Reset form
      setNewActivityTitle("");
      setNewActivityType("neutral");
      setNewActivityAllowedTime(30);
      setNewActivityTempoReward(30);
      setNewActivityConsumptionRate(0.5);
      setNewActivityIsRepetitive(false);
      setNewActivityConstraints([]);
      setIsCreateActivityDialogOpen(false);

      toast({
        title: "Actividad creada",
        description: "La actividad se ha creado correctamente",
      });
    } catch (error) {
      console.error("Error al crear actividad:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear la actividad",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateTitle = async () => {
    const title = newTitle.trim();
    if (!title) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "El título no puede estar vacío",
      });
      return;
    }

    if (title === board.title) {
      setIsEditingTitle(false);
      return;
    }

    try {
      setIsLoading(true);
      await engine.board.updateBoard({ ...board, title });
      setIsEditingTitle(false);
      toast({
        title: "Tablero actualizado",
        description: "El título se ha actualizado correctamente",
      });
    } catch (error) {
      console.error("Error al actualizar tablero:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar el título",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateSubBoard = async () => {
    try {
      setIsLoading(true);
      const newBoard: CreateBoardInput = {
        title: "Nuevo Subtablero",
        parentBoardId: board.id,
        activities: [],
        childrenBoards: [],
        activityProps: {},
        constraintList: [],
      };
      await engine.board.createBoard(newBoard);
      toast({
        title: "Subtablero creado",
        description: "El subtablero se ha creado correctamente",
      });
    } catch (error) {
      console.error("Error al crear subtablero:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el subtablero",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveBoard = async () => {
    try {
      setIsLoading(true);
      await engine.board.removeBoard(board);
      toast({
        title: "Tablero eliminado",
        description: "El tablero se ha eliminado correctamente",
      });
    } catch (error) {
      console.error("Error al eliminar tablero:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo eliminar el tablero",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddActivityConstraint = () => {
    setNewActivityConstraints([
      ...newActivityConstraints,
      {
        type: "expiration",
        dayMinuteExpiration: 0,
        penalty: 0,
        failCount: 0,
        id: crypto.randomUUID(),
        status: "active",
      },
    ]);
  };

  const handleUpdateActivityConstraint = (
    index: number,
    updates: Partial<ExpirationChallengeConstraint>
  ) => {
    setNewActivityConstraints(
      newActivityConstraints.map((constraint, i) =>
        i === index ? { ...constraint, ...updates } : constraint
      )
    );
  };

  const handleUpdateActivityConstraintPenalty = (
    index: number,
    value: string,
    type: "fixed" | "percentage"
  ) => {
    const penalty = type === "fixed" ? Number(value) : value;
    handleUpdateActivityConstraint(index, { penalty });
  };

  const handleRemoveActivityConstraint = (index: number) => {
    setNewActivityConstraints(newActivityConstraints.filter((_, i) => i !== index));
  };

  const handleUpdateProps = async () => {
    try {
      setIsLoading(true);
      const updatedProps = {
        activityProps: {
          challenge: editedProps.challenge
            ? {
                isRepetitive: editedProps.challenge.isRepetitive,
              }
            : undefined,
          neutral: editedProps.neutral,
          discount: editedProps.discount,
        },
        constraintList: editedProps.constraintList,
      };

      await engine.board.updateBoard({
        ...board,
        ...updatedProps,
      });
      setIsEditingProps(false);
      toast({
        title: "Propiedades actualizadas",
        description: "Las propiedades del tablero se han actualizado correctamente",
      });
    } catch (error) {
      console.error("Error al actualizar propiedades:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudieron actualizar las propiedades",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateChallengeProps = (
    updates: Partial<Pick<ChallengeActivity, "isRepetitive">> & {
      constraintList?: BoardChallengeConstraint[];
    }
  ) => {
    setEditedProps((prev) => ({
      ...prev,
      activityProps: {
        challenge: editedProps.challenge
          ? {
              isRepetitive: editedProps.challenge.isRepetitive,
            }
          : undefined,
        neutral: editedProps.neutral,
        discount: editedProps.discount,
      },
      constraintList: updates.constraintList ?? prev.constraintList,
    }));
  };

  const updateNeutralProps = (
    updates: Partial<Pick<NeutralActivity, "allowedTime" | "isRepetitive">>
  ) => {
    setEditedProps((prev) => ({
      ...prev,
      neutral: {
        ...prev.neutral,
        ...updates,
      },
    }));
  };

  const updateHobbyProps = (
    updates: Partial<Pick<HobbyActivity, "allowedTime" | "isRepetitive" | "tempoConsumptionRate">>
  ) => {
    setEditedProps((prev) => ({
      ...prev,
      discount: {
        ...prev.discount,
        ...updates,
      },
    }));
  };

  const handleAddNewConstraint = () => {
    const newConstraint: BoardChallengeConstraint = {
      id: crypto.randomUUID(),
      type: "expiration",
      dayMinuteExpiration: 60,
      penalty: "100%",
    };

    updateChallengeProps({
      constraintList: [...editedProps.constraintList, newConstraint],
    });
  };

  return (
    <Accordion type="single" collapsible>
      <AccordionItem value={board.id} className="border-none">
        <div className="flex items-center gap-2 px-2 py-1">
          <AccordionTrigger className="flex-1 hover:no-underline py-0">
            <div className="flex items-center gap-2">
              {isEditingTitle ? (
                <div className="flex gap-2 items-center">
                  <Input
                    value={newTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewTitle(e.target.value)
                    }
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                      if (e.key === "Enter") handleUpdateTitle();
                      if (e.key === "Escape") {
                        setNewTitle(board.title);
                        setIsEditingTitle(false);
                      }
                    }}
                    autoFocus
                  />
                  <Button size="sm" onClick={handleUpdateTitle} disabled={isLoading}>
                    Guardar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNewTitle(board.title);
                      setIsEditingTitle(false);
                    }}
                    disabled={isLoading}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <span className="text-sm font-medium">{board.title}</span>
              )}
            </div>
          </AccordionTrigger>
          <BoardPropertiesInfo board={board} />
          <Dialog open={isEditingProps} onOpenChange={setIsEditingProps}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <span className="sr-only">Editar propiedades</span>
                ⚙️
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Editar Propiedades del Tablero</DialogTitle>
                <DialogDescription>
                  Configura las propiedades que heredarán las actividades creadas en este tablero
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="challenge">
                    <AccordionTrigger>Propiedades para Desafíos</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 p-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="challenge-repetitive"
                            checked={editedProps.challenge?.isRepetitive ?? false}
                            onCheckedChange={(checked) =>
                              updateChallengeProps({ isRepetitive: checked as boolean })
                            }
                          />
                          <Label htmlFor="challenge-repetitive">Repetible</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>Criterios de Aceptación</Label>
                          {editedProps.constraintList?.map((constraint, index) => (
                            <div key={index} className="space-y-2 p-4 border rounded-lg">
                              <div className="flex items-center justify-between">
                                <Label>Hora de Expiración</Label>
                                <TimeSelector
                                  value={constraint.dayMinuteExpiration}
                                  onChange={(minutes) => {
                                    const newConstraints = [...editedProps.constraintList];
                                    newConstraints[index] = {
                                      ...newConstraints[index],
                                      dayMinuteExpiration: minutes,
                                    };
                                    updateChallengeProps({ constraintList: newConstraints });
                                  }}
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
                                      onChange={(e) => {
                                        const newConstraints = [...editedProps.constraintList];
                                        newConstraints[index] = {
                                          ...newConstraints[index],
                                          penalty: parseInt(e.target.value),
                                        };
                                        updateChallengeProps({ constraintList: newConstraints });
                                      }}
                                      className="w-24"
                                    />
                                  )}
                                  <Select
                                    value={
                                      typeof constraint.penalty === "string"
                                        ? constraint.penalty
                                        : "fixed"
                                    }
                                    onValueChange={(value) => {
                                      const newConstraints = [...editedProps.constraintList];
                                      newConstraints[index] = {
                                        ...newConstraints[index],
                                        penalty: value === "fixed" ? 0 : value,
                                      };
                                      updateChallengeProps({ constraintList: newConstraints });
                                    }}
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
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  const newConstraints = [...editedProps.constraintList];
                                  newConstraints.splice(index, 1);
                                  updateChallengeProps({ constraintList: newConstraints });
                                }}
                                className="mt-2"
                              >
                                Eliminar Criterio
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" onClick={handleAddNewConstraint}>
                            Agregar Criterio
                          </Button>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="neutral">
                    <AccordionTrigger>Propiedades para Actividades Neutrales</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 p-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="neutral-repetitive"
                            checked={editedProps.neutral?.isRepetitive ?? false}
                            onCheckedChange={(checked) =>
                              updateNeutralProps({ isRepetitive: checked as boolean })
                            }
                          />
                          <Label htmlFor="neutral-repetitive">Repetible</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>Tiempo Permitido</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editedProps.neutral?.allowedTime ?? 30}
                              onChange={(e) =>
                                updateNeutralProps({ allowedTime: parseInt(e.target.value) })
                              }
                              className="w-24"
                            />
                            <span>minutos</span>
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="hobby">
                    <AccordionTrigger>Propiedades para Hobbies</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4 p-4">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            id="hobby-repetitive"
                            checked={editedProps.discount?.isRepetitive ?? false}
                            onCheckedChange={(checked) =>
                              updateHobbyProps({ isRepetitive: checked as boolean })
                            }
                          />
                          <Label htmlFor="hobby-repetitive">Repetible</Label>
                        </div>
                        <div className="space-y-2">
                          <Label>Tiempo Permitido</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              value={editedProps.discount?.allowedTime ?? 30}
                              onChange={(e) =>
                                updateHobbyProps({ allowedTime: parseInt(e.target.value) })
                              }
                              className="w-24"
                            />
                            <span>minutos</span>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label>Tasa de Consumo</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              step="0.1"
                              min="0"
                              max="1"
                              value={editedProps.discount?.tempoConsumptionRate ?? 0.5}
                              onChange={(e) =>
                                updateHobbyProps({
                                  tempoConsumptionRate: parseFloat(e.target.value),
                                })
                              }
                              className="w-24"
                            />
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditingProps(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleUpdateProps} disabled={isLoading}>
                  {isLoading ? "Guardando..." : "Guardar Cambios"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={isCreateActivityDialogOpen} onOpenChange={setIsCreateActivityDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" disabled={isLoading}>
                Nueva Actividad
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Actividad</DialogTitle>
                <DialogDescription>
                  Configura la nueva actividad para "{board.title}"
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <label htmlFor="title" className="text-sm font-medium">
                    Título
                  </label>
                  <Input
                    id="title"
                    value={newActivityTitle}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setNewActivityTitle(e.target.value)
                    }
                    placeholder="Título de la actividad"
                  />
                </div>

                <div className="grid gap-2">
                  <label htmlFor="type" className="text-sm font-medium">
                    Tipo
                  </label>
                  <Select
                    value={newActivityType}
                    onValueChange={(value: "neutral" | "challenge" | "discount") =>
                      setNewActivityType(value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="neutral">Neutral</SelectItem>
                      <SelectItem value="challenge">Desafío</SelectItem>
                      <SelectItem value="discount">Hobby</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-2">
                  <TooltipProvider>
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="isRepetitive"
                        disabled={
                          (newActivityType === "neutral" &&
                            board.activityProps.neutral?.isRepetitive !== undefined) ||
                          (newActivityType === "challenge" &&
                            board.activityProps.challenge?.isRepetitive !== undefined) ||
                          (newActivityType === "discount" &&
                            board.activityProps.discount?.isRepetitive !== undefined)
                        }
                        checked={
                          newActivityType === "neutral"
                            ? (board.activityProps.neutral?.isRepetitive ?? newActivityIsRepetitive)
                            : newActivityType === "challenge"
                              ? (board.activityProps.challenge?.isRepetitive ??
                                newActivityIsRepetitive)
                              : (board.activityProps.discount?.isRepetitive ??
                                newActivityIsRepetitive)
                        }
                        onCheckedChange={(checked) =>
                          setNewActivityIsRepetitive(checked as boolean)
                        }
                      />
                      <Label htmlFor="isRepetitive" className="text-sm font-medium">
                        Repetible
                      </Label>
                      {((newActivityType === "neutral" &&
                        board.activityProps.neutral?.isRepetitive !== undefined) ||
                        (newActivityType === "challenge" &&
                          board.activityProps.challenge?.isRepetitive !== undefined) ||
                        (newActivityType === "discount" &&
                          board.activityProps.discount?.isRepetitive !== undefined)) && (
                        <Badge variant="outline" className="text-[10px]">
                          Heredado
                        </Badge>
                      )}
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="inline-flex">
                          {((newActivityType === "neutral" &&
                            board.activityProps.neutral?.isRepetitive !== undefined) ||
                            (newActivityType === "challenge" &&
                              board.activityProps.challenge?.isRepetitive !== undefined) ||
                            (newActivityType === "discount" &&
                              board.activityProps.discount?.isRepetitive !== undefined)) && (
                            <span className="sr-only">Info</span>
                          )}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent>
                        {((newActivityType === "neutral" &&
                          board.activityProps.neutral?.isRepetitive !== undefined) ||
                          (newActivityType === "challenge" &&
                            board.activityProps.challenge?.isRepetitive !== undefined) ||
                          (newActivityType === "discount" &&
                            board.activityProps.discount?.isRepetitive !== undefined)) && (
                          <p>
                            Esta propiedad está heredada del tablero padre y no puede ser modificada
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                {(newActivityType === "neutral" || newActivityType === "discount") && (
                  <div className="grid gap-2">
                    <TooltipProvider>
                      <div className="flex items-center justify-between">
                        <label htmlFor="allowedTime" className="text-sm font-medium">
                          Tiempo Permitido (minutos)
                        </label>
                        {((newActivityType === "neutral" &&
                          board.activityProps.neutral?.allowedTime) ||
                          (newActivityType === "discount" &&
                            board.activityProps.discount?.allowedTime)) && (
                          <Badge variant="outline" className="text-[10px]">
                            Heredado
                          </Badge>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Input
                              id="allowedTime"
                              type="number"
                              value={
                                newActivityType === "neutral"
                                  ? (board.activityProps.neutral?.allowedTime ??
                                    newActivityAllowedTime)
                                  : (board.activityProps.discount?.allowedTime ??
                                    newActivityAllowedTime)
                              }
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewActivityAllowedTime(Number(e.target.value))
                              }
                              min={1}
                              max={960}
                              disabled={Boolean(
                                (newActivityType === "neutral" &&
                                  board.activityProps.neutral?.allowedTime) ||
                                  (newActivityType === "discount" &&
                                    board.activityProps.discount?.allowedTime)
                              )}
                              className={
                                (newActivityType === "neutral" &&
                                  board.activityProps.neutral?.allowedTime) ||
                                (newActivityType === "discount" &&
                                  board.activityProps.discount?.allowedTime)
                                  ? "bg-muted"
                                  : ""
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {((newActivityType === "neutral" &&
                            board.activityProps.neutral?.allowedTime) ||
                            (newActivityType === "discount" &&
                              board.activityProps.discount?.allowedTime)) && (
                            <p>
                              Este valor está heredado del tablero padre y no puede ser modificado
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {newActivityType === "challenge" && (
                  <div className="grid gap-2">
                    <label htmlFor="tempoReward" className="text-sm font-medium">
                      Recompensa Total (tempos)
                    </label>
                    <Input
                      id="tempoReward"
                      type="number"
                      value={newActivityTempoReward}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setNewActivityTempoReward(Number(e.target.value))
                      }
                      min={1}
                    />
                  </div>
                )}

                {newActivityType === "discount" && (
                  <div className="grid gap-2">
                    <TooltipProvider>
                      <div className="flex items-center justify-between">
                        <label htmlFor="consumptionRate" className="text-sm font-medium">
                          Tasa de Consumo (0-1)
                        </label>
                        {board.activityProps.discount?.tempoConsumptionRate && (
                          <Badge variant="outline" className="text-[10px]">
                            Heredado
                          </Badge>
                        )}
                      </div>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div>
                            <Input
                              id="consumptionRate"
                              type="number"
                              value={
                                board.activityProps.discount?.tempoConsumptionRate ??
                                newActivityConsumptionRate
                              }
                              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setNewActivityConsumptionRate(Number(e.target.value))
                              }
                              min={0.1}
                              max={0.9}
                              step={0.1}
                              disabled={
                                board.activityProps.discount?.tempoConsumptionRate !== undefined
                              }
                              className={
                                board.activityProps.discount?.tempoConsumptionRate !== undefined
                                  ? "bg-muted"
                                  : ""
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {board.activityProps.discount?.tempoConsumptionRate !== undefined && (
                            <p>
                              Este valor está heredado del tablero padre y no puede ser modificado
                            </p>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                )}

                {newActivityType === "challenge" && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Criterios de Aceptación</Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddActivityConstraint}
                      >
                        Agregar Criterio
                      </Button>
                    </div>

                    {newActivityConstraints.map((constraint, index) => (
                      <div key={index} className="space-y-2 p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <Label>Hora de Expiración</Label>
                          <TimeSelector
                            value={constraint.dayMinuteExpiration}
                            onChange={(minutes) =>
                              handleUpdateActivityConstraint(index, {
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
                                  handleUpdateActivityConstraintPenalty(
                                    index,
                                    e.target.value,
                                    "fixed"
                                  )
                                }
                                className="w-24"
                              />
                            )}
                            <Select
                              value={
                                typeof constraint.penalty === "string"
                                  ? constraint.penalty
                                  : "fixed"
                              }
                              onValueChange={(value) =>
                                handleUpdateActivityConstraintPenalty(
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
                          onClick={() => handleRemoveActivityConstraint(index)}
                          className="mt-2"
                        >
                          Eliminar Criterio
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button onClick={handleCreateActivity} disabled={isLoading}>
                  Crear
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={handleCreateSubBoard} disabled={isLoading}>
            Nuevo Subtablero
          </Button>
          {!board.parentBoardId && (
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
                    ¿Estás seguro de que deseas eliminar este tablero?
                    {(activities.length > 0 || childBoards.length > 0) && (
                      <p className="text-destructive mt-2">
                        ¡Atención! Se eliminarán también{" "}
                        {activities.length > 0 && `${activities.length} actividades`}
                        {activities.length > 0 && childBoards.length > 0 && " y "}
                        {childBoards.length > 0 && `${childBoards.length} subtableros`}.
                      </p>
                    )}
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={handleRemoveBoard} disabled={isLoading} variant="destructive">
                    Eliminar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Actividades del tablero actual */}
        {activities.length > 0 && (
          <div className="mb-4">
            {activities.map((activity) => (
              <ActivityCard key={activity.id} activity={activity} />
            ))}
          </div>
        )}

        {/* Subtableros */}
        {childBoards.length > 0 && (
          <Accordion type="single" collapsible className="mt-4">
            {childBoards.map((childBoard) => (
              <AccordionItem key={childBoard.id} value={childBoard.id}>
                <AccordionTrigger>{childBoard.title}</AccordionTrigger>
                <AccordionContent>
                  <BoardItem board={childBoard} level={level + 1} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </AccordionItem>
    </Accordion>
  );
};

const BoardsColumn: React.FC = () => {
  const { uiState } = useUiStateContext();
  const engine = useSystemEngineContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
  const [isCreateBoardDialogOpen, setIsCreateBoardDialogOpen] = React.useState(false);
  const [newBoardTitle, setNewBoardTitle] = React.useState("");

  // Propiedades heredables para Challenge
  const [challengeIsRepetitive, setChallengeIsRepetitive] = React.useState(false);
  const [challengeConstraints, setChallengeConstraints] = React.useState<
    ExpirationChallengeConstraint[]
  >([]);

  // Propiedades heredables para Neutral
  const [neutralIsRepetitive, setNeutralIsRepetitive] = React.useState(false);
  const [neutralAllowedTime, setNeutralAllowedTime] = React.useState(30);

  // Propiedades heredables para Hobby
  const [hobbyIsRepetitive, setHobbyIsRepetitive] = React.useState(false);
  const [hobbyAllowedTime, setHobbyAllowedTime] = React.useState(30);
  const [hobbyConsumptionRate, setHobbyConsumptionRate] = React.useState(0.5);

  const rootBoards = React.useMemo(() => {
    return uiState.boards.filter((board) => !board.parentBoardId);
  }, [uiState.boards]);

  const handleCreateBoard = async () => {
    try {
      setIsLoading(true);

      // Construir activityProps solo con las propiedades que han sido configuradas
      const activityProps: Board["activityProps"] = {};

      // Challenge props
      if (challengeIsRepetitive || challengeConstraints.length > 0) {
        activityProps.challenge = {
          isRepetitive: challengeIsRepetitive,
        };
      }

      // Neutral props
      if (neutralIsRepetitive || neutralAllowedTime !== 30) {
        activityProps.neutral = {
          isRepetitive: neutralIsRepetitive,
          allowedTime: neutralAllowedTime,
        };
      }

      // Hobby props
      if (hobbyIsRepetitive || hobbyAllowedTime !== 30 || hobbyConsumptionRate !== 0.5) {
        activityProps.discount = {
          isRepetitive: hobbyIsRepetitive,
          allowedTime: hobbyAllowedTime,
          tempoConsumptionRate: hobbyConsumptionRate,
        };
      }

      const newBoard: CreateBoardInput = {
        title: newBoardTitle.trim(),
        parentBoardId: undefined,
        childrenBoards: [],
        activities: [],
        activityProps,
        constraintList: challengeConstraints,
      };

      await engine.board.createBoard(newBoard);

      // Reset form
      setNewBoardTitle("");
      setChallengeIsRepetitive(false);
      setChallengeConstraints([]);
      setNeutralIsRepetitive(false);
      setNeutralAllowedTime(30);
      setHobbyIsRepetitive(false);
      setHobbyAllowedTime(30);
      setHobbyConsumptionRate(0.5);
      setIsCreateBoardDialogOpen(false);

      toast({
        title: "Tablero creado",
        description: "El tablero se ha creado correctamente",
      });
    } catch (error) {
      console.error("Error al crear tablero:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo crear el tablero",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddConstraint = () => {
    const newConstraint: ExpirationChallengeConstraint = {
      id: crypto.randomUUID(),
      type: "expiration",
      dayMinuteExpiration: 0,
      penalty: 0,
      status: "active",
      failCount: 0,
    };
    setChallengeConstraints([...challengeConstraints, newConstraint]);
  };

  const handleUpdateConstraint = (
    index: number,
    updates: Partial<ExpirationChallengeConstraint>
  ) => {
    setChallengeConstraints(
      challengeConstraints.map((constraint, i) =>
        i === index ? { ...constraint, ...updates } : constraint
      )
    );
  };

  const handleUpdateConstraintPenalty = (
    index: number,
    value: string,
    type: "fixed" | "percentage"
  ) => {
    const penalty = type === "fixed" ? Number(value) : value;
    handleUpdateConstraint(index, { penalty });
  };

  const handleRemoveConstraint = (index: number) => {
    setChallengeConstraints(challengeConstraints.filter((_, i) => i !== index));
  };

  const handleChallengeRepetitiveChange = (checked: boolean) => {
    setChallengeIsRepetitive(checked);
  };

  const handleNeutralRepetitiveChange = (checked: boolean) => {
    setNeutralIsRepetitive(checked);
  };

  const handleHobbyRepetitiveChange = (checked: boolean) => {
    setHobbyIsRepetitive(checked);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Tableros</h2>
        <Dialog open={isCreateBoardDialogOpen} onOpenChange={setIsCreateBoardDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isLoading}>Nuevo Tablero</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Crear Nuevo Tablero</DialogTitle>
              <DialogDescription>
                Configura las propiedades que heredarán las actividades dentro de este tablero.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              <div className="grid gap-2">
                <Label htmlFor="boardTitle">Título</Label>
                <Input
                  id="boardTitle"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  placeholder="Nombre del tablero"
                />
              </div>

              <Accordion type="single" collapsible>
                {/* Propiedades para Desafíos */}
                <AccordionItem value="challenge">
                  <AccordionTrigger>Propiedades para Desafíos</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="challengeIsRepetitive"
                          checked={challengeIsRepetitive}
                          onCheckedChange={handleChallengeRepetitiveChange}
                        />
                        <Label htmlFor="challengeIsRepetitive">Repetible</Label>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <Label>Criterios de Aceptación</Label>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleAddConstraint}
                          >
                            Agregar Criterio
                          </Button>
                        </div>

                        {challengeConstraints.map((constraint, index) => (
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
                                    typeof constraint.penalty === "string"
                                      ? constraint.penalty
                                      : "fixed"
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
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Propiedades para Actividades Neutrales */}
                <AccordionItem value="neutral">
                  <AccordionTrigger>Propiedades para Actividades Neutrales</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="neutralIsRepetitive"
                          checked={neutralIsRepetitive}
                          onCheckedChange={handleNeutralRepetitiveChange}
                        />
                        <Label htmlFor="neutralIsRepetitive">Repetible</Label>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="neutralAllowedTime">Tiempo Permitido (minutos)</Label>
                        <Input
                          id="neutralAllowedTime"
                          type="number"
                          value={neutralAllowedTime}
                          onChange={(e) => setNeutralAllowedTime(Number(e.target.value))}
                          min={1}
                          max={960}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Propiedades para Hobbies */}
                <AccordionItem value="hobby">
                  <AccordionTrigger>Propiedades para Hobbies</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="hobbyIsRepetitive"
                          checked={hobbyIsRepetitive}
                          onCheckedChange={handleHobbyRepetitiveChange}
                        />
                        <Label htmlFor="hobbyIsRepetitive">Repetible</Label>
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="hobbyAllowedTime">Tiempo Permitido (minutos)</Label>
                        <Input
                          id="hobbyAllowedTime"
                          type="number"
                          value={hobbyAllowedTime}
                          onChange={(e) => setHobbyAllowedTime(Number(e.target.value))}
                          min={1}
                          max={960}
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label htmlFor="hobbyConsumptionRate">Tasa de Consumo (0-1)</Label>
                        <Input
                          id="hobbyConsumptionRate"
                          type="number"
                          value={hobbyConsumptionRate}
                          onChange={(e) => setHobbyConsumptionRate(Number(e.target.value))}
                          min={0.1}
                          max={0.9}
                          step={0.1}
                        />
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>

            <DialogFooter>
              <Button onClick={handleCreateBoard} disabled={isLoading || !newBoardTitle.trim()}>
                Crear
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rootBoards.map((board) => (
        <BoardItem key={board.id} board={board} />
      ))}

      {rootBoards.length === 0 && (
        <p className="text-center text-muted-foreground">No hay tableros creados</p>
      )}
    </div>
  );
};

export default BoardsColumn;
