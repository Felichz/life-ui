import { useEffect, useState, type KeyboardEvent } from "react";
import { AlertCircle, Check, CircleSlash, Flag } from "lucide-react";
import type { CompletionRequest } from "../../../types";
import { t } from "../../i18n";
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
import { Textarea } from "../../components/ui/Field";
import { TypeIcon } from "../../components/TypeIcon";
import { TYPE_META, type PlanItem } from "../../lib/domain";
import { formatMinutes } from "../../lib/format";
import { goalFor } from "../../lib/goals";
import { useSystem } from "../../state/system";

interface ClosingDialogProps {
  open: boolean;
  request: CompletionRequest | null;
  item: PlanItem | null;
  nextLabel?: string;
  error: string | null;
  busy: boolean;
  onConfirm: (note?: string) => void;
  onInterrupt: (note?: string) => void;
  onCancel: () => void;
}

/**
 * Closing a task (ADR-015): one question, did you complete it? The answer is
 * the only thing measured, and a done task counts as a session of its goal,
 * which the dialog says before the answer. A sentence on how it went is
 * optional and goes to the coach.
 */
export function ClosingDialog({
  open,
  request,
  item,
  nextLabel,
  error,
  busy,
  onConfirm,
  onInterrupt,
  onCancel,
}: ClosingDialogProps) {
  const { core } = useSystem();
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) setNote("");
  }, [open, request?.requestedAt]);

  if (!request || !item) return null;
  const contract = item.contract;
  const goal = goalFor(core, item.instance.templateId);
  const said = note.trim() || undefined;

  const onKeyDown = (event: KeyboardEvent) => {
    // Enter in the sentence is a new line; ctrl or cmd + Enter says "yes, done"
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      onConfirm(said);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent size="md" onKeyDown={onKeyDown} data-testid="closing-dialog">
        <DialogHeader>
          <DialogTitle>{t("closing.question", { title: request.activityTitle })}</DialogTitle>
          <DialogDescription>
            {nextLabel ? t("closing.next", { next: nextLabel }) : t("closing.description")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4 pb-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="bg-panel px-3.5 py-2.5">
              <dt className="text-xs text-ink-2">{t("closing.realTime")}</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
                {formatMinutes(request.durationMinutes)}
              </dd>
            </div>
            <div className="bg-panel px-3.5 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                <TypeIcon type={item.type} className="size-3" />
                {contract?.estimate !== undefined
                  ? t("closing.estimate")
                  : item.type === "timeboxing"
                    ? t("type.timebox.label")
                    : t("closing.expectedRange")}
                <span className="text-ink-3">· {TYPE_META[item.type].short}</span>
              </dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 text-lg font-semibold text-ink">
                <span className="tabular">{contract ? contract.label.replace("~", "") : "—"}</span>
                {request.beatEstimate && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
                    <Check className="size-3" strokeWidth={2.5} />
                    {t("closing.early")}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {/* What a yes moves: the goal this task works toward */}
          {goal && !goal.reached && (
            <p className="flex items-start gap-2.5 rounded-lg bg-accent/5 px-3.5 py-2.5 text-sm text-ink ring-1 ring-inset ring-accent/20">
              <Flag className="mt-0.5 size-4 shrink-0 text-accent-ink" />
              <span>
                {t("closing.goal", {
                  goal: goal.title,
                  phase: goal.phase,
                  done: goal.phaseDone,
                  total: goal.phaseTotal,
                })}
              </span>
            </p>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t("closing.note")}</span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={t("closing.notePlaceholder")}
              rows={2}
            />
          </label>

          {error && (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-sm text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p>
                <span className="font-medium">{t("closing.errorTitle")}</span>{" "}
                {t("closing.errorBody", { error })}
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <Button variant="ghost" onClick={onCancel} disabled={busy} className="sm:-ml-2">
            {t("closing.keepGoing")}
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => onInterrupt(said)} disabled={busy}>
              <CircleSlash />
              {t("closing.notDone")}
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm(said)}
              loading={busy}
              data-testid="closing-confirm"
            >
              <Check />
              {t("closing.done")}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
