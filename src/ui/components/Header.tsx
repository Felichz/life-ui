import React from "react";
import { useSystem } from "../contexts/SystemContext";

const Header: React.FC = () => {
  const system = useSystem();

  const handleNavigation = (): void => {
    // Función vacía para manejo de navegación
  };

  return (
    <header className="app-header">
      <h1>Qualia Control</h1>
      <nav className="main-navigation">{/* Elementos de navegación */}</nav>
    </header>
  );
};

export default Header;
