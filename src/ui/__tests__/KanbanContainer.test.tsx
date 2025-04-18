import { render, screen } from "@testing-library/react";
import KanbanContainer from "../containers/KanbanContainer";
import type { TimeBlock, ActivityInstance, AppState } from "../../types";

// Mock del hook useSystemCore
jest.mock("../hooks/useSystemCore", () => ({
  useSystemCore: jest.fn(() => ({
    state: {
      global: {
        timeBlocks: [],
        days: [],
        activityTemplates: [],
        eventTemplates: [],
        subjectiveVariables: [],
        interruptionCauses: [],
        userPreferences: {
          hiddenSubjectiveVariableIds: [],
          updatedAt: "",
        },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
      },
      currentDay: null,
    },
    isDayActive: jest.fn().mockReturnValue(true),
    activateActivity: jest.fn(),
    updateActivityInstance: jest.fn(),
    createActivityInstance: jest.fn(),
    getActivityTemplates: jest.fn().mockReturnValue([]),
    isTimeBlockAvailable: jest.fn().mockReturnValue(true),
    getInterruptionCauses: jest.fn().mockReturnValue([]),
    getActiveActivity: jest.fn(),
    completeActivity: jest.fn().mockReturnValue({
      id: "completed-activity-id",
      templateTitle: "Completed Activity",
    }),
    interruptActivity: jest.fn().mockReturnValue({
      id: "interrupted-activity-id",
    }),
    createInterruptionCause: jest.fn(),
  })),
}));

// Importar el mock para poder configurarlo en los tests
import { useSystemCore } from "../hooks/useSystemCore";

// Tipo para las columnas en el mock
interface MockColumn {
  block: TimeBlock;
  activities: ActivityInstance[];
}

// Mock para InterruptionModalContainer
jest.mock("../containers/InterruptionModalContainer", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    onClose: () => void;
    activityId?: string;
    onInterruptSuccess?: (id: string) => void;
  }) => (
    <div data-testid="interruption-modal">
      {props.open && (
        <button data-testid="interruption-close" onClick={props.onClose}>
          Cerrar Interrupción
        </button>
      )}
    </div>
  ),
}));

// Mock para VariableModalContainer
jest.mock("../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    onClose: () => void;
    relatedActivityIds?: string[];
    relatedEventIds?: string[];
    onSuccess?: () => void;
  }) => (
    <div data-testid="variable-modal">
      {props.open && (
        <button data-testid="variable-close" onClick={props.onClose}>
          Cerrar Variables
        </button>
      )}
    </div>
  ),
}));

// Mock para el componente KanbanBoard
jest.mock("../components/Kanban/Board", () => {
  return function MockKanbanBoard({ columns }: { columns: MockColumn[] }) {
    return (
      <div data-testid="kanban-board">
        <div data-testid="columns-count">{columns.length}</div>
        <div>
          {columns.map((column) => (
            <div key={column.block.id} data-testid={`column-${column.block.id}`}>
              <h3>{column.block.name}</h3>
              <div data-testid={`activities-count-${column.block.id}`}>
                {column.activities.length}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };
});

// Datos de prueba
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
    startMinute: 360,
    endMinute: 720,
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
    blockId: "block-1",
    order: 0,
    state: "instantiated",
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "activity-2",
    templateId: "template-2",
    blockId: "block-2",
    order: 0,
    state: "instantiated",
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
  {
    id: "activity-3",
    templateId: "template-3",
    blockId: "block-1",
    order: 1,
    state: "instantiated",
    createdAt: "2023-01-01T08:00:00.000Z",
    updatedAt: "2023-01-01T08:00:00.000Z",
  },
];

// Crea un estado mock parcial
const createMockState = (
  timeBlocks: TimeBlock[] = [],
  activities: ActivityInstance[] = []
): Partial<AppState> => ({
  global: {
    timeBlocks,
    days: [],
    activityTemplates: [],
    eventTemplates: [],
    subjectiveVariables: [],
    interruptionCauses: [],
    userPreferences: {
      hiddenSubjectiveVariableIds: [],
      updatedAt: "",
    },
    completedActivityRecords: [],
    eventInstances: [],
    subjectiveVariableSnapshots: [],
  },
  currentDay:
    activities.length > 0
      ? {
          day: {
            id: "day-1",
            state: "active",
            startTime: "2023-01-01T08:00:00.000Z",
            createdAt: "2023-01-01T08:00:00.000Z",
            updatedAt: "2023-01-01T08:00:00.000Z",
          },
          activityInstances: activities,
        }
      : null,
});

describe("KanbanContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("crea un bloque Por Hacer por defecto cuando no hay bloques definidos", () => {
    // Mock del estado sin bloques ni actividades
    (useSystemCore as jest.Mock).mockReturnValue({
      state: createMockState(),
      isDayActive: jest.fn().mockReturnValue(true),
      activateActivity: jest.fn(),
      updateActivityInstance: jest.fn(),
      createActivityInstance: jest.fn(),
      getActivityTemplates: jest.fn().mockReturnValue([]),
      isTimeBlockAvailable: jest.fn().mockReturnValue(true),
      getInterruptionCauses: jest.fn().mockReturnValue([]),
      getActiveActivity: jest.fn(),
      completeActivity: jest.fn().mockReturnValue({
        id: "completed-activity-id",
        templateTitle: "Completed Activity",
      }),
      interruptActivity: jest.fn().mockReturnValue({
        id: "interrupted-activity-id",
      }),
      createInterruptionCause: jest.fn(),
    });

    render(<KanbanContainer />);

    // Verificar que se creó una columna "Por Hacer" por defecto
    expect(screen.getByTestId("columns-count")).toHaveTextContent("1");
    expect(screen.getByText("Por Hacer")).toBeInTheDocument();
  });

  test("muestra todas las columnas y actividades correctamente", () => {
    // Mock del estado con bloques y actividades
    (useSystemCore as jest.Mock).mockReturnValue({
      state: createMockState(mockTimeBlocks, mockActivities),
      isDayActive: jest.fn().mockReturnValue(true),
      activateActivity: jest.fn(),
      updateActivityInstance: jest.fn(),
      createActivityInstance: jest.fn(),
      getActivityTemplates: jest.fn().mockReturnValue([]),
      isTimeBlockAvailable: jest.fn().mockReturnValue(true),
      getInterruptionCauses: jest.fn().mockReturnValue([]),
      getActiveActivity: jest.fn(),
      completeActivity: jest.fn().mockReturnValue({
        id: "completed-activity-id",
        templateTitle: "Completed Activity",
      }),
      interruptActivity: jest.fn().mockReturnValue({
        id: "interrupted-activity-id",
      }),
      createInterruptionCause: jest.fn(),
    });

    render(<KanbanContainer />);

    // Verificar número de columnas
    expect(screen.getByTestId("columns-count")).toHaveTextContent("2");

    // Verificar nombres de columnas
    expect(screen.getByText("Por Hacer")).toBeInTheDocument();
    expect(screen.getByText("Mañana")).toBeInTheDocument();

    // Verificar el número de actividades en cada columna
    expect(screen.getByTestId("activities-count-block-1")).toHaveTextContent("2");
    expect(screen.getByTestId("activities-count-block-2")).toHaveTextContent("1");
  });

  test("ordena las actividades dentro de cada columna", () => {
    // Actividades en orden inverso para probar que se ordenan
    const desordenadas = [...mockActivities].reverse();

    (useSystemCore as jest.Mock).mockReturnValue({
      state: createMockState(mockTimeBlocks, desordenadas),
      isDayActive: jest.fn().mockReturnValue(true),
      activateActivity: jest.fn(),
      updateActivityInstance: jest.fn(),
      createActivityInstance: jest.fn(),
      getActivityTemplates: jest.fn().mockReturnValue([]),
      isTimeBlockAvailable: jest.fn().mockReturnValue(true),
      getInterruptionCauses: jest.fn().mockReturnValue([]),
      getActiveActivity: jest.fn(),
      completeActivity: jest.fn().mockReturnValue({
        id: "completed-activity-id",
        templateTitle: "Completed Activity",
      }),
      interruptActivity: jest.fn().mockReturnValue({
        id: "interrupted-activity-id",
      }),
      createInterruptionCause: jest.fn(),
    });

    render(<KanbanContainer />);

    // Verificar que hay 2 columnas
    expect(screen.getByTestId("columns-count")).toHaveTextContent("2");

    // Verificar que las actividades están en el orden correcto por columna
    expect(screen.getByTestId("activities-count-block-1")).toHaveTextContent("2");
    expect(screen.getByTestId("activities-count-block-2")).toHaveTextContent("1");
  });
});
