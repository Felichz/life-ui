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

jest.mock("../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: () => <div>Activity Instance Modal</div>,
}));

// Mock de ActionButtons
jest.mock("../components/Common/ActionButtons", () => ({
  __esModule: true,
  default: () => <div>Action Buttons</div>,
}));

// Helper para construir el mock base de useSystemCore.
// `state.global` y demás campos son requeridos por TempoBanner, etc.
const buildSystemCoreMock = (overrides: Record<string, unknown> = {}) => ({
  isDayActive: jest.fn().mockReturnValue(true),
  getActiveActivity: jest.fn().mockReturnValue(null),
  completeActivity: jest.fn(),
  interruptActivity: jest.fn(),
  requestCompletion: jest.fn(() => ({
    activityTitle: "T",
    durationMinutes: 30,
    estimatedMinutes: 30,
    beatEstimate: false,
    requestedAt: "2023-01-01T12:00:00.000Z",
  })),
  endDay: jest.fn(),
  getTimeBlocks: jest.fn().mockReturnValue([]),
  createActivityInstance: jest.fn(),
  getCurrentDay: jest.fn(() => null),
  getTempoSummary: jest.fn(() => ({
    totalTempos: 0,
    target: 1000,
    targetProgress: 0,
    progressBarValue: 0,
    displayPercent: 0,
    completedActivities: 0,
    averageSatisfaction: 0,
    lastReward: undefined,
  })),
  state: {
    global: {
      days: [],
      activityTemplates: [],
      eventTemplates: [],
      timeBlocks: [],
      userPreferences: {
        dailyTempoTarget: 100,
        updatedAt: "",
      },
      completedActivityRecords: [],
      eventInstances: [],
      schemaVersion: 2,
    },
    currentDay: {
      day: { id: "d", state: "active", createdAt: "", updatedAt: "" },
      activityInstances: [],
    },
  },
  ...overrides,
});

describe("DayPage - Finalizar día", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("al hacer clic en finalizar día y confirmar con activa: delega al flow (no llama completeActivity directo)", async () => {
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn();
    const mockActiveActivity = {
      id: "active-activity-id",
      templateId: "template-id",
      state: "active",
    };

    (useSystemCore as jest.Mock).mockReturnValue(
      buildSystemCoreMock({
        getActiveActivity: jest.fn().mockReturnValue(mockActiveActivity),
        completeActivity: mockCompleteActivity,
        endDay: mockEndDay,
      })
    );

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText(/finalizar día/i));
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    // El contexto es la única autoridad: completeActivity NO se llama
    // directamente desde DayPage. Se llamaría al resolver el modal.
    // Aquí verificamos que NO se llamó directamente (sigue siendo 0 calls).
    expect(mockCompleteActivity).not.toHaveBeenCalled();
  });

  test("si no hay actividad activa, solo debe finalizar el día sin completar actividad", async () => {
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn();

    (useSystemCore as jest.Mock).mockReturnValue(
      buildSystemCoreMock({
        completeActivity: mockCompleteActivity,
        endDay: mockEndDay,
      })
    );

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText(/finalizar día/i));
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    expect(mockCompleteActivity).not.toHaveBeenCalled();
    expect(mockEndDay).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith("/overview");
  });

  test("si ocurre un error al finalizar el día, debe mostrar un mensaje de error", async () => {
    const mockCompleteActivity = jest.fn();
    const mockEndDay = jest.fn().mockImplementation(() => {
      throw new Error("Error al finalizar el día");
    });

    (useSystemCore as jest.Mock).mockReturnValue(
      buildSystemCoreMock({
        completeActivity: mockCompleteActivity,
        endDay: mockEndDay,
      })
    );

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByLabelText(/finalizar día/i));
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    expect(screen.getByText(/Error al finalizar el día/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
