import { useEffect } from "react";

import { systemApi, useSystemEngine } from "@core";

import { useUiStateContext } from "./system-context/useUiStateContext";
import "./app.css";

function App() {
  const { uiState, setUiState } = useUiStateContext();
  const systemEngine = useSystemEngine({ uiState, setUiState, systemApi });

  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as unknown as any;

    w.systemEngine = systemEngine;
  }, []);

  return (
    <div className="state-display">
      <h2>Estado del Sistema</h2>

      <div>
        <h3>Estado General</h3>
        <p>Actualizando: {uiState.updatingSystemState ? "Sí" : "No"}</p>
        <p>Balance de Tempo: {uiState.totalTempoBalance}</p>
        <p>
          Día Actual:{" "}
          {uiState.currentDay
            ? new Date(uiState.currentDay.date).toLocaleDateString()
            : "No definido"}
        </p>
        <p>Estado del Ciclo: {uiState.lifecycleState}</p>
        <p>
          Actividad Seleccionada:{" "}
          {uiState.selectedActivity ? uiState.selectedActivity.title : "Ninguna"}
        </p>
      </div>

      <div>
        <h3>Métricas Útiles</h3>
        <h4>Minutos Invertidos:</h4>
        <ul>
          <li>
            Productividad Intrínseca:{" "}
            {uiState.usefulMetrics.totalMinutesInvested.intrinsecProductivity}
          </li>
          <li>Desafíos: {uiState.usefulMetrics.totalMinutesInvested.challenges}</li>
          <li>Pasatiempos: {uiState.usefulMetrics.totalMinutesInvested.hobbies}</li>
          <li>Descanso: {uiState.usefulMetrics.totalMinutesInvested.rest}</li>
          <li>Otros: {uiState.usefulMetrics.totalMinutesInvested.other}</li>
        </ul>
        <p>Tempos Generados Total: {uiState.usefulMetrics.totalGeneratedTemposEver}</p>
      </div>

      <div>
        <h3>Parámetros del Sistema</h3>
        <p>Tasa de Consumo Pasivo: {uiState.systemParams.passiveTempoConsumptionRate}</p>
      </div>

      <div>
        <h3>Tableros</h3>
        <p>Cantidad: {uiState.boards.length}</p>
        <ul>
          {uiState.boards.map((board) => (
            <li key={board.id}>{board.title}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Actividades</h3>
        <p>Cantidad: {uiState.activities.length}</p>
        <ul>
          {uiState.activities.map((activity) => (
            <li key={activity.id}>
              {activity.title} ({activity.type})
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3>Historial de Tiempo Invertido</h3>
        <p>Entradas: {uiState.investedTimeHistory.length}</p>
        <ul>
          {uiState.investedTimeHistory.slice(-5).map((record, index) => (
            <li key={index}>
              {new Date(record.timestamp).toLocaleTimeString()} -
              {record.status === "activity" ? ` Actividad: ${record.type}` : " Idle"} -
              {record.minutesInvested} minutos
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default App;
