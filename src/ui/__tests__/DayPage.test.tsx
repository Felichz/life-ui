import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DayPage from "../pages/DayPage";
import { useSystemCore } from "../hooks/useSystemCore";

// Mock de useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(),
}));

// Mock del KanbanContainer para evitar errores con la ref
jest.mock("../containers/KanbanContainer", () => ({
  __esModule: true,
  default: React.forwardRef(() => <div data-testid="kanban-container">Kanban Container</div>),
}));

// Mock de los otros contenedores
jest.mock("../containers/QuickBarContainer", () => ({
  __esModule: true,
  default: () => <div>Quick Bar Container</div>,
}));

jest.mock("../containers/TimelineContainer", () => ({
  __esModule: true,
  default: () => <div>Timeline Container</div>,
}));

// Mock de EventQuickBarContainer
jest.mock("../containers/EventQuickBarContainer", () => ({
  __esModule: true,
  default: () => <div>Event Quick Bar Container</div>,
}));

// Mock de ActivityLibraryContainer
jest.mock("../containers/ActivityLibraryContainer", () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="activity-library-modal" data-open={open}>
      Biblioteca de Actividades Modal
      {open && <button onClick={onClose}>Cerrar</button>}
    </div>
  ),
}));

// Mock de TimeBlockModalContainer
jest.mock("../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="timeblock-modal" data-open={open}>
      Gestión de Bloques de Tiempo
      {open && <button onClick={onClose}>Cerrar</button>}
    </div>
  ),
}));

// Mock de EventLibraryModalContainer
jest.mock("../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => (
    <div data-testid="event-library-modal" data-open={open}>
      Gestión de Biblioteca de Eventos
      {open && <button onClick={onClose}>Cerrar</button>}
    </div>
  ),
}));

// Mock de ActivityInstanceModal
jest.mock("../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: ({ open }: { open: boolean }) => (
    <div data-testid="activity-instance-modal" data-open={open}>
      Modal de Configuración de Actividad
    </div>
  ),
}));

describe("DayPage", () => {
  // Helper para construir el mock base de useSystemCore.
  // `state.global` es requerido por TempoBanner, etc.
  const buildMock = (overrides: Record<string, unknown> = {}) => ({
    isDayActive: jest.fn().mockReturnValue(true),
    getTimeBlocks: jest.fn().mockReturnValue([]),
    moveActivityInstance: jest.fn(),
    createActivityInstance: jest.fn(),
    getActiveActivity: jest.fn().mockReturnValue(null),
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

  test("renderiza la página cuando hay un día activo", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);

    expect(screen.getByTestId("day-page")).toBeInTheDocument();
    expect(screen.getByText("Kanban Container")).toBeInTheDocument();
    expect(screen.getByText("Actividades del día")).toBeInTheDocument();
  });

  test("muestra mensaje cuando no hay día activo", () => {
    (useSystemCore as jest.Mock).mockReturnValue(
      buildMock({ isDayActive: jest.fn().mockReturnValue(false) })
    );

    render(<MemoryRouter><DayPage /></MemoryRouter>);

    // Verificar que se muestra el mensaje de error
    expect(screen.getByText("No hay un día activo")).toBeInTheDocument();
    expect(screen.getByText("Debes iniciar un día para acceder a esta vista.")).toBeInTheDocument();

    // Verificar que el contenedor principal no se muestra
    expect(screen.queryByTestId("day-page")).not.toBeInTheDocument();
  });

  test("apertura y cierre del modal de biblioteca de actividades", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);

    // Inicialmente el modal debería estar cerrado
    expect(screen.getByTestId("activity-library-modal")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón para mostrar biblioteca
    fireEvent.click(screen.getByText("Abrir biblioteca"));

    // Ahora el modal debería estar abierto
    expect(screen.getByTestId("activity-library-modal")).toHaveAttribute("data-open", "true");

    // El botón de cerrar debería estar visible
    const closeButton = screen.getByText("Cerrar");
    expect(closeButton).toBeInTheDocument();

    // Hacer clic para cerrar
    fireEvent.click(closeButton);

    // El modal debería cerrarse
    expect(screen.getByTestId("activity-library-modal")).toHaveAttribute("data-open", "false");
  });

  test("apertura del modal también desde el IconButton de la AppBar", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);

    // Inicialmente el modal debería estar cerrado
    expect(screen.getByTestId("activity-library-modal")).toHaveAttribute("data-open", "false");

    // Hacer clic en el icono de la AppBar
    fireEvent.click(screen.getByLabelText("abrir biblioteca de actividades"));

    // Ahora el modal debería estar abierto
    expect(screen.getByTestId("activity-library-modal")).toHaveAttribute("data-open", "true");
  });

  test("apertura y cierre del modal de gestión de bloques de tiempo desde AppBar", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);

    // Inicialmente el modal debería estar cerrado
    expect(screen.getByTestId("timeblock-modal")).toHaveAttribute("data-open", "false");

    // Hacer clic en el icono de la AppBar
    fireEvent.click(screen.getByLabelText("gestionar bloques de tiempo"));

    // Ahora el modal debería estar abierto
    expect(screen.getByTestId("timeblock-modal")).toHaveAttribute("data-open", "true");

    // El botón de cerrar debería estar visible
    const closeButton = screen.getByText("Cerrar");
    expect(closeButton).toBeInTheDocument();

    // Hacer clic para cerrar
    fireEvent.click(closeButton);

    // El modal debería cerrarse
    expect(screen.getByTestId("timeblock-modal")).toHaveAttribute("data-open", "false");
  });

  test("apertura del modal de bloques de tiempo desde el botón del Kanban", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);

    // Inicialmente el modal debería estar cerrado
    expect(screen.getByTestId("timeblock-modal")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de gestionar bloques
    fireEvent.click(screen.getByText("Gestionar bloques"));

    // Ahora el modal debería estar abierto
    expect(screen.getByTestId("timeblock-modal")).toHaveAttribute("data-open", "true");
  });

  test("el botón de variables subjetivas fue removido (schema v2+)", () => {
    render(<MemoryRouter><DayPage /></MemoryRouter>);
    // El botón ya no existe: las variables subjetivas fueron removidas.
    expect(
      screen.queryByLabelText("actualizar variables subjetivas")
    ).not.toBeInTheDocument();
  });
});
