import { useState, useCallback } from "react";
import type { DragStart, DropResult } from "@hello-pangea/dnd";
import type { UUID } from "../../types";
import { useSystemCore } from "./useSystemCore";

interface UseDragDropOptions {
  onDragStart?: (templateId: UUID, source: string) => void;
  onDragEnd?: (result: DropResult) => void;
  onCreateActivityInstance?: (
    templateId: UUID,
    blockId: UUID,
    dynamicSettings?: Record<string, unknown>
  ) => void;
}

interface UseDragDropReturn {
  isDragging: boolean;
  draggedTemplateId: UUID | null;
  draggedSource: string | null;
  modalData: { templateId: UUID; blockId: UUID } | null;
  handleDragStart: (initial: DragStart) => void;
  handleDragEnd: (result: DropResult) => void;
  openConfigModal: (templateId: UUID, blockId: UUID) => void;
}

/**
 * Hook personalizado para gestionar operaciones de drag and drop en la aplicación
 */
export const useDragDrop = (options: UseDragDropOptions = {}): UseDragDropReturn => {
  const { moveActivityInstance } = useSystemCore();
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [draggedTemplateId, setDraggedTemplateId] = useState<UUID | null>(null);
  const [draggedSource, setDraggedSource] = useState<string | null>(null);
  const [modalData, setModalData] = useState<{ templateId: UUID; blockId: UUID } | null>(null);

  const handleDragStart = useCallback(
    (initial: DragStart) => {
      setIsDragging(true);
      const { draggableId, source } = initial;
      setDraggedTemplateId(draggableId);
      setDraggedSource(source.droppableId);

      if (options.onDragStart) {
        options.onDragStart(draggableId, source.droppableId);
      }
    },
    [options.onDragStart]
  );

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false);
      setDraggedTemplateId(null);
      setDraggedSource(null);

      // Siempre notificar al callback si está definido
      if (options.onDragEnd) {
        options.onDragEnd(result);
      }

      const { source, destination, draggableId } = result;

      // Para debugging
      console.log("Drag end result:", result);

      // Si no hay destino, se canceló el drag
      if (!destination) {
        return;
      }

      // No hacer nada si el origen y destino son iguales y el índice no cambió
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        return;
      }

      // Identificar el tipo de operación
      // 1. Arrastrar desde biblioteca a columna de Kanban
      if (source.droppableId === "library" && destination.droppableId.startsWith("block-")) {
        console.log("Biblioteca a Kanban: ", draggableId, destination.droppableId);
        const blockId = destination.droppableId.split("-")[1];
        openConfigModal(draggableId, blockId);
      }
      // 2. Reordenar dentro de una misma columna o entre columnas de Kanban
      else if (
        source.droppableId.startsWith("block-") &&
        destination.droppableId.startsWith("block-")
      ) {
        console.log("Reordenar en Kanban: ", draggableId, destination.droppableId);
        const targetBlockId = destination.droppableId.split("-")[1];
        moveActivityInstance(draggableId, targetBlockId, destination.index);
      }
    },
    [options.onDragEnd, moveActivityInstance]
  );

  const openConfigModal = useCallback(
    (templateId: UUID, blockId: UUID) => {
      console.log("Abriendo modal para configurar: ", templateId, blockId);
      setModalData({ templateId, blockId });
      if (options.onCreateActivityInstance) {
        options.onCreateActivityInstance(templateId, blockId);
      }
    },
    [options.onCreateActivityInstance]
  );

  return {
    isDragging,
    draggedTemplateId,
    draggedSource,
    modalData,
    handleDragStart,
    handleDragEnd,
    openConfigModal,
  };
};
