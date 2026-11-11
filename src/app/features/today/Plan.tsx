import { useState } from "react";
import { Link } from "react-router-dom";
import { Clock3, Columns3, List, Lock } from "lucide-react";
import type { TimeBlock } from "../../../types";
import { Segmented } from "../../components/ui/Segmented";
import { Tooltip } from "../../components/ui/Tooltip";
import { LiveDot, TypeIcon } from "../../components/TypeIcon";
import { SectionTitle } from "../../components/PageHeader";
import {
  blockName,
  blockRange,
  blockStatus,
  type BlockStatus,
  type PlanItem,
} from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatDayMinutes } from "../../lib/format";
import { MISSED_AFTER } from "../../agent/snapshot";
import { t } from "../../i18n";

/**
 * The day's plan, read-only: every change goes through the chat (ADR-002).
 * Scheduled activities show their time and come first in their block; one
 * whose time passed shows it, without judgment (ADR-006).
 */

export interface PlanGroup {
  block: TimeBlock;
  status: BlockStatus;
  items: PlanItem[];
}

type View = "list" | "board";
const VIEW_KEY = "lifeui.planView";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "board" ? "board" : "list";
  } catch {
    return "list";
  }
}

export function Plan({
  groups,
  total,
  nowMinutes,
}: {
  groups: PlanGroup[];
  total: number;
  nowMinutes: number;
}) {
  const [view, setView] = useState<View>(readView);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // preference kept in memory only
    }
  };

  return (
    <section aria-labelledby="plan-title">
      <SectionTitle
        meta={total > 0 ? total : undefined}
        actions={
          <>
            <Segmented
              label={t("plan.view")}
              size="sm"
              value={view}
              onChange={changeView}
              className="hidden md:inline-flex"
              options={[
                { value: "list", label: t("plan.view.list"), icon: <List /> },
                { value: "board", label: t("plan.view.board"), icon: <Columns3 /> },
              ]}
            />
            <Tooltip content={t("plan.editBlocks")}>
              <Link
                to="/library?tab=blocks"
                className="ml-1 inline-flex h-7 items-center gap-1.5 rounded px-2 text-sm font-medium text-ink-2 transition-colors hover:bg-hover hover:text-ink coarse:h-9"
              >
                <Clock3 className="size-4" />
                {t("plan.blocks")}
              </Link>
            </Tooltip>
          </>
        }
      >
        <span id="plan-title">{t("plan.title")}</span>
      </SectionTitle>

      {view === "board" ? (
        <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:mx-0 xl:px-0">
          {groups.map((group) => (
            <BoardColumn key={group.block.id} group={group} nowMinutes={nowMinutes} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <ListGroup key={group.block.id} group={group} nowMinutes={nowMinutes} />
          ))}
        </div>
      )}
    </section>
  );
}

function StatusTag({ status }: { status: BlockStatus }) {
  if (status === "now") {
    return (
      <span className="rounded bg-accent/10 px-1.5 py-px text-xs font-medium text-accent-ink">
        {t("block.status.now")}
      </span>
    );
  }
  if (status === "past")
    return <span className="text-xs text-ink-3">{t("block.status.past")}</span>;
  if (status === "later")
    return <span className="text-xs text-ink-3">{t("block.status.later")}</span>;
  return null;
}

function GroupHeader({ group, compact = false }: { group: PlanGroup; compact?: boolean }) {
  const { block, status, items } = group;
  return (
    <div className={cn("flex items-center gap-2", compact ? "h-9 px-1" : "h-8")}>
      <h3 className={cn("text-base font-semibold", status === "past" ? "text-ink-2" : "text-ink")}>
        {blockName(block)}
      </h3>
      {!block.isDefault && <span className="tabular text-sm text-ink-3">{blockRange(block)}</span>}
      <StatusTag status={status} />
      <span className="tabular text-sm text-ink-3">{items.length > 0 ? items.length : ""}</span>
    </div>
  );
}

function PastNotice({ group }: { group: PlanGroup }) {
  if (group.status !== "past" || group.items.length === 0) return null;
  return (
    <p className="mb-1.5 rounded-md bg-subtle px-3 py-2 text-sm text-ink-2">
      {t("plan.pastNoticeChat")}
    </p>
  );
}

function ListGroup({ group, nowMinutes }: { group: PlanGroup; nowMinutes: number }) {
  const empty = group.items.length === 0;
  // A past, empty block asks for nothing: a subtle line instead of a gap
  const quiet = empty && group.status === "past";
  return (
    <div>
      <GroupHeader group={group} />
      <PastNotice group={group} />
      <div
        className={cn(
          "flex flex-col rounded-lg border",
          empty && !quiet && "min-h-[44px] border-dashed border-line",
          quiet && "min-h-[32px] border-transparent",
          !empty && "border-line bg-panel shadow-xs"
        )}
      >
        {empty && (
          <p
            className={cn(
              "flex items-center text-sm text-ink-3",
              quiet ? "h-[30px] px-0" : "h-[42px] px-3"
            )}
          >
            {quiet ? t("plan.emptyPast") : t("plan.emptyChat")}
          </p>
        )}
        {group.items.map((item) => (
          <PlanRow
            key={item.instance.id}
            item={item}
            status={group.status}
            block={group.block}
            nowMinutes={nowMinutes}
          />
        ))}
      </div>
    </div>
  );
}

function BoardColumn({ group, nowMinutes }: { group: PlanGroup; nowMinutes: number }) {
  return (
    <div
      className={cn(
        "flex w-[288px] shrink-0 flex-col rounded-lg border border-line bg-subtle/70 p-1.5",
        group.status === "now" && "border-accent/40"
      )}
    >
      <GroupHeader group={group} compact />
      <PastNotice group={group} />
      <div className="flex min-h-[96px] flex-1 flex-col gap-1.5">
        {group.items.map((item) => (
          <PlanRow
            key={item.instance.id}
            item={item}
            status={group.status}
            block={group.block}
            nowMinutes={nowMinutes}
            card
          />
        ))}
      </div>
    </div>
  );
}

interface PlanRowProps {
  item: PlanItem;
  status: BlockStatus;
  block: TimeBlock;
  nowMinutes: number;
  card?: boolean;
}

function PlanRow({ item, status, block, nowMinutes, card = false }: PlanRowProps) {
  const available = status === "always" || status === "now";
  const scheduled = item.instance.scheduledStart;
  const missed = !item.isActive && scheduled !== undefined && nowMinutes > scheduled + MISSED_AFTER;
  const lockedReason =
    status === "later"
      ? t("plan.availableFrom", {
          start: formatDayMinutes(block.startMinute),
          end: formatDayMinutes(block.endMinute),
        })
      : t("plan.pastLocked");

  return (
    <div
      className={cn(
        "relative flex items-center gap-2.5",
        card
          ? "min-h-[52px] rounded-md border border-line bg-panel px-2.5 py-2 shadow-xs"
          : "min-h-[44px] border-b border-line px-3 last:border-b-0 first:rounded-t-lg last:rounded-b-lg coarse:min-h-[52px]",
        item.isActive && "bg-live/5"
      )}
    >
      {scheduled !== undefined && (
        <span
          className={cn(
            "tabular w-11 shrink-0 text-sm font-medium",
            missed ? "text-ink-3 line-through" : "text-ink-2"
          )}
        >
          {formatDayMinutes(scheduled)}
        </span>
      )}
      <TypeIcon type={item.type} />
      <div className={cn("min-w-0 flex-1", card && "py-0.5")}>
        <span
          className={cn(
            "block truncate text-base font-medium",
            status === "past" ? "text-ink-2" : "text-ink"
          )}
        >
          {item.title}
        </span>
        {card && item.contract && (
          <span className="tabular block text-sm text-ink-3">{item.contract.label}</span>
        )}
      </div>
      {missed && (
        <span className="shrink-0 rounded bg-hover px-1.5 py-0.5 text-xs text-ink-2">
          {t("plan.timePassed")}
        </span>
      )}
      {!card && item.contract && (
        <span className="tabular hidden shrink-0 text-sm text-ink-3 sm:block">
          {item.contract.label}
        </span>
      )}

      {item.isActive ? (
        <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded px-2 text-sm font-medium text-live">
          <LiveDot />
          <span className={cn(card && "sr-only")}>{t("focus.running")}</span>
        </span>
      ) : (
        !available && (
          <Tooltip content={lockedReason}>
            <span
              tabIndex={0}
              aria-label={lockedReason}
              className="flex size-7 shrink-0 items-center justify-center rounded text-ink-3"
            >
              <Lock className="size-3.5" />
            </span>
          </Tooltip>
        )
      )}
    </div>
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
