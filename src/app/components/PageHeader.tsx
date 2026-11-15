import type { ReactNode } from "react";
import { cn } from "../lib/cn";

/**
 * A place's header in the context panel: the title, a line under it, and its
 * few actions. The panel is narrow beside the conversation and a whole screen
 * on a phone; the title is sized for both.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  wrap = false,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Lets the actions wrap to a new line on narrow screens */
  wrap?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex justify-between gap-x-4 gap-y-3",
        wrap ? "flex-wrap items-end" : "items-start",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/** The header of a place, with the room under it the panel's sections start from. */
export function PanelHeader(props: Parameters<typeof PageHeader>[0]) {
  return <PageHeader {...props} className={cn("mb-6", props.className)} />;
}

/**
 * A place in the context panel (or a phone's screen): one column at a reading
 * width. `width` is kept for the places that asked for a wide page before the
 * panel; the panel decides the width now.
 */
export function Page({ children }: { children: ReactNode; width?: "wide" | "narrow" }) {
  return (
    <div className="mx-auto w-full max-w-[720px] px-5 pb-12 pt-5 @lg:px-6 lg:pt-6">{children}</div>
  );
}

export const Panel = Page;

export function SectionTitle({
  children,
  meta,
  actions,
}: {
  children: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-h-8 items-center justify-between gap-3">
      <h2 className="flex items-baseline gap-2 text-md font-semibold text-ink">
        {children}
        {meta !== undefined && (
          <span className="tabular text-sm font-normal text-ink-3">{meta}</span>
        )}
      </h2>
      {actions && <div className="flex items-center gap-1">{actions}</div>}
    </div>
  );
}
