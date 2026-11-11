import { useState } from "react";
import { Cpu, Power } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Tooltip } from "../components/ui/Tooltip";
import { useToast } from "../state/toast";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { isDesktop } from "../platform/desktop";
import { t } from "../i18n";
import { useModel } from "./ModelGate";
import { AGENT_CONTEXT } from "./models";

const RUNTIME_NAME = { lmstudio: "LM Studio", ollama: "Ollama" } as const;

/**
 * The model the agent runs on, always in sight (ADR-004): its name, runtime,
 * context and how much of it sits on the GPU, with a way to change it.
 */
export function ModelBadge({ className }: { className?: string }) {
  const { model, placement, openSetup, unloadModel } = useModel();
  const toast = useToast();
  const [unloading, setUnloading] = useState(false);
  if (!isDesktop()) return null;

  const unload = async () => {
    if (!model) return;
    setUnloading(true);
    try {
      await unloadModel();
      toast({
        title: t("model.badge.unloaded"),
        description: t("model.badge.unloadedHint", { name: model.name }),
      });
    } catch (caught) {
      toast({ tone: "error", title: t("model.badge.unloadFailed"), description: String(caught) });
    } finally {
      setUnloading(false);
    }
  };

  const details = model
    ? [
        RUNTIME_NAME[model.runtime],
        t("model.badge.context", { tokens: formatNumber(AGENT_CONTEXT / 1024) }),
        placement
          ? placement.onGpu >= 0.95
            ? t("model.badge.gpuFull")
            : t("model.badge.gpuPart", { share: Math.round(placement.onGpu * 100) })
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : t("model.badge.none");

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          model ? "bg-live/10 text-live" : "bg-hover text-ink-3"
        )}
      >
        <Cpu className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {model ? model.name : t("agent.noModel.title")}
        </span>
        <span className="block truncate text-xs text-ink-2">{details}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <Button size="sm" variant="ghost" onClick={openSetup} disabled={unloading}>
          {model ? t("model.badge.change") : t("agent.noModel.cta")}
        </Button>
        {model && (
          <Tooltip content={t("model.badge.unload")} side="bottom">
            <IconButton
              label={t("model.badge.unload")}
              size="sm"
              disabled={unloading}
              onClick={() => void unload()}
            >
              <Power />
            </IconButton>
          </Tooltip>
        )}
      </span>
    </div>
  );
}
