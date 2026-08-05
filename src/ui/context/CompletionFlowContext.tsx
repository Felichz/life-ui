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
 *    Si el callback lanza, la continuación NO corre (evita activar otra
 *    actividad o cerrar el día con un registro corrupto).
 * 3. `cancel` descarta el cierre pendiente sin tocar nada.
 * 4. El `requestedAt` (timestamp congelado) NO vive en este contexto:
 *    viene de `activityManager.requestCompletion()` vía `CompletionRequest`.
 */

type ConfirmHandler = (activityId: UUID, score: number) => void;
type InterruptHandler = (activityId: UUID) => void;

interface CompletionFlowContextValue {
  pendingCloseId: UUID | null;
  pendingContinuation: (() => void) | null;

  /** Pedir el cierre de la actividad activa. Solo `(id, continuation)`. */
  requestCloseActive: (activityId: UUID, continuation: () => void) => void;

  /** Registra los handlers que se ejecutarán al resolver/rechazar. */
  registerCloseHandlers: (onConfirm: ConfirmHandler, onInterrupt: InterruptHandler) => void;

  resolve: (score: number) => void;
  reject: () => void;
  cancel: () => void;
}

interface InternalState {
  activityId: UUID;
  continuation: () => void;
}

const CompletionFlowContext = createContext<CompletionFlowContextValue | undefined>(undefined);

export const CompletionFlowProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<InternalState | null>(null);

  // Handlers registrados por DayPage (o quien tenga acceso al sistema).
  const handlersRef = useRef<{ onConfirm: ConfirmHandler; onInterrupt: InterruptHandler }>({
    onConfirm: () => {},
    onInterrupt: () => {},
  });

  const requestCloseActive = useCallback((activityId: UUID, continuation: () => void) => {
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
      setState(null);
      if (!s) return;
      try {
        handlersRef.current.onConfirm(s.activityId, score);
      } catch (e) {
        // El cierre falló: no se ejecuta la continuación.
        console.error("CompletionFlow: onConfirm lanzó, se omite continuation.", e);
        return;
      }
      // Solo en éxito se ejecuta la continuación.
      s.continuation();
    },
    [state]
  );

  const reject = useCallback(() => {
    const s = state;
    setState(null);
    if (!s) return;
    try {
      handlersRef.current.onInterrupt(s.activityId);
    } catch (e) {
      console.error("CompletionFlow: onInterrupt lanzó, se omite continuation.", e);
      return;
    }
    s.continuation();
  }, [state]);

  const cancel = useCallback(() => {
    setState(null);
  }, []);

  return (
    <CompletionFlowContext.Provider
      value={{
        requestCloseActive,
        registerCloseHandlers,
        pendingCloseId: state?.activityId ?? null,
        pendingContinuation: state?.continuation ?? null,
        resolve,
        reject,
        cancel,
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
      requestCloseActive: () => {},
      registerCloseHandlers: () => {},
      resolve: () => {},
      reject: () => {},
      cancel: () => {},
    };
  }
  return ctx;
};
