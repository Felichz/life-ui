import type { TimeBlock, UUID } from "../../../types";
import { blockName, blockRange, blockStatus, sortBlocks, type BlockStatus } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { minutesOfDay } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { t } from "../../i18n";

export function statusLabel(status: BlockStatus): string {
  return t(`block.status.${status}`);
}

interface BlockPickerProps {
  blocks: TimeBlock[];
  value: UUID;
  onChange: (blockId: UUID) => void;
  disabled?: boolean;
}

export function BlockPicker({ blocks, value, onChange, disabled }: BlockPickerProps) {
  const now = minutesOfDay(useNow(30_000));
  return (
    <div
      role="radiogroup"
      aria-label={t("block.label")}
      className="flex flex-col overflow-hidden rounded-lg border border-line"
    >
      {sortBlocks(blocks).map((block) => {
        const status = blockStatus(block, now);
        const selected = block.id === value;
        return (
          <button
            key={block.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(block.id)}
            className={cn(
              "flex items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 disabled:cursor-not-allowed disabled:opacity-60 coarse:py-3",
              selected ? "bg-accent/5" : "hover:bg-subtle"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex size-4 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-accent bg-accent" : "border-line-strong"
              )}
            >
              {selected && <span className="size-1.5 rounded-full bg-white" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-medium text-ink">
                {blockName(block)}
              </span>
              {!block.isDefault && (
                <span className="tabular block text-sm text-ink-2">{blockRange(block)}</span>
              )}
            </span>
            <span
              className={cn(
                "shrink-0 rounded px-1.5 py-0.5 text-xs font-medium",
                status === "now" ? "bg-accent/10 text-accent-ink" : "text-ink-3"
              )}
            >
              {statusLabel(status)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
