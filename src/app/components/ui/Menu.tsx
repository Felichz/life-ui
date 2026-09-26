import * as RadixMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronRight } from "lucide-react";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "../../lib/cn";

export const Menu = RadixMenu.Root;
export const MenuTrigger = RadixMenu.Trigger;
export const MenuSub = RadixMenu.Sub;

const surface =
  "z-50 min-w-[200px] overflow-hidden rounded-lg border border-line bg-panel p-1 text-ink shadow-pop data-[state=open]:animate-pop-in";

export function MenuContent({
  className,
  align = "end",
  sideOffset = 6,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Content>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(surface, className)}
        {...props}
      />
    </RadixMenu.Portal>
  );
}

const itemClass =
  "relative flex h-8 cursor-default select-none items-center gap-2.5 rounded px-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:text-ink-3 coarse:h-10 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-ink-2";

interface MenuItemProps extends ComponentPropsWithoutRef<typeof RadixMenu.Item> {
  icon?: ReactNode;
  shortcut?: string;
  destructive?: boolean;
}

export function MenuItem({
  icon,
  shortcut,
  destructive,
  className,
  children,
  ...props
}: MenuItemProps) {
  return (
    <RadixMenu.Item
      className={cn(
        itemClass,
        destructive && "text-danger [&_svg]:text-danger data-[highlighted]:bg-danger/10",
        className
      )}
      {...props}
    >
      {icon}
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {shortcut && <kbd className="font-sans text-xs text-ink-3">{shortcut}</kbd>}
    </RadixMenu.Item>
  );
}

export function MenuCheckItem({
  checked,
  children,
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.Item> & { checked: boolean }) {
  return (
    <RadixMenu.Item className={cn(itemClass, className)} {...props}>
      <span className="flex size-4 items-center justify-center">
        {checked && <Check className="!text-accent" />}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </RadixMenu.Item>
  );
}

export function MenuSubTrigger({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <RadixMenu.SubTrigger className={cn(itemClass, "data-[state=open]:bg-hover")}>
      {icon}
      <span className="flex-1">{children}</span>
      <ChevronRight className="!size-3.5" />
    </RadixMenu.SubTrigger>
  );
}

export function MenuSubContent({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof RadixMenu.SubContent>) {
  return (
    <RadixMenu.Portal>
      <RadixMenu.SubContent sideOffset={4} className={cn(surface, className)} {...props} />
    </RadixMenu.Portal>
  );
}

export function MenuLabel({ children }: { children: ReactNode }) {
  return (
    <RadixMenu.Label className="px-2 pb-1 pt-1.5 text-xs font-medium text-ink-3">
      {children}
    </RadixMenu.Label>
  );
}

export function MenuSeparator() {
  return <RadixMenu.Separator className="-mx-1 my-1 h-px bg-line" />;
}
