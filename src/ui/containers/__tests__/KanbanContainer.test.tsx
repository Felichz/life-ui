import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react-hooks";
import type { ActivityInstance, UUID } from "../../../types";

// Mock completo de useSystemCore con factory para garantizar que todos los métodos estén definidos
jest.mock("../../hooks/useSystemCore", () => {
  const mockActivateActivity = jest.fn();
  const mockUpdateActivityInstance = jest.fn();
  const mockIsDayActive = jest.fn().mockReturnValue(true);
  const mockIsTimeBlockAvailable = jest.fn().mockReturnValue(true);
  const mockCreateActivityInstance = jest.fn();
  const mockGetActivityTemplates = jest.fn().mockReturnValue([]);
  const mockGetInterruptionCauses = jest.fn().mockReturnValue([]);
  const mockCompleteActivity = jest.fn().mockReturnValue({
    id: "completed-activity-id",
    templateTitle: "Completed Activity",
  });

  const mockActivities = [
    {
      id: "activity-123",
      templateId: "template-123",
      blockId: "block-123",
      order: 0,
      state: "instantiated",
      timeboxingSettings: {
        type: "minimum-time",
        minimumDurationMinutes: 30,
      },
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
    {
      id: "activity-456",
      templateId: "template-456",
      blockId: "block-123",
      order: 1,
      state: "instantiated",
      timeboxingSettings: {
        type: "minimum-time",
        // Sin minimumDurationMinutes para forzar configuración
      },
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    },
  ];

  const mockSystemCore = {
    state: {
      global: {
        timeBlocks: [
          {
            id: "block-123",
            name: "Test Block",
            startMinute: 480,
            endMinute: 600,
            isDefault: false,
            order: 1,
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
          },
        ],
      },
      currentDay: {
        activityInstances: mockActivities,
        day: { id: "day-123" },
      },
    },
    activateActivity: mockActivateActivity,
    updateActivityInstance: mockUpdateActivityInstance,
    isDayActive: mockIsDayActive,
    isTimeBlockAvailable: mockIsTimeBlockAvailable,
    createActivityInstance: mockCreateActivityInstance,
    getActivityTemplates: mockGetActivityTemplates,
    getInterruptionCauses: mockGetInterruptionCauses,
    completeActivity: mockCompleteActivity,
  };

  return {
    __esModule: true,
    useSystemCore: jest.fn().mockReturnValue(mockSystemCore),
  };
});

// Importar el componente después de definir todos los mocks
import KanbanContainer from "../KanbanContainer";

jest.mock("../../hooks/useDragDrop", () => ({
  useDragDrop: () => ({
    handleDragEnd: jest.fn(),
    openConfigModal: jest.fn(),
  }),
}));

// Definir interfaces para los props del componente mockeado
interface BoardProps {
  onActivateActivity: (id: UUID) => void;
  mockIdToActivate?: string;
  [key: string]: unknown;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (templateId: UUID, blockId: UUID, settings: Record<string, unknown>) => void;
  [key: string]: unknown;
}

interface InterruptionCause {
  id: string;
  name: string;
}

// Mock estático de Board
const BoardMock = jest.fn((props: BoardProps) => (
  <div data-testid="mocked-board">
    <button
      data-testid="activate-button"
      onClick={() => props.onActivateActivity(props.mockIdToActivate || "activity-123")}
    >
      Activar desde Test
    </button>
  </div>
));

jest.mock("../../components/Kanban/Board", () => ({
  __esModule: true,
  default: (props: BoardProps) => BoardMock(props),
}));

jest.mock("../../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: (props: ModalProps) =>
    props.open ? (
      <div data-testid="activity-modal">
        <button
          data-testid="confirm-button"
          onClick={() => props.onConfirm("template-123", "block-123", {})}
        >
          Confirmar
        </button>
        <button data-testid="cancel-button" onClick={props.onClose}>
          Cancelar
        </button>
      </div>
    ) : null,
}));

// Mock para VariableModalContainer
jest.mock("../../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    onClose: () => void;
    relatedActivityIds?: string[];
    relatedEventIds?: string[];
    onConfirm?: () => void;
  }) =>
    props.open ? (
      <div data-testid="variable-modal">
        <button data-testid="variable-close" onClick={props.onClose}>
          Cerrar Variables
        </button>
        {props.onConfirm && (
          <button data-testid="variable-confirm" onClick={props.onConfirm}>
            Confirmar Variables
          </button>
        )}
      </div>
    ) : null,
}));

// Mock para InterruptionModalContainer
jest.mock("../../containers/InterruptionModalContainer", () => ({
  __esModule: true,
  default: (props: {
    open: boolean;
    onClose: () => void;
    activityTitle?: string;
    causes?: InterruptionCause[];
    isCreatingCause?: boolean;
    onConfirm?: (causeId: string, notes: string) => void;
    onCreateCause?: (name: string) => void;
    [key: string]: unknown;
  }) =>
    props.open ? (
      <div data-testid="interruption-modal">
        <button data-testid="interruption-close" onClick={props.onClose}>
          Cerrar Interrupción
        </button>
        {props.onConfirm && (
          <button
            data-testid="interruption-confirm"
            onClick={() => props.onConfirm?.("test-cause-id", "test-notes")}
          >
            Confirmar Interrupción
          </button>
        )}
      </div>
    ) : null,
}));

describe("KanbanContainer", () => {
  // Accedemos a los mocks directamente desde el módulo
  const mockUseSystemCore = jest.requireMock("../../hooks/useSystemCore").useSystemCore;

  beforeEach(() => {
    jest.clearAllMocks();
    BoardMock.mockClear();
  });

  test("debería activar directamente una actividad cuando no necesita configuración", async () => {
    render(<KanbanContainer />);

    // Simular clic en el botón de activar
    const activateButton = screen.getByTestId("activate-button");
    await act(async () => {
      fireEvent.click(activateButton);
    });

    // Obtenemos el mock del hook
    const mockSystemCore = mockUseSystemCore();

    // Verificar que se llama a activateActivity con el ID correcto
    expect(mockSystemCore.activateActivity).toHaveBeenCalledWith("activity-123");
    // Verificar que el modal no se abre
    expect(screen.queryByTestId("activity-modal")).not.toBeInTheDocument();
  });

  test("debería abrir el modal de configuración cuando la actividad necesita configuración", async () => {
    // Simular una actividad que necesita configuración (sin minimumDurationMinutes)
    const activityNeedsConfig = {
      id: "activity-456",
      templateId: "template-456",
      blockId: "block-123",
      order: 1,
      state: "instantiated",
      timeboxingSettings: {
        type: "minimum-time",
        // Sin minimumDurationMinutes para forzar configuración
      },
      createdAt: "2023-01-01T00:00:00Z",
      updatedAt: "2023-01-01T00:00:00Z",
    };

    // Modificamos el valor de retorno del mock para este test específico
    mockUseSystemCore.mockReturnValueOnce({
      ...mockUseSystemCore(),
      state: {
        ...mockUseSystemCore().state,
        currentDay: {
          ...mockUseSystemCore().state.currentDay,
          activityInstances: [activityNeedsConfig],
        },
      },
    });

    render(<KanbanContainer />);

    // Asegurarnos de que el mock fue llamado y obtener las props pasadas
    expect(BoardMock).toHaveBeenCalled();
    const onActivateActivity = BoardMock.mock.calls[0][0].onActivateActivity;

    // Renderizar un componente adicional con un botón para activar la actividad
    render(
      <div>
        <button
          data-testid="trigger-456"
          onClick={() => {
            onActivateActivity("activity-456");
          }}
        >
          Activar 456
        </button>
      </div>
    );

    // Activar directamente la actividad que necesita configuración
    const triggerButton = screen.getByTestId("trigger-456");
    await act(async () => {
      fireEvent.click(triggerButton);
    });

    // Verificar que se abre el modal de configuración
    expect(screen.getByTestId("activity-modal")).toBeInTheDocument();

    // Simular confirmación del modal
    const confirmButton = screen.getByTestId("confirm-button");
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    // Obtenemos el mock del hook para verificaciones
    const mockSystemCore = mockUseSystemCore();

    // Verificar que se actualiza y activa la actividad
    expect(mockSystemCore.updateActivityInstance).toHaveBeenCalled();
    expect(mockSystemCore.activateActivity).toHaveBeenCalled();
  });
});
