/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { render, screen } from "@testing-library/react";
import KanbanColumn from "../Column";
import type { TimeBlock, ActivityInstance } from "../../../../types";
import KanbanCard from "../Card";

// Mock de componentes hijos
jest.mock("../Card", () => jest.fn(() => <div data-testid="mocked-card" />));

// Mock de react-beautiful-dnd
jest.mock("@hello-pangea/dnd", () => ({
  Droppable: ({ children }: { children: (provided: any, snapshot: any) => React.ReactNode }) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {},
        placeholder: null,
      },
      {}
    ),
}));

describe("KanbanColumn", () => {
  const mockBlock: TimeBlock = {
    id: "block-123",
    name: "Test Block",
    startMinute: 480, // 8:00
    endMinute: 600, // 10:00
    isDefault: false,
    order: 1,
    createdAt: "2023-01-01T00:00:00Z",
    updatedAt: "2023-01-01T00:00:00Z",
  };

  const mockDefaultBlock: TimeBlock = {
    ...mockBlock,
    id: "default-block",
    name: "Por Hacer",
    isDefault: true,
  };

  const mockActivities: ActivityInstance[] = [
    {
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
    },
  ];

  const defaultProps = {
    block: mockBlock,
    activities: mockActivities,
    isDayActive: true,
    isTimeBlockAvailable: jest.fn().mockImplementation(() => true),
  };

  beforeEach(() => {
    // Limpiar mocks antes de cada test
    jest.clearAllMocks();
  });

  test("debería renderizar correctamente un bloque de tiempo con actividades", () => {
    render(<KanbanColumn {...defaultProps} />);

    expect(screen.getByText("Test Block")).toBeInTheDocument();
    expect(screen.getByText("08:00 - 10:00")).toBeInTheDocument();
    expect(screen.getByTestId("mocked-card")).toBeInTheDocument();
  });

  test("debería renderizar un bloque por defecto sin horario", () => {
    render(<KanbanColumn {...defaultProps} block={mockDefaultBlock} />);

    expect(screen.getByText("Por Hacer")).toBeInTheDocument();
    expect(screen.queryByText(/\d{2}:\d{2} - \d{2}:\d{2}/)).not.toBeInTheDocument();
  });

  test("debería renderizar mensaje cuando no hay actividades", () => {
    render(<KanbanColumn {...defaultProps} activities={[]} />);

    expect(screen.getByText("No hay actividades en este bloque.")).toBeInTheDocument();
  });

  test("debería pasar las props correctas a KanbanCard", () => {
    render(<KanbanColumn {...defaultProps} onActivateActivity={jest.fn()} />);

    // Verificar que KanbanCard se llama con las props correctas
    expect(KanbanCard).toHaveBeenCalledWith(
      expect.objectContaining({
        activity: mockActivities[0],
        index: 0,
        isDayActive: true,
        isTimeBlockAvailable: true,
        onActivate: expect.any(Function),
      }),
      expect.anything()
    );
  });
});
