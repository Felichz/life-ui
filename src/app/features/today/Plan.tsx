import { useState } from "react";
import { Check, Lock } from "lucide-react";
import type {
  AppState,
  CompletedActivityRecord,
  EventInstance,
  TimeBlock,
  UUID,
} from "../../../types";
import { Tooltip } from "../../components/ui/Tooltip";
import { LiveDot, TypeIcon } from "../../components/TypeIcon";
import {
  blockName,
  blockRange,
  blockStatus,
  recordContract,
  type BlockStatus,
  type PlanItem,
} from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatDayMinutes, formatMinutes, formatTime } from "../../lib/format";
import { MISSED_AFTER } from "../../agent/snapshot";
import { ActivityNotes, NotesToggle } from "./Upcoming";
import { t } from "../../i18n";

/**
 * The day as one line of time, read-only: every change goes through the chat
 * (ADR-002). What was done and logged comes first, then a mark for now (with
 * what is running), then what is still planned, block by block. The plan and
 * the log were two columns; they are one day, split at now.
 */

export interface PlanGroup {
  block: TimeBlock;
  status: BlockStatus;
  items: PlanItem[];
}

type Done =
  | { kind: "record"; at: string; record: CompletedActivityRecord }
  | { kind: "event"; at: string; event: EventInstance };

function doneToday(state: AppState, dayId: UUID): Done[] {
  return [
    ...state.global.completedActivityRecords
      .filter((record) => record.dayId === dayId)
      .map((record) => ({ kind: "record" as const, at: record.startTime, record })),
    ...state.global.eventInstances
      .filter((event) => event.dayId === dayId)
      .map((event) => ({ kind: "event" as const, at: event.timestamp, event })),
  ].sort((a, b) => a.at.localeCompare(b.at));
}

export function DayTimeline({
  state,
  dayId,
  groups,
  active,
  nowMinutes,
}: {
  state: AppState;
  dayId: UUID;
  groups: PlanGroup[];
  active: PlanItem | null;
  nowMinutes: number;
}) {
  const done = doneToday(state, dayId);
  const past = groups.filter((group) => group.status === "past" && group.items.length > 0);
  // The current block first, then "To do", then what comes later
  const ahead = [
    ...groups.filter((group) => group.status === "now"),
    ...groups.filter((group) => group.status === "always"),
    ...groups.filter((group) => group.status === "later"),
  ];
  const nothingYet = done.length === 0 && past.length === 0;

  return (
    <div className="flex flex-col">
      {done.length > 0 && (
        <ol aria-label={t("today.log")} className="flex flex-col">
          {done.map((entry) =>
            entry.kind === "record" ? (
              <DoneRow key={entry.record.id} record={entry.record} />
            ) : (
              <EventRow key={entry.event.id} event={entry.event} />
            )
          )}
        </ol>
      )}
      {past.map((group) => (
        <Group key={group.block.id} group={group} nowMinutes={nowMinutes} />
      ))}

      <NowMark minutes={nowMinutes} first={nothingYet} />
      {active && <RunningRow item={active} />}

      {ahead.map((group) => (
        <Group key={group.block.id} group={group} nowMinutes={nowMinutes} />
      ))}
    </div>
  );
}

/** Now, as a line across the day: the one indigo mark of the timeline. */
function NowMark({ minutes, first }: { minutes: number; first: boolean }) {
  return (
    <div
      className={cn("flex items-center gap-2 pb-2", first ? "pt-0" : "pt-4")}
      aria-label={t("block.status.now")}
    >
      <span className="tabular shrink-0 text-xs font-semibold text-accent-ink">
        {t("block.status.now")} · {formatDayMinutes(minutes)}
      </span>
      <span aria-hidden className="h-px flex-1 bg-accent/40" />
    </div>
  );
}

/** The time column: "9:40" in Spanish, "11:15 AM" in English. */
const TIME = "tabular w-11 shrink-0 whitespace-nowrap text-sm text-ink-3 [:lang(en)_&]:w-[62px]";

function DoneRow({ record }: { record: CompletedActivityRecord }) {
  const interrupted = record.state === "interrupted";
  const contract = recordContract(record);
  return (
    <li className="flex min-h-[40px] items-center gap-2.5 py-1.5">
      <span className={TIME}>{formatTime(record.startTime)}</span>
      <Check aria-hidden className="size-4 shrink-0 text-ink-3" strokeWidth={2.2} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-base text-ink-2">{record.templateTitle}</p>
        <p className="tabular truncate text-xs text-ink-3">
          {formatMinutes(record.durationMinutes)}
          {contract && ` · ${contract.label}`}
          {!interrupted &&
            record.satisfactionScore !== undefined &&
            ` · ${record.satisfactionScore}/10`}
        </p>
      </div>
      {interrupted ? (
        <span className="shrink-0 text-xs text-ink-3">{t("log.notFinished")}</span>
      ) : (
        <span className="tabular shrink-0 rounded bg-tempo/15 px-1.5 py-0.5 text-xs font-semibold text-tempo-ink">
          +{record.temposAwarded ?? 0}
        </span>
      )}
    </li>
  );
}

function EventRow({ event }: { event: EventInstance }) {
  return (
    <li className="flex min-h-[32px] items-center gap-2.5 py-1">
      <span className={TIME}>{formatTime(event.timestamp)}</span>
      <span aria-hidden className="mx-1 size-2 shrink-0 rotate-45 bg-event" />
      <span className="min-w-0 flex-1 truncate text-sm text-ink-2">{event.templateName}</span>
      <span className="text-xs text-ink-3">{t("log.event")}</span>
    </li>
  );
}

/** What is running, with what it holds open: the person reads it while doing it (ADR-008). */
function RunningRow({ item }: { item: PlanItem }) {
  return (
    <div className="mb-2 rounded-lg bg-live/5 px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <LiveDot />
        <p className="min-w-0 flex-1 truncate text-base font-semibold text-ink">{item.title}</p>
        {item.contract && (
          <span className="tabular shrink-0 text-sm text-ink-3">{item.contract.label}</span>
        )}
      </div>
      {item.instance.notes && <ActivityNotes notes={item.instance.notes} className="mt-2.5" />}
    </div>
  );
}

function Group({ group, nowMinutes }: { group: PlanGroup; nowMinutes: number }) {
  const items = group.items.filter((item) => !item.isActive);
  // A block with nothing left in it says so in one quiet line, and only while it is current
  if (items.length === 0 && group.status !== "now") return null;
  return (
    <section aria-label={blockName(group.block)} className="pt-3">
      <h3 className="flex h-7 items-center gap-2 text-sm">
        <span
          className={cn("font-semibold", group.status === "past" ? "text-ink-3" : "text-ink-2")}
        >
          {blockName(group.block)}
        </span>
        {!group.block.isDefault && (
          <span className="tabular text-ink-3">{blockRange(group.block)}</span>
        )}
        {group.status === "later" && (
          <span className="text-ink-3">· {t("block.status.later")}</span>
        )}
      </h3>
      {group.status === "past" && (
        <p className="mb-1 text-xs text-ink-3">{t("plan.pastNoticeChat")}</p>
      )}
      {items.length === 0 ? (
        <p className="flex h-9 items-center text-sm text-ink-3">{t("plan.emptyChat")}</p>
      ) : (
        <ul className="flex flex-col">
          {items.map((item) => (
            <PlanRow key={item.instance.id} item={item} group={group} nowMinutes={nowMinutes} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanRow({
  item,
  group,
  nowMinutes,
}: {
  item: PlanItem;
  group: PlanGroup;
  nowMinutes: number;
}) {
  const { status, block } = group;
  const available = status === "always" || status === "now";
  const scheduled = item.instance.scheduledStart;
  const missed = scheduled !== undefined && nowMinutes > scheduled + MISSED_AFTER;
  const lockedReason =
    status === "later"
      ? t("plan.availableFrom", {
          start: formatDayMinutes(block.startMinute),
          end: formatDayMinutes(block.endMinute),
        })
      : t("plan.pastLocked");
  const notes = item.instance.notes;
  const [open, setOpen] = useState(false);

  return (
    <li className="border-b border-line/70 last:border-b-0">
      <div className="flex min-h-[44px] items-center gap-2.5 py-1.5 coarse:min-h-[52px]">
        <span className={cn(TIME, missed && "line-through")}>
          {scheduled !== undefined ? formatDayMinutes(scheduled) : ""}
        </span>
        <TypeIcon type={item.type} />
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-base font-medium",
              status === "past" ? "text-ink-2" : "text-ink"
            )}
          >
            {item.title}
          </p>
          {(item.contract || missed) && (
            <p className="tabular truncate text-xs text-ink-3">
              {item.contract?.label}
              {missed && `${item.contract ? " · " : ""}${t("plan.timePassed")}`}
            </p>
          )}
        </div>
        {notes && <NotesToggle open={open} onToggle={() => setOpen((now) => !now)} />}
        {!available && (
          <Tooltip content={lockedReason}>
            <span
              tabIndex={0}
              aria-label={lockedReason}
              className="flex size-7 shrink-0 items-center justify-center rounded text-ink-3"
            >
              <Lock className="size-3.5" />
            </span>
          </Tooltip>
        )}
      </div>
      {open && notes && (
        <ActivityNotes notes={notes} className="mb-3 ml-[54px] [:lang(en)_&]:ml-[72px]" />
      )}
    </li>
  );
}

export function planGroups(
  blocks: TimeBlock[],
  items: PlanItem[],
  nowMinutes: number
): PlanGroup[] {
  const known = new Set(blocks.map((block) => block.id));
  const fallback = blocks.find((block) => block.isDefault);
  // Scheduled first, by time; then the rest in their order (ADR-006)
  const ordered = [...items].sort(
    (a, b) =>
      (a.instance.scheduledStart ?? 10_000) - (b.instance.scheduledStart ?? 10_000) ||
      a.instance.order - b.instance.order
  );
  return blocks.map((block) => ({
    block,
    status: blockStatus(block, nowMinutes),
    items: ordered.filter(
      (item) =>
        item.instance.blockId === block.id ||
        (block === fallback && !known.has(item.instance.blockId))
    ),
  }));
}
