import React, { useState } from "react";
import { useSystemCore } from "../hooks/useSystemCore";
import ActivityLibraryModal from "../modals/ActivityLibraryModal";
import type { ActivityTemplate, UUID } from "../../types";

interface ActivityLibraryContainerProps {
  open: boolean;
  onClose: () => void;
  onCreateInstance?: (templateId: UUID, blockId: UUID) => void;
}

/**
 * Contenedor para la gestión del modal de biblioteca de actividades
 */
const ActivityLibraryContainer: React.FC<ActivityLibraryContainerProps> = ({
  open,
  onClose,
  onCreateInstance,
}) => {
  const {
    createActivityTemplate,
    updateActivityTemplate,
    deleteActivityTemplate,
    getActivityTemplates,
  } = useSystemCore();
  const [editingTemplate, setEditingTemplate] = useState<ActivityTemplate | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<UUID | null>(null);

  const handleOpenCreate = () => {
    setEditingTemplate(null);
  };

  const handleOpenEdit = (template: ActivityTemplate) => {
    setEditingTemplate(template);
  };

  const handleConfirmDelete = (templateId: UUID) => {
    setConfirmDeleteId(templateId);
  };

  const handleDelete = () => {
    if (confirmDeleteId) {
      deleteActivityTemplate(confirmDeleteId);
      setConfirmDeleteId(null);
    }
  };

  const handleCancelDelete = () => {
    setConfirmDeleteId(null);
  };

  const handleCloseModal = () => {
    // Limpiar estados al cerrar
    setEditingTemplate(null);
    setConfirmDeleteId(null);
    onClose();
  };

  const handleSaveTemplate = (data: Omit<ActivityTemplate, "id" | "createdAt" | "updatedAt">) => {
    if (editingTemplate) {
      // Modo edición
      updateActivityTemplate(editingTemplate.id, data);
    } else {
      // Modo creación
      createActivityTemplate(data);
    }
    setEditingTemplate(null);
  };

  const handleOpenInstanceModal = (templateId: UUID, blockId: UUID) => {
    if (onCreateInstance) {
      onCreateInstance(templateId, blockId);
    }
    onClose();
  };

  return (
    <ActivityLibraryModal
      open={open}
      onClose={handleCloseModal}
      onOpenCreate={handleOpenCreate}
      onOpenEdit={handleOpenEdit}
      onConfirmDelete={handleConfirmDelete}
      onDelete={handleDelete}
      onCancelDelete={handleCancelDelete}
      onSave={handleSaveTemplate}
      onOpenInstanceModal={handleOpenInstanceModal}
      editingTemplate={editingTemplate}
      confirmDeleteId={confirmDeleteId}
    />
  );
};

export default ActivityLibraryContainer;
