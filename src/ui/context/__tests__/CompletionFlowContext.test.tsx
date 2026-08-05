/**
 * @jest-environment jsdom
 */

import React from "react";
import { act, render, screen } from "@testing-library/react";
import {
  CompletionFlowProvider,
  useCompletionFlow,
} from "../CompletionFlowContext";

interface FlowShape {
  pendingCloseId: string | null;
  pendingContinuation: (() => void) | null;
  closeError: string | null;
  requestCloseActive: (id: string, continuation: () => void) => void;
  registerCloseHandlers: (
    onConfirm: (id: string, score: number) => void,
    onInterrupt: (id: string) => void
  ) => void;
  resolve: (score: number) => boolean;
  reject: () => boolean;
  cancel: () => void;
  clearCloseError: () => void;
}

interface HarnessProps {
  onConfirm?: (id: string, score: number) => void;
  onInterrupt?: (id: string) => void;
}

const Harness: React.FC<HarnessProps> = ({ onConfirm, onInterrupt }) => {
  const flow = useCompletionFlow();
  React.useEffect(() => {
    if (onConfirm || onInterrupt) {
      flow.registerCloseHandlers(
        onConfirm ?? (() => {}),
        onInterrupt ?? (() => {})
      );
    }
  }, [flow, onConfirm, onInterrupt]);
  (window as unknown as { __harness?: { flow: FlowShape } }).__harness = { flow };
  return (
    <div>
      <span data-testid="pendingCloseId">{flow.pendingCloseId || "none"}</span>
      <span data-testid="closeError">{flow.closeError || "none"}</span>
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

const renderWith = (props: HarnessProps = {}) =>
  render(
    <CompletionFlowProvider>
      <Harness {...props} />
    </CompletionFlowProvider>
  );

const getFlow = () =>
  (window as unknown as { __harness: { flow: FlowShape } }).__harness.flow;

describe("CompletionFlowContext", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("estado inicial", () => {
    it("empieza sin cierre pendiente y sin continuation", () => {
      renderWith();
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
      expect(getFlow().pendingContinuation).toBeNull();
    });

    it("fallback no-op si se usa fuera del provider", () => {
      render(<Harness />);
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });

    it("NO expone requestedAt propio: el timestamp viene del manager", () => {
      renderWith();
      const flow = getFlow();
      // La nueva API: el contexto delega la fuente del timestamp.
      expect((flow as unknown as { requestedAt?: unknown }).requestedAt).toBeUndefined();
    });
  });

  describe("requestCloseActive", () => {
    it("establece pendingCloseId", () => {
      renderWith();
      act(() => {
        getFlow().requestCloseActive("act-1", () => {});
      });
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-1");
    });

    it("el último request gana si hay uno pendiente", () => {
      renderWith();
      act(() => {
        getFlow().requestCloseActive("act-1", () => {});
        getFlow().requestCloseActive("act-2", () => {});
      });
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-2");
    });
  });

  describe("resolve: una sola autoridad + continuation solo en éxito", () => {
    it("invoca onConfirm UNA vez con (id, score) y luego continuation en éxito (retorna true)", () => {
      const onConfirm = jest.fn();
      const onCont = jest.fn();
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      let result: boolean | undefined;
      act(() => {
        result = getFlow().resolve(8);
      });
      expect(result).toBe(true);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onConfirm).toHaveBeenCalledWith("act-1", 8);
      expect(onCont).toHaveBeenCalledTimes(1);
    });

    it("NO ejecuta continuation si onConfirm lanza (retorna false, state preservado)", () => {
      const onConfirm = jest.fn(() => {
        throw new Error("boom");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      let result: boolean | undefined;
      act(() => {
        result = getFlow().resolve(8);
      });
      expect(result).toBe(false);
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCont).not.toHaveBeenCalled();
      expect(errSpy).toHaveBeenCalled();
      errSpy.mockRestore();
    });

    it("limpia pendingCloseId tras resolver", () => {
      renderWith();
      act(() => {
        getFlow().requestCloseActive("act-1", () => {});
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });
  });

  describe("reject: una sola autoridad + continuation solo en éxito", () => {
    it("invoca onInterrupt UNA vez y luego continuation en éxito (retorna true)", () => {
      const onInterrupt = jest.fn();
      const onCont = jest.fn();
      renderWith({ onInterrupt });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      let result: boolean | undefined;
      act(() => {
        result = getFlow().reject();
      });
      expect(result).toBe(true);
      expect(onInterrupt).toHaveBeenCalledTimes(1);
      expect(onInterrupt).toHaveBeenCalledWith("act-1");
      expect(onCont).toHaveBeenCalledTimes(1);
    });

    it("NO ejecuta continuation si onInterrupt lanza (retorna false, state preservado)", () => {
      const onInterrupt = jest.fn(() => {
        throw new Error("boom");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onInterrupt });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      let result: boolean | undefined;
      act(() => {
        result = getFlow().reject();
      });
      expect(result).toBe(false);
      expect(onInterrupt).toHaveBeenCalledTimes(1);
      expect(onCont).not.toHaveBeenCalled();
      errSpy.mockRestore();
    });
  });

  describe("cancel", () => {
    it("limpia el estado sin ejecutar continuation ni callbacks", () => {
      const onConfirm = jest.fn();
      const onInterrupt = jest.fn();
      const onCont = jest.fn();
      renderWith({ onConfirm, onInterrupt });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      act(() => {
        screen.getByTestId("cancel").click();
      });
      expect(onConfirm).not.toHaveBeenCalled();
      expect(onInterrupt).not.toHaveBeenCalled();
      expect(onCont).not.toHaveBeenCalled();
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
    });
  });

  describe("errores en el cierre: feedback visible + state preservado", () => {
    it("si onConfirm lanza: setea closeError y PRESERVA el state (modal sigue abierto)", () => {
      const onConfirm = jest.fn(() => {
        throw new Error("disco lleno");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("none");

      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCont).not.toHaveBeenCalled();
      // State preservado: el modal sigue "abierto" (pendingCloseId intacto)
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-1");
      // closeError visible
      expect(screen.getByTestId("closeError")).toHaveTextContent("disco lleno");
      errSpy.mockRestore();
    });

    it("si onInterrupt lanza: setea closeError y PRESERVA el state", () => {
      const onInterrupt = jest.fn(() => {
        throw new Error("no se pudo interrumpir");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onInterrupt });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });

      act(() => {
        screen.getByTestId("reject").click();
      });
      expect(onInterrupt).toHaveBeenCalledTimes(1);
      expect(onCont).not.toHaveBeenCalled();
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-1");
      expect(screen.getByTestId("closeError")).toHaveTextContent("no se pudo interrumpir");
      errSpy.mockRestore();
    });

    it("clearCloseError limpia el error sin tocar el state", () => {
      const onConfirm = jest.fn(() => {
        throw new Error("boom");
      });
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", () => {});
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("boom");

      act(() => {
        getFlow().clearCloseError();
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("none");
      // State preservado
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-1");
      errSpy.mockRestore();
    });

    it("retry: tras un fallo, el usuario puede volver a llamar resolve y esta vez tiene éxito", () => {
      let attempts = 0;
      const onConfirm = jest.fn(() => {
        attempts += 1;
        if (attempts === 1) throw new Error("transient");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });

      // Primer intento: falla
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(onCont).not.toHaveBeenCalled();
      expect(screen.getByTestId("closeError")).toHaveTextContent("transient");

      // Limpiamos error y reintentamos: ahora tiene éxito
      act(() => {
        getFlow().clearCloseError();
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(onConfirm).toHaveBeenCalledTimes(2);
      expect(onCont).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
      errSpy.mockRestore();
    });

    it("cancel limpia el closeError junto con el state", () => {
      const onConfirm = jest.fn(() => {
        throw new Error("boom");
      });
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", () => {});
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("boom");

      act(() => {
        screen.getByTestId("cancel").click();
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("none");
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("none");
      errSpy.mockRestore();
    });

    it("requestCloseActive limpia el closeError previo al abrir uno nuevo", () => {
      const onConfirm = jest.fn(() => {
        throw new Error("primer fallo");
      });
      const onCont = jest.fn();
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
      renderWith({ onConfirm });
      act(() => {
        getFlow().requestCloseActive("act-1", onCont);
      });
      act(() => {
        screen.getByTestId("resolve").click();
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("primer fallo");

      act(() => {
        getFlow().requestCloseActive("act-2", onCont);
      });
      expect(screen.getByTestId("closeError")).toHaveTextContent("none");
      expect(screen.getByTestId("pendingCloseId")).toHaveTextContent("act-2");
      errSpy.mockRestore();
    });
  });
});
