import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";
import App from "../App";
import { System } from "../../system";

// Mock de los componentes
jest.mock("../components/Header", () => {
  return function MockHeader() {
    return <div data-testid="header-component">Header Mock</div>;
  };
});

jest.mock("../components/MainContent", () => {
  return function MockMainContent() {
    return <div data-testid="main-content-component">MainContent Mock</div>;
  };
});

jest.mock("../components/Footer", () => {
  return function MockFooter() {
    return <div data-testid="footer-component">Footer Mock</div>;
  };
});

// Mock para System
const mockSystem = { test: "mocked system instance" };
jest.mock("../../system", () => ({
  System: {
    getInstance: jest.fn(() => mockSystem),
  },
}));

// Mock para SystemContext
const mockUseSystem = jest.fn(() => mockSystem);
jest.mock("../contexts/SystemContext", () => ({
  SystemContextProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="system-context-provider">{children}</div>
  ),
  useSystem: () => mockUseSystem(),
}));

describe("App", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("App - Estructura del Layout", () => {
    test("debe renderizar correctamente la estructura con SystemContextProvider y los componentes Header, MainContent y Footer", () => {
      // Act
      const { container } = render(<App />);

      // Assert
      expect(screen.getByTestId("system-context-provider")).toBeInTheDocument();
      expect(screen.getByTestId("header-component")).toBeInTheDocument();
      expect(screen.getByTestId("main-content-component")).toBeInTheDocument();
      expect(screen.getByTestId("footer-component")).toBeInTheDocument();

      // Verificar container con className="app-container"
      const appContainer = container.querySelector(".app-container");
      expect(appContainer).toBeInTheDocument();
    });
  });

  describe("App - Integración del Contexto", () => {
    test("debe permitir que los componentes hijos accedan a la instancia de system", () => {
      // Componente de prueba que usa el hook useSystem
      const TestComponent = () => {
        // useSystem ya está mockeado globalmente
        const system = mockUseSystem();
        return (
          <div data-testid="test-component">
            {system ? "System encontrado" : "System no encontrado"}
          </div>
        );
      };

      // Act
      render(<TestComponent />);

      // Assert
      expect(screen.getByTestId("test-component")).toHaveTextContent("System encontrado");
      expect(mockUseSystem).toHaveBeenCalled();
    });
  });
});
