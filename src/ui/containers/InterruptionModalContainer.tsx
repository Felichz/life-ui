import React, { useState } from "react";
import { useSystemCore } from "../hooks/useSystemCore";
import InterruptionModal from "../modals/InterruptionModal";
import type { UUID, ActivityInstance, InterruptionCause } from "../../types";

interface InterruptionModalContainerProps {
  open: boolean;
  onClose: () => void;
  activityId?: UUID;
  onInterruptSuccess?: (interruptedActivityId: UUID) => void;
}

/**
 * Contenedor para el modal de interrupción de actividades
 */
const InterruptionModalContainer: React.FC<InterruptionModalContainerProps> = ({
  open,
  onClose,
  activityId,
  onInterruptSuccess,
}) => {
  const {
    getInterruptionCauses,
    createInterruptionCause,
    interruptActivity,
    getActivityTemplates,
    getActiveActivity,
  } = useSystemCore();
  const [isCreatingCause, setIsCreatingCause] = useState(false);
  const [activityInstance, setActivityInstance] = useState<ActivityInstance | null>(null);

  // Cargar la actividad
  React.useEffect(() => {
    if (open && activityId) {
      // Obtendremos el título de la actividad desde su plantilla
      const activeInstance = getActiveActivity();
      if (activeInstance && activeInstance.id === activityId) {
        setActivityInstance(activeInstance);
      }
    } else {
      setActivityInstance(null);
    }
  }, [open, activityId]);

  // Obtener título de la actividad
  const activityTitle = React.useMemo(() => {
    if (!activityInstance) return undefined;

    // Buscar la plantilla para obtener el título
    const templates = getActivityTemplates();
    const template = templates.find((t) => t.id === activityInstance.templateId);
    return template?.title || "Actividad sin título";
  }, [activityInstance, getActivityTemplates]);

  // Manejo de la confirmación
  const handleConfirm = async (_isAvoidable: boolean, _causeId?: UUID) => {
    if (!activityId) return;

    try {
      // Schema v2+: interruptActivity ya no toma isAvoidable ni causeId.
      // Mantenemos los parámetros legacy por compatibilidad con InterruptionModal UI
      // pero el core los ignora. Phase 10 eliminará el modal completo.
      const interruptedActivity = interruptActivity(activityId);

      onClose();

      if (onInterruptSuccess) {
        onInterruptSuccess(interruptedActivity.id);
      }
    } catch (error) {
      console.error("Error al interrumpir actividad:", error);
    }
  };

  // Crear una nueva causa
  const handleCreateCause = async (description: string): Promise<InterruptionCause | null> => {
    if (!description.trim()) return null;

    try {
      setIsCreatingCause(true);
      const newCause = createInterruptionCause(description.trim());
      return newCause;
    } catch (error) {
      console.error("Error al crear causa:", error);
      return null;
    } finally {
      setIsCreatingCause(false);
    }
  };

  return (
    <InterruptionModal
      open={open}
      onClose={onClose}
      activityTitle={activityTitle}
      causes={getInterruptionCauses()}
      isCreatingCause={isCreatingCause}
      onConfirm={handleConfirm}
      onCreateCause={handleCreateCause}
    />
  );
};

export default InterruptionModalContainer;
