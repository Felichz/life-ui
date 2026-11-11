import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { ModelEndpoint } from "../agent/llm";
import { AlertTriangle, Check, Cpu, HardDrive, MemoryStick, Wrench } from "lucide-react";
import { Button } from "../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/Dialog";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { isDesktop } from "../platform/desktop";
import { t, type MessageKey } from "../i18n";
import {
  AGENT_CONTEXT,
  GPU_MARGIN,
  closingIsEnough,
  estimate,
  formatGiB,
  gpuProcesses,
  isLoaded,
  listModels,
  load,
  runtimeStatus,
  savedChoice,
  saveChoice,
  ramRoom,
  spillBytes,
  startRuntime,
  systemResources,
  verdict,
  type GpuProcess,
  type LocalModel,
  type Placement,
  type Resources,
  type RuntimeId,
  type Runtimes,
  type Verdict,
} from "./models";

type Step =
  | { kind: "checking" }
  | { kind: "setup"; runtimes: Runtimes; models: LocalModel[] }
  | { kind: "load"; model: LocalModel; resources: Resources; need: number | null }
  | { kind: "loading"; model: LocalModel }
  | { kind: "loaded"; model: LocalModel; placement: Placement }
  | { kind: "done" };

const RUNTIME_NAME: Record<RuntimeId, string> = { lmstudio: "LM Studio", ollama: "Ollama" };

const BASE_URL: Record<RuntimeId, string> = {
  lmstudio: "http://127.0.0.1:1234/v1",
  ollama: "http://127.0.0.1:11434/v1",
};

const endpointFor = (model: LocalModel): ModelEndpoint => ({
  baseUrl: BASE_URL[model.runtime],
  model: model.key,
  context: AGENT_CONTEXT,
});

interface ModelContextValue {
  /** The loaded model the agent talks to, or null. */
  endpoint: ModelEndpoint | null;
  /** Opens the model picker again. */
  openSetup: () => void;
}

const ModelContext = createContext<ModelContextValue>({ endpoint: null, openSetup: () => {} });

export const useModel = () => useContext(ModelContext);

/**
 * The desktop app's way in (ADR-004): pick a downloaded model the first time,
 * and on every launch ask before loading it, showing whether it fits on the
 * GPU. The app renders behind it; the web build skips it.
 */
export function ModelGate({ children }: { children: ReactNode }) {
  const [step, setStep] = useState<Step>(() =>
    isDesktop() ? { kind: "checking" } : { kind: "done" }
  );
  const [error, setError] = useState<string | null>(null);
  const [endpoint, setEndpoint] = useState<ModelEndpoint | null>(null);

  const openSetup = useCallback(async () => {
    const runtimes = await runtimeStatus();
    setStep({ kind: "setup", runtimes, models: await listModels(runtimes) });
  }, []);

  const prepareLoad = useCallback(async (model: LocalModel) => {
    if (await isLoaded(model)) {
      setEndpoint(endpointFor(model));
      return setStep({ kind: "done" });
    }
    const resources = await systemResources();
    setStep({ kind: "load", model, resources, need: null });
    const need = await estimate(model).catch(() => null);
    setStep({ kind: "load", model, resources, need });
  }, []);

  useEffect(() => {
    if (step.kind !== "checking") return;
    (async () => {
      const choice = savedChoice();
      if (!choice) return openSetup();
      const runtimes = await runtimeStatus();
      const model = (await listModels(runtimes)).find(
        (m) => m.runtime === choice.runtime && m.key === choice.key
      );
      if (!model) return openSetup();
      await prepareLoad(model);
    })().catch((caught) => {
      setError(String(caught));
      void openSetup().catch(() => setStep({ kind: "done" }));
    });
  }, [step.kind, openSetup, prepareLoad]);

  const choose = async (model: LocalModel) => {
    saveChoice(model);
    setError(null);
    await prepareLoad(model).catch((caught) => setError(String(caught)));
  };

  const start = async (runtime: RuntimeId) => {
    setError(null);
    try {
      await startRuntime(runtime);
      await openSetup();
    } catch (caught) {
      setError(String(caught));
    }
  };

  const doLoad = async (model: LocalModel, need: number, allowOffload: boolean) => {
    setError(null);
    setStep({ kind: "loading", model });
    try {
      const runtimes = await runtimeStatus();
      if (!runtimes[model.runtime].running) await startRuntime(model.runtime);
      const placement = await load(model, need, allowOffload);
      setStep({ kind: "loaded", model, placement });
    } catch (caught) {
      setError(String(caught));
      await prepareLoad(model);
    }
  };

  const open = step.kind !== "done";
  const reopen = useCallback(() => {
    setError(null);
    openSetup().catch((caught) => setError(String(caught)));
  }, [openSetup]);
  return (
    <ModelContext.Provider value={{ endpoint, openSetup: reopen }}>
      {children}
      <Dialog open={open}>
        <DialogContent size="lg" hideClose aria-describedby={undefined}>
          {step.kind === "checking" && <Checking />}
          {step.kind === "setup" && (
            <Setup
              step={step}
              onChoose={choose}
              onStart={start}
              onSkip={() => setStep({ kind: "done" })}
            />
          )}
          {step.kind === "load" && (
            <LoadDialog
              step={step}
              onLoad={doLoad}
              onChange={() => void openSetup()}
              onSkip={() => setStep({ kind: "done" })}
            />
          )}
          {step.kind === "loading" && <Loading model={step.model} />}
          {step.kind === "loaded" && (
            <Loaded
              step={step}
              onContinue={() => {
                setEndpoint(endpointFor(step.model));
                setStep({ kind: "done" });
              }}
            />
          )}
          {error && (
            <p
              role="alert"
              className="mx-5 mb-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-ink"
            >
              {error}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </ModelContext.Provider>
  );
}

function Checking() {
  return (
    <DialogHeader>
      <DialogTitle>{t("model.checking")}</DialogTitle>
    </DialogHeader>
  );
}

function Setup({
  step,
  onChoose,
  onStart,
  onSkip,
}: {
  step: Extract<Step, { kind: "setup" }>;
  onChoose: (model: LocalModel) => void;
  onStart: (runtime: RuntimeId) => void;
  onSkip: () => void;
}) {
  const { runtimes, models } = step;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("model.setup.title")}</DialogTitle>
        <DialogDescription>{t("model.setup.body")}</DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          {(["lmstudio", "ollama"] as const).map((id) => {
            const r = runtimes[id];
            return (
              <div key={id} className="rounded-lg border border-line px-3 py-2.5">
                <p className="text-sm font-medium text-ink">{RUNTIME_NAME[id]}</p>
                <p className="text-xs text-ink-2">
                  {!r.installed
                    ? t("model.runtime.missing")
                    : r.running
                      ? t("model.runtime.running", { port: r.port })
                      : t("model.runtime.stopped")}
                </p>
                {r.installed && !r.running && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-2"
                    onClick={() => onStart(id)}
                  >
                    {t("model.runtime.start")}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
        {models.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-2">
            {t("model.setup.none")}
          </p>
        ) : (
          <ul className="flex max-h-[340px] flex-col overflow-y-auto rounded-lg border border-line">
            {models.map((m) => (
              <li key={`${m.runtime}:${m.key}`} className="border-b border-line last:border-b-0">
                <button
                  type="button"
                  onClick={() => onChoose(m)}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-subtle"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink">{m.name}</span>
                    <span className="tabular block text-xs text-ink-2">
                      {[RUNTIME_NAME[m.runtime], m.params, m.quantization, formatGiB(m.sizeBytes)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>
                  {m.toolUse ? (
                    <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
                      <Wrench className="size-3" />
                      {t("model.tools")}
                    </span>
                  ) : (
                    <span className="rounded bg-hover px-1.5 py-0.5 text-xs text-ink-3">
                      {t("model.noTools")}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogBody>
      <DialogFooter>
        <Button variant="ghost" onClick={onSkip}>
          {t("model.skip")}
        </Button>
      </DialogFooter>
    </>
  );
}

const VERDICT: Record<Verdict, { title: MessageKey; body: MessageKey; tone: string }> = {
  fits: {
    title: "model.verdict.fits",
    body: "model.verdict.fitsBody",
    tone: "bg-success/10 text-success",
  },
  offload: {
    title: "model.verdict.offload",
    body: "model.verdict.offloadBody",
    tone: "bg-tempo/15 text-tempo-ink",
  },
  "too-big": {
    title: "model.verdict.tooBig",
    body: "model.verdict.tooBigBody",
    tone: "bg-danger/10 text-danger",
  },
  unknown: {
    title: "model.verdict.unknown",
    body: "model.verdict.unknownBody",
    tone: "bg-hover text-ink-2",
  },
};

function LoadDialog({
  step,
  onLoad,
  onChange,
  onSkip,
}: {
  step: Extract<Step, { kind: "load" }>;
  onLoad: (model: LocalModel, need: number, allowOffload: boolean) => void;
  onChange: () => void;
  onSkip: () => void;
}) {
  const { model, resources, need } = step;
  const [confirming, setConfirming] = useState(false);
  const gpu = [...resources.gpus].sort((a, b) => b.vram_free - a.vram_free)[0];
  const result = need === null ? null : verdict(need, resources);
  const spill = need === null ? 0 : spillBytes(need, resources);
  const meta = result ? VERDICT[result] : null;

  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("model.load.title", { name: model.name })}</DialogTitle>
        <DialogDescription>
          {t("model.load.body", {
            runtime: RUNTIME_NAME[model.runtime],
            context: formatNumber(AGENT_CONTEXT),
          })}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="flex flex-col gap-3 pb-4">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line text-sm">
          <Stat
            icon={<HardDrive />}
            label={t("model.need")}
            value={need === null ? "…" : formatGiB(need)}
          />
          <Stat
            icon={<Cpu />}
            label={gpu ? t("model.vramFree", { gpu: gpu.name }) : t("model.vram")}
            value={gpu ? `${formatGiB(gpu.vram_free)} / ${formatGiB(gpu.vram_total)}` : "—"}
          />
          <Stat
            icon={<MemoryStick />}
            label={t("model.ramFree")}
            value={`${formatGiB(resources.ram_available)} / ${formatGiB(resources.ram_total)}`}
          />
        </dl>
        {gpu && need !== null && (
          <VramBar used={gpu.vram_used} need={need} total={gpu.vram_total} />
        )}
        {meta && (
          <div className={cn("rounded-lg px-3.5 py-3 text-sm", meta.tone)}>
            <p className="flex items-center gap-1.5 font-medium">
              {result === "fits" ? (
                <Check className="size-4" />
              ) : (
                <AlertTriangle className="size-4" />
              )}
              {t(meta.title)}
            </p>
            <p className="mt-0.5 text-ink-2">
              {t(meta.body, {
                spill: formatGiB(spill),
                room: formatGiB(ramRoom(resources)),
                note: resources.vram_note ?? "",
              })}
            </p>
          </div>
        )}
        {gpu && need !== null && result !== "fits" && (
          <GpuUsers need={need} freeVram={gpu.vram_free} />
        )}
        {confirming && result !== "fits" && (
          <p className="text-sm font-medium text-ink">
            {result === "too-big" ? t("model.confirm.tooBig") : t("model.confirm.offload")}
          </p>
        )}
      </DialogBody>
      <DialogFooter className="sm:justify-between">
        <div className="flex gap-1">
          <Button variant="ghost" onClick={onChange}>
            {t("model.change")}
          </Button>
          <Button variant="ghost" onClick={onSkip}>
            {t("model.notNow")}
          </Button>
        </div>
        <Button
          variant={result === "too-big" && confirming ? "danger" : "primary"}
          disabled={need === null}
          onClick={() => {
            if (need === null) return;
            if (result === "fits" || confirming) onLoad(model, need, result !== "fits");
            else setConfirming(true);
          }}
        >
          {result === "too-big" && confirming
            ? t("model.loadAnyway")
            : confirming
              ? t("model.loadConfirm")
              : t("model.loadButton")}
        </Button>
      </DialogFooter>
    </>
  );
}

/** What holds the GPU's memory now, and which one is enough to close. */
function GpuUsers({ need, freeVram }: { need: number; freeVram: number }) {
  const [list, setList] = useState<GpuProcess[] | null | "error">(null);
  useEffect(() => {
    let live = true;
    gpuProcesses()
      .then((found) => live && setList(found))
      .catch(() => live && setList("error"));
    return () => {
      live = false;
    };
  }, []);

  if (list === "error") return <p className="text-sm text-ink-2">{t("model.gpu.unavailable")}</p>;
  if (list === null) return <p className="text-sm text-ink-2">{t("model.gpu.loading")}</p>;

  const MIN = 50 * 1024 ** 2;
  const apps = list.filter((p) => !p.system && p.bytes >= MIN).slice(0, 5);
  const windows = list.filter((p) => p.system).reduce((sum, p) => sum + p.bytes, 0);
  return (
    <section>
      <h3 className="mb-1.5 flex flex-wrap items-baseline justify-between gap-x-3 text-sm font-medium text-ink">
        {t("model.gpu.title")}
        <span className="font-normal text-ink-2">
          {t("model.gpu.missing", { size: formatGiB(Math.max(0, need + GPU_MARGIN - freeVram)) })}
        </span>
      </h3>
      <ul className="overflow-hidden rounded-lg border border-line">
        {apps.map((p) => (
          <li
            key={p.pid}
            className="flex items-center gap-3 border-b border-line px-3 py-2 text-sm last:border-b-0"
          >
            <span className="min-w-0 flex-1 truncate">
              <span className="font-medium text-ink">{p.name}</span>
              <span className="tabular ml-2 text-xs text-ink-3">PID {p.pid}</span>
            </span>
            {closingIsEnough(need, freeVram, p) && (
              <span className="inline-flex items-center gap-1 rounded bg-success/10 px-1.5 py-0.5 text-xs text-success">
                <Check className="size-3" />
                {t("model.gpu.enough")}
              </span>
            )}
            <span className="tabular w-20 text-right text-ink-2">{formatGiB(p.bytes)}</span>
          </li>
        ))}
        {windows > 0 && (
          <li className="flex items-center gap-3 px-3 py-2 text-sm text-ink-2">
            <span className="min-w-0 flex-1">{t("model.gpu.windows")}</span>
            <span className="tabular w-20 text-right">{formatGiB(windows)}</span>
          </li>
        )}
      </ul>
    </section>
  );
}

function Stat({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="bg-panel px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs text-ink-2 [&_svg]:size-3.5">
        {icon}
        <span className="truncate">{label}</span>
      </dt>
      <dd className="tabular mt-0.5 text-md font-semibold text-ink">{value}</dd>
    </div>
  );
}

/** The GPU's memory: what other programs use, and where the model would go. */
function VramBar({ used, need, total }: { used: number; need: number; total: number }) {
  const pct = (n: number) => `${Math.max(0, Math.min(100, (n / total) * 100))}%`;
  const fits = used + need <= total;
  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-hover">
        <div className="absolute inset-y-0 left-0 bg-ink-3/45" style={{ width: pct(used) }} />
        <div
          className={cn("absolute inset-y-0", fits ? "bg-accent" : "bg-danger/80")}
          style={{ left: pct(used), width: pct(Math.min(need, total - used)) }}
        />
      </div>
      <p className="mt-1.5 flex gap-4 text-xs text-ink-2">
        <span className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-ink-3/45" />
          {t("model.bar.others", { size: formatGiB(used) })}
        </span>
        <span className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", fits ? "bg-accent" : "bg-danger/80")} />
          {t("model.bar.model", { size: formatGiB(need) })}
        </span>
      </p>
    </div>
  );
}

function Loading({ model }: { model: LocalModel }) {
  return (
    <DialogHeader className="pb-5">
      <DialogTitle>{t("model.loading", { name: model.name })}</DialogTitle>
      <DialogDescription>{t("model.loadingBody")}</DialogDescription>
    </DialogHeader>
  );
}

function Loaded({
  step,
  onContinue,
}: {
  step: Extract<Step, { kind: "loaded" }>;
  onContinue: () => void;
}) {
  const share = Math.round(step.placement.onGpu * 100);
  const full = share >= 95;
  return (
    <>
      <DialogHeader>
        <DialogTitle>{t("model.loaded", { name: step.model.name })}</DialogTitle>
        <DialogDescription>
          {full ? t("model.placement.full") : t("model.placement.partial", { share })}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="primary" onClick={onContinue}>
          {t("model.continue")}
        </Button>
      </DialogFooter>
    </>
  );
}
