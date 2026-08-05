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

jest.mock("../../containers/ActivityLibraryContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="activity-library-container">Library mocked</div>),
}));

jest.mock("../../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="timeblock-modal-container">TimeBlock mocked</div>),
}));

jest.mock("../../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="event-library-modal-container">EventLibrary mocked</div>),
}));

jest.mock("../../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="variable-modal-container">Variable mocked</div>),
}));

jest.mock("../../containers/OverviewModalContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="overview-modal-container">Overview mocked</div>),
}));

jest.mock("../../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="activity-instance-modal">Instance mocked</div>),
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
    interruptActivity: jest.fn(),
    requestCompletion: jest.fn(() => ({
      activityTitle: "T",
      durationMinutes: 30,
      estimatedMinutes: 30,
      canApplyBonus: false,
      requestedAt: "2023-01-01T12:00:00.000Z",
    })),
    endDay: jest.fn(),
    canUpdateVariables: jest.fn(() => true),
    getCurrentDay: jest.fn(() => null),
    getTimeBlocks: jest.fn(() => []),
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
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: {
          hiddenSubjectiveVariableIds: [],
          dailyTempoTarget: 1000,
          updatedAt: "",
        },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
        schemaVersion: 2,
      },
      currentDay: {
        day: { id: "d", state: "active", createdAt: "", updatedAt: "" },
        activityInstances: [],
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(() => mockSystemCore);
  });

  test("flujo feliz: con actividad activa, el flow pide el cierre (no completa directamente)", async () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    const endDayButton = screen.getByTestId("end-day-button");
    expect(endDayButton).toBeInTheDocument();

    fireEvent.click(endDayButton);
    expect(screen.getByTestId("confirm-end-day-modal")).toHaveAttribute("data-open", "true");

    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    // El contexto es la única autoridad. completeActivity NO se llama
    // directamente desde DayPage: se llamaría al resolver el modal.
    expect(mockSystemCore.completeActivity).not.toHaveBeenCalled();
    // endDay tampoco corre todavía (la continuation se ejecuta solo si
    // el cierre tuvo éxito, pero aquí no resolvemos el modal).
    expect(mockSystemCore.endDay).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
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

  test("muestra error si falla el proceso de finalización (endDay lanza)", async () => {
    // Sin actividad activa: handleEndDayConfirm cae al branch directo
    // que llama endDay. Si endDay lanza, debe mostrarse el error.
    const errorMessage = "Error al finalizar el día";
    const mockEndDay = jest.fn(() => {
      throw new Error(errorMessage);
    });
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockSystemCore,
      getActiveActivity: jest.fn(() => null),
      endDay: mockEndDay,
    }));

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByTestId("end-day-button"));
    fireEvent.click(screen.getByTestId("confirm-end-day-button"));

    expect(mockEndDay).toHaveBeenCalled();
    await waitFor(() => {
      expect(
        screen.getByText(`Error al finalizar el día: ${errorMessage}`)
      ).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
