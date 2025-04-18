import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import ActivityLibraryModal from "../modals/ActivityLibraryModal";
import type { ActivityTemplate } from "../../types";
import type {
  DroppableProvided,
  DraggableProvided,
  DroppableStateSnapshot,
  DraggableStateSnapshot,
} from "@hello-pangea/dnd";

// Mock de hooks que se usan dentro del componente
const mockGetActivityTemplates = jest.fn();
const mockGetTimeBlocks = jest.fn();

jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: () => ({
    getActivityTemplates: mockGetActivityTemplates,
    getTimeBlocks: mockGetTimeBlocks,
  }),
}));

// Mock de react-beautiful-dnd
jest.mock("@hello-pangea/dnd", () => ({
  Droppable: ({
    children,
  }: {
    children: (provided: DroppableProvided, snapshot: DroppableStateSnapshot) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {
          "data-rfd-droppable-context-id": "test-context-id",
          "data-rfd-droppable-id": "test-droppable-id",
        },
        placeholder: null,
      },
      {
        isDraggingOver: false,
        draggingOverWith: null,
        draggingFromThisWith: null,
        isUsingPlaceholder: false,
      }
    ),
  Draggable: ({
    children,
  }: {
    children: (provided: DraggableProvided, snapshot: DraggableStateSnapshot) => React.ReactNode;
  }) =>
    children(
      {
        innerRef: () => {},
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

describe("ActivityLibraryModal", () => {
  const defaultProps = {
    open: true,
    onClose: jest.fn(),
    onOpenCreate: jest.fn(),
    onOpenEdit: jest.fn(),
    onConfirmDelete: jest.fn(),
    onDelete: jest.fn(),
    onCancelDelete: jest.fn(),
    onSave: jest.fn(),
    onOpenInstanceModal: jest.fn(),
    editingTemplate: null,
    confirmDeleteId: null,
  };

  beforeEach(() => {
    // Configurar mocks con valores constantes antes de cada test
    mockGetActivityTemplates.mockReturnValue([
      {
        id: "1",
        title: "Actividad de prueba",
        description: "Descripción de prueba",
        type: "clear-objective",
        isSystemActivity: false,
        clearObjectiveSettings: {
          estimatedDurationMinutes: 30,
        },
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      } as ActivityTemplate,
    ]);

    mockGetTimeBlocks.mockReturnValue([
      {
        id: "default-block",
        name: "Por Hacer",
        startMinute: 0,
        endMinute: 1439,
        isDefault: true,
        order: 0,
        createdAt: "2023-01-01T00:00:00Z",
        updatedAt: "2023-01-01T00:00:00Z",
      },
    ]);
  });

  it("renders the modal with activity list when open", () => {
    render(<ActivityLibraryModal {...defaultProps} />);

    // Verificar que el título del modal es correcto
    expect(screen.getByText("Biblioteca de Actividades")).toBeInTheDocument();

    // Verificar que se muestra la actividad de prueba
    expect(screen.getByText("Actividad de prueba")).toBeInTheDocument();
    expect(screen.getByText("Descripción de prueba")).toBeInTheDocument();

    // Verificar que el botón de nueva actividad está presente
    expect(screen.getByText("Nueva Actividad")).toBeInTheDocument();
  });

  it("filters activities when searching", () => {
    render(<ActivityLibraryModal {...defaultProps} />);

    // Buscar una actividad existente
    const searchInput = screen.getByPlaceholderText("Buscar actividades...");
    fireEvent.change(searchInput, { target: { value: "prueba" } });

    // La actividad debe seguir apareciendo
    expect(screen.getByText("Actividad de prueba")).toBeInTheDocument();

    // Buscar algo que no existe
    fireEvent.change(searchInput, { target: { value: "noexiste" } });

    // No debe haber actividades y debe mostrarse un mensaje
    expect(screen.queryByText("Actividad de prueba")).not.toBeInTheDocument();
    expect(screen.getByText("No se encontraron actividades.")).toBeInTheDocument();
  });

  it("opens create form when clicking on Nueva Actividad", () => {
    render(<ActivityLibraryModal {...defaultProps} />);

    // Hacer clic en Nueva Actividad
    fireEvent.click(screen.getByText("Nueva Actividad"));

    // Verificar que aparece el formulario de creación
    expect(screen.getAllByText("Nueva actividad")).toHaveLength(2);

    // Verificamos que hay elementos del formulario
    const formControls = screen.getAllByRole("textbox");
    expect(formControls.length).toBeGreaterThan(0);
  });

  it("calls the edit handler when clicking edit button", () => {
    render(<ActivityLibraryModal {...defaultProps} />);

    // Hacer clic en el botón de editar
    const editButton = screen.getByLabelText("editar");
    fireEvent.click(editButton);

    // Verificar que se llama al handler de edición
    expect(defaultProps.onOpenEdit).toHaveBeenCalled();
  });
});
