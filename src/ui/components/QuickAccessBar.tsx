import React from "react";
import { useSystem } from "../contexts/SystemContext";
import { Button } from "./shadcn/button";

const QuickAccessBar: React.FC = () => {
  const system = useSystem();

  const handleQuickAction = (action: string): void => {
    // Función vacía para manejar acción rápida
  };

  return (
    <div className="quick-access-bar">
      <Button onClick={() => handleQuickAction("meditation")}>Meditación</Button>
      <Button onClick={() => handleQuickAction("autopilot")}>Piloto Automático</Button>
      <Button onClick={() => handleQuickAction("water")}>Beber Agua</Button>
      <Button onClick={() => handleQuickAction("stretch")}>Estirar</Button>
      {/* Otros botones */}
    </div>
  );
};

export default QuickAccessBar;
