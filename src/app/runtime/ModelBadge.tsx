import { useState } from "react";
import { Cloud, Cpu, Power } from "lucide-react";
import { Button, IconButton } from "../components/ui/Button";
import { Tooltip } from "../components/ui/Tooltip";
import { useToast } from "../state/toast";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { isDesktop } from "../platform/desktop";
import { t } from "../i18n";
import { useModel } from "./ModelGate";
import { useAgentAvailable } from "../agent/AgentProvider";
import { providerName } from "./providers";

const RUNTIME_NAME = { lmstudio: "LM Studio", ollama: "Ollama" } as const;

/**
 * The model the agent runs on, always in sight (ADR-004): its name, runtime,
 * context and how much of it sits on the GPU, with a way to change it. A model
 * through an API (ADR-005) shows its provider instead.
 */
export function ModelBadge({ className }: { className?: string }) {
  const { model, remote, placement, context, speed, openSetup, unloadModel } = useModel();
  const available = useAgentAvailable();
  const toast = useToast();
  const [unloading, setUnloading] = useState(false);
  // A model that comes from neither setup (a scripted one in tests, the dev model): nothing to show
  if (!isDesktop() && !remote && available) return null;

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

  const details = remote
    ? [
        remote.label || providerName(remote),
        t("model.badge.context", { tokens: formatNumber(remote.context / 1024) }),
      ].join(" · ")
    : model
      ? [
          RUNTIME_NAME[model.runtime],
          t("model.badge.context", { tokens: formatNumber(context / 1024) }),
          speed ? t("model.badge.speed", { speed: formatNumber(speed) }) : null,
          placement
            ? placement.onGpu >= 0.95
              ? t("model.badge.gpuFull")
              : t("model.badge.gpuPart", { share: Math.round(placement.onGpu * 100) })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")
      : isDesktop()
        ? t("model.badge.none")
        : t("remote.badge.none");
  const live = Boolean(model || remote);

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-md",
          live ? "bg-live/10 text-live" : "bg-hover text-ink-3"
        )}
      >
        {remote ? <Cloud className="size-4" /> : <Cpu className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-ink">
          {remote ? remote.model : model ? model.name : t("agent.noModel.title")}
        </span>
        <span className="block truncate text-xs text-ink-2">{details}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5">
        <Button size="sm" variant="ghost" onClick={openSetup} disabled={unloading}>
          {live ? t("model.badge.change") : t(isDesktop() ? "agent.noModel.cta" : "remote.connect")}
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
