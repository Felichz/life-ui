import { renderHook } from "@testing-library/react-hooks";
import { act } from "react";
import { useDragDrop } from "../useDragDrop";
import type { DropResult } from "@hello-pangea/dnd";
import { useSystemCore } from "../useSystemCore";

// TODO: Actualizar a React 18 usando createRoot API cuando se actualice @testing-library/react-hooks
// Ver: https://reactjs.org/link/switch-to-createroot

// Mock del hook useSystemCore
jest.mock("../useSystemCore", () => ({
  useSystemCore: jest.fn(() => ({
    moveActivityInstance: jest.fn(),
    state: { global: {}, currentDay: null },
    // Añadir las propiedades mínimas necesarias para que TypeScript no se queje
    startDay: jest.fn(),
    endDay: jest.fn(),
    getCurrentDay: jest.fn(),
    isDayActive: jest.fn(),
    createActivityTemplate: jest.fn(),
    createActivityInstance: jest.fn(),
    clearState: jest.fn(),
  })),
}));

describe("useDragDrop Hook", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useDragDrop());

    expect(result.current.isDragging).toBe(false);
    expect(result.current.draggedTemplateId).toBeNull();
    expect(result.current.draggedSource).toBeNull();
  });

  it("should handle drag start", () => {
    const onDragStartMock = jest.fn();
    const { result } = renderHook(() =>
      useDragDrop({
        onDragStart: onDragStartMock,
      })
    );

    act(() => {
      result.current.handleDragStart({
        draggableId: "template-123",
        type: "TEMPLATE",
        source: {
          droppableId: "library",
          index: 0,
        },
        mode: "FLUID",
      });
    });

    expect(result.current.isDragging).toBe(true);
    expect(result.current.draggedTemplateId).toBe("template-123");
    expect(result.current.draggedSource).toBe("library");
    expect(onDragStartMock).toHaveBeenCalledWith("template-123", "library");
  });

  it("should handle drag end with no destination", () => {
    const onDragEndMock = jest.fn();
    const { result } = renderHook(() =>
      useDragDrop({
        onDragEnd: onDragEndMock,
      })
    );

    // Simular el inicio del drag primero
    act(() => {
      result.current.handleDragStart({
        draggableId: "template-123",
        type: "TEMPLATE",
        source: {
          droppableId: "library",
          index: 0,
        },
        mode: "FLUID",
      });
    });

    // Crear el objeto dropResult para el test
    const dropResult: DropResult = {
      draggableId: "template-123",
      type: "TEMPLATE",
      source: {
        droppableId: "library",
        index: 0,
      },
      mode: "FLUID",
      reason: "CANCEL" as const,
      destination: null,
      combine: null,
    };

    // Luego drag end sin destino (cancelado)
    act(() => {
      result.current.handleDragEnd(dropResult);
    });

    // Verificar que se haya llamado el mock con el resultado correcto
    expect(result.current.isDragging).toBe(false);
    expect(result.current.draggedTemplateId).toBeNull();
    expect(result.current.draggedSource).toBeNull();
    expect(onDragEndMock).toHaveBeenCalledWith(dropResult);
  });

  it("should handle drag from library to kanban block", () => {
    const onCreateActivityInstanceMock = jest.fn();
    const { result } = renderHook(() =>
      useDragDrop({
        onCreateActivityInstance: onCreateActivityInstanceMock,
      })
    );

    // Simular drop de biblioteca a bloque
    const dropResult: DropResult = {
      draggableId: "template-123",
      type: "TEMPLATE",
      source: {
        droppableId: "library",
        index: 0,
      },
      destination: {
        droppableId: "block-456",
        index: 2,
      },
      mode: "FLUID",
      reason: "DROP",
      combine: null,
    };

    act(() => {
      result.current.handleDragEnd(dropResult);
    });

    expect(onCreateActivityInstanceMock).toHaveBeenCalledWith("template-123", "456");
  });

  it("should handle reordering within a kanban block", () => {
    const moveActivityInstanceMock = jest.fn();
    // Actualizar el mock para este test específico
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      moveActivityInstance: moveActivityInstanceMock,
      state: { global: {}, currentDay: null },
      // Otras propiedades mínimas
      startDay: jest.fn(),
      endDay: jest.fn(),
      getCurrentDay: jest.fn(),
      isDayActive: jest.fn(),
      createActivityTemplate: jest.fn(),
      createActivityInstance: jest.fn(),
      clearState: jest.fn(),
    }));

    const { result } = renderHook(() => useDragDrop());

    // Simular reordenamiento dentro del mismo bloque
    const dropResult: DropResult = {
      draggableId: "activity-789",
      type: "INSTANCE",
      source: {
        droppableId: "block-456",
        index: 0,
      },
      destination: {
        droppableId: "block-456",
        index: 2,
      },
      mode: "FLUID",
      reason: "DROP",
      combine: null,
    };

    act(() => {
      result.current.handleDragEnd(dropResult);
    });

    expect(moveActivityInstanceMock).toHaveBeenCalledWith("activity-789", "456", 2);
  });
});
