import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { SectionTitle } from "../../components/PageHeader";
import { formatNumber } from "../../lib/format";
import { useSystem } from "../../state/system";
import { t } from "../../i18n";

/**
 * The roadmaps in one glance, on Today: what the day is for. Each line is
 * the goal, how far along it is and the milestone being worked on.
 */
export function GoalsStrip() {
  const { core, state } = useSystem();
  const progress = useMemo(
    () => core.getRoadmapProgress().filter((item) => item.roadmap.status === "active"),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [core, state]
  );
  if (progress.length === 0) return null;
  return (
    <section aria-labelledby="goals-strip-title">
      <SectionTitle>
        <span id="goals-strip-title">{t("nav.goals")}</span>
      </SectionTitle>
      <ul className="flex flex-col rounded-lg border border-line bg-panel shadow-xs">
        {progress.map((item) => {
          const current = item.milestones[item.current ?? 0]?.milestone.title;
          return (
            <li key={item.roadmap.id} className="border-b border-line last:border-b-0">
              <Link
                to="/goals"
                className="group flex items-center gap-4 rounded-lg px-3 py-2.5 transition-colors duration-150 hover:bg-subtle"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-medium text-ink">
                    {item.roadmap.title}
                  </span>
                  <span className="block truncate text-sm text-ink-2">
                    {item.complete ? t("goals.reached") : current}
                  </span>
                </span>
                <span
                  className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-hover sm:block"
                  aria-hidden
                >
                  <span
                    className="block h-full rounded-full bg-accent"
                    style={{ width: `${item.fraction * 100}%` }}
                  />
                </span>
                <span className="tabular w-10 shrink-0 text-right text-sm font-medium text-ink">
                  {formatNumber(Math.round(item.fraction * 100))}%
                </span>
                <ArrowRight className="size-4 shrink-0 text-ink-3 transition-transform duration-150 group-hover:translate-x-0.5" />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
