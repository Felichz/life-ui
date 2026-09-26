import { useCallback } from "react";
import type { UUID } from "../../types";
import type { Settings } from "../lib/domain";
import { formatTime } from "../lib/format";
import { useClosingFlow } from "./closing";
import { errorMessage, useSystem } from "./system";
import { useToast } from "./toast";

/**
 * Acciones del día que combinan varias llamadas al core. Si hay algo en
 * marcha, empezar otra cosa pasa primero por el ritual de cierre y la
 * continuación solo corre si ese cierre se guardó.
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
      "la actividad",
    [core]
  );

  const runAfterClosing = useCallback(
    (nextTitle: string, run: () => void) => {
      const active = core.getState().currentDay?.activeActivityInstanceId;
      if (active) requestClose({ then: run, nextLabel: `empezará «${nextTitle}»` });
      else run();
    },
    [core, requestClose]
  );

  /** Empieza una actividad que ya está en el plan. */
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
          fail("No se pudo empezar", caught);
        }
      });
    },
    [core, fail, runAfterClosing, titleOfTemplate]
  );

  /** Bloque donde cae algo que se empieza ahora: la franja actual o "Por hacer". */
  const blockForNow = useCallback((): UUID | null => {
    const current = core.getCurrentTimeBlock();
    if (current) return current.id;
    return core.getTimeBlocks().find((block) => block.isDefault)?.id ?? null;
  }, [core]);

  /** Crea una instancia desde la biblioteca y la empieza (con los valores por defecto o los dados). */
  const startTemplate = useCallback(
    (templateId: UUID, options: { blockId?: UUID; settings?: Settings } = {}) => {
      runAfterClosing(titleOfTemplate(templateId), () => {
        try {
          const blockId = options.blockId ?? blockForNow();
          if (!blockId) throw new Error("No hay bloques disponibles");
          const instance = core.createActivityInstance(templateId, blockId, options.settings);
          core.activateActivity(instance.id);
        } catch (caught) {
          fail("No se pudo empezar", caught);
        }
      });
    },
    [blockForNow, core, fail, runAfterClosing, titleOfTemplate]
  );

  const logEvent = useCallback(
    (templateId: UUID) => {
      try {
        const event = core.createEventInstance(templateId);
        toast({
          title: `${event.templateName} registrado`,
          description: `A las ${formatTime(event.timestamp)}`,
        });
      } catch (caught) {
        fail("No se pudo registrar el evento", caught);
      }
    },
    [core, fail, toast]
  );

  const closeActive = useCallback(() => requestClose(), [requestClose]);

  return { startInstance, startTemplate, logEvent, closeActive, blockForNow };
}
