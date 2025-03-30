import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";
import { System } from "../../../system";
import { SystemContextProvider, useSystem } from "../SystemContext";

// Mock del System
jest.mock("../../../system", () => ({
  System: {
    getInstance: jest.fn(),
  },
}));

describe("SystemContext", () => {
  // Componente de prueba que usa el hook useSystem
  const TestComponent = () => {
    const system = useSystem();
    return (
      <div data-testid="test-component">
        {system ? "System encontrado" : "System no encontrado"}
      </div>
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("SystemContextProvider", () => {
    test("debe proveer la instancia de System a sus hijos", () => {
      // Arrange
      const mockSystem = { test: "mocked system instance" };
      (System.getInstance as jest.Mock).mockReturnValue(mockSystem);

      // Act
      const { getByTestId } = render(
        <SystemContextProvider>
          <TestComponent />
        </SystemContextProvider>
      );

      expect(System.getInstance).toHaveBeenCalledTimes(1);
      expect(getByTestId("test-component")).toHaveTextContent("System encontrado");
    });
  });

  describe("useSystem hook", () => {
    test("debe lanzar error cuando se usa fuera de SystemContextProvider", () => {
      // Arrange
      const consoleError = console.error;
      console.error = jest.fn(); // Suprimir errores de consola durante el test

      // Act & Assert
      expect(() => {
        render(<TestComponent />);
      }).toThrow("useSystem debe usarse dentro de SystemContextProvider");

      console.error = consoleError; // Restaurar console.error
    });
  });
});
