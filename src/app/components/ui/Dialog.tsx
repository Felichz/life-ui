import { t } from "../../i18n";
import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const Dialog = RadixDialog.Root;
export const DialogTrigger = RadixDialog.Trigger;
export const DialogClose = RadixDialog.Close;

interface DialogContentProps extends ComponentPropsWithoutRef<typeof RadixDialog.Content> {
  /** center: modal centrado. sheet: panel lateral en escritorio, hoja inferior en móvil. */
  variant?: "center" | "sheet";
  size?: "sm" | "md" | "lg";
  hideClose?: boolean;
}

export function DialogContent({
  variant = "center",
  size = "md",
  hideClose = false,
  className,
  children,
  ...props
}: DialogContentProps) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 z-50 bg-[rgb(var(--shadow)/0.36)] data-[state=open]:animate-fade-in dark:bg-black/60" />
      <RadixDialog.Content
        {...props}
        className={cn(
          "fixed z-50 flex flex-col border-line bg-panel text-ink shadow-dialog focus:outline-none",
          variant === "center" && [
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl border-t data-[state=open]:animate-sheet-up",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:max-h-[86dvh] sm:w-[calc(100vw-32px)] sm:rounded-xl sm:border sm:data-[state=open]:animate-dialog-in",
            size === "sm" && "sm:max-w-[420px]",
            size === "md" && "sm:max-w-[520px]",
            size === "lg" && "sm:max-w-[640px]",
          ],
          variant === "sheet" && [
            "inset-x-0 bottom-0 max-h-[94dvh] rounded-t-xl border-t data-[state=open]:animate-sheet-up",
            "md:inset-y-2 md:left-auto md:right-2 md:max-h-none md:w-[460px] md:rounded-xl md:border md:data-[state=open]:animate-sheet-in",
          ],
          className
        )}
      >
        {children}
        {!hideClose && (
          <RadixDialog.Close
            aria-label={t("common.close")}
            className="absolute right-3 top-3 flex size-8 items-center justify-center rounded text-ink-3 transition-colors hover:bg-hover hover:text-ink coarse:size-10"
          >
            <X className="size-[18px]" />
          </RadixDialog.Close>
        )}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  );
}

export function DialogHeader({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("shrink-0 px-5 pb-2 pr-14 pt-5", className)}>{children}</div>;
}

export function DialogTitle({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDialog.Title>) {
  return (
    <RadixDialog.Title
      className={cn("text-lg font-semibold text-ink text-balance", className)}
      {...props}
    />
  );
}

export function DialogDescription({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixDialog.Description>) {
  return (
    <RadixDialog.Description className={cn("mt-1 text-sm text-ink-2", className)} {...props} />
  );
}

export function DialogBody({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-3", className)}>{children}</div>
  );
}

export function DialogFooter({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col-reverse gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:justify-end",
        className
      )}
    >
      {children}
    </div>
  );
}
