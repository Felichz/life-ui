import React from "react";

import type { Activity, ChallengeActivity, ExpirationChallengeConstraint } from "@core/types";
import { useToast } from "@shadcn/hooks/use-toast";
import { v4 as uuidv4 } from "uuid";

import { useSystemEngineContext } from "@/core/SystemEngineContext";

/**
 * Hook para manejar las acciones de la actividad
 */
export const useActivityActions = (activity: Activity) => {
  const engine = useSystemEngineContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

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
      await engine.activity.unselectCurrentyActivity();
      return true; // Indica éxito para cerrar diálogos
    } catch (error) {
      console.error("Error en la acción:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Ha ocurrido un error al procesar la acción",
      });
      return false;
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

  return {
    isLoading,
    handleSelect,
    handleUnselect,
    handleCompleteChallenge,
    handleDelete,
  };
};

/**
 * Hook para manejar la edición de una actividad
 */
export const useActivityEdit = (activity: Activity) => {
  const engine = useSystemEngineContext();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);
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
        return false;
      }

      await engine.activity.updateActivity(activityUpdates);

      toast({
        title: "Actividad actualizada",
        description: "La actividad se ha actualizado correctamente",
      });

      return true;
    } catch (error) {
      console.error("Error al actualizar actividad:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "No se pudo actualizar la actividad",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    isLoading,
    editedTitle,
    setEditedTitle,
    editedAllowedTime,
    setEditedAllowedTime,
    editedTempoReward,
    setEditedTempoReward,
    editedConsumptionRate,
    setEditedConsumptionRate,
    inheritedConstraints,
    editedConstraints,
    setEditedConstraints,
    handleUpdateActivity,
  };
};

/**
 * Hook para manejar los constraints de un desafío
 */
export const useConstraintsManagement = (
  editedConstraints: ExpirationChallengeConstraint[],
  setEditedConstraints: React.Dispatch<React.SetStateAction<ExpirationChallengeConstraint[]>>
) => {
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

  return {
    handleAddConstraint,
    handleUpdateConstraint,
    handleRemoveConstraint,
    handleUpdateConstraintPenalty,
  };
};

/**
 * Hook para calcular el progreso de una actividad
 */
export const useActivityProgress = (activity: Activity) => {
  const engine = useSystemEngineContext();

  const progress = React.useMemo(() => {
    return engine.activity.calculateProgress(activity);
  }, [activity, engine.activity]);

  const isGeneratingTempo = React.useMemo(() => {
    if (activity.type === "challenge") {
      return activity.minutesActive < (activity as ChallengeActivity).totalTempoReward;
    }
    return false;
  }, [activity]);

  const exceededMinutes = React.useMemo(() => {
    if (activity.type === "challenge") {
      return (activity as ChallengeActivity).exceededMinutes ?? 0;
    }
    return 0;
  }, [activity]);

  return {
    progress,
    isGeneratingTempo,
    exceededMinutes,
  };
};
