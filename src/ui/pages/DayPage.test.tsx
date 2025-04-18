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
jest.mock("../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: (props: { onClose: () => void }) => (
    <div data-testid="variable-modal-container">
      VariableModalContainer
      <button data-testid="close-variable" onClick={props.onClose}>
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
  const mockCanUpdateVariables = jest.fn().mockReturnValue(true);
  const mockCreateActivityInstance = jest.fn();

  beforeEach(() => {
    // Configuración por defecto del mock
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn().mockReturnValue(true),
      getActiveActivity: mockGetActiveActivity,
      canUpdateVariables: mockCanUpdateVariables,
      createActivityInstance: mockCreateActivityInstance,
      getUserPreferences: jest.fn().mockReturnValue({ hiddenSubjectiveVariableIds: [] }),
      toggleVariableVisibility: jest.fn(),
      state: {
        global: {
          days: [],
        },
      },
    });
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
    // Cambiar el mock para simular que no hay día activo
    (useSystemCore as jest.Mock).mockReturnValue({
      isDayActive: jest.fn().mockReturnValue(false),
      getActiveActivity: mockGetActiveActivity,
      canUpdateVariables: mockCanUpdateVariables,
      getUserPreferences: jest.fn().mockReturnValue({ hiddenSubjectiveVariableIds: [] }),
      toggleVariableVisibility: jest.fn(),
      state: {
        global: {
          days: [],
        },
      },
    });

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

  test("Abre y cierra el modal de variables subjetivas y maneja el estado de habilitación", () => {
    // Primer render: botón habilitado
    const { unmount } = render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Usar data-testid para hacerlo más específico
    const buttons = screen.getAllByRole("button");
    const variableButton = buttons.find(
      (button) => button.getAttribute("aria-label") === "actualizar variables subjetivas"
    );

    // Comprobar que el botón está habilitado por defecto
    expect(variableButton).toBeDefined();
    expect(variableButton).toBeEnabled();

    // Clic en el botón de variables subjetivas
    fireEvent.click(variableButton!);

    // Verificar que se abre el modal
    expect(screen.getByTestId("variable-modal-container")).toBeInTheDocument();

    // Cerrar el modal usando el testId específico
    fireEvent.click(screen.getByTestId("close-variable"));

    // Limpiar el primer render
    unmount();

    // Simular que no se pueden actualizar las variables (cooldown)
    mockCanUpdateVariables.mockReturnValue(false);

    // Segundo render: botón deshabilitado
    render(
      <MemoryRouter>
        <DayPage />
      </MemoryRouter>
    );

    // Usar el mismo enfoque, pero esta vez debería estar deshabilitado
    const newButtons = screen.getAllByRole("button");
    const disabledButton = newButtons.find(
      (button) => button.getAttribute("aria-label") === "actualizar variables subjetivas"
    );

    // El botón debería estar deshabilitado ahora
    expect(disabledButton).toBeDefined();
    expect(disabledButton).toBeDisabled();
  });
});
