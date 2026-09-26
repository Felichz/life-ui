import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

export function Kbd({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "inverse";
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-[4px] px-1 font-sans text-2xs font-medium",
        tone === "default" && "border border-line bg-subtle text-ink-2",
        tone === "inverse" && "bg-canvas/15 text-canvas",
        className
      )}
    >
      {children}
    </kbd>
  );
}
