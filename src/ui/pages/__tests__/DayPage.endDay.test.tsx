import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DayPage from "../DayPage";
import { useSystemCore } from "../../hooks/useSystemCore";

// Mock useNavigate de react-router-dom
const mockNavigate = jest.fn();
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock del hook useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock del ConfirmEndDayModal para poder acceder a sus props
jest.mock("../../modals/ConfirmEndDayModal", () => {
  return {
    __esModule: true,
    default: jest.fn(({ open, onClose, onConfirm }) => (
      <div data-testid="confirm-end-day-modal" data-open={open}>
        <button onClick={onClose} data-testid="cancel-end-day-button">
          Cancelar
        </button>
        <button onClick={onConfirm} data-testid="confirm-end-day-button">
          Finalizar día
        </button>
      </div>
    )),
  };
});

// Mock de los componentes hijos para evitar renderizado completo
jest.mock("../../containers/KanbanContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="kanban-container">Kanban mocked</div>),
}));

jest.mock("../../containers/QuickBarContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="quickbar-container">QuickBar mocked</div>),
}));

jest.mock("../../containers/EventQuickBarContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="event-quickbar-container">EventQuickBar mocked</div>),
}));

jest.mock("../../containers/TimelineContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="timeline-container">Timeline mocked</div>),
}));

jest.mock("../../components/Common/TopBar", () => {
  return {
    __esModule: true,
    default: jest.fn(({ isDayActive, onEndDayClick, actionButtons }) => (
      <div data-testid="top-bar">
        {actionButtons}
        {isDayActive && (
          <button onClick={onEndDayClick} data-testid="end-day-button" aria-label="finalizar día">
            Finalizar día
          </button>
        )}
      </div>
    )),
  };
});

// Otros mocks necesarios para que el componente funcione
jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("DayPage - Finalizar día (T22)", () => {
  const mockActiveActivity = {
    id: "active-activity-id",
    templateId: "template-id",
    blockId: "block-id",
    order: 1,
    state: "active",
    startTime: "2023-01-01T12:00:00.000Z",
    createdAt: "2023-01-01T12:00:00.000Z",
    updatedAt: "2023-01-01T12:00:00.000Z",
  };

  // Configuración predeterminada del mock para useSystemCore
  const mockSystemCore = {
    isDayActive: jest.fn(() => true),
    getActiveActivity: jest.fn(() => mockActiveActivity),
    completeActivity: jest.fn(),
    endDay: jest.fn(),
    canUpdateVariables: jest.fn(() => true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(() => mockSystemCore);
  });

  test("flujo feliz: finaliza día, completa actividad activa y redirige a overview", async () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Verificar que el botón de finalizar día está presente
    const endDayButton = screen.getByTestId("end-day-button");
    expect(endDayButton).toBeInTheDocument();

    // Hacer clic en el botón para abrir el modal
    fireEvent.click(endDayButton);

    // Verificar que el modal se abre
    const modal = screen.getByTestId("confirm-end-day-modal");
    expect(modal).toHaveAttribute("data-open", "true");

    // Confirmar la finalización del día
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    // Verificar que se llamó a completeActivity con el ID de la actividad activa
    expect(mockSystemCore.completeActivity).toHaveBeenCalledWith(mockActiveActivity.id);

    // Verificar que se llamó a endDay
    expect(mockSystemCore.endDay).toHaveBeenCalledTimes(1);

    // Verificar que se redirigió a la página de overview
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  test("cancela el proceso de finalización cuando hace clic en Cancelar", () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Hacer clic en el botón para abrir el modal
    fireEvent.click(screen.getByTestId("end-day-button"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("confirm-end-day-modal")).toHaveAttribute("data-open", "true");

    // Hacer clic en Cancelar
    fireEvent.click(screen.getByTestId("cancel-end-day-button"));

    // Verificar que no se llamó a completeActivity ni endDay
    expect(mockSystemCore.completeActivity).not.toHaveBeenCalled();
    expect(mockSystemCore.endDay).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test("sin actividad activa, solo finaliza el día", () => {
    // Sobrescribir el mock para que no tenga actividad activa
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockSystemCore,
      getActiveActivity: jest.fn(() => null),
    }));

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Hacer clic en el botón para abrir el modal
    fireEvent.click(screen.getByTestId("end-day-button"));

    // Confirmar la finalización del día
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    // Verificar que no se llamó a completeActivity
    expect(mockSystemCore.completeActivity).not.toHaveBeenCalled();

    // Verificar que se llamó a endDay
    expect(mockSystemCore.endDay).toHaveBeenCalledTimes(1);

    // Verificar que se redirigió a la página de overview
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  test("muestra error si falla el proceso de finalización", async () => {
    // Sobrescribir el mock para que endDay lance un error
    const errorMessage = "Error al finalizar el día";
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockSystemCore,
      endDay: jest.fn(() => {
        throw new Error(errorMessage);
      }),
    }));

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Hacer clic en el botón para abrir el modal
    fireEvent.click(screen.getByTestId("end-day-button"));

    // Confirmar la finalización del día
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    // Verificar que se llama a completeActivity pero lanza error en endDay
    expect(mockSystemCore.completeActivity).toHaveBeenCalled();

    // Verificar que se muestra el mensaje de error
    await waitFor(() => {
      expect(screen.getByText(`Error al finalizar el día: ${errorMessage}`)).toBeInTheDocument();
    });

    // Verificar que no se navegó a overview
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
