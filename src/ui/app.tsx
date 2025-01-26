import { useUiStateContext } from "./system-context/useUiStateContext";

import { SystemEngineProvider } from "@/core/SystemEngineContext";
import MainLayout from "@/ui/components/MainLayout";
import { TooltipProvider } from "@/ui/components/shadcn/tooltip";

import "./app.css";

function App() {
  const { uiState, setUiState } = useUiStateContext();

  return (
    <TooltipProvider>
      <SystemEngineProvider uiState={uiState} setUiState={setUiState}>
        <MainLayout />
      </SystemEngineProvider>
    </TooltipProvider>
  );
}

export default App;
