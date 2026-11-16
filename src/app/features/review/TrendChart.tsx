import { useState } from "react";
import type { Day } from "../../../types";
import { dayStart } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatDayMonth, formatNumber } from "../../lib/format";
import { useSystem } from "../../state/system";
import { t, tp } from "../../i18n";

interface TrendChartProps {
  days: Day[];
  selectedId: string;
  onSelect: (dayId: string) => void;
}

/**
 * Tasks done per day (ADR-015), with the ones closed as not done stacked in a
 * lighter tone above them. No target: a day is read for what was done.
 */
export function TrendChart({ days, selectedId, onSelect }: TrendChartProps) {
  const { core } = useSystem();
  const [hovered, setHovered] = useState<string | null>(null);
  const points = days.map((day) => ({ day, summary: core.getDaySummary(day.id) }));
  const max =
    Math.max(...points.map((point) => point.summary.completed + point.summary.notCompleted), 1) *
    1.1;
  const withCloses = points.filter(
    (point) => point.summary.completed + point.summary.notCompleted > 0
  );
  const average = withCloses.length
    ? withCloses.reduce((sum, point) => sum + point.summary.completed, 0) / withCloses.length
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
    <div className="rounded-xl border border-line bg-panel p-4 shadow-xs @lg:p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <p className="text-sm text-ink-2">{t("trend.title")}</p>
          <p className="mt-0.5 text-base text-ink">
            {t("trend.average")}{" "}
            <span className="tabular font-semibold text-accent-ink">
              {formatNumber(average, 1)}
            </span>
          </p>
        </div>
        {active && (
          <p className="tabular text-sm text-ink-2" aria-live="polite">
            {formatDayMonth(dayStart(active.day))} ·{" "}
            {active.summary.completed + active.summary.notCompleted > 0 ? (
              <>
                <span className="font-semibold text-ink">
                  {tp("start.completed", active.summary.completed)}
                </span>
                {active.summary.notCompleted > 0 &&
                  ` · ${tp("today.notDone", active.summary.notCompleted)}`}
              </>
            ) : (
              t("trend.noCloses")
            )}
          </p>
        )}
      </div>

      <div className="mt-6" aria-hidden>
        <div className="relative h-40 @lg:h-44">
          <div className="absolute inset-x-0 bottom-0 border-t border-line" />
          <div className="absolute inset-0 flex items-end gap-1 @lg:gap-1.5">
            {points.map(({ day, summary }) => {
              const emphasized = day.id === (hovered ?? selectedId);
              const total = summary.completed + summary.notCompleted;
              return (
                <button
                  key={day.id}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onSelect(day.id)}
                  onMouseEnter={() => setHovered(day.id)}
                  onMouseLeave={() => setHovered(null)}
                  className="group flex h-full min-w-0 flex-1 cursor-pointer flex-col items-center justify-end"
                >
                  {total === 0 ? (
                    <span className="h-[2px] w-full max-w-[40px] rounded-t-[4px] bg-line" />
                  ) : (
                    <>
                      {summary.notCompleted > 0 && (
                        <span
                          className="w-full max-w-[40px] rounded-t-[4px] bg-ink-3/20"
                          style={{ height: `${(summary.notCompleted / max) * 100}%` }}
                        />
                      )}
                      {summary.completed > 0 && (
                        <span
                          className={cn(
                            "w-full max-w-[40px] transition-colors duration-300",
                            summary.notCompleted === 0 && "rounded-t-[4px]",
                            emphasized ? "bg-accent" : "bg-accent/40 group-hover:bg-accent/60"
                          )}
                          style={{ height: `${(summary.completed / max) * 100}%` }}
                        />
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
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
                  !narrow && "hidden @lg:block"
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
      <p className="mt-3 flex items-center gap-4 text-xs text-ink-3">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-accent" />
          {t("log.done")}
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-sm bg-ink-3/20" />
          {t("log.notDone")}
        </span>
      </p>

      <div className="sr-only">
        <table>
          <caption>{t("trend.title")}</caption>
          <thead>
            <tr>
              <th scope="col">{t("trend.col.day")}</th>
              <th scope="col">{t("log.done")}</th>
              <th scope="col">{t("log.notDone")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map(({ day, summary }) => (
              <tr key={day.id}>
                <td>{formatDayMonth(dayStart(day))}</td>
                <td>{summary.completed}</td>
                <td>{summary.notCompleted}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
