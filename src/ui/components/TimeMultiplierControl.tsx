import { useCallback, useState, useEffect } from "react";

import { FastForward, Pause, Play, RotateCcw } from "lucide-react";

import { useUiStateContext } from "../system-context/useUiStateContext";

import { useSystemEngineContext } from "@/core/SystemEngineContext";

export const TimeMultiplierControl = () => {
  const { uiState } = useUiStateContext();
  const { updateSystemParams } = useSystemEngineContext();
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
      <input
        type="number"
        min={0}
        step={1}
        value={inputMultiplier}
        onChange={(e) => setInputMultiplier(Math.max(0, parseInt(e.target.value) || 0))}
        className="w-20 px-2 py-1 text-sm border rounded text-foreground bg-background"
        placeholder="Multiplicador"
      />
      <button
        onClick={handleApply}
        disabled={inputMultiplier === uiState.systemParams.timeMultiplier}
        className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <FastForward className="w-4 h-4" />
      </button>
      <button
        onClick={isPaused ? handleResume : handlePause}
        className="px-3 py-1 text-sm text-white bg-gray-500 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title={isPaused ? "Reanudar simulación" : "Pausar simulación"}
      >
        {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
      </button>
      <button
        onClick={handleReset}
        disabled={uiState.systemParams.timeMultiplier === 1}
        className="px-3 py-1 text-sm text-white bg-gray-500 rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Restablecer velocidad normal (x1)"
      >
        <RotateCcw className="w-4 h-4" />
      </button>
      <button
        onClick={() =>
          updateSystemParams({
            ...uiState.systemParams,
            timeMultiplier: 60,
          })
        }
        disabled={uiState.systemParams.timeMultiplier === 60}
        className="px-3 py-1 text-sm text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
        title="Establecer velocidad x60"
      >
        x60
      </button>
    </div>
  );
};
