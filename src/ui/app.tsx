import { useEffect } from "react";

import { systemApi, useSystemEngine } from "@core";
import ReactJson from "react-json-view";

import { useUiStateContext } from "./system-context/useUiStateContext";
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

  return (
    <div className="state-display">
      <h2>Estado del Sistema</h2>
      <ReactJson
        src={uiState}
        theme="monokai"
        collapsed={1}
        displayDataTypes={false}
        enableClipboard={true}
        style={{
          padding: "1.5rem",
          borderRadius: "8px",
          backgroundColor: "#2d2d2d",
          fontSize: "1rem",
          height: "calc(100vh - 100px)",
          overflowY: "auto",
        }}
      />
    </div>
  );
}

export default App;
