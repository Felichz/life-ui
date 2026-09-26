import * as RadixTooltip from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Kbd } from "./Kbd";

export const TooltipProvider = RadixTooltip.Provider;

interface TooltipProps {
  content: ReactNode;
  shortcut?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: ReactNode;
}

export function Tooltip({ content, shortcut, side = "top", children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          sideOffset={6}
          className="z-[70] flex max-w-[260px] items-center gap-2 rounded-md bg-ink px-2 py-1.5 text-xs font-medium text-canvas shadow-pop data-[state=delayed-open]:animate-fade-in"
        >
          <span>{content}</span>
          {shortcut && (
            <span className="flex gap-0.5">
              {shortcut.map((key) => (
                <Kbd key={key} tone="inverse">
                  {key}
                </Kbd>
              ))}
            </span>
          )}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
