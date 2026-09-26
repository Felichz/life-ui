import type { ReactNode } from "react";
import { cn } from "../lib/cn";

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
  /** Permite que las acciones bajen de línea en pantallas estrechas */
  wrap?: boolean;
  className?: string;
}) {
  return (
    <header
      className={cn(
        "flex justify-between gap-x-6 gap-y-3",
        wrap ? "flex-wrap items-end" : "items-start sm:items-end",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-ink">{title}</h1>
        {subtitle && <p className="mt-0.5 text-base text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Page({
  children,
  width = "wide",
}: {
  children: ReactNode;
  width?: "wide" | "narrow";
}) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4 pb-10 pt-5 sm:px-6 lg:px-10 lg:pt-8",
        width === "wide" ? "max-w-[1240px]" : "max-w-[880px]"
      )}
    >
      {children}
    </div>
  );
}

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
