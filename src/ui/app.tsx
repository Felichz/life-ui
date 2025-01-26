import { useUiStateContext } from "./system-context/useUiStateContext";

import { SystemEngineProvider } from "@/core/SystemEngineContext";
import MainLayout from "@/ui/components/MainLayout";

import "./app.css";

function App() {
  const { uiState, setUiState } = useUiStateContext();

  return (
    <SystemEngineProvider uiState={uiState} setUiState={setUiState}>
      <MainLayout />
    </SystemEngineProvider>
  );
}

export default App;
