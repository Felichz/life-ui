import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { UUID } from "../../types";

/**
 * Coordinator para el ritual de cierre de actividad activa.
 *
 * Cualquier componente (Kanban, QuickBar, "Finalizar día") puede llamar
 * `requestCloseActive(activeId, continuation, onConfirm, onInterrupt)`.
 * El provider expone `pendingCloseId` + `requestedAt`; el CompletionModal vive
 * en DayPage y al cerrarse llama a `resolve(score)` o `reject()`.
 */

interface CompletionFlowContextValue {
  // Activa cuyo cierre está pendiente (null si ninguna)
  pendingCloseId: UUID | null;
  // Timestamp congelado al pedir el cierre (para que la duración no cambie
  // entre la preview del modal y el guardado final)
  requestedAt: string | null;
  // El "continuation" callback (lo que se hace tras cerrar la activa)
  pendingContinuation: (() => void) | null;

  requestCloseActive: (
    activityId: UUID,
    continuation: () => void,
    onConfirm: (activityId: UUID, score: number) => void,
    onInterrupt: (activityId: UUID) => void
  ) => void;

  resolve: (score: number) => void;
  reject: () => void;
  cancel: () => void;
}

interface InternalState {
  activityId: UUID;
  onConfirm: (activityId: UUID, score: number) => void;
  onInterrupt: (activityId: UUID) => void;
  continuation: () => void;
  requestedAt: string;
}

const CompletionFlowContext = createContext<CompletionFlowContextValue | undefined>(undefined);

export const CompletionFlowProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<InternalState | null>(null);

  const requestCloseActive = useCallback(
    (
      activityId: UUID,
      continuation: () => void,
      onConfirm: (activityId: UUID, score: number) => void,
      onInterrupt: (activityId: UUID) => void
    ) => {
      const now = new Date().toISOString();
      setState({ activityId, onConfirm, onInterrupt, continuation, requestedAt: now });
    },
    []
  );

  const resolve = useCallback(
    (score: number) => {
      const s = state;
      setState(null);
      if (s) {
        s.onConfirm(s.activityId, score);
        s.continuation();
      }
    },
    [state]
  );

  const reject = useCallback(() => {
    const s = state;
    setState(null);
    if (s) {
      s.onInterrupt(s.activityId);
      s.continuation();
    }
  }, [state]);

  const cancel = useCallback(() => {
    setState(null);
  }, []);

  return (
    <CompletionFlowContext.Provider
      value={{
        requestCloseActive,
        pendingCloseId: state?.activityId ?? null,
        requestedAt: state?.requestedAt ?? null,
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
      requestedAt: null,
      pendingContinuation: null,
      requestCloseActive: () => {},
      resolve: () => {},
      reject: () => {},
      cancel: () => {},
    };
  }
  return ctx;
};
