import { useState } from "react";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Link } from "react-router-dom";
import {
  ArrowRightLeft,
  Clock3,
  Columns3,
  GripVertical,
  List,
  Lock,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Trash2,
} from "lucide-react";
import type { TimeBlock, UUID } from "../../../types";
import { Button, IconButton } from "../../components/ui/Button";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuSub,
  MenuSubContent,
  MenuSubTrigger,
  MenuTrigger,
} from "../../components/ui/Menu";
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
import { useDayActions } from "../../state/actions";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { useShell } from "../../shell/ShellContext";
import { EditInstanceDialog } from "../activity/EditInstanceDialog";
import { t } from "../../i18n";

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

export function Plan({ groups, total }: { groups: PlanGroup[]; total: number }) {
  const { core } = useSystem();
  const toast = useToast();
  const [view, setView] = useState<View>(readView);
  const [editing, setEditing] = useState<UUID | null>(null);

  const changeView = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // preferencia solo en memoria
    }
  };

  const onDragEnd = ({ source, destination, draggableId }: DropResult) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index)
      return;
    try {
      core.moveActivityInstance(draggableId, destination.droppableId, destination.index);
    } catch (caught) {
      toast({ tone: "error", title: t("error.move"), description: errorMessage(caught) });
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

      <DragDropContext onDragEnd={onDragEnd}>
        {view === "board" ? (
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10 xl:mx-0 xl:px-0">
            {groups.map((group) => (
              <BoardColumn key={group.block.id} group={group} onEdit={setEditing} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((group) => (
              <ListGroup key={group.block.id} group={group} onEdit={setEditing} />
            ))}
          </div>
        )}
      </DragDropContext>
      <EditInstanceDialog instanceId={editing} onClose={() => setEditing(null)} />
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
  const { openAddActivity } = useShell();
  const { block, status, items } = group;
  return (
    <div className={cn("flex items-center gap-2", compact ? "h-9 px-1" : "h-8")}>
      <h3 className={cn("text-base font-semibold", status === "past" ? "text-ink-2" : "text-ink")}>
        {blockName(block)}
      </h3>
      {!block.isDefault && <span className="tabular text-sm text-ink-3">{blockRange(block)}</span>}
      <StatusTag status={status} />
      <span className="tabular text-sm text-ink-3">{items.length > 0 ? items.length : ""}</span>
      <IconButton
        label={t("plan.addTo", { block: blockName(block) })}
        size="sm"
        className="ml-auto"
        onClick={() => openAddActivity({ blockId: block.id })}
      >
        <Plus />
      </IconButton>
    </div>
  );
}

function PastNotice({ group }: { group: PlanGroup }) {
  const { core } = useSystem();
  const toast = useToast();
  if (group.status !== "past" || group.items.length === 0) return null;
  const todo = core.getTimeBlocks().find((block) => block.isDefault);
  return (
    <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2 rounded-md bg-subtle px-3 py-2 text-sm text-ink-2">
      <span>{t("plan.pastNotice")}</span>
      {todo && (
        <Button
          variant="ghost"
          size="sm"
          className="-my-1"
          onClick={() => {
            for (const item of group.items) core.moveActivityInstance(item.instance.id, todo.id);
            toast({ title: t("plan.movedToTodo", { count: group.items.length }) });
          }}
        >
          <ArrowRightLeft />
          {t("plan.moveToTodo")}
        </Button>
      )}
    </div>
  );
}

function ListGroup({ group, onEdit }: { group: PlanGroup; onEdit: (id: UUID) => void }) {
  return (
    <div>
      <GroupHeader group={group} />
      <PastNotice group={group} />
      <Droppable droppableId={group.block.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex flex-col rounded-lg transition-colors",
              group.items.length === 0 && "min-h-[44px] border border-dashed border-line",
              group.items.length > 0 && "border border-line bg-panel shadow-xs",
              snapshot.isDraggingOver && "border-accent/60 bg-accent/5"
            )}
          >
            {group.items.length === 0 && !snapshot.isDraggingOver && (
              <p className="flex h-[42px] items-center px-3 text-sm text-ink-3">
                {t("plan.emptyBlock")}
              </p>
            )}
            {group.items.map((item, index) => (
              <PlanRow
                key={item.instance.id}
                item={item}
                index={index}
                status={group.status}
                block={group.block}
                onEdit={onEdit}
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

function BoardColumn({ group, onEdit }: { group: PlanGroup; onEdit: (id: UUID) => void }) {
  return (
    <div
      className={cn(
        "flex w-[288px] shrink-0 flex-col rounded-lg border border-line bg-subtle/70 p-1.5",
        group.status === "now" && "border-accent/40"
      )}
    >
      <GroupHeader group={group} compact />
      <PastNotice group={group} />
      <Droppable droppableId={group.block.id}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "flex min-h-[96px] flex-1 flex-col gap-1.5 rounded-md transition-colors",
              snapshot.isDraggingOver && "bg-accent/5"
            )}
          >
            {group.items.map((item, index) => (
              <PlanRow
                key={item.instance.id}
                item={item}
                index={index}
                status={group.status}
                block={group.block}
                onEdit={onEdit}
                card
              />
            ))}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
}

interface PlanRowProps {
  item: PlanItem;
  index: number;
  status: BlockStatus;
  block: TimeBlock;
  onEdit: (id: UUID) => void;
  card?: boolean;
}

function PlanRow({ item, index, status, block, onEdit, card = false }: PlanRowProps) {
  const { startInstance } = useDayActions();
  const available = status === "always" || status === "now";
  const lockedReason =
    status === "later"
      ? t("plan.availableFrom", {
          start: formatDayMinutes(block.startMinute),
          end: formatDayMinutes(block.endMinute),
        })
      : t("plan.pastLocked");

  return (
    <Draggable draggableId={item.instance.id} index={index} isDragDisabled={item.isActive}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          aria-roledescription={t("plan.draggable")}
          className={cn(
            "group relative flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-accent",
            card
              ? "min-h-[52px] rounded-md border border-line bg-panel px-2.5 py-2 shadow-xs"
              : "min-h-[44px] border-b border-line px-2 last:border-b-0 first:rounded-t-lg last:rounded-b-lg coarse:min-h-[52px]",
            !card && "hover:bg-subtle",
            item.isActive && "bg-live/5",
            snapshot.isDragging && "rounded-md border border-line bg-panel shadow-pop"
          )}
        >
          {!card && (
            <GripVertical
              aria-hidden
              className={cn(
                "size-4 shrink-0 text-ink-3 transition-opacity",
                item.isActive ? "opacity-0" : "opacity-0 group-hover:opacity-100"
              )}
            />
          )}
          <TypeIcon type={item.type} />
          <div className={cn("min-w-0 flex-1", card && "py-0.5")}>
            <button
              type="button"
              onClick={() => onEdit(item.instance.id)}
              className={cn(
                "block max-w-full truncate text-left text-base font-medium hover:underline",
                status === "past" ? "text-ink-2" : "text-ink"
              )}
            >
              {item.title}
            </button>
            {card && item.contract && (
              <span className="tabular block text-sm text-ink-3">{item.contract.label}</span>
            )}
          </div>
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
          ) : available ? (
            <Tooltip content={t("focus.start")}>
              <IconButton
                label={t("plan.startNamed", { title: item.title })}
                size="sm"
                onClick={() => startInstance(item.instance.id)}
                className="text-ink-2 hover:bg-accent/10 hover:text-accent-ink"
              >
                <Play className="fill-current" />
              </IconButton>
            </Tooltip>
          ) : (
            <Tooltip content={lockedReason}>
              <span
                tabIndex={0}
                aria-label={lockedReason}
                className="flex size-7 shrink-0 items-center justify-center rounded text-ink-3 coarse:size-9"
              >
                <Lock className="size-3.5" />
              </span>
            </Tooltip>
          )}
          <RowMenu item={item} onEdit={onEdit} />
        </div>
      )}
    </Draggable>
  );
}

function RowMenu({ item, onEdit }: { item: PlanItem; onEdit: (id: UUID) => void }) {
  const { core } = useSystem();
  const { startInstance } = useDayActions();
  const toast = useToast();
  const blocks = core.getTimeBlocks();

  const run = (label: string, action: () => void) => {
    try {
      action();
    } catch (caught) {
      toast({ tone: "error", title: label, description: errorMessage(caught) });
    }
  };

  return (
    <Menu>
      <MenuTrigger asChild>
        <IconButton label={t("plan.optionsNamed", { title: item.title })} size="sm">
          <MoreHorizontal />
        </IconButton>
      </MenuTrigger>
      <MenuContent>
        {!item.isActive && (
          <MenuItem icon={<Play />} onSelect={() => startInstance(item.instance.id)}>
            {t("plan.startNow")}
          </MenuItem>
        )}
        <MenuItem icon={<Pencil />} onSelect={() => onEdit(item.instance.id)}>
          {t("plan.adjustToday")}
        </MenuItem>
        {!item.isActive && (
          <MenuSub>
            <MenuSubTrigger icon={<ArrowRightLeft />}>{t("plan.moveTo")}</MenuSubTrigger>
            <MenuSubContent>
              {blocks
                .filter((block) => block.id !== item.instance.blockId)
                .map((block) => (
                  <MenuItem
                    key={block.id}
                    onSelect={() =>
                      run(t("error.move"), () =>
                        core.moveActivityInstance(item.instance.id, block.id)
                      )
                    }
                  >
                    {blockName(block)}
                    {!block.isDefault && (
                      <span className="tabular ml-2 text-ink-3">{blockRange(block)}</span>
                    )}
                  </MenuItem>
                ))}
            </MenuSubContent>
          </MenuSub>
        )}
        {!item.isActive && (
          <>
            <MenuSeparator />
            <MenuItem
              icon={<Trash2 />}
              destructive
              onSelect={() =>
                run(t("error.remove"), () => {
                  core.deleteActivityInstance(item.instance.id);
                  toast({
                    title: t("plan.removed", { title: item.title }),
                    description: t("plan.removedHint"),
                  });
                })
              }
            >
              {t("plan.remove")}
            </MenuItem>
          </>
        )}
      </MenuContent>
    </Menu>
  );
}

export function planGroups(
  blocks: TimeBlock[],
  items: PlanItem[],
  nowMinutes: number
): PlanGroup[] {
  const known = new Set(blocks.map((block) => block.id));
  const fallback = blocks.find((block) => block.isDefault);
  return blocks.map((block) => ({
    block,
    status: blockStatus(block, nowMinutes),
    items: items.filter(
      (item) =>
        item.instance.blockId === block.id ||
        (block === fallback && !known.has(item.instance.blockId))
    ),
  }));
}
