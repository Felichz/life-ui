import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import EventQuickBarContainer from "../containers/EventQuickBarContainer";
import { useSystemCore } from "../hooks/useSystemCore";
import type { EventTemplate } from "../../types";

jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

describe("EventQuickBarContainer", () => {
  const createEventInstanceMock = jest.fn();
  const isDayActiveMock = jest.fn();

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
    createEventInstanceMock.mockReset();
    isDayActiveMock.mockReset();
    isDayActiveMock.mockReturnValue(true);

    createEventInstanceMock.mockImplementation((templateId) => ({
      id: "event-instance-1",
      templateId,
      templateName: mockTemplates.find((t) => t.id === templateId)?.name || "",
      timestamp: "2023-01-01T12:00:00Z",
      dayId: "day-1",
      createdAt: "2023-01-01T12:00:00Z",
    }));

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
    isDayActiveMock.mockReturnValue(false);

    const { container } = render(<EventQuickBarContainer />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renderiza correctamente los botones de eventos", () => {
    render(<EventQuickBarContainer />);

    expect(screen.getByText("Tomar café")).toBeInTheDocument();
    expect(screen.getByText("Reunión de equipo")).toBeInTheDocument();
  });

  it("crea una instancia de evento al hacer clic en un botón", () => {
    render(<EventQuickBarContainer />);

    const eventButton = screen.getByText("Tomar café");
    fireEvent.click(eventButton);

    expect(createEventInstanceMock).toHaveBeenCalledWith("event-1");
  });

  it("muestra error cuando falla la creación de instancia", async () => {
    createEventInstanceMock.mockImplementation(() => {
      throw new Error("Error de prueba");
    });

    render(<EventQuickBarContainer />);

    const eventButton = screen.getByText("Tomar café");
    fireEvent.click(eventButton);

    await waitFor(() => {
      expect(screen.getByText("Error al registrar evento: Error de prueba")).toBeInTheDocument();
    });
  });
});
