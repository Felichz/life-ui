import React from "react";
import { useSystem } from "../contexts/SystemContext";
import { Slider } from "./shadcn/slider";
import { Card } from "./shadcn/card";

const SubjectiveStatePanel: React.FC = () => {
  const system = useSystem();

  const updateStateVariables = (): void => {
    // Función vacía para actualizar variables subjetivas
  };

  const createSnapshot = (): void => {
    // Función vacía para crear una instantánea de las variables
  };

  return (
    <div className="subjective-state-panel">
      <Card>
        <h2>Estado Subjetivo</h2>
        <div className="variables-container">{/* Variables subjetivas con sliders */}</div>
        <button onClick={createSnapshot}>Guardar Instantánea</button>
      </Card>
    </div>
  );
};

export default SubjectiveStatePanel;
