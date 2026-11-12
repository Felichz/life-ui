import { useMemo, useState } from "react";
import { Check, Pencil } from "lucide-react";
import type { RoadmapProgress, StepProgress } from "../../../types";
import { Markdown } from "../../agent/Markdown";
import { Page, PageHeader, SectionTitle } from "../../components/PageHeader";
import { TypeIcon } from "../../components/TypeIcon";
import { Button } from "../../components/ui/Button";
import { Textarea } from "../../components/ui/Field";
import { cn } from "../../lib/cn";
import { templateMap } from "../../lib/domain";
import { formatDateShort, formatDayMinutes, formatDayMonth, formatNumber } from "../../lib/format";
import { useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { t, tp } from "../../i18n";

/**
 * Where the person is going (ADR-010): the life they want, in their own
 * words, and the roadmaps that lead there, each one showing how far along
 * they really are.
 */
export function GoalsPage() {
  return (
    <Page width="narrow">
      <PageHeader title={t("nav.goals")} subtitle={t("goals.subtitle")} />
      <div className="mt-6 flex flex-col gap-10">
        <IdealLife />
        <Roadmaps />
      </div>
    </Page>
  );
}

/**
 * The one text in the app the person writes by hand: it is theirs. The agent
 * adds to it from the chat, with their yes.
 */
function IdealLife() {
  const { core, state } = useSystem();
  const toast = useToast();
  const idealLife = state.global.idealLife;
  const [draft, setDraft] = useState<string | null>(null);

  const save = () => {
    if (draft === null) return;
    core.setIdealLife(draft);
    setDraft(null);
    toast({ title: t("goals.ideal.saved") });
  };

  return (
    <section aria-labelledby="ideal-title">
      <SectionTitle
        actions={
          draft === null &&
          idealLife?.text && (
            <Button size="sm" variant="ghost" onClick={() => setDraft(idealLife.text)}>
              <Pencil />
              {t("common.edit")}
            </Button>
          )
        }
      >
        <span id="ideal-title">{t("goals.ideal.title")}</span>
      </SectionTitle>

      {draft !== null ? (
        <div>
          <Textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-labelledby="ideal-title"
            placeholder={t("goals.ideal.placeholder")}
            autoFocus
            className="min-h-[280px] py-3 leading-relaxed"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-sm text-ink-3">{t("goals.ideal.markdown")}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDraft(null)}>
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={save}>
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      ) : idealLife?.text ? (
        <div className="rounded-xl border border-line bg-panel px-5 py-5 shadow-xs sm:px-6">
          <Markdown>{idealLife.text}</Markdown>
          <p className="mt-4 border-t border-line pt-3 text-sm text-ink-3">
            {t("goals.ideal.footer", { date: formatDayMonth(idealLife.updatedAt) })}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line px-5 py-6 sm:px-6">
          <p className="max-w-prose text-base text-ink-2">{t("goals.ideal.empty")}</p>
          <Button className="mt-4" onClick={() => setDraft("")}>
            <Pencil />
            {t("goals.ideal.write")}
          </Button>
        </div>
      )}
    </section>
  );
}

function Roadmaps() {
  const { core, state } = useSystem();
  const progress = useMemo(
    () => core.getRoadmapProgress(),

    [core, state]
  );
  return (
    <section aria-labelledby="roadmaps-title">
      <SectionTitle meta={progress.length || undefined}>
        <span id="roadmaps-title">{t("goals.roadmaps.title")}</span>
      </SectionTitle>
      {progress.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-5 py-6 text-base text-ink-2 sm:px-6">
          {t("goals.roadmaps.empty")}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {progress.map((item) => (
            <RoadmapCard key={item.roadmap.id} progress={item} />
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * The way to one goal, as far as the eye can follow it: where it starts,
 * each milestone, and where the person stands now. The bar is cut at the
 * milestones, so the distance left is something that can be counted.
 */
function RoadmapCard({ progress }: { progress: RoadmapProgress }) {
  const { roadmap } = progress;
  const paused = roadmap.status === "paused";
  return (
    <article
      aria-label={roadmap.title}
      className={cn(
        "rounded-xl border border-line bg-panel shadow-xs",
        paused && "bg-subtle/60 shadow-none"
      )}
    >
      <header className="px-5 pb-4 pt-5 sm:px-6">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <h3 className="text-balance text-xl font-semibold text-ink">{roadmap.title}</h3>
            {roadmap.why && <p className="mt-1 text-base text-ink-2">{roadmap.why}</p>}
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-3">
              {progress.complete ? (
                <span className="inline-flex items-center gap-1 font-medium text-success">
                  <Check className="size-3.5" />
                  {t("goals.reached")}
                </span>
              ) : (
                <span>
                  {t("goals.steps", { done: progress.doneSteps, total: progress.totalSteps })}
                </span>
              )}
              {paused && (
                <span className="rounded bg-hover px-1.5 py-0.5 text-xs font-medium text-ink-2">
                  {t("goals.paused")}
                </span>
              )}
              {roadmap.targetDate && (
                <span>
                  ·{" "}
                  {t("goals.target", {
                    date: formatDateShort(new Date(`${roadmap.targetDate}T12:00:00`)),
                  })}
                </span>
              )}
            </p>
          </div>
          <p className="tabular shrink-0 text-3xl font-semibold text-ink">
            {formatNumber(Math.round(progress.fraction * 100))}
            <span className="ml-0.5 text-lg text-ink-3">%</span>
          </p>
        </div>

        {/* One segment per milestone, as wide as its share of the steps */}
        <div className="mt-4 flex gap-1" aria-hidden>
          {progress.milestones.map((entry) => {
            const fraction =
              entry.steps.reduce((sum, step) => sum + step.fraction, 0) / entry.steps.length;
            return (
              <span
                key={entry.milestone.id}
                className="h-1.5 overflow-hidden rounded-full bg-hover"
                style={{ flexGrow: entry.steps.length, flexBasis: 0 }}
              >
                <span
                  className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
                  style={{ width: `${fraction * 100}%` }}
                />
              </span>
            );
          })}
        </div>
      </header>

      <ol className="border-t border-line px-5 py-4 sm:px-6">
        {progress.milestones.map((entry, index) => (
          <Milestone
            key={entry.milestone.id}
            entry={entry}
            number={index + 1}
            last={index === progress.milestones.length - 1}
          />
        ))}
      </ol>
    </article>
  );
}

function Milestone({
  entry,
  number,
  last,
}: {
  entry: RoadmapProgress["milestones"][number];
  number: number;
  last: boolean;
}) {
  const { milestone, status } = entry;
  return (
    <li className="relative flex gap-3.5 pb-5 last:pb-1">
      {/* The rail: the part already walked is drawn stronger */}
      {!last && (
        <span
          aria-hidden
          className={cn(
            "absolute bottom-0 left-[11px] top-7 w-px",
            status === "done" ? "bg-ink-3" : "bg-line"
          )}
        />
      )}
      <span
        aria-hidden
        className={cn(
          "tabular relative mt-0.5 flex size-[23px] shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          status === "done" && "bg-ink text-canvas",
          status === "current" && "bg-accent-fill text-white",
          status === "upcoming" && "border border-line-strong bg-panel text-ink-3"
        )}
      >
        {status === "done" ? <Check className="size-3.5" strokeWidth={2.5} /> : number}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <h4
            className={cn(
              "text-md font-semibold",
              status === "upcoming" ? "text-ink-2" : "text-ink"
            )}
          >
            {milestone.title}
          </h4>
          <span
            className={cn(
              "text-sm",
              status === "current" ? "font-medium text-accent-ink" : "text-ink-3"
            )}
          >
            {status === "done"
              ? t("goals.milestone.done", {
                  date: entry.reachedAt ? formatDayMonth(entry.reachedAt) : "",
                })
              : status === "current"
                ? t("goals.milestone.current")
                : t("goals.milestone.upcoming")}
          </span>
        </div>
        {milestone.note && <p className="mt-0.5 text-sm text-ink-2">{milestone.note}</p>}
        <ul className="mt-2 flex flex-col gap-2">
          {entry.steps.map((step) => (
            <Step key={step.step.id} step={step} status={status} />
          ))}
        </ul>
      </div>
    </li>
  );
}

function Step({
  step,
  status,
}: {
  step: StepProgress;
  status: RoadmapProgress["milestones"][number]["status"];
}) {
  const { state } = useSystem();
  const template = templateMap(state).get(step.step.templateId);
  const upcoming = status === "upcoming";
  const amount = t(step.step.unit === "times" ? "goals.step.times" : "goals.step.minutes", {
    done: formatNumber(step.done),
    amount: formatNumber(step.step.amount),
  });
  return (
    <li>
      <div className="flex items-center gap-2.5">
        <TypeIcon
          type={template?.type ?? "flexible-duration"}
          className={cn(upcoming && "opacity-50")}
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-base",
            upcoming ? "text-ink-2" : "text-ink",
            step.complete && "text-ink-2"
          )}
        >
          {step.step.title}
        </span>
        <span
          className={cn(
            "tabular shrink-0 text-sm",
            step.complete ? "text-ink-2" : upcoming ? "text-ink-3" : "font-medium text-ink"
          )}
        >
          {upcoming
            ? t(
                step.step.unit === "times" ? "goals.step.timesTarget" : "goals.step.minutesTarget",
                {
                  amount: formatNumber(step.step.amount),
                }
              )
            : amount}
        </span>
      </div>
      {status === "current" && (
        <div className="ml-[26px] mt-1.5">
          <span className="block h-1 overflow-hidden rounded-full bg-hover" aria-hidden>
            <span
              className="block h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
              style={{ width: `${step.fraction * 100}%` }}
            />
          </span>
          {/* What makes the step real: the dates it is planned on */}
          {!step.complete && (
            <p className="tabular mt-1 text-sm text-ink-3">
              {step.inPlanToday
                ? t("goals.step.today")
                : step.next
                  ? `${t("goals.step.next", {
                      date: formatDateShort(new Date(`${step.next.date}T12:00:00`)),
                    })}${step.next.time !== undefined ? ` · ${formatDayMinutes(step.next.time)}` : ""}`
                  : t("goals.step.unplanned")}
              {step.plannedAhead > 1 && ` · ${tp("goals.step.planned", step.plannedAhead)}`}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
