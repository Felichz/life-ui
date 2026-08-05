import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import DayPage from "../DayPage";
import { useSystemCore } from "../../hooks/useSystemCore";

// Mock del hook useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock de los componentes hijos para evitar renderizado completo
jest.mock("../../containers/KanbanContainer", () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="kanban-container">{children}</div>
  )),
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
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="activity-library-container" data-open={open}>
      ActivityLibrary mocked
    </div>
  )),
}));

jest.mock("../../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="timeblock-modal-container" data-open={open}>
      TimeBlockModal mocked
    </div>
  )),
}));

jest.mock("../../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="event-library-modal-container" data-open={open}>
      EventLibraryModal mocked
    </div>
  )),
}));

jest.mock("../../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="variable-modal-container" data-open={open}>
      VariableModal mocked
    </div>
  )),
}));

jest.mock("../../containers/OverviewModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="overview-modal-container" data-open={open}>
      OverviewModal mocked
    </div>
  )),
}));

jest.mock("../../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="activity-instance-modal" data-open={open}>
      ActivityInstanceModal mocked
    </div>
  )),
}));

jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("DayPage", () => {
  // Configuración del mock para useSystemCore
  // `state.global` es requerido por TempoBanner, DayMetrics, etc.
  const mockUseSystemCore = () => ({
    isDayActive: jest.fn(() => true),
    createActivityInstance: jest.fn(),
    getActiveActivity: jest.fn(() => null),
    canUpdateVariables: jest.fn(() => true),
    requestCompletion: jest.fn(() => ({
      activityTitle: "Test",
      durationMinutes: 30,
      estimatedMinutes: 30,
      canApplyBonus: false,
      requestedAt: "2023-01-01T12:00:00.000Z",
    })),
    completeActivity: jest.fn(() => ({
      record: { id: "rec", satisfactionScore: 8, temposAwarded: 24 },
      temposAwarded: 24,
      beatEstimate: false,
      dailyTempoTotal: 24,
      targetProgress: 0.024,
    })),
    interruptActivity: jest.fn(() => ({ id: "rec", temposAwarded: 0 })),
    endDay: jest.fn(),
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
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: { hiddenSubjectiveVariableIds: [], dailyTempoTarget: 1000, updatedAt: "" },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
        schemaVersion: 2,
      },
      currentDay: null,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (useSystemCore as jest.Mock).mockImplementation(mockUseSystemCore);
  });

  test("muestra mensaje cuando no hay día activo", () => {
    // Sobrescribir mock para un día inactivo
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockUseSystemCore(),
      isDayActive: () => false,
    }));

    render(<DayPage />);
    expect(screen.getByText("No hay un día activo")).toBeInTheDocument();
    expect(screen.getByText("Debes iniciar un día para acceder a esta vista.")).toBeInTheDocument();
  });

  test("renderiza componentes principales cuando hay día activo", () => {
    render(<DayPage />);

    // Verificar que se muestran los componentes principales
    expect(screen.getByTestId("day-page")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-container")).toBeInTheDocument();
    expect(screen.getByTestId("quickbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-container")).toBeInTheDocument();
  });

  test("abre el modal OverviewModal al hacer clic en el botón de resumen histórico", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("overview-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de resumen histórico
    fireEvent.click(screen.getByLabelText("ver resumen histórico"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("overview-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal ActivityLibrary al hacer clic en el botón de biblioteca", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("activity-library-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de biblioteca
    fireEvent.click(screen.getByLabelText("abrir biblioteca de actividades"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("activity-library-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal TimeBlockModal al hacer clic en el botón de bloques", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("timeblock-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de bloques
    fireEvent.click(screen.getByLabelText("gestionar bloques de tiempo"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("timeblock-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal EventLibraryModal al hacer clic en el botón de eventos", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("event-library-modal-container")).toHaveAttribute(
      "data-open",
      "false"
    );

    // Hacer clic en el botón de eventos
    fireEvent.click(screen.getByLabelText("gestionar biblioteca de eventos"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("event-library-modal-container")).toHaveAttribute(
      "data-open",
      "true"
    );
  });

  test("abre el modal VariableModal al hacer clic en el botón de variables", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("variable-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de variables
    fireEvent.click(screen.getByLabelText("actualizar variables subjetivas"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("variable-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("deshabilita el botón de variables cuando no se pueden actualizar", () => {
    // Sobrescribir mock para variables no actualizables
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockUseSystemCore(),
      canUpdateVariables: () => false,
    }));

    render(<DayPage />);

    // Verificar que el botón está deshabilitado
    expect(screen.getByLabelText("actualizar variables subjetivas")).toBeDisabled();
  });
});
