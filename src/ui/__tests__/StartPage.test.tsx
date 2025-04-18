/**
 * Tests para StartPage
 *
 * Pendiente de implementar cuando se configure el framework de pruebas.
 *
 * Los tests a implementar serán:
 *
 * 1. Verificar que se muestre el botón "Comenzar día" cuando no hay día activo
 * 2. Verificar que se muestre el mensaje de bienvenida cuando es el primer uso
 * 3. Verificar que se llame a startDay cuando se hace clic en "Comenzar día"
 * 4. Verificar que se redirija a la página principal después de iniciar el día
 * 5. Verificar que se muestren correctamente los datos del último día si existe
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import React from "react";
import StartPage from "../pages/StartPage";
import { useSystemCore } from "../context/SystemProvider";

// Mock del useNavigate
const mockNavigate = jest.fn();

// Mocks necesarios para la mayoría de tests
const defaultMock = {
  startDay: jest.fn(),
  isDayActive: jest.fn(() => false),
  state: {
    global: {
      days: [],
      completedActivityRecords: [],
    },
  },
  getCompletionRate: jest.fn(() => 0.75),
  getTimeDistributionData: jest.fn(() => ({})),
};

// Mock para el test de día anterior
const mockWithPreviousDay = {
  startDay: jest.fn(),
  isDayActive: jest.fn(() => false),
  state: {
    global: {
      days: [
        {
          id: "last-day-123",
          startTime: "2023-01-01T08:00:00.000Z",
          endTime: "2023-01-01T18:00:00.000Z",
          state: "inactive",
          createdAt: "2023-01-01T08:00:00.000Z",
          updatedAt: "2023-01-01T18:00:00.000Z",
        },
      ],
      completedActivityRecords: [{ dayId: "last-day-123" }, { dayId: "last-day-123" }],
    },
  },
  getCompletionRate: jest.fn(() => 0.75),
  getTimeDistributionData: jest.fn(() => ({})),
};

// Mock de los módulos
jest.mock("../context/SystemProvider", () => ({
  useSystemCore: jest.fn(() => defaultMock),
}));

jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

describe("StartPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(() => defaultMock);
  });

  test("muestra botón 'Comenzar día' cuando no hay día activo", () => {
    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    expect(screen.getByText("Comenzar día")).toBeDefined();
  });

  test("muestra mensaje de bienvenida cuando es el primer uso", () => {
    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/Bienvenido a Qualia Control/)).toBeDefined();
  });

  test("llama a startDay cuando se hace clic en 'Comenzar día'", async () => {
    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    const startButton = screen.getByText("Comenzar día");
    fireEvent.click(startButton);

    // Verificar que la función startDay fue llamada
    expect(defaultMock.startDay).toHaveBeenCalledTimes(1);
  });

  test("redirige a página principal después de iniciar el día", async () => {
    jest.useFakeTimers();

    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    const startButton = screen.getByText("Comenzar día");
    fireEvent.click(startButton);

    jest.advanceTimersByTime(510); // Avanzar más allá del setTimeout

    expect(mockNavigate).toHaveBeenCalledWith("/");

    jest.useRealTimers();
  });

  test("redirige a página principal si ya hay un día activo", () => {
    // Sobreescribir la implementación para este test
    defaultMock.isDayActive.mockReturnValueOnce(true);

    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  test("muestra datos del último día cuando existe", () => {
    // Configuramos un mock con datos históricos para este test específico
    (useSystemCore as jest.Mock).mockImplementation(() => mockWithPreviousDay);

    render(
      <MemoryRouter>
        <StartPage />
      </MemoryRouter>
    );

    // Verificar que se muestre el resumen del día anterior
    expect(screen.getByText("Resumen del día anterior")).toBeDefined();
    expect(screen.getByText("Tasa de completación")).toBeDefined();
    expect(screen.getByText("75%")).toBeDefined(); // 0.75 -> 75%
    expect(screen.getByText("Actividades completadas")).toBeDefined();
    expect(screen.getByText("2")).toBeDefined(); // 2 actividades completadas
    expect(screen.getByText("10h")).toBeDefined(); // Diferencia de 10 horas
  });
});
