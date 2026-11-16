import { useCallback } from "react";
import type { UUID } from "../../types";
import { t } from "../i18n";
import { useClosingFlow } from "../state/closing";
import { errorMessage, useSystem } from "../state/system";
import { useToast } from "../state/toast";
import { useShell } from "./ShellContext";

/**
 * Starting and finishing tasks from the panel and the HUD (ADR-015). The
 * button does it in the app at once, and the person's message in the chat
 * says what they did, so the coach answers it ("Empecé «X»"). It knows the
 * change is made: the prompt tells it not to make it again.
 */
export function useTaskActions() {
  const { core } = useSystem();
  const { compose } = useShell();
  const { requestClose } = useClosingFlow();
  const toast = useToast();

  const titleOf = useCallback(
    (templateId: UUID) =>
      core.getActivityTemplates().find((template) => template.id === templateId)?.title ??
      t("activity.fallbackName"),
    [core]
  );

  /** Something running is closed first, as done or not; then `run` goes on. */
  const afterClosing = useCallback(
    (nextTitle: string, run: () => void) => {
      if (!core.getState().currentDay?.activeActivityInstanceId) return run();
      requestClose({
        nextLabel: t("closing.next.start", { title: nextTitle }),
        onClosed: (outcome, title, note) => {
          compose(closedMessage(outcome, title, note), "send");
          run();
        },
      });
    },
    [compose, core, requestClose]
  );

  const startDay = useCallback(() => {
    try {
      if (!core.getCurrentDay()) core.startDay();
      core.bringPlannedActivities();
      return true;
    } catch (caught) {
      toast({ tone: "error", title: t("error.start"), description: errorMessage(caught) });
      return false;
    }
  }, [core, toast]);

  /** Starts the day from its button, and tells the coach. */
  const startTheDay = useCallback(() => {
    if (startDay()) compose(t("panel.dayStarted"), "send");
  }, [compose, startDay]);

  /** Starts a task of today's plan. */
  const start = useCallback(
    (instanceId: UUID) => {
      const instance = core
        .getState()
        .currentDay?.activityInstances.find((item) => item.id === instanceId);
      if (!instance) return;
      const title = titleOf(instance.templateId);
      afterClosing(title, () => {
        try {
          core.activateActivity(instanceId);
          compose(t("panel.started", { title }), "send");
        } catch (caught) {
          toast({ tone: "error", title: t("error.start"), description: errorMessage(caught) });
        }
      });
    },
    [afterClosing, compose, core, titleOf, toast]
  );

  /**
   * Starts a task for today before the day has started: the day starts first,
   * which brings today's planned tasks and the ones left from before into it.
   */
  const startBeforeDay = useCallback(
    (templateId: UUID) => {
      if (!startDay()) return;
      const instance = core
        .getState()
        .currentDay?.activityInstances.find((item) => item.templateId === templateId);
      const title = titleOf(templateId);
      try {
        if (instance) core.activateActivity(instance.id);
        compose(t(instance ? "panel.dayAndStarted" : "panel.dayStarted", { title }), "send");
      } catch (caught) {
        toast({ tone: "error", title: t("error.start"), description: errorMessage(caught) });
      }
    },
    [compose, core, startDay, titleOf, toast]
  );

  /** Finishes what is running: "did you complete it?", then the coach is told. */
  const finish = useCallback(() => {
    requestClose({
      onClosed: (outcome, title, note) => compose(closedMessage(outcome, title, note), "send"),
    });
  }, [compose, requestClose]);

  return { start, startBeforeDay, startTheDay, finish };
}

function closedMessage(outcome: "done" | "not-done", title: string, note?: string): string {
  const said = t(outcome === "done" ? "panel.done" : "panel.notDone", { title });
  return note ? `${said} ${note}` : said;
}
