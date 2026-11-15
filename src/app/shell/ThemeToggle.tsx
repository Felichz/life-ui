import { Moon, Sun } from "lucide-react";
import { Tooltip } from "../components/ui/Tooltip";
import { cn } from "../lib/cn";
import { useTheme } from "../state/theme";
import { t } from "../i18n";

/**
 * Light or dark in one click, always in reach. It sets the choice explicitly;
 * following the system again is in Settings.
 */
export function ThemeToggle({
  className,
  side = "left",
}: {
  className?: string;
  side?: "left" | "right" | "top" | "bottom";
}) {
  const { resolved, setPreference } = useTheme();
  const next = resolved === "dark" ? "light" : "dark";
  const label = t(next === "dark" ? "shell.theme.toDark" : "shell.theme.toLight");
  return (
    <Tooltip content={label} side={side}>
      <button
        type="button"
        onClick={() => setPreference(next)}
        aria-label={label}
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg text-ink-3 transition-colors hover:bg-hover hover:text-ink",
          className
        )}
      >
        {resolved === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
    </Tooltip>
  );
}
