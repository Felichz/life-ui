import React from "react";

import { ClearDataButton } from "./ClearDataButton";
import { TestModeToggle } from "./TestModeToggle";
import { TimeMultiplierControl } from "./TimeMultiplierControl";

import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

export const TestModeBar = () => {
  const { uiState } = useUiStateContext();

  if (!uiState.systemParams.isTestMode) {
    return (
      <div className="w-full bg-background border-b px-4 py-2">
        <div className="flex justify-end">
          <TestModeToggle />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-background border-b px-4 py-2">
      <div className="flex items-center justify-end gap-4">
        <TestModeToggle />
        <div className="h-8 w-px bg-border" />
        <TimeMultiplierControl />
        <div className="h-8 w-px bg-border" />
        <ClearDataButton />
      </div>
    </div>
  );
};
