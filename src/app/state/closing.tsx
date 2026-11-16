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
import { t } from "../i18n";
import { ClosingDialog } from "../features/activity/ClosingDialog";
import { planItem, templateMap, type PlanItem } from "../lib/domain";
import { CoreError } from "../../system";
import { errorMessage, useSystem } from "./system";
import { useToast } from "./toast";
import { goalFor } from "../lib/goals";

/**
 * The closing path from the panel (ADR-015): requestCompletion → "did you
 * complete it?" → completeActivity or interruptActivity. `then` and
 * `onClosed` only run if the close was saved.
 */
export interface CloseOptions {
  then?: () => void;
  /** Told how it ended, to tell the coach. */
  onClosed?: (outcome: "done" | "not-done", title: string, note?: string) => void;
  /** What happens next, so the dialog can tell the user. */
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
        if (!instance) throw new CoreError("activity-instance-not-found");
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
          title: t("error.openClosing"),
          description: errorMessage(caught),
        });
      }
    },
    [core, toast]
  );

  const finish = useCallback((current: Pending, outcome: "done" | "not-done", note?: string) => {
    setPending(null);
    setError(null);
    current.options.onClosed?.(outcome, current.request.activityTitle, note);
    current.options.then?.();
  }, []);

  const confirm = useCallback(
    (note?: string) => {
      const current = pendingRef.current;
      if (!current || busy) return;
      setBusy(true);
      try {
        const result = core.completeActivity(current.activityId, {
          endTime: current.request.requestedAt,
          note,
        });
        // The reward is the way to the goal (ADR-015)
        const goal = goalFor(core, result.record.templateId);
        toast({
          tone: goal ? "reward" : "neutral",
          title: t("closing.toast.done", { title: current.request.activityTitle }),
          description: goal
            ? goal.reached
              ? t("closing.toast.goalReached", { goal: goal.title })
              : t("closing.toast.goal", {
                  goal: goal.title,
                  phase: goal.phase,
                  done: goal.phaseDone,
                  total: goal.phaseTotal,
                  percent: goal.percent,
                })
            : undefined,
        });
        finish(current, "done", note);
      } catch (caught) {
        setError(errorMessage(caught, t("error.saveClosing")));
      } finally {
        setBusy(false);
      }
    },
    [busy, core, finish, toast]
  );

  const interrupt = useCallback(
    (note?: string) => {
      const current = pendingRef.current;
      if (!current || busy) return;
      setBusy(true);
      try {
        core.interruptActivity(current.activityId, { note });
        toast({
          title: t("closing.toast.interrupted"),
          description: t("closing.toast.interruptedDetail", {
            title: current.request.activityTitle,
          }),
        });
        finish(current, "not-done", note);
      } catch (caught) {
        setError(errorMessage(caught, t("error.save")));
      } finally {
        setBusy(false);
      }
    },
    [busy, core, finish, toast]
  );

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
  if (!context) throw new Error("useClosingFlow must be used inside <ClosingFlowProvider>");
  return context;
}
