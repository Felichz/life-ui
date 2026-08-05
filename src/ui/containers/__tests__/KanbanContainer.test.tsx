import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import type { UUID } from "../../../types";

// Mock del contexto de completion flow
const mockRequestCloseActive = jest.fn();
const mockPendingCloseId = null;

jest.mock("../../context/CompletionFlowContext", () => ({
  useCompletionFlow: () => ({
    pendingCloseId: mockPendingCloseId,
    pendingContinuation: null,
    requestCloseActive: mockRequestCloseActive,
    registerCloseHandlers: jest.fn(),
    resolve: jest.fn(),
    reject: jest.fn(),
    cancel: jest.fn(),
  }),
}));

// Mock de useSystemCore con factory
const mockActivateActivity = jest.fn();
const mockUpdateActivityInstance = jest.fn();
const mockIsDayActive = jest.fn().mockReturnValue(true);
const mockIsTimeBlockAvailable = jest.fn().mockReturnValue(true);
const mockCreateActivityInstance = jest.fn();
const mockGetActivityTemplates = jest.fn().mockReturnValue([]);
const mockGetActiveActivity = jest.fn().mockReturnValue(null);

jest.mock("../../hooks/useSystemCore", () => ({
  useSystemCore: () => ({
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
        activityTemplates: [],
      },
      currentDay: {
        activityInstances: [
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
            },
            createdAt: "2023-01-01T00:00:00Z",
            updatedAt: "2023-01-01T00:00:00Z",
          },
        ],
        day: { id: "day-123" },
      },
    },
    activateActivity: mockActivateActivity,
    updateActivityInstance: mockUpdateActivityInstance,
    isDayActive: mockIsDayActive,
    isTimeBlockAvailable: mockIsTimeBlockAvailable,
    createActivityInstance: mockCreateActivityInstance,
    getActivityTemplates: mockGetActivityTemplates,
    getActiveActivity: mockGetActiveActivity,
  }),
}));

import KanbanContainer from "../KanbanContainer";

jest.mock("../../hooks/useDragDrop", () => ({
  useDragDrop: () => ({
    handleDragEnd: jest.fn(),
    openConfigModal: jest.fn(),
  }),
}));

interface BoardProps {
  onActivateActivity: (id: UUID) => void;
  [key: string]: unknown;
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (templateId: UUID, blockId: UUID, settings: Record<string, unknown>) => void;
  [key: string]: unknown;
}

const BoardMock = jest.fn((props: BoardProps) => (
  <div data-testid="mocked-board">
    <button
      data-testid="activate-button"
      onClick={() => props.onActivateActivity("activity-123")}
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

describe("KanbanContainer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    BoardMock.mockClear();
  });

  test("debería activar directamente una actividad cuando no necesita configuración", async () => {
    render(<KanbanContainer />);

    const activateButton = screen.getByTestId("activate-button");
    await act(async () => {
      fireEvent.click(activateButton);
    });

    expect(mockActivateActivity).toHaveBeenCalledWith("activity-123");
    expect(screen.queryByTestId("activity-modal")).not.toBeInTheDocument();
  });

  test("debería abrir el modal de configuración cuando la actividad necesita configuración", async () => {
    render(<KanbanContainer />);

    expect(BoardMock).toHaveBeenCalled();
    const onActivateActivity = BoardMock.mock.calls[0][0].onActivateActivity;

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

    const triggerButton = screen.getByTestId("trigger-456");
    await act(async () => {
      fireEvent.click(triggerButton);
    });

    expect(screen.getByTestId("activity-modal")).toBeInTheDocument();

    const confirmButton = screen.getByTestId("confirm-button");
    await act(async () => {
      fireEvent.click(confirmButton);
    });

    expect(mockUpdateActivityInstance).toHaveBeenCalled();
    expect(mockActivateActivity).toHaveBeenCalled();
  });

  test("debería delegar el cierre de actividad al completionFlow al completar", () => {
    render(<KanbanContainer />);

    const onCompleteActivity = BoardMock.mock.calls[0][0].onCompleteActivity as (id: string) => void;
    onCompleteActivity("activity-123");

    // API nueva: solo (id, continuation). El contexto ejecuta los handlers
    // registrados por DayPage (registrados en una useEffect, fuera del scope
    // de este test) y luego corre la continuation en éxito.
    expect(mockRequestCloseActive).toHaveBeenCalledWith("activity-123", expect.any(Function));
  });

  test("debería delegar el cierre de actividad al completionFlow al interrumpir", () => {
    render(<KanbanContainer />);

    const onInterruptActivity = BoardMock.mock.calls[0][0].onInterruptActivity as (id: string) => void;
    onInterruptActivity("activity-123");

    expect(mockRequestCloseActive).toHaveBeenCalledWith("activity-123", expect.any(Function));
  });
});
