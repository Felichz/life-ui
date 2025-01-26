import { useCallback, useState, useEffect } from "react";

import { Check, FastForward, Pause, Play, RotateCcw, StepForward } from "lucide-react";

import { Tooltip, TooltipContent, TooltipTrigger } from "./shadcn/tooltip";
import { useUiStateContext } from "../system-context/useUiStateContext";

import { useSystemEngineContext } from "@/core/SystemEngineContext";

export const TimeMultiplierControl = () => {
  const { uiState } = useUiStateContext();
  const { updateSystemParams, advanceOneMinute } = useSystemEngineContext();
  const [inputMultiplier, setInputMultiplier] = useState<number>(
    uiState.systemParams.timeMultiplier
  );
  const [previousMultiplier, setPreviousMultiplier] = useState<number>(1);

  useEffect(() => {
    setInputMultiplier(uiState.systemParams.timeMultiplier);
  }, [uiState.systemParams.timeMultiplier]);

  const handleApply = useCallback(async () => {
    if (inputMultiplier === uiState.systemParams.timeMultiplier) return;
    await updateSystemParams({
      ...uiState.systemParams,
      timeMultiplier: inputMultiplier,
    });
  }, [inputMultiplier, uiState.systemParams, updateSystemParams]);

  const handleQuickApply = useCallback(async () => {
    await updateSystemParams({
      ...uiState.systemParams,
      timeMultiplier: 60,
    });
  }, [inputMultiplier, uiState.systemParams, updateSystemParams]);

  const handleReset = useCallback(async () => {
    await updateSystemParams({
      ...uiState.systemParams,
      timeMultiplier: 1,
    });
  }, [uiState.systemParams, updateSystemParams]);

  const handlePause = useCallback(async () => {
    setPreviousMultiplier(uiState.systemParams.timeMultiplier);
    await updateSystemParams({
      ...uiState.systemParams,
      timeMultiplier: 0,
    });
  }, [uiState.systemParams, updateSystemParams]);

  const handleResume = useCallback(async () => {
    await updateSystemParams({
      ...uiState.systemParams,
      timeMultiplier: previousMultiplier || 1,
    });
  }, [previousMultiplier, uiState.systemParams, updateSystemParams]);

  if (!uiState.systemParams.isTestMode) return null;

  const isPaused = uiState.systemParams.timeMultiplier === 0;

  return (
    <div className="flex items-center gap-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <input
            type="number"
            min={0}
            step={1}
            value={inputMultiplier}
            onChange={(e) => setInputMultiplier(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 px-2 py-1 text-sm border rounded text-foreground bg-background"
            placeholder="Multiplicador"
          />
        </TooltipTrigger>
        <TooltipContent>
          <p>Multiplicador de tiempo personalizado</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleApply}
            disabled={inputMultiplier === uiState.systemParams.timeMultiplier}
            className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Check className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Aplicar multiplicador personalizado</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={isPaused ? handleResume : handlePause}
            className="px-3 py-1 text-sm text-white bg-gray-500 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isPaused ? "Reanudar simulación" : "Pausar simulación"}</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleReset}
            disabled={uiState.systemParams.timeMultiplier === 1}
            className="px-3 py-1 text-sm text-white bg-gray-500 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Restablecer velocidad normal (x1)</p>
        </TooltipContent>
      </Tooltip>

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={handleQuickApply}
            disabled={uiState.systemParams.timeMultiplier === 60}
            className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            x60
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Establecer velocidad x60</p>
        </TooltipContent>
      </Tooltip>

      {isPaused && (
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={advanceOneMinute}
              className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600"
            >
              <StepForward className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Avanzar un minuto manualmente</p>
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
};
