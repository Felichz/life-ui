import { useEffect } from "react";

import { systemApi, useSystemEngine } from "@/core";
import { useUiStateContext } from "@/system-context/useUiStateContext";
import "./app.css";

function App() {
  const { uiState, setUiState } = useUiStateContext();
  const systemEngine = useSystemEngine({ uiState, setUiState, systemApi });

  console.log("uiState", uiState);

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as unknown as any;

    w.systemEngine = systemEngine;
  }, [systemEngine]);

  return <></>;
}

export default App;
