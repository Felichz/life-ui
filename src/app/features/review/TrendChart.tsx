import { useState } from "react";
import type { Day } from "../../../types";
import { dayStart } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatDayMonth, formatNumber } from "../../lib/format";
import { useSystem } from "../../state/system";
import { t } from "../../i18n";

interface TrendChartProps {
  days: Day[];
  selectedId: string;
  onSelect: (dayId: string) => void;
}

/**
 * Tempos per day against the reference (dashed line). A single series, a
 * single axis; satisfaction goes in the tooltip and the table, not another axis.
 */
export function TrendChart({ days, selectedId, onSelect }: TrendChartProps) {
  const { core } = useSystem();
  const [hovered, setHovered] = useState<string | null>(null);
  const points = days.map((day) => ({ day, summary: core.getTempoSummary(day.id) }));
  const target = points[0]?.summary.target ?? 100;
  const max = Math.max(target * 1.15, ...points.map((point) => point.summary.totalTempos)) || 1;
  const withTempos = points.filter((point) => point.summary.completedActivities > 0);
  const average = withTempos.length
    ? withTempos.reduce((sum, point) => sum + point.summary.totalTempos, 0) / withTempos.length
    : 0;
  const averageSatisfaction = withTempos.length
    ? withTempos.reduce((sum, point) => sum + point.summary.averageSatisfaction, 0) /
      withTempos.length
    : 0;
  const active = points.find((point) => point.day.id === (hovered ?? selectedId));

  if (points.length < 2) {
    return (
      <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
        {t("trend.needMoreDays")}
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-panel p-4 shadow-xs sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-ink-2">{t("trend.title")}</p>
          <p className="mt-0.5 text-base text-ink">
            {t("trend.average")}{" "}
            <span className="tabular font-semibold text-tempo-ink">{formatNumber(average)}</span>
            <span className="text-ink-2"> · {t("today.avgSatisfaction")} </span>
            <span className="tabular font-semibold">{formatNumber(averageSatisfaction, 1)}</span>
          </p>
        </div>
        {active && (
          <p className="tabular text-sm text-ink-2" aria-live="polite">
            {formatDayMonth(dayStart(active.day))} ·{" "}
            <span className="font-semibold text-ink">
              {t("endDay.tempos", { count: formatNumber(active.summary.totalTempos) })}
            </span>{" "}
            · {active.summary.displayPercent}% ·{" "}
            {active.summary.completedActivities
              ? `${formatNumber(active.summary.averageSatisfaction, 1)}/10`
              : t("trend.noCloses")}
          </p>
        )}
      </div>

      <div className="mt-6 flex gap-2" aria-hidden>
        <div className="min-w-0 flex-1">
          <div className="relative h-40 sm:h-44">
            <div className="absolute inset-x-0 bottom-0 border-t border-line" />
            <div className="absolute inset-0 flex items-end gap-1 sm:gap-1.5">
              {points.map(({ day, summary }) => {
                const emphasized = day.id === (hovered ?? selectedId);
                const height = (summary.totalTempos / max) * 100;
                return (
                  <button
                    key={day.id}
                    type="button"
                    tabIndex={-1}
                    onClick={() => onSelect(day.id)}
                    onMouseEnter={() => setHovered(day.id)}
                    onMouseLeave={() => setHovered(null)}
                    className="group flex h-full min-w-0 flex-1 cursor-pointer items-end justify-center"
                  >
                    <span
                      className={cn(
                        "w-full max-w-[40px] rounded-t-[4px] transition-[background-color,height] duration-300",
                        emphasized ? "bg-tempo" : "bg-ink-3/30 group-hover:bg-ink-3/45",
                        summary.totalTempos === 0 && "bg-line"
                      )}
                      style={{
                        height: summary.totalTempos === 0 ? "2px" : `${Math.max(height, 1.5)}%`,
                      }}
                    />
                  </button>
                );
              })}
            </div>
            {/* The reference sits above the bars so it is never hidden */}
            <div
              className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-ink-2/60"
              style={{ bottom: `${(target / max) * 100}%` }}
            />
          </div>
          <div className="relative mt-1.5 h-4">
            {points.map(({ day }, index) => {
              // Counting from the end: the most recent day always gets a label
              const fromEnd = points.length - 1 - index;
              const wide = fromEnd % Math.ceil(points.length / 7) === 0;
              const narrow = fromEnd % Math.ceil(points.length / 4) === 0;
              if (!wide && !narrow) return null;
              const edge = index === 0 ? "left-0" : fromEnd === 0 ? "right-0" : "-translate-x-1/2";
              return (
                <span
                  key={day.id}
                  className={cn(
                    "tabular absolute whitespace-nowrap text-2xs",
                    day.id === selectedId ? "font-medium text-ink-2" : "text-ink-3",
                    edge,
                    !narrow && "hidden sm:block"
                  )}
                  style={
                    index === 0 || fromEnd === 0
                      ? undefined
                      : { left: `${((index + 0.5) / points.length) * 100}%` }
                  }
                >
                  {formatDayMonth(dayStart(day))}
                </span>
              );
            })}
          </div>
        </div>
        {/* Reference axis in its own margin: it covers no bar */}
        <div className="relative h-40 w-7 shrink-0 sm:h-44">
          <span
            className="tabular absolute left-0 translate-y-1/2 text-2xs font-medium text-ink-2"
            style={{ bottom: `${(target / max) * 100}%` }}
            title={t("trend.reference", { target: formatNumber(target) })}
          >
            {formatNumber(target)}
          </span>
        </div>
      </div>
      <p className="mt-3 flex items-center gap-2 text-xs text-ink-3">
        <span aria-hidden className="w-4 border-t-[1.5px] border-dashed border-ink-2/60" />
        {t("trend.reference", { target: formatNumber(target) })}
      </p>

      <div className="sr-only">
        <table>
          <caption>{t("trend.title")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("trend.col.day")}</th>
              <th scope="col">{t("review.col.tempos")}</th>
              <th scope="col">{t("trend.col.percent")}</th>
              <th scope="col">{t("trend.col.satisfaction")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map(({ day, summary }) => (
              <tr key={day.id}>
                <td>{formatDayMonth(dayStart(day))}</td>
                <td>{summary.totalTempos}</td>
                <td>{summary.displayPercent}%</td>
                <td>{formatNumber(summary.averageSatisfaction, 1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
