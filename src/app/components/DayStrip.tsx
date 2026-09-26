import { t } from "../i18n";
import type { ActivityType, TimeBlock } from "../../types";
import { TYPE_META, blockName } from "../lib/domain";
import { cn } from "../lib/cn";
import { formatDayMinutes, formatMinutes } from "../lib/format";

export interface StripSegment {
  id: string;
  start: number;
  end: number;
  type: ActivityType;
  title: string;
  interrupted?: boolean;
  running?: boolean;
}

export interface StripEvent {
  id: string;
  minute: number;
  name: string;
}

interface DayStripProps {
  segments: StripSegment[];
  events: StripEvent[];
  blocks?: TimeBlock[];
  nowMinute?: number;
  size?: "compact" | "large";
  className?: string;
}

/**
 * La tira del día: franjas horarias de fondo, lo que realmente ocurrió como
 * segmentos coloreados por tipo, eventos como marcas y la línea de "ahora".
 * Es una vista de apoyo (aria-hidden): la lista de registro lleva los datos.
 */
export function DayStrip({
  segments,
  events,
  blocks = [],
  nowMinute,
  size = "compact",
  className,
}: DayStripProps) {
  const timedBlocks = blocks.filter((block) => !block.isDefault);
  const points = [
    ...segments.flatMap((segment) => [segment.start, segment.end]),
    ...events.map((event) => event.minute),
    ...timedBlocks.flatMap((block) => [block.startMinute, block.endMinute]),
    ...(nowMinute !== undefined ? [nowMinute] : []),
  ];
  const earliest = Math.min(7 * 60, ...points);
  const latest = Math.max(21 * 60, ...points);
  const start = Math.max(0, Math.floor(earliest / 60) * 60);
  const end = Math.min(24 * 60, Math.ceil(latest / 60) * 60);
  const span = Math.max(60, end - start);
  const pct = (minute: number) =>
    `${((Math.min(end, Math.max(start, minute)) - start) / span) * 100}%`;
  const width = (from: number, to: number) =>
    `${(Math.max(0, Math.min(end, to) - Math.max(start, from)) / span) * 100}%`;

  const hourStep = size === "large" ? (span > 12 * 60 ? 2 : 1) : span > 12 * 60 ? 3 : 2;
  const ticks: number[] = [];
  for (let hour = Math.ceil(start / 60); hour * 60 <= end; hour += hourStep) ticks.push(hour * 60);

  const trackHeight = size === "large" ? "h-10" : "h-7";

  return (
    <div className={cn("select-none", className)} aria-hidden>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-md bg-subtle ring-1 ring-inset ring-line",
          trackHeight
        )}
      >
        {timedBlocks.map((block, index) => (
          <div
            key={block.id}
            title={`${blockName(block)} · ${formatDayMinutes(block.startMinute)}–${formatDayMinutes(block.endMinute)}`}
            className={cn(
              "absolute inset-y-0 border-x border-line/70",
              index % 2 === 0 ? "bg-hover/60" : "bg-hover/25"
            )}
            style={{
              left: pct(block.startMinute),
              width: width(block.startMinute, block.endMinute),
            }}
          >
            {size === "large" && (
              <span className="absolute left-1.5 top-1 truncate text-2xs font-medium text-ink-3">
                {blockName(block)}
              </span>
            )}
          </div>
        ))}

        {segments.map((segment) => {
          const meta = TYPE_META[segment.type];
          return (
            <div
              key={segment.id}
              title={`${segment.title} · ${formatDayMinutes(segment.start)}–${formatDayMinutes(segment.end)} · ${formatMinutes(segment.end - segment.start)}${segment.interrupted ? ` · ${t("log.notFinished").toLowerCase()}` : ""}`}
              className={cn(
                "absolute rounded-[3px]",
                size === "large" ? "inset-y-3.5" : "inset-y-1.5",
                segment.running && "animate-[pulse_2.4s_ease-in-out_infinite]"
              )}
              style={{
                left: pct(segment.start),
                width: `max(3px, ${width(segment.start, segment.end)})`,
                background: segment.interrupted
                  ? `repeating-linear-gradient(135deg, color-mix(in srgb, ${meta.color} 45%, transparent) 0 3px, transparent 3px 6px)`
                  : meta.color,
                boxShadow: segment.interrupted
                  ? `inset 0 0 0 1px color-mix(in srgb, ${meta.color} 55%, transparent)`
                  : undefined,
              }}
            />
          );
        })}

        {events.map((event) => (
          <div
            key={event.id}
            title={`${event.name} · ${formatDayMinutes(event.minute)}`}
            className="absolute inset-y-0 w-0"
            style={{ left: pct(event.minute) }}
          >
            <span className="absolute left-1/2 top-0.5 size-1.5 -translate-x-1/2 rotate-45 bg-event" />
            <span className="absolute inset-y-2 left-1/2 w-px -translate-x-1/2 bg-event/50" />
          </div>
        ))}

        {nowMinute !== undefined && nowMinute >= start && nowMinute <= end && (
          <div className="absolute inset-y-0 w-0" style={{ left: pct(nowMinute) }}>
            <span className="absolute inset-y-0 left-0 w-px bg-accent" />
            <span className="absolute -left-[3px] bottom-0 size-[7px] rounded-full bg-accent" />
          </div>
        )}
      </div>
      <div className="relative mt-1 h-4">
        {ticks.map((tick) => (
          <span
            key={tick}
            className="tabular absolute -translate-x-1/2 text-2xs text-ink-3 first:translate-x-0 last:-translate-x-full"
            style={{ left: pct(tick) }}
          >
            {formatDayMinutes(tick).replace(":00", "")}
          </span>
        ))}
      </div>
    </div>
  );
}
