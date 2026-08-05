import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import type { UUID } from "../../types";

/**
 * Coordinator para el ritual de cierre de actividad activa.
 *
 * El contexto es la **única autoridad** que ejecuta la acción de cierre.
 * Los callbacks de cierre (`onConfirm`/`onInterrupt`) los registra el
 * componente que conoce el sistema (típicamente DayPage) y se aplican
 * a CUALQUIER cierre pendiente, sin importar quién lo haya pedido.
 *
 * Reglas:
 * 1. Una sola ejecución de `onConfirm`/`onInterrupt` por resolución.
 * 2. `continuation` se ejecuta **solo si el callback de cierre tuvo éxito**.
 * 3. Si el callback lanza, el estado del flujo se PRESERVA y `closeError`
 *    se setea con el mensaje. El modal no se cierra: el usuario ve el
 *    error y puede reintentar o cancelar. No debe parecer que la acción
 *    funcionó si no se registró la recompensa.
 * 4. `cancel` descarta el cierre pendiente y limpia cualquier error.
 * 5. El `requestedAt` (timestamp congelado) NO vive en este contexto:
 *    viene de `activityManager.requestCompletion()` vía `CompletionRequest`.
 */

type ConfirmHandler = (activityId: UUID, score: number) => void;
type InterruptHandler = (activityId: UUID) => void;

interface CompletionFlowContextValue {
  pendingCloseId: UUID | null;
  pendingContinuation: (() => void) | null;
  /** Error del último cierre (si el callback de cierre lanzó). Null si OK. */
  closeError: string | null;

  requestCloseActive: (activityId: UUID, continuation: () => void) => void;
  registerCloseHandlers: (onConfirm: ConfirmHandler, onInterrupt: InterruptHandler) => void;

  resolve: (score: number) => void;
  reject: () => void;
  cancel: () => void;
  /** Limpia el error sin tocar el state del flow (útil cuando el usuario reintenta). */
  clearCloseError: () => void;
}

interface InternalState {
  activityId: UUID;
  continuation: () => void;
}

const CompletionFlowContext = createContext<CompletionFlowContextValue | undefined>(undefined);

export const CompletionFlowProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<InternalState | null>(null);
  const [closeError, setCloseError] = useState<string | null>(null);

  const handlersRef = useRef<{ onConfirm: ConfirmHandler; onInterrupt: InterruptHandler }>({
    onConfirm: () => {},
    onInterrupt: () => {},
  });

  const requestCloseActive = useCallback((activityId: UUID, continuation: () => void) => {
    setCloseError(null);
    setState({ activityId, continuation });
  }, []);

  const registerCloseHandlers = useCallback(
    (onConfirm: ConfirmHandler, onInterrupt: InterruptHandler) => {
      handlersRef.current = { onConfirm, onInterrupt };
    },
    []
  );

  const resolve = useCallback(
    (score: number) => {
      const s = state;
      if (!s) return;
      try {
        handlersRef.current.onConfirm(s.activityId, score);
      } catch (e) {
        // Fallo: el modal NO se cierra. El usuario ve el error y puede
        // reintentar o cancelar. La continuation NO corre.
        const message = e instanceof Error ? e.message : "Error desconocido al cerrar";
        setCloseError(message);
        console.error("CompletionFlow: onConfirm lanzó, se omite continuation.", e);
        return;
      }
      setCloseError(null);
      setState(null);
      s.continuation();
    },
    [state]
  );

  const reject = useCallback(() => {
    const s = state;
    if (!s) return;
    try {
      handlersRef.current.onInterrupt(s.activityId);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Error desconocido al interrumpir";
      setCloseError(message);
      console.error("CompletionFlow: onInterrupt lanzó, se omite continuation.", e);
      return;
    }
    setCloseError(null);
    setState(null);
    s.continuation();
  }, [state]);

  const cancel = useCallback(() => {
    setState(null);
    setCloseError(null);
  }, []);

  const clearCloseError = useCallback(() => {
    setCloseError(null);
  }, []);

  return (
    <CompletionFlowContext.Provider
      value={{
        requestCloseActive,
        registerCloseHandlers,
        pendingCloseId: state?.activityId ?? null,
        pendingContinuation: state?.continuation ?? null,
        closeError,
        resolve,
        reject,
        cancel,
        clearCloseError,
      }}
    >
      {children}
    </CompletionFlowContext.Provider>
  );
};

export const useCompletionFlow = () => {
  const ctx = useContext(CompletionFlowContext);
  if (!ctx) {
    return {
      pendingCloseId: null,
      pendingContinuation: null,
      closeError: null,
      requestCloseActive: () => {},
      registerCloseHandlers: () => {},
      resolve: () => {},
      reject: () => {},
      cancel: () => {},
      clearCloseError: () => {},
    };
  }
  return ctx;
};
