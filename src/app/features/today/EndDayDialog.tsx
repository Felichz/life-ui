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
import { formatNumber } from "../../lib/format";
import { useClosingFlow } from "../../state/closing";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { t, tp, tr } from "../../i18n";

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
        title: t("endDay.done"),
        description: t("endDay.doneDetail", { tempos: formatNumber(summary.totalTempos) }),
      });
      navigate(dayId ? `/review?day=${dayId}` : "/review");
    } catch (caught) {
      toast({
        tone: "error",
        title: t("error.endDay"),
        description: errorMessage(caught),
      });
    }
  };

  const confirm = () => {
    onOpenChange(false);
    if (activeId) requestClose({ then: endNow, nextLabel: t("closing.next.endDay") });
    else endNow();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{t("endDay.title")}</DialogTitle>
          <DialogDescription>{t("endDay.description")}</DialogDescription>
        </DialogHeader>
        <DialogBody className="pb-4">
          <ul className="flex flex-col gap-2 text-base text-ink-2">
            <li>
              {tr("endDay.summary", {
                tempos: (
                  <span className="tabular font-medium text-tempo-ink">
                    {t("endDay.tempos", { count: formatNumber(summary.totalTempos) })}
                  </span>
                ),
                completed: tp("endDay.completed", summary.completedActivities),
              })}
            </li>
            {activeTitle && (
              <li>
                {tr("endDay.closeFirst", {
                  title: <span className="font-medium text-ink">{activeTitle}</span>,
                })}
              </li>
            )}
            {pending.length > 0 && <li>{tp("endDay.pending", pending.length)}</li>}
          </ul>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t("endDay.keepGoing")}
          </Button>
          <Button variant="primary" onClick={confirm}>
            {t("endDay.confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
