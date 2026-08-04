import { useState } from "react";
import { Box, Alert, Snackbar } from "@mui/material";
import QuickBar from "../components/QuickBar";
import ActivityInstanceModal from "../modals/ActivityInstanceModal";
import { useSystemCore } from "../hooks/useSystemCore";
import type { ActivityTemplate, UUID, DynamicSettings } from "../../types";

const QuickBarContainer = () => {
  // Obtener core y estado desde el contexto
  const {
    getActivityTemplates,
    getActiveActivity,
    isDayActive,
    activateActivity,
    createActivityInstance,
    getCurrentTimeBlock,
    getTimeBlocks,
  } = useSystemCore();

  // Estados para gestionar la UI
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<UUID | null>(null);
  const [targetBlockId, setTargetBlockId] = useState<UUID | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingActivityId, setLoadingActivityId] = useState<UUID | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Filtrar solo actividades del sistema
  const systemActivities: ActivityTemplate[] = getActivityTemplates().filter(
    (a: ActivityTemplate) => a.isSystemActivity
  );
  const activeActivity = getActiveActivity();

  // Función para encontrar el bloque de tiempo adecuado
  const getTargetBlockId = (): UUID | null => {
    // Primero intentar usar el bloque actual según la hora
    const currentBlock = getCurrentTimeBlock();
    if (currentBlock) return currentBlock.id;

    // Si no hay bloque actual, usar el bloque "Por Hacer"
    const todoBlock = getTimeBlocks().find((block) => block.isDefault);
    return todoBlock?.id || null;
  };

  // Determina si una actividad requiere configuración dinámica
  const needsConfiguration = (template: ActivityTemplate): boolean => {
    if (template.type === "clear-objective" && template.clearObjectiveSettings) {
      return true;
    }
    if (template.type === "flexible-duration" && template.flexibleDurationSettings) {
      return true;
    }
    if (template.type === "timeboxing" && template.timeboxingSettings) {
      return true;
    }
    return false;
  };

  // Handler de selección
  const handleSelect = (activityId: UUID) => {
    if (!isDayActive()) return;

    // Si la actividad ya está activa, no hacer nada
    if (activeActivity && activeActivity.templateId === activityId) return;

    // Buscar la plantilla seleccionada
    const selectedTemplate = systemActivities.find((a) => a.id === activityId);
    if (!selectedTemplate) return;

    // Obtener el bloque destino
    const blockId = getTargetBlockId();
    if (!blockId) {
      setError("No hay bloques de tiempo disponibles");
      return;
    }

    // Determinar si necesita configuración dinámica
    if (needsConfiguration(selectedTemplate)) {
      // Guardar datos para el modal
      setSelectedTemplateId(activityId);
      setTargetBlockId(blockId);
      setIsModalOpen(true);
    } else {
      // Activar directamente
      handleDirectActivation(activityId);
    }
  };

  // Activación directa sin configuración
  const handleDirectActivation = (activityId: UUID) => {
    setIsLoading(true);
    setLoadingActivityId(activityId);
    setError(null);

    try {
      // Si hay actividad activa, NO auto-completar: el core ahora exige completion explícito.
      // La UI debe mostrar el CompletionModal antes de permitir el cambio.
      if (activeActivity) {
        setError("Hay una actividad activa. Ciérrala primero desde el kanban antes de cambiar.");
        setIsLoading(false);
        setLoadingActivityId(null);
        return;
      }

      activateActivity(activityId);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al activar: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingActivityId(null);
    }
  };

  // Manejar confirmación del modal con configuración dinámica
  const handleModalConfirm = (
    templateId: UUID,
    blockId: UUID,
    dynamicSettings: DynamicSettings
  ) => {
    setIsLoading(true);
    setLoadingActivityId(templateId);
    setError(null);

    try {
      // Si hay actividad activa, NO auto-completar.
      if (activeActivity) {
        setError("Hay una actividad activa. Ciérrala primero desde el kanban antes de crear otra.");
        setIsLoading(false);
        setLoadingActivityId(null);
        return;
      }

      const instance = createActivityInstance(templateId, blockId, dynamicSettings);
      activateActivity(instance.id);

      setIsModalOpen(false);
      setSelectedTemplateId(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Error desconocido";
      setError(`Error al crear/activar: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingActivityId(null);
    }
  };

  // Cerrar modal
  const handleModalClose = () => {
    setIsModalOpen(false);
    setSelectedTemplateId(null);
    setTargetBlockId(null);
  };

  // Cerrar alerta de error
  const handleErrorClose = () => {
    setError(null);
  };

  // No mostrar si no hay día activo
  if (!isDayActive()) return null;

  return (
    <Box sx={{ width: "100%" }}>
      <QuickBar
        systemActivities={systemActivities}
        activeActivityId={activeActivity?.templateId}
        onSelect={handleSelect}
        isLoading={isLoading}
        loadingActivityId={loadingActivityId || undefined}
      />

      {/* Modal de configuración dinámica */}
      {isModalOpen && (
        <ActivityInstanceModal
          open={isModalOpen}
          onClose={handleModalClose}
          templateId={selectedTemplateId}
          blockId={targetBlockId}
          onConfirm={handleModalConfirm}
        />
      )}

      {/* Alerta de error */}
      <Snackbar
        open={!!error}
        autoHideDuration={6000}
        onClose={handleErrorClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="error" onClose={handleErrorClose}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default QuickBarContainer;
