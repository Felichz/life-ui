/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DayPage from "./DayPage";
import { useSystemCore } from "../hooks/useSystemCore";

// Mock de los hooks y componentes necesarios
jest.mock("../hooks/useSystemCore");
jest.mock("../containers/KanbanContainer", () => ({
  __esModule: true,
  default: React.forwardRef(() => <div data-testid="kanban-container">KanbanContainer</div>),
}));
jest.mock("../containers/QuickBarContainer", () => ({
  __esModule: true,
  default: () => <div data-testid="quickbar-container">QuickBarContainer</div>,
}));
jest.mock("../containers/EventQuickBarContainer", () => ({
  __esModule: true,
  default: () => <div data-testid="event-quickbar-container">EventQuickBarContainer</div>,
}));
jest.mock("../containers/TimelineContainer", () => ({
  __esModule: true,
  default: () => <div data-testid="timeline-container">TimelineContainer</div>,
}));
jest.mock("../containers/ActivityLibraryContainer", () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="activity-library-container">
      ActivityLibraryContainer
      <button data-testid="close-library" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));
jest.mock("../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="timeblock-modal-container">
      TimeBlockModalContainer
      <button data-testid="close-timeblock" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));
jest.mock("../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="event-library-modal-container">
      EventLibraryModalContainer
      <button data-testid="close-event" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));
jest.mock("../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="activity-instance-modal">
      ActivityInstanceModal
      <button data-testid="close-instance" onClick={props.onClose}>
        Close
      </button>
    </div>
  ),
}));
jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Droppable: ({ children }: { children: (provided: any, snapshot: any) => React.ReactNode }) =>
    children(
      {
        draggableProps: {},
        innerRef: jest.fn(),
      },
      {}
    ),
  Draggable: ({ children }: { children: (provided: any, snapshot: any) => React.ReactNode }) =>
    children(
      {
        draggableProps: {},
        dragHandleProps: {},
        innerRef: jest.fn(),
      },
      {}
    ),
}));

describe("DayPage", () => {
  // Mock valores por defecto para el hook useSystemCore
  const mockGetActiveActivity = jest.fn().mockReturnValue(null);
  const mockCreateActivityInstance = jest.fn();

  // Helper para construir un mock base. `state.global` y demás campos
  // son requeridos por TempoBanner, DayMetricsContainer, etc.
  const buildMock = (overrides: Record<string, unknown> = {}) => ({
    isDayActive: jest.fn().mockReturnValue(true),
    getActiveActivity: mockGetActiveActivity,
    createActivityInstance: mockCreateActivityInstance,
    getUserPreferences: jest.fn().mockReturnValue({ dailyTempoTarget: 100, updatedAt: "" }),
    requestCompletion: jest.fn(() => ({
      activityTitle: "T",
      durationMinutes: 30,
      estimatedMinutes: 30,
      beatEstimate: false,
      requestedAt: "2023-01-01T12:00:00.000Z",
    })),
    completeActivity: jest.fn(),
    interruptActivity: jest.fn(),
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

  beforeEach(() => {
    (useSystemCore as jest.Mock).mockReturnValue(buildMock());
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("Renderiza correctamente cuando hay un día activo", () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Verificar que los componentes principales se renderizan
    expect(screen.getByTestId("day-page")).toBeInTheDocument();
    expect(screen.getByTestId("quickbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-container")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-container")).toBeInTheDocument();
  });

  test("Muestra mensaje cuando no hay día activo", () => {
    (useSystemCore as jest.Mock).mockReturnValue(
      buildMock({ isDayActive: jest.fn().mockReturnValue(false) })
    );

    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Verificar que se muestra el mensaje de no hay día activo
    expect(screen.getByText("No hay un día activo")).toBeInTheDocument();
    expect(screen.getByText("Debes iniciar un día para acceder a esta vista.")).toBeInTheDocument();
  });

  test("Abre y cierra el modal de biblioteca de actividades", () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Clic en el botón de biblioteca
    fireEvent.click(screen.getByLabelText("abrir biblioteca de actividades"));

    // Verificar que se abre el modal
    expect(screen.getByTestId("activity-library-container")).toBeInTheDocument();

    // Cerrar el modal usando el testId específico
    fireEvent.click(screen.getByTestId("close-library"));
  });

  test("Abre y cierra el modal de bloques de tiempo", () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Clic en el botón de bloques de tiempo
    fireEvent.click(screen.getByLabelText("gestionar bloques de tiempo"));

    // Verificar que se abre el modal
    expect(screen.getByTestId("timeblock-modal-container")).toBeInTheDocument();

    // Cerrar el modal usando el testId específico
    fireEvent.click(screen.getByTestId("close-timeblock"));
  });

  test("el botón de variables subjetivas fue removido (schema v2+)", () => {
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );
    // El botón y el modal de variables subjetivas ya no existen.
    expect(
      screen.queryByLabelText("actualizar variables subjetivas")
    ).not.toBeInTheDocument();
  });
});
