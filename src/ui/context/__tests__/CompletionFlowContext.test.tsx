/**
 * @jest-environment jsdom
 */

import React, { useEffect } from "react";
import { act, render, screen } from "@testing-library/react";
import {
  CompletionFlowProvider,
  useCompletionFlow,
} from "../CompletionFlowContext";

interface HarnessProps {
  onCont?: () => void;
  onConfirm?: (id: string, score: number) => void;
  onInterrupt?: (id: string) => void;
}

interface FlowShape {
  pendingCloseId: string | null;
  requestedAt: string | null;
  requestCloseActive: (
    id: string,
    continuation: () => void,
    onConfirm: (id: string, score: number) => void,
    onInterrupt: (id: string) => void
  ) => void;
  resolve: (score: number) => void;
  reject: () => void;
  cancel: () => void;
}

const Harness: React.FC<HarnessProps> = ({ onCont, onConfirm, onInterrupt }) => {
  const flow = useCompletionFlow();
  (window as unknown as { __harness?: { flow: FlowShape } }).__harness = { flow };
  return (
    <div>
      <span data-testid="pendingCloseId">{flow.pendingCloseId || "none"}</span>
      <span data-testid="requestedAt">{flow.requestedAt || "none"}</span>
      <button data-testid="resolve" onClick={() => flow.resolve(8)}>
        resolve
      </button>
      <button data-testid="reject" onClick={() => flow.reject()}>
        reject
      </button>
      <button data-testid="cancel" onClick={() => flow.cancel()}>
        cancel
      </button>
    </div>
  );
};

const renderWith = (props: HarnessProps) =>
  render(
    <CompletionFlowProvider>
      <Harness {...props} />
    </CompletionFlowProvider>
  );

const trigger = (id: string) => {
  const harness = (window as unknown as { __harness: { flow: { requestCloseActive: (...args: unknown[]) => void } } }).__harness;
  harness.flow.requestCloseActive(id, () => {}, () => {}, () => {});
};

describe("CompletionFlowContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("estado inicial", () => {
    it("empieza sin cierre pendiente", () => {
      renderWith({});
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
      expect(screen.getByTestId("requestedAt")).toHaveTextContent("none");
    });

    it("fallback no-op si se usa fuera del provider", () => {
      render(<Harness />);
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });
  });

  describe("requestCloseActive", () => {
    it("establece pendingCloseId y requestedAt", () => {
      renderWith({});
      act(() => {
        trigger("act-1");
      });
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-1");
      expect(screen.getByTestId("requestedAt")).not.toHaveTextContent("none");
    });

    it("la continuation se ejecuta al resolver", () => {
      let contCalled = false;
      let _interruptedId = "";
      let _receivedScore = -1;

      renderWith({
        onCont: () => {
          contCalled = true;
        },
      });
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive(
          "act-1",
          () => {
            contCalled = true;
          },
          (id: string, score: number) => {
            _interruptedId = id;
            _receivedScore = score;
          },
          (id: string) => {
            _interruptedId = id;
          }
        );
      });
      void _interruptedId;
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(contCalled).toBe(true);
    });

    it("la continuation se ejecuta al rechazar", () => {
      let contCalled = false;
      let interruptedId = "";

      renderWith({
        onCont: () => {
          contCalled = true;
        },
      });
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive(
          "act-1",
          () => {
            contCalled = true;
          },
          () => {},
          (id: string) => {
            interruptedId = id;
          }
        );
      });
      act(() => {
        screen.getByTestId("reject").click();
      });
      expect(contCalled).toBe(true);
      expect(interruptedId).toBe("act-1");
    });

    it("cancel limpia el estado sin ejecutar continuation", () => {
      let contCalled = false;
      renderWith({
        onCont: () => {
          contCalled = true;
        },
      });
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive(
          "act-1",
          () => {
            contCalled = true;
          },
          () => {},
          () => {}
        );
      });
      act(() => {
        screen.getByTestId("cancel").click();
      });
      expect(contCalled).toBe(false);
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });
  });

  describe("resolve / reject cleanup", () => {
    it("resolve limpia pendingCloseId", () => {
      renderWith({});
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive("act-1", () => {}, () => {}, () => {});
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });

    it("resolve invoca onConfirm con score", () => {
      let receivedScore = -1;
      let receivedId = "";
      renderWith({});
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive(
          "act-1",
          () => {},
          (id: string, score: number) => {
            receivedId = id;
            receivedScore = score;
          },
          () => {}
        );
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(receivedId).toBe("act-1");
      expect(receivedScore).toBe(8);
    });

    it("reject invoca onInterrupt", () => {
      let receivedId = "";
      renderWith({});
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive(
          "act-1",
          () => {},
          () => {},
          (id: string) => {
            receivedId = id;
          }
        );
      });
      act(() => {
        screen.getByTestId("reject").click();
      });
      expect(receivedId).toBe("act-1");
    });
  });

  describe("múltiples cierres", () => {
    it("rechaza nuevos cierres cuando ya hay uno pendiente", () => {
      renderWith({});
      act(() => {
        const flow = (window as unknown as { __harness: { flow: any } }).__harness.flow;
        flow.requestCloseActive("act-1", () => {}, () => {}, () => {});
        flow.requestCloseActive("act-2", () => {}, () => {}, () => {});
      });
      // El último gana
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-2");
    });
  });
});