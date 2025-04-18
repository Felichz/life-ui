import React from "react";
import { render, screen, act } from "@testing-library/react";
import ActivityTimer from "../ActivityTimer";

// Mock para requestAnimationFrame
const originalRAF = global.requestAnimationFrame;
const originalCancelRAF = global.cancelAnimationFrame;

describe("ActivityTimer", () => {
  // Variable para almacenar la callback de requestAnimationFrame
  let rafCallback: FrameRequestCallback | null = null;

  beforeEach(() => {
    // Configurar mock directo para Date.now() en lugar de mockear el constructor
    jest.spyOn(Date, "now").mockImplementation(() => 0); // Timestamp inicio = 0

    // Mock de requestAnimationFrame para control manual
    global.requestAnimationFrame = jest.fn((callback) => {
      // Guardamos la referencia a la callback en lugar de ejecutarla inmediatamente
      rafCallback = callback;
      return 1; // ID del request
    });

    global.cancelAnimationFrame = jest.fn();
  });

  afterEach(() => {
    // Restaurar mocks originales
    jest.restoreAllMocks();
    global.requestAnimationFrame = originalRAF;
    global.cancelAnimationFrame = originalCancelRAF;
    rafCallback = null;
  });

  test("debería renderizar correctamente con el formato MM:SS", () => {
    // Usar tiempo cero como referencia (el timer mostraría 00:00)
    render(<ActivityTimer startTime="2023-01-01T00:00:00Z" />);

    expect(screen.getByTestId("activity-timer")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });

  test("debería actualizar el tiempo transcurrido", () => {
    // Mock de Date.now antes de renderizar
    const mockStartTime = new Date("2023-01-01T00:00:00Z").getTime();
    jest.spyOn(Date, "now").mockImplementation(() => mockStartTime);

    // Renderizamos con tiempo específico
    const { rerender } = render(<ActivityTimer startTime="2023-01-01T00:00:00Z" />);

    // Inicialmente 00:00
    expect(screen.getByText("00:00")).toBeInTheDocument();

    // Cambiar el mock para simular que han pasado 65 segundos desde el inicio
    jest.spyOn(Date, "now").mockImplementation(() => mockStartTime + 65000);

    // Ejecutar manualmente la callback de requestAnimationFrame si existe
    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    // Debería mostrar 01:05
    expect(screen.getByText("01:05")).toBeInTheDocument();

    // Cambiar el mock para simular que han pasado 10 minutos desde el inicio
    jest.spyOn(Date, "now").mockImplementation(() => mockStartTime + 600000);

    // Ejecutar manualmente la callback de requestAnimationFrame si existe
    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    // Debería mostrar 10:00
    expect(screen.getByText("10:00")).toBeInTheDocument();
  });

  test("debería calcular correctamente el tiempo transcurrido desde startTime", () => {
    // Establecer mock para que la hora actual sea 5 minutos después del startTime
    const startTimestamp = new Date("2023-01-01T00:00:00Z").getTime();
    jest.spyOn(Date, "now").mockImplementation(() => startTimestamp + 300000); // 5 minutos después

    render(<ActivityTimer startTime="2023-01-01T00:00:00Z" />);

    // Ejecutar manualmente la callback de requestAnimationFrame si existe
    if (rafCallback) {
      act(() => {
        rafCallback!(0);
      });
    }

    // Debería mostrar 05:00 (5 minutos)
    expect(screen.getByText("05:00")).toBeInTheDocument();
  });

  test("debería limpiar el requestAnimationFrame al desmontar", () => {
    const { unmount } = render(<ActivityTimer startTime="2023-01-01T00:00:00Z" />);

    unmount();

    // Verificar que se llamó a cancelAnimationFrame
    expect(global.cancelAnimationFrame).toHaveBeenCalled();
  });
});
