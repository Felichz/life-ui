import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DayPage from "../DayPage";
import { useSystemCore } from "../../hooks/useSystemCore";

// Mock del hook useSystemCore
jest.mock("../../hooks/useSystemCore");

// Mock del contexto de completion flow: simulamos el flow real con un state
// interno para poder verificar la interacción entre resolve y los cierres
// consecutivos (regresión: completionRequest stale entre cierres).
type FlowStore = {
  pendingCloseId: string | null;
  pendingContinuation: (() => void) | null;
  closeError: string | null;
  registeredHandlers: {
    onConfirm: (id: string, score: number) => void;
    onInterrupt: (id: string) => void;
  };
  requestCloseActive: (id: string, cont: () => void) => void;
  resolve: (score: number) => boolean;
  reject: () => boolean;
  cancel: () => void;
  clearCloseError: () => void;
};

const flowStore: FlowStore = {
  pendingCloseId: null,
  pendingContinuation: null,
  closeError: null,
  registeredHandlers: {
    onConfirm: () => {},
    onInterrupt: () => {},
  },
  requestCloseActive: (id, cont) => {
    flowStore.pendingCloseId = id;
    flowStore.pendingContinuation = cont;
    flowStore.closeError = null;
  },
  resolve: (score: number): boolean => {
    const id = flowStore.pendingCloseId;
    if (!id) return false;
    try {
      flowStore.registeredHandlers.onConfirm(id, score);
    } catch (e) {
      flowStore.closeError = e instanceof Error ? e.message : "Error";
      return false;
    }
    flowStore.pendingCloseId = null;
    flowStore.pendingContinuation = null;
    flowStore.closeError = null;
    return true;
  },
  reject: (): boolean => {
    const id = flowStore.pendingCloseId;
    if (!id) return false;
    try {
      flowStore.registeredHandlers.onInterrupt(id);
    } catch (e) {
      flowStore.closeError = e instanceof Error ? e.message : "Error";
      return false;
    }
    flowStore.pendingCloseId = null;
    flowStore.pendingContinuation = null;
    flowStore.closeError = null;
    return true;
  },
  cancel: () => {
    flowStore.pendingCloseId = null;
    flowStore.pendingContinuation = null;
    flowStore.closeError = null;
  },
  clearCloseError: () => {
    flowStore.closeError = null;
  },
};

const resetFlow = () => {
  flowStore.pendingCloseId = null;
  flowStore.pendingContinuation = null;
  flowStore.closeError = null;
  flowStore.registeredHandlers.onConfirm = () => {};
  flowStore.registeredHandlers.onInterrupt = () => {};
};

jest.mock("../../context/CompletionFlowContext", () => ({
  useCompletionFlow: () => ({
    get pendingCloseId() {
      return flowStore.pendingCloseId;
    },
    get pendingContinuation() {
      return flowStore.pendingContinuation;
    },
    get closeError() {
      return flowStore.closeError;
    },
    requestCloseActive: flowStore.requestCloseActive,
    registerCloseHandlers: (
      onConfirm: (id: string, score: number) => void,
      onInterrupt: (id: string) => void
    ) => {
      flowStore.registeredHandlers.onConfirm = onConfirm;
      flowStore.registeredHandlers.onInterrupt = onInterrupt;
    },
    resolve: flowStore.resolve,
    reject: flowStore.reject,
    cancel: flowStore.cancel,
    clearCloseError: flowStore.clearCloseError,
  }),
}));

// Mock de los componentes hijos para evitar renderizado completo
jest.mock("../../containers/KanbanContainer", () => ({
  __esModule: true,
  default: jest.fn(({ children }: { children?: React.ReactNode }) => (
    <div data-testid="kanban-container">{children}</div>
  )),
}));

jest.mock("../../containers/QuickBarContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="quickbar-container">QuickBar mocked</div>),
}));

jest.mock("../../containers/EventQuickBarContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="event-quickbar-container">EventQuickBar mocked</div>),
}));

jest.mock("../../containers/TimelineContainer", () => ({
  __esModule: true,
  default: jest.fn(() => <div data-testid="timeline-container">Timeline mocked</div>),
}));

jest.mock("../../containers/ActivityLibraryContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="activity-library-container" data-open={open}>
      ActivityLibrary mocked
    </div>
  )),
}));

jest.mock("../../containers/TimeBlockModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="timeblock-modal-container" data-open={open}>
      TimeBlockModal mocked
    </div>
  )),
}));

jest.mock("../../containers/EventLibraryModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="event-library-modal-container" data-open={open}>
      EventLibraryModal mocked
    </div>
  )),
}));

jest.mock("../../containers/VariableModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="variable-modal-container" data-open={open}>
      VariableModal mocked
    </div>
  )),
}));

jest.mock("../../containers/OverviewModalContainer", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="overview-modal-container" data-open={open}>
      OverviewModal mocked
    </div>
  )),
}));

jest.mock("../../modals/ActivityInstanceModal", () => ({
  __esModule: true,
  default: jest.fn(({ open }: { open: boolean }) => (
    <div data-testid="activity-instance-modal" data-open={open}>
      ActivityInstanceModal mocked
    </div>
  )),
}));

jest.mock("@hello-pangea/dnd", () => ({
  DragDropContext: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

// Mock de CompletionModal: expone botones para que el test dispare onConfirm /
// onInterrupt / onClose manualmente, y muestra el activityTitle del request
// recibido para que el test verifique que es el correcto.
jest.mock("../../modals/CompletionModal", () => ({
  __esModule: true,
  default: jest.fn(
    ({
      open,
      request,
      onConfirm,
      onInterrupt,
      onClose,
    }: {
      open: boolean;
      request: { activityTitle: string } | null;
      onConfirm: (assessment: { satisfactionScore: number }) => void;
      onInterrupt: () => void;
      onClose: () => void;
    }) => {
      if (!open || !request) return null;
      return (
        <div data-testid="completion-modal" data-title={request.activityTitle}>
          <button data-testid="cm-confirm" onClick={() => onConfirm({ satisfactionScore: 8 })}>
            Confirmar
          </button>
          <button data-testid="cm-interrupt" onClick={onInterrupt}>
            Interrumpir
          </button>
          <button data-testid="cm-close" onClick={onClose}>
            Cerrar
          </button>
        </div>
      );
    }
  ),
}));

describe("DayPage", () => {
  // Configuración del mock para useSystemCore
  // `state.global` es requerido por TempoBanner, DayMetrics, etc.
  const mockUseSystemCore = () => ({
    isDayActive: jest.fn(() => true),
    createActivityInstance: jest.fn(),
    getActiveActivity: jest.fn(() => null),
    canUpdateVariables: jest.fn(() => true),
    requestCompletion: jest.fn(() => ({
      activityTitle: "Test",
      durationMinutes: 30,
      estimatedMinutes: 30,
      canApplyBonus: false,
      requestedAt: "2023-01-01T12:00:00.000Z",
    })),
    completeActivity: jest.fn(() => ({
      record: { id: "rec", satisfactionScore: 8, temposAwarded: 24 },
      temposAwarded: 24,
      beatEstimate: false,
      dailyTempoTotal: 24,
      targetProgress: 0.024,
    })),
    interruptActivity: jest.fn(() => ({ id: "rec", temposAwarded: 0 })),
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
        subjectiveVariables: [],
        interruptionCauses: [],
        timeBlocks: [],
        userPreferences: { hiddenSubjectiveVariableIds: [], dailyTempoTarget: 1000, updatedAt: "" },
        completedActivityRecords: [],
        eventInstances: [],
        subjectiveVariableSnapshots: [],
        schemaVersion: 2,
      },
      currentDay: null,
    },
  });

  beforeEach(() => {
    jest.clearAllMocks();
    resetFlow();
    (useSystemCore as jest.Mock).mockImplementation(mockUseSystemCore);
  });

  test("muestra mensaje cuando no hay día activo", () => {
    // Sobrescribir mock para un día inactivo
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockUseSystemCore(),
      isDayActive: () => false,
    }));

    render(<DayPage />);
    expect(screen.getByText("No hay un día activo")).toBeInTheDocument();
    expect(screen.getByText("Debes iniciar un día para acceder a esta vista.")).toBeInTheDocument();
  });

  test("renderiza componentes principales cuando hay día activo", () => {
    render(<DayPage />);

    // Verificar que se muestran los componentes principales
    expect(screen.getByTestId("day-page")).toBeInTheDocument();
    expect(screen.getByTestId("kanban-container")).toBeInTheDocument();
    expect(screen.getByTestId("quickbar-container")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-container")).toBeInTheDocument();
  });

  test("abre el modal OverviewModal al hacer clic en el botón de resumen histórico", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("overview-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de resumen histórico
    fireEvent.click(screen.getByLabelText("ver resumen histórico"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("overview-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal ActivityLibrary al hacer clic en el botón de biblioteca", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("activity-library-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de biblioteca
    fireEvent.click(screen.getByLabelText("abrir biblioteca de actividades"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("activity-library-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal TimeBlockModal al hacer clic en el botón de bloques", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("timeblock-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de bloques
    fireEvent.click(screen.getByLabelText("gestionar bloques de tiempo"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("timeblock-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("abre el modal EventLibraryModal al hacer clic en el botón de eventos", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("event-library-modal-container")).toHaveAttribute(
      "data-open",
      "false"
    );

    // Hacer clic en el botón de eventos
    fireEvent.click(screen.getByLabelText("gestionar biblioteca de eventos"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("event-library-modal-container")).toHaveAttribute(
      "data-open",
      "true"
    );
  });

  test("abre el modal VariableModal al hacer clic en el botón de variables", () => {
    render(<DayPage />);

    // Verificar que el modal está cerrado inicialmente
    expect(screen.getByTestId("variable-modal-container")).toHaveAttribute("data-open", "false");

    // Hacer clic en el botón de variables
    fireEvent.click(screen.getByLabelText("actualizar variables subjetivas"));

    // Verificar que el modal se abre
    expect(screen.getByTestId("variable-modal-container")).toHaveAttribute("data-open", "true");
  });

  test("deshabilita el botón de variables cuando no se pueden actualizar", () => {
    // Sobrescribir mock para variables no actualizables
    (useSystemCore as jest.Mock).mockImplementation(() => ({
      ...mockUseSystemCore(),
      canUpdateVariables: () => false,
    }));

    render(<DayPage />);

    // Verificar que el botón está deshabilitado
    expect(screen.getByLabelText("actualizar variables subjetivas")).toBeDisabled();
  });

  describe("cierres consecutivos (regresión: completionRequest stale)", () => {
    // Antes: tras un cierre exitoso, completionRequest quedaba con los
    // datos de la actividad anterior. Al pedir el cierre de la siguiente
    // actividad, el useEffect !(pendingCloseId && !completionRequest)
    // NO se disparaba → requestCompletion() no se llamaba → el modal
    // mostraba título/duración de la actividad previa.

    const setupTwoActivities = () => {
      const mockRequestCompletion = jest.fn(
        (id: string): {
          activityTitle: string;
          durationMinutes: number;
          estimatedMinutes: number;
          canApplyBonus: boolean;
          requestedAt: string;
        } => ({
          activityTitle: id === "act-A" ? "Actividad A" : "Actividad B",
          durationMinutes: id === "act-A" ? 30 : 45,
          estimatedMinutes: id === "act-A" ? 30 : 60,
          canApplyBonus: id === "act-A" ? false : true,
          requestedAt: "2023-01-01T12:00:00.000Z",
        })
      );
      const mockCompleteActivity = jest.fn(() => ({
        record: { id: "rec", satisfactionScore: 8, temposAwarded: 24 },
        temposAwarded: 24,
        beatEstimate: false,
        dailyTempoTotal: 24,
        targetProgress: 0.024,
      }));
      (useSystemCore as jest.Mock).mockImplementation(() => ({
        ...mockUseSystemCore(),
        requestCompletion: mockRequestCompletion,
        completeActivity: mockCompleteActivity,
      }));
      return { mockRequestCompletion, mockCompleteActivity };
    };

    test("cierre A exitoso → cierre B muestra título/duración correctos", () => {
      const { mockRequestCompletion, mockCompleteActivity } = setupTwoActivities();

      const { rerender } = render(<DayPage />);

      // 1) Pedir cierre de A
      act(() => {
        flowStore.requestCloseActive("act-A", () => {});
        rerender(<DayPage />);
      });
      // El useEffect del DayPage debió llamar requestCompletion("act-A")
      expect(mockRequestCompletion).toHaveBeenCalledWith("act-A");
      expect(screen.getByTestId("completion-modal")).toHaveAttribute("data-title", "Actividad A");

      // 2) Resolver A (éxito)
      act(() => {
        screen.getByTestId("cm-confirm").click();
        rerender(<DayPage />);
      });
      expect(mockCompleteActivity).toHaveBeenCalledWith(
        "act-A",
        expect.objectContaining({ satisfactionScore: 8 })
      );
      // El modal se cerró (pendingCloseId = null)
      expect(screen.queryByTestId("completion-modal")).not.toBeInTheDocument();

      // 3) Pedir cierre de B — requestCompletion DEBE llamarse con "act-B"
      act(() => {
        flowStore.requestCloseActive("act-B", () => {});
        rerender(<DayPage />);
      });
      expect(mockRequestCompletion).toHaveBeenCalledWith("act-B");
      expect(screen.getByTestId("completion-modal")).toHaveAttribute("data-title", "Actividad B");
    });

    test("cierre A con error → estado preservado → cierre B funciona normal", () => {
      const { mockRequestCompletion, mockCompleteActivity } = setupTwoActivities();
      // Primer completeActivity lanza para simular fallo
      mockCompleteActivity.mockImplementationOnce(() => {
        throw new Error("disco lleno");
      });

      const { rerender } = render(<DayPage />);

      // 1) Cierre A falla
      act(() => {
        flowStore.requestCloseActive("act-A", () => {});
        rerender(<DayPage />);
      });
      act(() => {
        screen.getByTestId("cm-confirm").click();
        rerender(<DayPage />);
      });
      // Modal sigue abierto con título de A
      expect(screen.getByTestId("completion-modal")).toHaveAttribute("data-title", "Actividad A");
      // Reintentamos: ahora sí funciona
      act(() => {
        screen.getByTestId("cm-confirm").click();
        rerender(<DayPage />);
      });
      // Modal se cierra (éxito en el segundo intento)
      expect(screen.queryByTestId("completion-modal")).not.toBeInTheDocument();

      // 2) Cierre B usa datos frescos
      act(() => {
        flowStore.requestCloseActive("act-B", () => {});
        rerender(<DayPage />);
      });
      expect(mockRequestCompletion).toHaveBeenCalledWith("act-B");
      expect(screen.getByTestId("completion-modal")).toHaveAttribute("data-title", "Actividad B");
    });
  });
});
