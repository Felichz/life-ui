import { useCallback } from "react";

import { Clock } from "lucide-react";

import { Toggle } from "./shadcn/toggle";
import { useUiStateContext } from "../system-context/useUiStateContext";
import { useSystemEngineContext } from "@/core/SystemEngineContext";

export const TestModeToggle = () => {
  const { uiState } = useUiStateContext();
  const { updateSystemParams } = useSystemEngineContext();

  const handleToggle = useCallback(async () => {
    // Solo permitimos activar el modo de prueba, no desactivarlo
    if (!uiState.systemParams.isTestMode) {
      await updateSystemParams({
        ...uiState.systemParams,
        isTestMode: true,
        timeMultiplier: 1,
      });
    }
  }, [uiState.systemParams, updateSystemParams]);

  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={uiState.systemParams.isTestMode}
      onPressedChange={handleToggle}
      aria-label="Activar modo de prueba"
      disabled={uiState.systemParams.isTestMode}
      title={
        uiState.systemParams.isTestMode
          ? "Modo de prueba activado. Para volver al modo normal, borra los datos persistidos y reinicia la aplicación."
          : "Activar modo de prueba"
      }
    >
      <Clock className="h-4 w-4" />
      <span className="text-xs">Modo prueba</span>
    </Toggle>
  );
};
