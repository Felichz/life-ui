import { render, screen } from "@testing-library/react";
import KanbanBoard from "../components/Kanban/Board";
import type { TimeBlockWithActivities } from "../components/Kanban/Board";
import type { TimeBlock, ActivityInstance, UUID } from "../../types";

// Mocks para las pruebas
const mockTimeBlocks: TimeBlock[] = [
  {
    id: "block-1",
    name: "Por Hacer",
    startMinute: 0,
    endMinute: 1439,
    isDefault: true,
    order: 0,
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "block-2",
    name: "Mañana",
    startMinute: 360, // 6:00
    endMinute: 720, // 12:00
    isDefault: false,
    order: 1,
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
];

const mockActivities: ActivityInstance[] = [
  {
    id: "activity-1",
    templateId: "template-1",
    blockId: "block-1", // Por Hacer
    order: 0,
    state: "instantiated",
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "activity-2",
    templateId: "template-2",
    blockId: "block-2", // Mañana
    order: 0,
    state: "instantiated",
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
];

// Crear las columnas para las pruebas
const mockColumns: TimeBlockWithActivities[] = [
  {
    block: mockTimeBlocks[0], // Por Hacer
    activities: [mockActivities[0]], // activity-1
  },
  {
    block: mockTimeBlocks[1], // Mañana
    activities: [mockActivities[1]], // activity-2
  },
];

// Mock para módulos que no existen en el entorno de pruebas
jest.mock("../components/Kanban/Column", () => {
  return function MockColumn({
    block,
    activities,
    isDayActive,
    isTimeBlockAvailable,
  }: {
    block: TimeBlock;
    activities: ActivityInstance[];
    isDayActive: boolean;
    isTimeBlockAvailable: (blockId: UUID) => boolean;
  }) {
    return (
      <div data-testid={`column-${block.id}`}>
        <h2>{block.name}</h2>
        <div>
          {activities.map((activity) => (
            <div key={activity.id} data-testid={`activity-${activity.id}`}>
              ID: {activity.id}
            </div>
          ))}
        </div>
        <div>Día activo: {isDayActive ? "Sí" : "No"}</div>
        <div>Bloque disponible: {isTimeBlockAvailable(block.id) ? "Sí" : "No"}</div>
      </div>
    );
  };
});

// Mock para isTimeBlockAvailable que siempre devuelve true
const mockIsTimeBlockAvailable = jest.fn().mockImplementation(() => true);

describe("KanbanBoard", () => {
  test("renderiza mensaje cuando no hay columnas", () => {
    render(
      <KanbanBoard
        columns={[]}
        isDayActive={true}
        isTimeBlockAvailable={mockIsTimeBlockAvailable}
      />
    );

    expect(screen.getByText("No hay bloques de tiempo definidos.")).toBeInTheDocument();
  });

  test("renderiza todas las columnas proporcionadas", () => {
    render(
      <KanbanBoard
        columns={mockColumns}
        isDayActive={true}
        isTimeBlockAvailable={mockIsTimeBlockAvailable}
      />
    );

    // Verificar que se renderizan ambas columnas
    expect(screen.getByTestId("column-block-1")).toBeInTheDocument();
    expect(screen.getByTestId("column-block-2")).toBeInTheDocument();

    // Verificar los nombres de las columnas
    expect(screen.getByText("Por Hacer")).toBeInTheDocument();
    expect(screen.getByText("Mañana")).toBeInTheDocument();
  });

  test("pasa las actividades correctas a cada columna", () => {
    render(
      <KanbanBoard
        columns={mockColumns}
        isDayActive={true}
        isTimeBlockAvailable={mockIsTimeBlockAvailable}
      />
    );

    // Verificar que la columna "Por Hacer" tiene activity-1
    const porHacerColumn = screen.getByTestId("column-block-1");
    expect(porHacerColumn).toHaveTextContent("activity-1");

    // Verificar que la columna "Mañana" tiene activity-2
    const mananaColumn = screen.getByTestId("column-block-2");
    expect(mananaColumn).toHaveTextContent("activity-2");
  });

  test("pasa correctamente las props isDayActive y isTimeBlockAvailable a las columnas", () => {
    // Mock que devuelve true solo para el bloque por defecto
    const selectiveBlockAvailable = jest
      .fn()
      .mockImplementation((blockId: UUID) => blockId === "block-1");

    render(
      <KanbanBoard
        columns={mockColumns}
        isDayActive={false}
        isTimeBlockAvailable={selectiveBlockAvailable}
      />
    );

    // Verificar isDayActive se pasa correctamente
    expect(screen.getAllByText("Día activo: No")).toHaveLength(2);

    // Verificar isTimeBlockAvailable se pasa y evalúa correctamente
    expect(screen.getByTestId("column-block-1")).toHaveTextContent("Bloque disponible: Sí");
    expect(screen.getByTestId("column-block-2")).toHaveTextContent("Bloque disponible: No");
  });
});
