import { useCallback } from "react";
import type { UUID } from "../../types";
import type { Settings } from "../lib/domain";
import { t } from "../i18n";
import { formatTime } from "../lib/format";
import { useClosingFlow } from "./closing";
import { errorMessage, useSystem } from "./system";
import { useToast } from "./toast";

/**
 * Day actions that combine several core calls. If something is running,
 * starting something else goes through the closing ritual first, and the
 * continuation only runs if that close was saved.
 */
export function useDayActions() {
  const { core } = useSystem();
  const { requestClose } = useClosingFlow();
  const toast = useToast();

  const fail = useCallback(
    (title: string, caught: unknown) =>
      toast({ tone: "error", title, description: errorMessage(caught) }),
    [toast]
  );

  const titleOfTemplate = useCallback(
    (templateId: UUID) =>
      core.getActivityTemplates().find((template) => template.id === templateId)?.title ??
      t("activity.fallbackName"),
    [core]
  );

  const runAfterClosing = useCallback(
    (nextTitle: string, run: () => void) => {
      const active = core.getState().currentDay?.activeActivityInstanceId;
      if (active)
        requestClose({ then: run, nextLabel: t("closing.next.start", { title: nextTitle }) });
      else run();
    },
    [core, requestClose]
  );

  /** Starts an activity that is already in the plan. */
  const startInstance = useCallback(
    (instanceId: UUID) => {
      const state = core.getState();
      if (state.currentDay?.activeActivityInstanceId === instanceId) return;
      const instance = state.currentDay?.activityInstances.find((item) => item.id === instanceId);
      if (!instance) return;
      runAfterClosing(titleOfTemplate(instance.templateId), () => {
        try {
          core.activateActivity(instanceId);
        } catch (caught) {
          fail(t("error.start"), caught);
        }
      });
    },
    [core, fail, runAfterClosing, titleOfTemplate]
  );

  /** Block for something started now: the current time block or "To do". */
  const blockForNow = useCallback((): UUID | null => {
    const current = core.getCurrentTimeBlock();
    if (current) return current.id;
    return core.getTimeBlocks().find((block) => block.isDefault)?.id ?? null;
  }, [core]);

  /** Creates an instance from the library and starts it (with default or given values). */
  const startTemplate = useCallback(
    (templateId: UUID, options: { blockId?: UUID; settings?: Settings } = {}) => {
      runAfterClosing(titleOfTemplate(templateId), () => {
        try {
          const blockId = options.blockId ?? blockForNow();
          if (!blockId) {
            toast({ tone: "error", title: t("error.start"), description: t("error.noBlocks") });
            return;
          }
          const instance = core.createActivityInstance(templateId, blockId, options.settings);
          core.activateActivity(instance.id);
        } catch (caught) {
          fail(t("error.start"), caught);
        }
      });
    },
    [blockForNow, core, fail, runAfterClosing, titleOfTemplate, toast]
  );

  const logEvent = useCallback(
    (templateId: UUID) => {
      try {
        const event = core.createEventInstance(templateId);
        toast({
          title: t("event.logged", { name: event.templateName }),
          description: t("event.loggedAt", { time: formatTime(event.timestamp) }),
        });
      } catch (caught) {
        fail(t("error.logEvent"), caught);
      }
    },
    [core, fail, toast]
  );

  const closeActive = useCallback(() => requestClose(), [requestClose]);

  return { startInstance, startTemplate, logEvent, closeActive, blockForNow };
}
