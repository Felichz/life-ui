import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { TimeBlock } from "../../../types";
import { DayStrip } from "../../components/DayStrip";
import { Button, IconButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { Tooltip } from "../../components/ui/Tooltip";
import { blockRange, blockStatus, sortBlocks } from "../../lib/domain";
import { formatDayMinutes, minutesOfDay, parseDayMinutes } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { t, tp, tr, type MessageKey } from "../../i18n";

const PRESETS: { name: MessageKey; start: number; end: number }[] = [
  { name: "blocks.preset.morning", start: 6 * 60, end: 12 * 60 },
  { name: "blocks.preset.afternoon", start: 12 * 60, end: 18 * 60 },
  { name: "blocks.preset.evening", start: 18 * 60, end: 23 * 60 },
];

interface Draft {
  name: string;
  start: string;
  end: string;
}

function parseDraft(draft: Draft): { name: string; start: number; end: number } | string {
  if (!draft.name.trim()) return t("blocks.error.name");
  const start = parseDayMinutes(draft.start);
  const end = parseDayMinutes(draft.end);
  if (start === null || end === null) return t("blocks.error.times");
  if (start >= end) return t("blocks.error.order");
  return { name: draft.name.trim(), start, end };
}

/** El core rechaza solapamientos; lo traducimos a un mensaje que ayude. */
function friendlyError(caught: unknown): string {
  const message = errorMessage(caught);
  return /solapa/i.test(message) ? t("blocks.error.overlap") : message;
}

export function BlocksEditor() {
  const { state, core } = useSystem();
  const toast = useToast();
  const now = minutesOfDay(useNow(30_000));
  const blocks = sortBlocks(state.global.timeBlocks);
  const timed = blocks.filter((block) => !block.isDefault);
  const [draft, setDraft] = useState<Draft>({ name: "", start: "", end: "" });
  const [error, setError] = useState<string | null>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (typeof parsed === "string") return setError(parsed);
    try {
      core.createTimeBlock(parsed.name, parsed.start, parsed.end);
      setDraft({ name: "", start: "", end: "" });
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  const usePresets = () => {
    try {
      for (const preset of PRESETS) core.createTimeBlock(t(preset.name), preset.start, preset.end);
      toast({
        title: t("blocks.presetsCreated"),
        description: t("blocks.presetsCreatedHint"),
      });
    } catch (caught) {
      toast({ tone: "error", title: t("error.create"), description: friendlyError(caught) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-xl text-base text-ink-2">
        {tr("blocks.intro", {
          todo: <span className="font-medium text-ink">{t("block.todo")}</span>,
        })}
      </p>

      <DayStrip segments={[]} events={[]} blocks={timed} nowMinute={now} size="large" />

      <ul className="overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
        {blocks.map((block) =>
          block.isDefault ? (
            <li
              key={block.id}
              className="flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-ink">{t("block.todo")}</p>
                <p className="text-sm text-ink-2">{t("blocks.todoHint")}</p>
              </div>
            </li>
          ) : (
            <BlockRow key={block.id} block={block} isNow={blockStatus(block, now) === "now"} />
          )
        )}
      </ul>

      {timed.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3">
          <p className="text-sm text-ink-2">{t("blocks.presetsPrompt")}</p>
          <Button variant="secondary" size="sm" onClick={usePresets}>
            {t("blocks.usePresets")}
          </Button>
        </div>
      )}

      <form onSubmit={add} className="rounded-lg border border-line bg-subtle/60 p-4" noValidate>
        <h3 className="text-sm font-semibold text-ink">{t("blocks.new")}</h3>
        <BlockFields draft={draft} onChange={(next) => (setDraft(next), setError(null))} />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="mt-3">
          <Plus />
          {t("blocks.add")}
        </Button>
      </form>
    </div>
  );
}

function BlockFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
      <Input
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        placeholder={t("blocks.namePlaceholder")}
        aria-label={t("blocks.nameLabel")}
        className="col-span-2 sm:col-span-1"
      />
      <Input
        type="time"
        value={draft.start}
        onChange={(event) => onChange({ ...draft, start: event.target.value })}
        aria-label={t("blocks.start")}
        className="tabular"
      />
      <Input
        type="time"
        value={draft.end}
        onChange={(event) => onChange({ ...draft, end: event.target.value })}
        aria-label={t("blocks.end")}
        className="tabular"
      />
    </div>
  );
}

function BlockRow({ block, isNow }: { block: TimeBlock; isNow: boolean }) {
  const { state, core } = useSystem();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: block.name,
    start: formatDayMinutes(block.startMinute),
    end: formatDayMinutes(block.endMinute),
  });
  const [error, setError] = useState<string | null>(null);
  const planned =
    state.currentDay?.activityInstances.filter((item) => item.blockId === block.id) ?? [];
  const hasActive = planned.some((item) => item.id === state.currentDay?.activeActivityInstanceId);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (typeof parsed === "string") return setError(parsed);
    try {
      core.updateTimeBlock(block.id, {
        name: parsed.name,
        startMinute: parsed.start,
        endMinute: parsed.end,
      });
      setEditing(false);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  const remove = (moveToTodo: boolean) => {
    try {
      core.deleteTimeBlock(block.id, moveToTodo);
      toast({ title: t("blocks.deleted", { name: block.name }) });
    } catch (caught) {
      toast({ tone: "error", title: t("error.delete"), description: errorMessage(caught) });
    }
  };

  if (editing) {
    return (
      <li className="border-b border-line px-4 py-3 last:border-b-0">
        <form onSubmit={save} noValidate>
          <BlockFields draft={draft} onChange={(next) => (setDraft(next), setError(null))} />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-2.5 flex gap-2">
            <Button type="submit" size="sm" variant="primary">
              <Check />
              {t("common.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t("common.cancel")}
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-b border-line px-4 py-2 last:border-b-0">
      <div className="flex min-h-[40px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-medium text-ink">
            {block.name}
            {isNow && (
              <span className="rounded bg-accent/10 px-1.5 py-px text-xs font-medium text-accent-ink">
                {t("block.status.now")}
              </span>
            )}
          </p>
          <p className="tabular text-sm text-ink-2">
            {blockRange(block)}
            {planned.length > 0 && (
              <span className="text-ink-3"> · {tp("blocks.activitiesToday", planned.length)}</span>
            )}
          </p>
        </div>
        <Tooltip content={t("common.edit")}>
          <IconButton
            label={t("common.editNamed", { name: block.name })}
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil />
          </IconButton>
        </Tooltip>
        <Tooltip content={hasActive ? t("blocks.hasRunning") : t("common.delete")}>
          <span>
            <IconButton
              label={t("common.deleteNamed", { name: block.name })}
              size="sm"
              disabled={hasActive}
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      {confirming && (
        <div className="mb-1.5 mt-1 flex flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-2 text-sm">
          <span className="mr-auto text-ink-2">
            {planned.length > 0
              ? tp("blocks.deleteWithActivities", planned.length)
              : t("blocks.deleteConfirm")}
          </span>
          {planned.length > 0 ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => remove(true)}>
                {t("blocks.moveToTodo")}
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(false)}>
                {t("blocks.removeFromPlan")}
              </Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => remove(true)}>
              {t("common.delete")}
            </Button>
          )}
          <IconButton label={t("common.cancel")} size="sm" onClick={() => setConfirming(false)}>
            <X />
          </IconButton>
        </div>
      )}
    </li>
  );
}
