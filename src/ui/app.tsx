import { useUiStateContext } from "./system-context/useUiStateContext";

import { SystemEngineProvider } from "@/core/SystemEngineContext";
import MainLayout from "@/ui/components/MainLayout";
import { TooltipProvider } from "@/ui/components/shadcn/tooltip";
import { ThemeProvider } from "@/ui/providers/theme-provider";

import "./app.css";

function App() {
  const { uiState, setUiState } = useUiStateContext();

  return (
    <ThemeProvider defaultTheme="system" storageKey="qualia-theme">
      <TooltipProvider>
        <SystemEngineProvider uiState={uiState} setUiState={setUiState}>
          <MainLayout />
        </SystemEngineProvider>
      </TooltipProvider>
    </ThemeProvider>
  );
}

export default App;
