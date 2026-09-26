import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog";
import { templateMap } from "../../lib/domain";
import { formatNumber, plural } from "../../lib/format";
import { useClosingFlow } from "../../state/closing";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";

export function EndDayDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { state, core } = useSystem();
  const { requestClose } = useClosingFlow();
  const toast = useToast();
  const navigate = useNavigate();
  const day = state.currentDay;
  if (!day) return null;

  const summary = core.getTempoSummary(day.day.id);
  const activeId = day.activeActivityInstanceId;
  const pending = day.activityInstances.filter((item) => item.id !== activeId);
  const activeTitle = activeId
    ? templateMap(state).get(
        day.activityInstances.find((item) => item.id === activeId)?.templateId ?? ""
      )?.title
    : undefined;

  const endNow = () => {
    try {
      const dayId = core.getCurrentDay()?.id;
      core.endDay();
      toast({
        title: "Día cerrado",
        description: `${formatNumber(summary.totalTempos)} tempos. Buen trabajo registrándolo.`,
      });
      navigate(dayId ? `/resumen?dia=${dayId}` : "/resumen");
    } catch (caught) {
      toast({
        tone: "error",
        title: "No se pudo cerrar el día",
        description: errorMessage(caught),
      });
    }
  };

  const confirm = () => {
    onOpenChange(false);
    if (activeId) requestClose({ then: endNow, nextLabel: "se cerrará el día" });
    else endNow();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>¿Terminar el día?</DialogTitle>
          <DialogDescription>Verás el resumen y mañana empiezas de cero.</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-4">
          <ul className="flex flex-col gap-2 text-base text-ink-2">
            <li>
              Llevas{" "}
              <span className="tabular font-medium text-tempo-ink">
                {formatNumber(summary.totalTempos)} tempos
              </span>{" "}
              y{" "}
              {plural(
                summary.completedActivities,
                "actividad completada",
                "actividades completadas"
              )}
              .
            </li>
            {activeTitle && (
              <li>
                Primero cerrarás <span className="font-medium text-ink">«{activeTitle}»</span>, que
                sigue en marcha.
              </li>
            )}
            {pending.length > 0 && (
              <li>
                {plural(pending.length, "actividad pendiente pasa", "actividades pendientes pasan")}{" "}
                al plan de mañana.
              </li>
            )}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Seguir con el día
          </Button>
          <Button variant="primary" onClick={confirm}>
            Terminar el día
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
