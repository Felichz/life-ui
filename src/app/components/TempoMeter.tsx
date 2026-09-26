import { t, tr } from "../i18n";
import { useEffect, useRef, useState } from "react";
import type { TempoSummary } from "../../types";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";

/**
 * Tempos del día frente a la referencia. La referencia es un ancla, no una
 * deuda: se muestra el porcentaje alcanzado, nunca lo que "falta".
 */
export function TempoMeter({
  summary,
  variant = "full",
  label = t("tempo.today"),
}: {
  summary: TempoSummary;
  variant?: "full" | "compact";
  label?: string;
}) {
  const bumped = useBump(summary.totalTempos);
  const over = summary.targetProgress > 1;

  if (variant === "compact") {
    return (
      <div
        className="flex flex-col gap-1.5"
        aria-label={t("tempo.aria", {
          total: summary.totalTempos,
          percent: summary.displayPercent,
        })}
      >
        <div className="flex items-baseline justify-between gap-2 text-sm">
          <span className="text-ink-2">
            <span
              key={bumped}
              className={cn(
                "tabular inline-block font-semibold text-tempo-ink",
                bumped > 0 && "animate-tempo-bump"
              )}
            >
              {formatNumber(summary.totalTempos)}
            </span>{" "}
            {t("tempo.unit")}
          </span>
          <span className="tabular text-xs text-ink-3">{summary.displayPercent}%</span>
        </div>
        <Bar value={summary.progressBarValue} over={over} thin />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex items-baseline gap-1.5">
          <span
            key={bumped}
            className={cn(
              "tabular inline-block origin-left text-3xl font-semibold text-tempo-ink",
              bumped > 0 && "animate-tempo-bump"
            )}
          >
            {formatNumber(summary.totalTempos)}
          </span>
          <span className="text-md text-ink-2">{label}</span>
        </p>
        <p className="text-sm text-ink-2">
          {tr("tempo.ofReference", {
            percent: (
              <span className="tabular font-medium text-ink">{summary.displayPercent}%</span>
            ),
          })}
          <span className="text-ink-3"> · {formatNumber(summary.target)}</span>
        </p>
      </div>
      <Bar value={summary.progressBarValue} over={over} />
    </div>
  );
}

function Bar({ value, over, thin = false }: { value: number; over: boolean; thin?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value)}
      className={cn(
        "relative w-full overflow-hidden rounded-full bg-hover",
        thin ? "h-1" : "h-1.5"
      )}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-700 ease-out",
          over ? "bg-tempo" : "bg-tempo/90"
        )}
        style={{ width: `${Math.max(value, value > 0 ? 1.5 : 0)}%` }}
      />
    </div>
  );
}

/** Devuelve un contador que cambia solo cuando el valor sube (para animar). */
function useBump(value: number): number {
  const previous = useRef(value);
  const [bump, setBump] = useState(0);
  useEffect(() => {
    if (value > previous.current) setBump((count) => count + 1);
    previous.current = value;
  }, [value]);
  return bump;
}
