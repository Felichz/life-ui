import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DayPage from "../pages/DayPage";
import { useSystemCore } from "../hooks/useSystemCore";
import { MemoryRouter } from "react-router-dom";

// Mocks
const mockNavigate = jest.fn();

// Mock de react-router-dom
jest.mock("react-router-dom", () => ({
  ...jest.requireActual("react-router-dom"),
  useNavigate: () => mockNavigate,
}));

// Mock de useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

// Mock de TopBar para poder acceder al botón de finalizar día
jest.mock("../components/Common/TopBar", () => ({
  __esModule: true,
  default: ({ onEndDayClick }: { onEndDayClick: () => void }) => (
    <div>
      TopBar
      <button onClick={onEndDayClick} aria-label="finalizar día">
        Finalizar día
      </button>
    </div>
  ),
}));

// Mock de ConfirmEndDayModal
jest.mock("../modals/ConfirmEndDayModal", () => ({
  __esModule: true,
  default: ({
    open,
    onClose,
    onConfirm,
  }: {
    open: boolean;
    onClose: () => void;
    onConfirm: () => void;
  }) => (
    <div data-testid="confirm-end-day-modal" data-open={open} role={open ? "dialog" : undefined}>
      Modal Finalizar Día
      {open && (
        <>
          <button onClick={onClose}>Cancelar</button>
          <button data-testid="confirm-end-day-button" onClick={onConfirm}>
            Finalizar día
          </button>
        </>
      )}
    </div>
  ),
}));

// Mock de otros componentes necesarios para que DayPage se renderice sin problemas
jest.mock("../containers/KanbanContainer", () => ({
  __esModule: true,
  default: React.forwardRef(() => <div>Kanban Container</div>),
}));

jest.mock("../containers/QuickBarContainer", () => ({
  __esModule: true,
  default: () => <div>Quick Bar Container</div>,
}));

jest.mock("../containers/TimelineContainer", () => ({
  __esModule: true,
  default: () => <div>Timeline Container</div>,
}));

jest.mock("../containers/EventQuickBarContainer", () => ({
  __esModule: true,
  default: () => <div>Event Quick Bar Container</div>,
}));

jest.mock("../containers/ActivityLibraryContainer", () => ({
  __esModule: true,
  default: () => <div>Activity Library Container</div>,
}));

jest.mock("../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: () => <div>Time Block Modal Container</div>,
}));

jest.mock("../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: () => <div>Event Library Modal Container</div>,
}));

jest.mock("../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: () => <div>Variable Modal Container</div>,
}));

jest.mock("../containers/OverviewModalContainer", () => ({
  __esModule: true,
  default: () => <div>Overview Modal Container</div>,
}));

jest.mock("../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: () => <div>Activity Instance Modal</div>,
}));

// Mock de ActionButtons
jest.mock("../components/Common/ActionButtons", () => ({
  __esModule: true,
  default: () => <div>Action Buttons</div>,
}));

describe("DayPage - Finalizar día", () => {
  // Setup inicial para cada test
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("al hacer clic en finalizar día y confirmar, debe completar actividad y navegar a overview", async () => {
    // Setup de los mocks para useSystemCore
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn();
    const mockActiveActivity = {
      id: "active-activity-id",
      templateId: "template-id",
      state: "active",
    };

    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn().mockReturnValue(true),
      getActiveActivity: jest.fn().mockReturnValue(mockActiveActivity),
      completeActivity: mockCompleteActivity,
      endDay: mockEndDay,
      canUpdateVariables: jest.fn().mockReturnValue(true),
      getTimeBlocks: jest.fn().mockReturnValue([]),
      createActivityInstance: jest.fn(),
    });

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Buscar y hacer clic en el botón de finalizar día
    const finishDayButton = screen.getByLabelText(/finalizar día/i);
    fireEvent.click(finishDayButton);

    // Comprobar que se abre el modal de confirmación
    const confirmDialog = screen.getByRole("dialog");
    expect(confirmDialog).toBeInTheDocument();

    // Confirmar finalización
    const confirmButton = screen.getByTestId("confirm-end-day-button");
    fireEvent.click(confirmButton);

    // Verificar que se completa la actividad activa
    expect(mockCompleteActivity).toHaveBeenCalledWith(mockActiveActivity.id);

    // Verificar que se finaliza el día
    expect(mockEndDay).toHaveBeenCalled();

    // Verificar que se navega a la página de overview
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  test("si no hay actividad activa, solo debe finalizar el día sin completar actividad", async () => {
    // Setup de los mocks para useSystemCore
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn();

    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn().mockReturnValue(true),
      getActiveActivity: jest.fn().mockReturnValue(null),
      completeActivity: mockCompleteActivity,
      endDay: mockEndDay,
      canUpdateVariables: jest.fn().mockReturnValue(true),
      getTimeBlocks: jest.fn().mockReturnValue([]),
      createActivityInstance: jest.fn(),
    });

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Buscar y hacer clic en el botón de finalizar día
    const finishDayButton = screen.getByLabelText(/finalizar día/i);
    fireEvent.click(finishDayButton);

    // Confirmar finalización
    const confirmButton = screen.getByTestId("confirm-end-day-button");
    fireEvent.click(confirmButton);

    // Verificar que NO se intenta completar ninguna actividad
    expect(mockCompleteActivity).not.toHaveBeenCalled();

    // Verificar que se finaliza el día
    expect(mockEndDay).toHaveBeenCalled();

    // Verificar que se navega a la página de overview
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  test("si ocurre un error al finalizar el día, debe mostrar un mensaje de error", async () => {
    // Setup de los mocks para useSystemCore
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn().mockImplementation(() => {
      throw new Error("Error al finalizar el día");
    });

    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn().mockReturnValue(true),
      getActiveActivity: jest.fn().mockReturnValue(null),
      completeActivity: mockCompleteActivity,
      endDay: mockEndDay,
      canUpdateVariables: jest.fn().mockReturnValue(true),
      getTimeBlocks: jest.fn().mockReturnValue([]),
      createActivityInstance: jest.fn(),
    });

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Buscar y hacer clic en el botón de finalizar día
    const finishDayButton = screen.getByLabelText(/finalizar día/i);
    fireEvent.click(finishDayButton);

    // Confirmar finalización
    const confirmButton = screen.getByTestId("confirm-end-day-button");
    fireEvent.click(confirmButton);

    // Verificar que se muestra un mensaje de error
    expect(screen.getByText(/Error al finalizar el día/i)).toBeInTheDocument();

    // Verificar que NO se navega a overview en caso de error
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
