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

  // Función auxiliar para verificar si un droppableId es una librería
  const isLibrary = (droppableId: string): boolean => {
    return droppableId === "library";
  };

  const handleDragEnd = useCallback(
    (result: DropResult) => {
      setIsDragging(false);
      setDraggedTemplateId(null);
      setDraggedSource(null);

      // Debugging detallado del resultado
      console.log("Drag end result:", JSON.stringify(result, null, 2));

      // Siempre notificar al callback si está definido
      if (options.onDragEnd) {
        options.onDragEnd(result);
      }

      const { source, destination, draggableId } = result;

      // Si no hay destino, se canceló el drag
      if (!destination) {
        console.log("No destination, drag was cancelled");
        return;
      }

      // No hacer nada si el origen y destino son iguales y el índice no cambió
      if (source.droppableId === destination.droppableId && source.index === destination.index) {
        console.log("Source and destination are the same with the same index, no action needed");
        return;
      }

      console.log(
        `Source droppableId: ${source.droppableId}, Destination droppableId: ${destination.droppableId}`
      );

      // Caso 1: Arrastrar desde biblioteca a un bloque
      if (isLibrary(source.droppableId)) {
        console.log("Caso 1: Library → Block");
        const blockId = destination.droppableId;
        openConfigModal(draggableId, blockId);
        return;
      }

      // Caso 2: Reordenar dentro de un bloque o entre bloques
      if (!isLibrary(source.droppableId) && !isLibrary(destination.droppableId)) {
        console.log("Caso 2: Block → Block");
        const targetBlockId = destination.droppableId;

        try {
          console.log(
            `Calling moveActivityInstance(${draggableId}, ${targetBlockId}, ${destination.index})`
          );
          moveActivityInstance(draggableId, targetBlockId, destination.index);
          console.log("Move completed successfully");
        } catch (error) {
          console.error("Error moving activity instance:", error);
        }
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
