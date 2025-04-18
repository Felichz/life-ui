import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventQuickBarContainer from "../containers/EventQuickBarContainer";
import { useSystemCore } from "../hooks/useSystemCore";
import type { EventTemplate } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

// Mock de VariableModalContainer
jest.mock("../containers/VariableModalContainer", () => {
  return {
    __esModule: true,
    default: jest.fn(({ open, onClose, relatedEventIds }) => {
      return open ? (
        <div data-testid="variable-modal" data-event-ids={JSON.stringify(relatedEventIds)}>
          <button onClick={onClose}>Cerrar</button>
        </div>
      ) : null;
    }),
  };
});

describe("EventQuickBarContainer", () => {
  // Mocks de funciones del core
  const createEventInstanceMock = jest.fn();
  const isDayActiveMock = jest.fn();

  // Datos de prueba
  const mockTemplates: EventTemplate[] = [
    {
      id: "event-1",
      name: "Tomar café",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
    {
      id: "event-2",
      name: "Reunión de equipo",
      createdAt: "2023-01-01T12:00:00Z",
      updatedAt: "2023-01-01T12:00:00Z",
    },
  ];

  beforeEach(() => {
    // Reiniciar contadores de llamadas a funciones mock
    createEventInstanceMock.mockReset();
    isDayActiveMock.mockReset();

    // Establecer el valor por defecto para isDayActive
    isDayActiveMock.mockReturnValue(true);

    // Configurar implementaciones de mocks
    createEventInstanceMock.mockImplementation((templateId) => ({
      id: "event-instance-1",
      templateId,
      templateName: mockTemplates.find((t) => t.id === templateId)?.name || "",
      timestamp: "2023-01-01T12:00:00Z",
      dayId: "day-1",
      createdAt: "2023-01-01T12:00:00Z",
    }));

    // Configurar el mock del hook
    (useSystemCore as jest.Mock).mockReturnValue({
      state: {
        global: {
          eventTemplates: [...mockTemplates],
        },
        currentDay: {
          day: { id: "day-1" },
        },
      },
      createEventInstance: createEventInstanceMock,
      isDayActive: isDayActiveMock,
    });
  });

  it("no renderiza nada cuando no hay día activo", () => {
    // Sobrescribir el valor por defecto para este test específico
    isDayActiveMock.mockReturnValue(false);

    const { container } = render(<EventQuickBarContainer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza correctamente los botones de eventos", () => {
    render(<EventQuickBarContainer />);

    // Verificar que se muestran los botones para cada plantilla
    expect(screen.getByText("Tomar café")).toBeInTheDocument();
    expect(screen.getByText("Reunión de equipo")).toBeInTheDocument();
  });

  it("crea una instancia de evento al hacer clic en un botón", async () => {
    render(<EventQuickBarContainer />);

    // Hacer clic en el botón de evento
    const eventButton = screen.getByText("Tomar café");
    fireEvent.click(eventButton);

    // Verificar que se llamó a la función correcta
    expect(createEventInstanceMock).toHaveBeenCalledWith("event-1");

    // Verificar que se abrió el modal de variables con el ID del evento
    await waitFor(() => {
      const variableModal = screen.getByTestId("variable-modal");
      const eventIds = JSON.parse(variableModal.getAttribute("data-event-ids") || "[]");
      expect(eventIds).toContain("event-instance-1");
    });
  });

  it("cierra el modal de variables correctamente", async () => {
    render(<EventQuickBarContainer />);

    // Hacer clic en el botón de evento para abrir el modal
    const eventButton = screen.getByText("Tomar café");
    fireEvent.click(eventButton);

    // Verificar que se abrió el modal
    const variableModal = await screen.findByTestId("variable-modal");
    expect(variableModal).toBeInTheDocument();

    // Cerrar el modal
    const closeButton = screen.getByText("Cerrar");
    fireEvent.click(closeButton);

    // Verificar que se cerró el modal
    await waitFor(() => {
      expect(screen.queryByTestId("variable-modal")).not.toBeInTheDocument();
    });
  });

  it("muestra error cuando falla la creación de instancia", async () => {
    // Configurar mock para fallar
    createEventInstanceMock.mockImplementation(() => {
      throw new Error("Error de prueba");
    });

    render(<EventQuickBarContainer />);

    // Hacer clic en el botón de evento
    const eventButton = screen.getByText("Tomar café");
    fireEvent.click(eventButton);

    // Verificar que se muestra el error
    await waitFor(() => {
      expect(screen.getByText("Error al registrar evento: Error de prueba")).toBeInTheDocument();
    });
  });
});
