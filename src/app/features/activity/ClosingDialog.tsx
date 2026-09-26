import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AlertCircle, Check, CircleSlash } from "lucide-react";
import type { CompletionRequest } from "../../../types";
import { UtilityService } from "../../../system/utilityService";
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
import { Kbd } from "../../components/ui/Kbd";
import { TypeIcon } from "../../components/TypeIcon";
import { TYPE_META, type PlanItem } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatMinutes, formatNumber } from "../../lib/format";

export const DEFAULT_SCORE = 7;

export const SCORE_LABELS: Record<number, string> = {
  0: "No cuenta esta vez. Registrarlo ya fue honesto.",
  1: "Casi nada. Lo reconozco igual.",
  2: "Algo avancé. Mejor que nada.",
  3: "Me costó, pero ahí está.",
  4: "A medias, y es honesto decirlo.",
  5: "Cumplí lo mínimo, sin extras.",
  6: "Cumplí. Buen punto de partida.",
  7: "Lo hice. Eso es lo que cuenta.",
  8: "Bien hecho, por encima de lo esperado.",
  9: "Muy bien. Casi lo máximo.",
  10: "Excelente. Lo di todo.",
};

interface ClosingDialogProps {
  open: boolean;
  request: CompletionRequest | null;
  item: PlanItem | null;
  nextLabel?: string;
  error: string | null;
  busy: boolean;
  onConfirm: (score: number) => void;
  onInterrupt: () => void;
  onCancel: () => void;
}

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
  const [score, setScore] = useState(DEFAULT_SCORE);
  const scoreRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (open) setScore(DEFAULT_SCORE);
  }, [open, request?.requestedAt]);

  if (!request || !item) return null;

  // Misma fuente que el core: la vista previa no puede divergir del resultado.
  const base = UtilityService.resolveBaseMinutes(request.estimatedMinutes, request.durationMinutes);
  const tempos = UtilityService.calculatePreviewTempos(score, base);
  const usesEstimate = typeof request.estimatedMinutes === "number" && request.estimatedMinutes > 0;
  const contract = item.contract;

  const setAndFocus = (next: number) => {
    const clamped = Math.max(0, Math.min(10, next));
    setScore(clamped);
    scoreRefs.current[clamped]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (/^[0-9]$/.test(event.key) && target.tagName !== "INPUT") {
      event.preventDefault();
      setAndFocus(Number(event.key));
    } else if (event.key === "Enter" && !target.closest("[data-footer-secondary]")) {
      event.preventDefault();
      onConfirm(score);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onCancel()}>
      <DialogContent size="md" onKeyDown={onKeyDown} data-testid="closing-dialog">
        <DialogHeader>
          <DialogTitle>¿Cómo fue «{request.activityTitle}»?</DialogTitle>
          <DialogDescription>
            {nextLabel
              ? `Al guardar, ${nextLabel}.`
              : "Un momento honesto y listo. Si cierras esto, la actividad sigue en marcha."}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-5 pb-5">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line">
            <div className="bg-panel px-3.5 py-2.5">
              <dt className="text-xs text-ink-2">Tiempo real</dt>
              <dd className="tabular mt-0.5 text-lg font-semibold text-ink">
                {formatMinutes(request.durationMinutes)}
              </dd>
            </div>
            <div className="bg-panel px-3.5 py-2.5">
              <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                <TypeIcon type={item.type} className="size-3" />
                {contract?.estimate !== undefined
                  ? "Estimado"
                  : item.type === "timeboxing"
                    ? "Timebox"
                    : "Rango esperado"}
                <span className="text-ink-3">· {TYPE_META[item.type].short}</span>
              </dt>
              <dd className="mt-0.5 flex flex-wrap items-center gap-x-2 text-lg font-semibold text-ink">
                <span className="tabular">{contract ? contract.label.replace("~", "") : "—"}</span>
                {request.beatEstimate && (
                  <span className="inline-flex items-center gap-1 whitespace-nowrap rounded bg-success/10 px-1.5 py-0.5 text-xs font-medium text-success">
                    <Check className="size-3" strokeWidth={2.5} />
                    Antes de tiempo
                  </span>
                )}
              </dd>
            </div>
          </dl>

          <fieldset>
            <legend className="mb-2.5 text-md font-medium text-ink">
              ¿Qué tan satisfecho estás con lo que hiciste?
            </legend>
            <div
              role="radiogroup"
              aria-label="Satisfacción de 0 a 10"
              className="grid grid-cols-11 gap-1 coarse:grid-cols-6 coarse:gap-1.5"
            >
              {Array.from({ length: 11 }, (_, value) => {
                const selected = value === score;
                return (
                  <button
                    key={value}
                    ref={(node) => {
                      scoreRefs.current[value] = node;
                    }}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${value} de 10`}
                    tabIndex={selected ? 0 : -1}
                    onClick={() => setScore(value)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                        event.preventDefault();
                        setAndFocus(score + 1);
                      } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                        event.preventDefault();
                        setAndFocus(score - 1);
                      }
                    }}
                    className={cn(
                      "tabular relative flex h-10 items-center justify-center rounded-md text-md font-medium transition-[background-color,color,box-shadow,transform] duration-150 active:scale-95 coarse:h-12",
                      selected
                        ? "bg-accent-fill text-white shadow-sm"
                        : value <= score
                          ? "bg-accent/10 text-accent-ink hover:bg-accent/20"
                          : "bg-hover/70 text-ink-2 hover:bg-hover hover:text-ink"
                    )}
                  >
                    {value}
                  </button>
                );
              })}
            </div>
            <div
              className="mt-1.5 grid grid-cols-11 gap-1 text-2xs text-ink-3 coarse:hidden"
              aria-hidden
            >
              <span className="col-span-2">no cuenta</span>
              <span className="col-start-8 whitespace-nowrap text-center">100%</span>
              <span className="col-span-2 col-start-10 text-right">máximo</span>
            </div>
            <p className="mt-1.5 hidden text-2xs text-ink-3 coarse:block" aria-hidden>
              0 no cuenta · 7 = 100% · 10 máximo
            </p>
            <p aria-live="polite" className="mt-3 min-h-[20px] text-md text-ink">
              <span className="tabular font-semibold">{score}/10</span>
              <span className="text-ink-2"> — {SCORE_LABELS[score]}</span>
            </p>
          </fieldset>

          <div className="flex items-center justify-between gap-4 rounded-lg bg-tempo/10 px-4 py-3 ring-1 ring-inset ring-tempo/25">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">Recompensa</p>
              <p className="tabular text-sm text-ink-2">
                {base > 0
                  ? `${formatMinutes(base)} ${usesEstimate ? "de estimado" : "de tiempo real"} × ${Math.round((score / UtilityService.SCORE_DIVISOR) * 100)}%`
                  : "Sin minutos que contar todavía"}
              </p>
            </div>
            <p className="shrink-0 text-right">
              <span className="tabular text-3xl font-semibold text-tempo-ink">
                {tempos > 0 ? `+${formatNumber(tempos)}` : "0"}
              </span>
              <span className="ml-1 text-sm text-ink-2">tempos</span>
            </p>
          </div>

          {error && (
            <div
              role="alert"
              className="flex gap-2.5 rounded-lg bg-danger/10 px-3.5 py-3 text-sm text-ink"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" />
              <p>
                <span className="font-medium">No se guardó el cierre.</span> {error}. La actividad
                sigue en marcha; puedes intentarlo de nuevo.
              </p>
            </div>
          )}
        </DialogBody>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="ghost"
            onClick={onInterrupt}
            disabled={busy}
            data-footer-secondary
            className="sm:-ml-2"
          >
            <CircleSlash />
            No la terminé
          </Button>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={onCancel} disabled={busy} data-footer-secondary>
              Seguir con ella
            </Button>
            <Button
              variant="primary"
              onClick={() => onConfirm(score)}
              loading={busy}
              data-testid="closing-confirm"
            >
              {tempos > 0 ? `Guardar · +${formatNumber(tempos)} tempos` : "Guardar"}
              <Kbd tone="inverse" className="ml-1 hidden bg-white/20 text-white sm:inline-flex">
                ↵
              </Kbd>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
