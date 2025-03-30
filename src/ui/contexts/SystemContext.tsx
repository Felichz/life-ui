import React, { createContext, useContext } from "react";
import { System } from "../../system"; // Importa system desde src/system/index.ts

const SystemContext = createContext<System | null>(null);

export const SystemContextProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const system = System.getInstance(); // Obtiene la instancia singleton de System
  return <SystemContext.Provider value={system}>{children}</SystemContext.Provider>;
};

export const useSystem = (): System => {
  const context = useContext(SystemContext);
  if (!context) throw new Error("useSystem debe usarse dentro de SystemContextProvider");
  return context;
};
