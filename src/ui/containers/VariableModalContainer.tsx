import React, { useState } from "react";
import { useSystemCore } from "../hooks/useSystemCore";
import VariableModal from "../modals/VariableModal";
import type { UUID } from "../../types";

interface VariableModalContainerProps {
  open: boolean;
  onClose: () => void;
  relatedActivityIds?: UUID[];
  relatedEventIds?: UUID[];
  onSuccess?: () => void;
}

/**
 * Contenedor para el modal de variables subjetivas
 */
const VariableModalContainer: React.FC<VariableModalContainerProps> = ({
  open,
  onClose,
  relatedActivityIds = [],
  relatedEventIds = [],
  onSuccess,
}) => {
  const { createSnapshot } = useSystemCore();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = (
    values: { variableId: UUID; currentValue: number }[],
    selectedActivityIds: UUID[],
    selectedEventIds: UUID[]
  ) => {
    setIsProcessing(true);

    try {
      // Crear snapshot con los valores y referencias seleccionados
      const snapshot = createSnapshot(values, selectedActivityIds, selectedEventIds);

      // Verificar que se haya creado correctamente
      if (snapshot) {
        if (onSuccess) {
          onSuccess();
        }

        // Cerrar el modal
        onClose();
      } else {
        // Si retorna null, es porque no se pudo crear (restricción temporal)
        // El modal ya muestra este error, así que solo terminamos el procesamiento
        setIsProcessing(false);
      }
    } catch (error) {
      console.error("Error al crear snapshot:", error);
      setIsProcessing(false);
    }
  };

  return (
    <VariableModal
      open={open}
      onClose={onClose}
      relatedActivityIds={relatedActivityIds}
      relatedEventIds={relatedEventIds}
      onConfirm={handleConfirm}
    />
  );
};

export default VariableModalContainer;
