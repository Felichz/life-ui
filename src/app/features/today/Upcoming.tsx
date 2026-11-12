import { useMemo, useState } from "react";
import { ChevronDown, NotebookText } from "lucide-react";
import type { PlannedActivity } from "../../../types";
import { localDate } from "../../../system/agendaManager";
import { Markdown } from "../../agent/Markdown";
import { SectionTitle } from "../../components/PageHeader";
import { TypeIcon } from "../../components/TypeIcon";
import { contractOf, templateMap } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatDateShort, formatDayMinutes } from "../../lib/format";
import { useSystem } from "../../state/system";
import { t, tp } from "../../i18n";

/** Days shown before "and N more": two weeks is what a person plans by. */
const DAYS_SHOWN = 14;

/**
 * What is planned for the days ahead (ADR-008), read-only like the rest of
 * the day: it is planned, changed and cancelled through the chat.
 */
export function Upcoming({ className }: { className?: string }) {
  const { state, core } = useSystem();
  const planned = useMemo(
    () => core.getPlannedActivities(),

    [core, state.global.plannedActivities]
  );
  const templates = useMemo(() => templateMap(state), [state]);
  if (planned.length === 0) return null;

  const days: Array<{ date: string; items: PlannedActivity[] }> = [];
  for (const item of planned) {
    const last = days[days.length - 1];
    if (last?.date === item.date) last.items.push(item);
    else days.push({ date: item.date, items: [item] });
  }
  const shown = days.slice(0, DAYS_SHOWN);
  const later = planned.length - shown.reduce((sum, day) => sum + day.items.length, 0);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <section aria-labelledby="upcoming-title" className={className}>
      <SectionTitle meta={planned.length}>
        <span id="upcoming-title">{t("upcoming.title")}</span>
      </SectionTitle>
      <ol className="flex flex-col rounded-lg border border-line bg-panel shadow-xs">
        {shown.map((day) => (
          <li
            key={day.date}
            className="flex flex-col gap-x-4 border-b border-line px-3 py-2 last:border-b-0 sm:flex-row"
          >
            <p className="w-28 shrink-0 pt-1.5 text-sm font-medium text-ink-2">
              {day.date === localDate(tomorrow)
                ? t("upcoming.tomorrow")
                : formatDateShort(new Date(`${day.date}T12:00:00`))}
            </p>
            <ul className="min-w-0 flex-1">
              {day.items.map((item) => {
                const template = templates.get(item.templateId);
                return (
                  <PlannedRow
                    key={item.id}
                    item={item}
                    title={template?.title ?? t("activity.untitled")}
                    type={template?.type ?? "flexible-duration"}
                    duration={template ? contractOf(template.type, template)?.label : undefined}
                  />
                );
              })}
            </ul>
          </li>
        ))}
      </ol>
      {later > 0 && <p className="mt-2 text-sm text-ink-3">{tp("upcoming.more", later)}</p>}
    </section>
  );
}

function PlannedRow({
  item,
  title,
  type,
  duration,
}: {
  item: PlannedActivity;
  title: string;
  type: Parameters<typeof TypeIcon>[0]["type"];
  duration?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li>
      <div className="flex min-h-8 items-center gap-2.5">
        <span className="tabular w-11 shrink-0 text-sm text-ink-2">
          {item.time !== undefined ? formatDayMinutes(item.time) : ""}
        </span>
        <TypeIcon type={type} />
        <span className="min-w-0 flex-1 truncate text-base text-ink">{title}</span>
        {duration && <span className="tabular shrink-0 text-sm text-ink-3">{duration}</span>}
        {item.notes && <NotesToggle open={open} onToggle={() => setOpen((now) => !now)} />}
      </div>
      {open && item.notes && <ActivityNotes notes={item.notes} className="mb-2 ml-[54px]" />}
    </li>
  );
}

/** The button that opens what is written inside an activity. */
export function NotesToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={t(open ? "notes.hide" : "notes.show")}
      onClick={onToggle}
      className="flex h-7 shrink-0 items-center gap-0.5 rounded px-1 text-ink-3 transition-colors duration-150 hover:bg-hover hover:text-ink coarse:h-9"
    >
      <NotebookText className="size-3.5" />
      <ChevronDown
        className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")}
      />
    </button>
  );
}

/** What to do in an activity: a routine, a checklist, written by the agent or the person. */
export function ActivityNotes({ notes, className }: { notes: string; className?: string }) {
  return (
    <div className={cn("rounded-md bg-subtle px-3 py-2.5 [&_*]:text-sm", className)}>
      <Markdown>{notes}</Markdown>
    </div>
  );
}
