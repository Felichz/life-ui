import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import KanbanCard from "../Card";
import type { ActivityInstance, UUID } from "../../../../types";
import type {
  DraggableChildrenFn,
  DraggableProvided,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";

// Mock de componentes
jest.mock("../../../components/Common/ActivityTimer", () => ({
  __esModule: true,
  default: () => <div data-testid="activity-timer">00:00</div>,
}));

// Mock de @hello-pangea/dnd para evitar error de "not connected to DnD"
jest.mock("@hello-pangea/dnd", () => ({
  Draggable: ({
    children,
  }: {
    children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => React.ReactNode;
  }) =>
    children(
      {
        draggableProps: {
          "data-rfd-draggable-context-id": "test-context-id",
          "data-rfd-draggable-id": "test-draggable-id",
        },
        dragHandleProps: {
          "data-rfd-drag-handle-draggable-id": "test-draggable-id",
          "data-rfd-drag-handle-context-id": "test-context-id",
          role: "button",
          tabIndex: 0,
          draggable: false,
          "aria-describedby": "rfd-description",
          onDragStart: () => {},
        },
        innerRef: () => {},
      },
      {
        isDragging: false,
        isDropAnimating: false,
        isClone: false,
        dropAnimation: null,
        draggingOver: null,
        combineWith: null,
        combineTargetFor: null,
        mode: null,
      }
    ),
}));

describe("KanbanCard", () => {
  const mockActivity: ActivityInstance = {
    id: "activity-123",
    templateId: "template-123",
    blockId: "block-123",
    order: 0,
    state: "instantiated",
    clearObjectiveSettings: {
      estimatedDurationMinutes: 30,
    },
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  };

  const mockActiveActivity: ActivityInstance = {
    ...mockActivity,
    state: "active",
    startTime: "2023-01-01T00:00:00Z",
  };

  const defaultProps = {
    activity: mockActivity,
    index: 0,
    isDayActive: true,
    isTimeBlockAvailable: true,
  };

  test("debería renderizar correctamente una actividad instantiada", () => {
    render(<KanbanCard {...defaultProps} />);

    expect(screen.getByText(/Actividad/)).toBeInTheDocument();
    expect(screen.getByText("instantiated")).toBeInTheDocument();
    expect(screen.getByText("~30 min")).toBeInTheDocument();
  });

  test("debería mostrar el botón de activar cuando la actividad está instantiada y el día está activo", () => {
    render(<KanbanCard {...defaultProps} />);

    expect(screen.getByTestId("activate-button")).toBeInTheDocument();
    expect(screen.getByText("Activar")).toBeInTheDocument();
  });

  test("debería deshabilitar el botón de activar cuando el bloque no está disponible", () => {
    render(<KanbanCard {...defaultProps} isTimeBlockAvailable={false} />);

    const activateButton = screen.getByTestId("activate-button");
    expect(activateButton).toBeInTheDocument();
    expect(activateButton).toBeDisabled();
  });

  test("debería ocultar el botón de activar cuando el día no está activo", () => {
    render(<KanbanCard {...defaultProps} isDayActive={false} />);

    expect(screen.queryByTestId("activate-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Activar")).not.toBeInTheDocument();
  });

  test("debería llamar a onActivate cuando se hace clic en el botón Activar", () => {
    const mockOnActivate = jest.fn();
    render(<KanbanCard {...defaultProps} onActivate={mockOnActivate} />);

    const activateButton = screen.getByTestId("activate-button");
    fireEvent.click(activateButton);

    expect(mockOnActivate).toHaveBeenCalledWith("activity-123");
  });

  test("debería mostrar el cronómetro cuando la actividad está activa", () => {
    render(<KanbanCard {...defaultProps} activity={mockActiveActivity} />);

    expect(screen.getByTestId("activity-timer")).toBeInTheDocument();
  });

  test("debería ocultar el cronómetro cuando la actividad no está activa", () => {
    render(<KanbanCard {...defaultProps} />);

    expect(screen.queryByTestId("activity-timer")).not.toBeInTheDocument();
  });

  test("debería mostrar el botón de completar cuando la actividad está activa", () => {
    render(<KanbanCard {...defaultProps} activity={mockActiveActivity} />);

    expect(screen.getByTestId("complete-button")).toBeInTheDocument();
    expect(screen.getByText("Completar")).toBeInTheDocument();
  });

  test("debería ocultar el botón de completar cuando la actividad no está activa", () => {
    render(<KanbanCard {...defaultProps} />);

    expect(screen.queryByTestId("complete-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Completar")).not.toBeInTheDocument();
  });

  test("debería ocultar el botón de completar cuando el día no está activo", () => {
    render(<KanbanCard {...defaultProps} activity={mockActiveActivity} isDayActive={false} />);

    expect(screen.queryByTestId("complete-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Completar")).not.toBeInTheDocument();
  });

  test("debería llamar a onComplete cuando se hace clic en el botón Completar", () => {
    const mockOnComplete = jest.fn();
    render(
      <KanbanCard {...defaultProps} activity={mockActiveActivity} onComplete={mockOnComplete} />
    );

    const completeButton = screen.getByTestId("complete-button");
    fireEvent.click(completeButton);

    expect(mockOnComplete).toHaveBeenCalledWith("activity-123");
  });

  test("debería mostrar el botón de interrumpir cuando la actividad está activa", () => {
    render(<KanbanCard {...defaultProps} activity={mockActiveActivity} />);

    expect(screen.getByTestId("interrupt-button")).toBeInTheDocument();
    expect(screen.getByText("Interrumpir")).toBeInTheDocument();
  });

  test("debería ocultar el botón de interrumpir cuando la actividad no está activa", () => {
    render(<KanbanCard {...defaultProps} />);

    expect(screen.queryByTestId("interrupt-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Interrumpir")).not.toBeInTheDocument();
  });

  test("debería ocultar el botón de interrumpir cuando el día no está activo", () => {
    render(<KanbanCard {...defaultProps} activity={mockActiveActivity} isDayActive={false} />);

    expect(screen.queryByTestId("interrupt-button")).not.toBeInTheDocument();
    expect(screen.queryByText("Interrumpir")).not.toBeInTheDocument();
  });

  test("debería llamar a onInterrupt cuando se hace clic en el botón Interrumpir", () => {
    const mockOnInterrupt = jest.fn();
    render(
      <KanbanCard {...defaultProps} activity={mockActiveActivity} onInterrupt={mockOnInterrupt} />
    );

    const interruptButton = screen.getByTestId("interrupt-button");
    fireEvent.click(interruptButton);

    expect(mockOnInterrupt).toHaveBeenCalledWith("activity-123");
  });
});
