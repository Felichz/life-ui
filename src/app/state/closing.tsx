import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CompletionRequest, UUID } from "../../types";
import { ClosingDialog } from "../features/activity/ClosingDialog";
import { planItem, templateMap, type PlanItem } from "../lib/domain";
import { errorMessage, useSystem } from "./system";
import { useToast } from "./toast";

/**
 * Única vía de cierre (ADR-001): requestCompletion → diálogo → completeActivity
 * o interruptActivity. Completar, cambiar de actividad y terminar el día
 * pasan por aquí; `then` solo corre si el cierre se guardó.
 */
export interface CloseOptions {
  then?: () => void;
  /** Qué ocurrirá después, para decírselo al usuario en el diálogo. */
  nextLabel?: string;
}

interface Pending {
  activityId: UUID;
  request: CompletionRequest;
  item: PlanItem;
  options: CloseOptions;
}

interface ClosingContextValue {
  requestClose: (options?: CloseOptions) => void;
  isClosing: boolean;
}

const ClosingContext = createContext<ClosingContextValue | null>(null);

export function ClosingFlowProvider({ children }: { children: ReactNode }) {
  const { core } = useSystem();
  const toast = useToast();
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingRef = useRef<Pending | null>(null);
  pendingRef.current = pending;

  const requestClose = useCallback(
    (options: CloseOptions = {}) => {
      const state = core.getState();
      const activeId = state.currentDay?.activeActivityInstanceId;
      if (!activeId || !state.currentDay) {
        options.then?.();
        return;
      }
      try {
        const request = core.requestCompletion(activeId);
        const instance = state.currentDay.activityInstances.find((item) => item.id === activeId);
        if (!instance) throw new Error("No encontramos la actividad en marcha");
        setError(null);
        setPending({
          activityId: activeId,
          request,
          item: planItem(instance, templateMap(state), activeId),
          options,
        });
      } catch (caught) {
        toast({
          tone: "error",
          title: "No pudimos abrir el cierre",
          description: errorMessage(caught),
        });
      }
    },
    [core, toast]
  );

  const finish = useCallback((current: Pending) => {
    setPending(null);
    setError(null);
    current.options.then?.();
  }, []);

  const confirm = useCallback(
    (score: number) => {
      const current = pendingRef.current;
      if (!current || busy) return;
      setBusy(true);
      try {
        const result = core.completeActivity(current.activityId, {
          satisfactionScore: score,
          endTime: current.request.requestedAt,
        });
        const summary = core.getTempoSummary(result.record.dayId);
        toast(
          result.temposAwarded > 0
            ? {
                tone: "reward",
                tempos: result.temposAwarded,
                title: current.request.activityTitle,
                description: `Llevas ${summary.totalTempos} tempos · ${summary.displayPercent}% de tu referencia diaria`,
              }
            : {
                title: current.request.activityTitle,
                description: "Guardada sin tempos. Contó igual que la registraras.",
              }
        );
        finish(current);
      } catch (caught) {
        setError(errorMessage(caught, "No se pudo guardar el cierre"));
      } finally {
        setBusy(false);
      }
    },
    [busy, core, finish, toast]
  );

  const interrupt = useCallback(() => {
    const current = pendingRef.current;
    if (!current || busy) return;
    setBusy(true);
    try {
      core.interruptActivity(current.activityId);
      toast({
        title: "Está bien. Mañana es otra oportunidad.",
        description: `«${current.request.activityTitle}» quedó como no terminada.`,
      });
      finish(current);
    } catch (caught) {
      setError(errorMessage(caught, "No se pudo guardar"));
    } finally {
      setBusy(false);
    }
  }, [busy, core, finish, toast]);

  const cancel = useCallback(() => {
    setPending(null);
    setError(null);
  }, []);

  const value = useMemo(
    () => ({ requestClose, isClosing: pending !== null }),
    [requestClose, pending]
  );

  return (
    <ClosingContext.Provider value={value}>
      {children}
      <ClosingDialog
        open={pending !== null}
        request={pending?.request ?? null}
        item={pending?.item ?? null}
        nextLabel={pending?.options.nextLabel}
        error={error}
        busy={busy}
        onConfirm={confirm}
        onInterrupt={interrupt}
        onCancel={cancel}
      />
    </ClosingContext.Provider>
  );
}

export function useClosingFlow(): ClosingContextValue {
  const context = useContext(ClosingContext);
  if (!context) throw new Error("useClosingFlow debe usarse dentro de <ClosingFlowProvider>");
  return context;
}
