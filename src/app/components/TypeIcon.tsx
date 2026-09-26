import { Target, Timer, Waves } from "lucide-react";
import type { ActivityType } from "../../types";
import { TYPE_META } from "../lib/domain";
import { cn } from "../lib/cn";

const ICONS: Record<ActivityType, typeof Target> = {
  "clear-objective": Target,
  "flexible-duration": Waves,
  timeboxing: Timer,
};

export function TypeIcon({
  type,
  className,
  boxed = false,
}: {
  type: ActivityType;
  className?: string;
  boxed?: boolean;
}) {
  const Icon = ICONS[type];
  const meta = TYPE_META[type];
  if (!boxed) {
    return (
      <Icon aria-hidden className={cn("size-4 shrink-0", meta.text, className)} strokeWidth={2} />
    );
  }
  return (
    <span
      aria-hidden
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-md", className)}
      style={{ backgroundColor: `color-mix(in srgb, ${meta.color} 13%, transparent)` }}
    >
      <Icon className={cn("size-4", meta.text)} strokeWidth={2} />
    </span>
  );
}

export function LiveDot({ className }: { className?: string }) {
  return (
    <span className={cn("relative flex size-2 shrink-0", className)} aria-hidden>
      <span className="absolute inset-0 animate-ring rounded-full bg-live" />
      <span className="relative size-2 rounded-full bg-live" />
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-6 shrink-0", className)} aria-hidden>
      <rect width="32" height="32" rx="8" fill="rgb(var(--accent))" />
      <circle cx="15.5" cy="15.5" r="7.5" fill="none" stroke="#fff" strokeWidth="3" />
      <path d="M15.5 8a7.5 7.5 0 0 1 7.5 7.5h-7.5z" fill="#fff" />
      <path d="M20 20l4.5 4.5" stroke="rgb(var(--tempo))" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
