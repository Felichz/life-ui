import { useState, forwardRef, useImperativeHandle, useEffect, useMemo, useRef } from "react";
import { Box } from "@mui/material";
import { useSystemCore } from "../hooks/useSystemCore";
import { useCompletionFlow } from "../context/CompletionFlowContext";
import KanbanBoard from "../components/Kanban/Board";
import type { TimeBlockWithActivities } from "../components/Kanban/Board";
import type { TimeBlock, ActivityInstance, UUID, ActivityTemplate } from "../../types";
import type { DropResult } from "@hello-pangea/dnd";
import ActivityInstanceModal from "../modals/ActivityInstanceModal";
import { useDragDrop } from "../hooks/useDragDrop";

// Definición de la interfaz para la ref
export interface KanbanContainerHandle {
  handleDragEnd: (result: DropResult) => void;
}

const KanbanContainer = forwardRef<KanbanContainerHandle>((props, ref) => {
  // Obtener core y estado desde el contexto
  const {
    state,
    createActivityInstance,
    updateActivityInstance,
    activateActivity,
    isDayActive,
    isTimeBlockAvailable,
    getActivityTemplates,
  } = useSystemCore();

  // Flujo de cierre coordinado (CompletionModal vive en DayPage)
  const completionFlow = useCompletionFlow();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalData, setModalData] = useState<{
    templateId: UUID | null;
    blockId: UUID | null;
    instanceId?: UUID;
  }>({
    templateId: null,
    blockId: null,
  });
  const [isEditMode, setIsEditMode] = useState(false);
  // Flag para saber si el modal viene de activación (para activar después)
  const [isFromActivation, setIsFromActivation] = useState(false);

  const [pendingActivation, setPendingActivation] = useState<{
    activityId: UUID;
    templateId: UUID;
    blockId: UUID;
    dynamicSettings?: Record<string, unknown>;
  } | null>(null);

  // ID de la plantilla "Piloto Automático" (se cargará en useEffect)
  const [pilotoAutoId, setPilotoAutoId] = useState<UUID | null>(null);

  // Create a map for templateId -> title for efficient lookup
  const templateTitleMap = useMemo(() => {
    const templates = getActivityTemplates();
    const map: Record<UUID, string> = {};
    templates.forEach((t) => {
      map[t.id] = t.title;
    });
    return map;
  }, [getActivityTemplates]); // Recalculate only if templates function changes

  // Buscar el ID de la plantilla "Piloto Automático" al cargar
  useEffect(() => {
    // Buscar entre las plantillas del sistema
    const templates = getActivityTemplates();
    const pilotoAuto = templates.find(
      (t: ActivityTemplate) => t.isSystemActivity && t.title === "Piloto Automático"
    );

    if (pilotoAuto) {
      setPilotoAutoId(pilotoAuto.id);
    }
  }, [getActivityTemplates]);

  // Utilizar el hook useDragDrop
  const { handleDragEnd: onDragEnd, openConfigModal } = useDragDrop({
    onCreateActivityInstance: (templateId, blockId) => {
      setModalData({ templateId, blockId });
      setIsEditMode(false);
      setIsFromActivation(false);
      setIsModalOpen(true);
    },
  });

  // Exponer handleDragEnd para la ref
  useImperativeHandle(ref, () => ({
    handleDragEnd: onDragEnd,
  }));

  // Obtener bloques de tiempo
  const timeBlocks: TimeBlock[] =
    state.global.timeBlocks.length > 0
      ? state.global.timeBlocks
      : [
          {
            id: "default-todo",
            name: "Por Hacer",
            startMinute: 0,
            endMinute: 1439,
            isDefault: true,
            order: 0,
            createdAt: "",
            updatedAt: "",
          },
        ];

  // Obtener actividades instanciadas del día actual
  const activities: ActivityInstance[] = state.currentDay?.activityInstances || [];

  // Mapear bloques a columnas con actividades correspondientes, AÑADIENDO templateTitle
  const columns: TimeBlockWithActivities[] = useMemo(() => {
    return timeBlocks
      .sort((a, b) => a.order - b.order)
      .map((block) => ({
        block,
        activities: activities
          .filter((act) => act.blockId === block.id)
          .sort((a, b) => a.order - b.order)
          .map((act) => ({
            // Augment activity with title
            ...act,
            templateTitle:
              templateTitleMap[act.templateId] || `Actividad ${act.id.substring(0, 4)}`, // Add title or fallback
          })),
      }));
  }, [timeBlocks, activities, templateTitleMap]); // Recalculate if blocks, activities, or the title map change

  // Manejar la edición de una actividad
  const handleEditActivity = (activity: ActivityInstance) => {
    // Buscar la plantilla de la actividad
    const instanceTemplateId = activity.templateId;

    setModalData({
      templateId: instanceTemplateId,
      blockId: activity.blockId,
      instanceId: activity.id,
    });
    setIsEditMode(true);
    setIsFromActivation(false);
    setIsModalOpen(true);
  };

  // Manejar la activación de una actividad
  const handleActivateActivity = (activityId: UUID) => {
    if (!isDayActive()) return;

    // Buscar la instancia de actividad
    const activityInstance = activities.find((act) => act.id === activityId);
    if (!activityInstance) return;

    // Verificar si necesita configuración antes de activarse
    const needsConfiguration = (() => {
      if (activityInstance.timeboxingSettings) {
        const settings = activityInstance.timeboxingSettings;
        if (settings.type === "minimum-time" && !settings.minimumDurationMinutes) return true;
        if (settings.type === "maximum-time" && !settings.maximumDurationMinutes) return true;
        if (
          settings.type === "both" &&
          (!settings.minimumDurationMinutes || !settings.maximumDurationMinutes)
        )
          return true;
      }
      return false;
    })();

    if (needsConfiguration) {
      // Abrir el modal de configuración
      setModalData({
        templateId: activityInstance.templateId,
        blockId: activityInstance.blockId,
        instanceId: activityInstance.id,
      });
      setIsEditMode(true);
      setIsFromActivation(true); // Marcar que viene de activación
      setIsModalOpen(true);
    } else {
      // Activar con auto-continuación si hay activa
      handleActivateWithContinuation(
        activityInstance.id,
        activityInstance.templateId,
        activityInstance.blockId
      );
    }
  };

  // Activar con auto-continuación: si hay activa, primero pedir completion
  const handleActivateWithContinuation = (
    activityId: UUID,
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Record<string, unknown>
  ) => {
    if (!isDayActive()) return;

    try {
      const active = getActiveActivity();
      if (active && active.id !== activityId) {
        setPendingActivation({ activityId, templateId, blockId, dynamicSettings });
        completionFlow.requestCloseActive(
          active.id,
          () => {
            const pending = pendingActivationRef.current;
            setPendingActivation(null);
            if (pending) {
              try {
                if (pending.dynamicSettings) {
                  const inst = createActivityInstance(
                    pending.templateId,
                    pending.blockId,
                    pending.dynamicSettings as never
                  );
                  activateActivity(inst.id);
                } else {
                  activateActivity(pending.activityId);
                }
              } catch (e) {
                console.error("Error al activar pendiente:", e);
              }
            }
          },
          // El reward/record es manejado por DayPage (modal compartido)
          () => {},
          () => {}
        );
        return;
      }

      activateActivity(activityId);
    } catch (error) {
      console.error("Error al activar actividad:", error);
    }
  };

  // Ref para que el callback de continuation vea el valor más reciente
  const pendingActivationRef = useRef(pendingActivation);
  useEffect(() => {
    pendingActivationRef.current = pendingActivation;
  }, [pendingActivation]);

  // Manejar completar una actividad (botón "Completar" en la card)
  // DayPage renderiza el CompletionModal único y maneja el reward
  const handleCompleteActivity = (activityId: UUID) => {
    if (!isDayActive()) return;
    completionFlow.requestCloseActive(
      activityId,
      () => {},
      () => {},
      () => {}
    );
  };

  // Manejar la interrupción: usa el CompletionModal compartido (botón "No la terminé")
  const handleInterruptActivity = (activityId: UUID) => {
    if (!isDayActive()) return;
    completionFlow.requestCloseActive(
      activityId,
      () => {},
      () => {},
      () => {}
    );
  };

  // Crear o actualizar instancia de actividad desde el modal
  const handleConfirmActivityInstance = (
    templateId: UUID,
    blockId: UUID,
    dynamicSettings: Record<string, unknown>
  ) => {
    if (isEditMode && modalData.instanceId) {
      // Actualizar la instancia existente
      updateActivityInstance(modalData.instanceId, {
        ...dynamicSettings,
        blockId, // Por si se cambia de bloque
      });

      // Si venía de activación, activar después de actualizar
      if (isFromActivation) {
        activateActivity(modalData.instanceId);
      }
    } else {
      // Crear una nueva instancia
      createActivityInstance(templateId, blockId, dynamicSettings);
    }

    // Cerrar el modal y limpiar datos
    setIsModalOpen(false);
    setModalData({ templateId: null, blockId: null });
    setIsEditMode(false);
    setIsFromActivation(false);
  };

  // Manejar la interrupción: usa el CompletionModal compartido (botón "No la terminé")
  // (handleInterruptActivity ya está definido arriba, en línea ~252)

  return (
    <Box sx={{ width: "100%" }} data-testid="kanban-container">
      <Box sx={{ width: "100%" }} data-testid="kanban-container">
        <KanbanBoard
          columns={columns}
          onEditActivity={handleEditActivity}
          onActivateActivity={handleActivateActivity}
          onCompleteActivity={handleCompleteActivity}
          onInterruptActivity={handleInterruptActivity}
          isDayActive={isDayActive()}
          isTimeBlockAvailable={isTimeBlockAvailable}
        />
        <ActivityInstanceModal
          open={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setIsEditMode(false);
            setIsFromActivation(false);
          }}
          templateId={modalData.templateId}
          blockId={modalData.blockId}
          instanceId={modalData.instanceId}
          isEditMode={isEditMode}
          onConfirm={handleConfirmActivityInstance}
        />
      </Box>
    </Box>
  );
});

// Añadir displayName para mejorar debuggability
KanbanContainer.displayName = "KanbanContainer";

export default KanbanContainer;
