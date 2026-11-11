import { desktopFetch, invoke } from "../platform/desktop";

/**
 * Local models in LM Studio and Ollama: what is downloaded, what it needs,
 * whether it fits, and where it landed after loading (ADR-004).
 */

export type RuntimeId = "lmstudio" | "ollama";

export interface RuntimeState {
  installed: boolean;
  running: boolean;
  port: number;
}

export interface Runtimes {
  lmstudio: RuntimeState;
  ollama: RuntimeState;
}

export interface LocalModel {
  runtime: RuntimeId;
  key: string;
  name: string;
  sizeBytes: number;
  params?: string;
  quantization?: string;
  architecture?: string;
  maxContext?: number;
  /** Trained for tool calls: the agent depends on them. */
  toolUse: boolean;
  /** Reads images. */
  vision?: boolean;
}

export interface Gpu {
  name: string;
  vram_total: number;
  vram_used: number;
  vram_free: number;
}

export interface Resources {
  ram_total: number;
  ram_available: number;
  gpus: Gpu[];
  vram_note: string | null;
}

/** The context used when nothing better is known (ADR-004, section 9). */
export const AGENT_CONTEXT = 16384;

/** The contexts the load dialog offers; a model's own maximum caps the list. */
const CONTEXT_STOPS = [4096, 8192, 12288, 16384, 24576, 32768];
/**
 * Below this the agent's own instructions leave too little room to talk: the
 * prompt and the tools take about 5.4K tokens since the coach and the web
 * search (ADR-009), so 8K would leave under 2K for the conversation.
 */
export const MIN_USEFUL_CONTEXT = 12288;

export function contextStops(model: LocalModel): number[] {
  const stops = CONTEXT_STOPS.filter((stop) => !model.maxContext || stop <= model.maxContext);
  return stops.length > 0 ? stops : [CONTEXT_STOPS[0]];
}

const GIB = 1024 ** 3;
const OLLAMA = "http://127.0.0.1:11434";

export interface GpuProcess {
  pid: number;
  name: string;
  bytes: number;
  /** Part of Windows: it can't be closed. */
  system: boolean;
}

/** Programs holding the GPU's memory now, biggest first (Windows only). */
export const gpuProcesses = () => invoke<GpuProcess[]>("gpu_processes");

/** Margin kept free on the GPU when deciding whether a model fits. */
export const GPU_MARGIN = 0.25 * GIB;

/** Would closing this process alone make the model fit entirely on the GPU? */
export function closingIsEnough(needBytes: number, freeVram: number, process: GpuProcess): boolean {
  return needBytes + GPU_MARGIN > freeVram && needBytes + GPU_MARGIN <= freeVram + process.bytes;
}

export const runtimeStatus = () => invoke<Runtimes>("runtime_status");
export const systemResources = () => invoke<Resources>("system_resources");
export const startRuntime = (runtime: RuntimeId) => invoke<void>("start_runtime", { runtime });

async function lmstudioModels(): Promise<LocalModel[]> {
  const list = await invoke<Array<Record<string, unknown>>>("lmstudio_models");
  return list.map((m) => ({
    runtime: "lmstudio" as const,
    key: String(m.modelKey),
    name: String(m.displayName ?? m.modelKey),
    sizeBytes: Number(m.sizeBytes ?? 0),
    params: m.paramsString ? String(m.paramsString) : undefined,
    quantization: (m.quantization as { name?: string } | undefined)?.name,
    architecture: m.architecture ? String(m.architecture) : undefined,
    maxContext: m.maxContextLength ? Number(m.maxContextLength) : undefined,
    toolUse: Boolean(m.trainedForToolUse),
    vision: Boolean(m.vision),
  }));
}

interface OllamaShow {
  capabilities?: string[];
  details?: { parameter_size?: string; quantization_level?: string; family?: string };
  model_info?: Record<string, unknown>;
}

async function ollamaShow(model: string): Promise<OllamaShow> {
  const res = await desktopFetch(`${OLLAMA}/api/show`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model }),
  });
  return res.json();
}

async function ollamaModels(): Promise<LocalModel[]> {
  const res = await desktopFetch(`${OLLAMA}/api/tags`);
  const { models = [] } = (await res.json()) as { models?: Array<Record<string, unknown>> };
  return Promise.all(
    models.map(async (m) => {
      const key = String(m.name);
      const show = await ollamaShow(key).catch(() => ({}) as OllamaShow);
      const info = show.model_info ?? {};
      const contextKey = Object.keys(info).find((k) => k.endsWith(".context_length"));
      return {
        runtime: "ollama" as const,
        key,
        name: key,
        sizeBytes: Number(m.size ?? 0),
        params: show.details?.parameter_size,
        quantization: show.details?.quantization_level,
        architecture: show.details?.family,
        maxContext: contextKey ? Number(info[contextKey]) : undefined,
        toolUse: Boolean(show.capabilities?.includes("tools")),
        vision: Boolean(show.capabilities?.includes("vision")),
      };
    })
  );
}

/** Every downloaded model from the runtimes that are running, tool-capable first. */
export async function listModels(runtimes: Runtimes): Promise<LocalModel[]> {
  const found = await Promise.all([
    runtimes.lmstudio.installed ? lmstudioModels().catch(() => []) : [],
    runtimes.ollama.running ? ollamaModels().catch(() => []) : [],
  ]);
  return found
    .flat()
    .sort((a, b) => Number(b.toolUse) - Number(a.toolUse) || a.name.localeCompare(b.name));
}

const MEASURED_KEY = "lifeui.modelMemory";
const measuredId = (model: LocalModel, context: number) =>
  `${model.runtime}:${model.key}:${context}`;
/** How far over the runtime's estimate ran for a model, from its last trusted load. */
const overshootId = (model: LocalModel) => `${model.runtime}:${model.key}:overshoot`;
/**
 * Before any load has been measured, LM Studio's estimate is taken 10% lower:
 * on the author's PC it ran 13% over at 8K and 14% over at 16K for a 9B model.
 */
const LMSTUDIO_PRIOR = 0.1;

/** The runtime's last raw estimate per model and context, to compare with the load. */
const rawEstimates = new Map<string, number>();

function readMeasures(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(MEASURED_KEY) ?? "{}") as Record<string, number>;
  } catch {
    return {};
  }
}

/**
 * What a model really took on the GPU the last time it loaded entirely there.
 * LM Studio's own estimate runs high (about 1 GiB for a 9B model on the
 * author's PC), enough to call a model that fits "too big for the GPU".
 */
export function measuredNeed(model: LocalModel, context = AGENT_CONTEXT): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(MEASURED_KEY) ?? "{}") as Record<string, number>;
    const bytes = all[measuredId(model, context)];
    return typeof bytes === "number" && bytes > 0 ? bytes : null;
  } catch {
    return null;
  }
}

function rememberNeed(model: LocalModel, context: number, bytes: number) {
  try {
    const all = readMeasures();
    all[measuredId(model, context)] = Math.round(bytes);
    // The same excess is taken off the estimates for the model's other contexts
    const raw = rawEstimates.get(measuredId(model, context));
    if (raw && raw > bytes) all[overshootId(model)] = Math.round(raw - bytes);
    localStorage.setItem(MEASURED_KEY, JSON.stringify(all));
  } catch {
    // the runtime's estimate is used next time
  }
}

/**
 * A full-GPU load measured this much and left room to spare: the number is
 * the model's real need. A load that filled the GPU may have spilled, so it
 * says nothing.
 */
export function trustedMeasure(
  usedBytes: number,
  freeAfterBytes: number,
  model: LocalModel
): boolean {
  return freeAfterBytes > GPU_MARGIN && usedBytes > 0.8 * model.sizeBytes;
}

/**
 * Bytes the model needs on the GPU to load entirely there: what it took last
 * time at this context, or the runtime's estimate corrected by what is known
 * about how high it runs.
 */
export async function estimate(model: LocalModel, context = AGENT_CONTEXT): Promise<number> {
  const measured = measuredNeed(model, context);
  if (measured) return measured;
  const raw = await rawEstimate(model, context);
  rawEstimates.set(measuredId(model, context), raw);
  const overshoot = readMeasures()[overshootId(model)];
  if (overshoot) return Math.max(model.sizeBytes, raw - overshoot);
  return model.runtime === "lmstudio" ? raw * (1 - LMSTUDIO_PRIOR) : raw;
}

/** The need at every context the dialog offers (null where the runtime gave none). */
export async function estimateAll(model: LocalModel): Promise<Record<number, number | null>> {
  const stops = contextStops(model);
  const needs = await Promise.all(stops.map((stop) => estimate(model, stop).catch(() => null)));
  return Object.fromEntries(stops.map((stop, index) => [stop, needs[index]]));
}

/**
 * The context to offer first: the largest one that fits entirely on the GPU
 * right now, and never less than what the agent needs to be useful.
 */
export function pickContext(
  needs: Record<number, number | null>,
  resources: Resources,
  stops: number[]
): number {
  const fitting = stops.filter((stop) => {
    const need = needs[stop];
    return need !== null && need !== undefined && verdict(need, resources) === "fits";
  });
  const floor = stops.find((stop) => stop >= MIN_USEFUL_CONTEXT) ?? stops[stops.length - 1];
  return Math.max(floor, fitting.length > 0 ? fitting[fitting.length - 1] : 0);
}

const CONTEXT_KEY = "lifeui.modelContext";

/** The context the person chose by hand for this model, if they did. */
export function savedContext(model: LocalModel): number | null {
  try {
    const all = JSON.parse(localStorage.getItem(CONTEXT_KEY) ?? "{}") as Record<string, number>;
    return all[`${model.runtime}:${model.key}`] ?? null;
  } catch {
    return null;
  }
}

export function saveContext(model: LocalModel, context: number | null): void {
  try {
    const all = JSON.parse(localStorage.getItem(CONTEXT_KEY) ?? "{}") as Record<string, number>;
    if (context === null) delete all[`${model.runtime}:${model.key}`];
    else all[`${model.runtime}:${model.key}`] = context;
    localStorage.setItem(CONTEXT_KEY, JSON.stringify(all));
  } catch {
    // the automatic choice is used next time
  }
}

async function rawEstimate(model: LocalModel, context: number): Promise<number> {
  if (model.runtime === "lmstudio") {
    const result = await invoke<{ gpu_bytes: number | null }>("lmstudio_estimate", {
      model: model.key,
      context,
    });
    if (result.gpu_bytes) return result.gpu_bytes;
    return model.sizeBytes + 1.2 * GIB;
  }
  // Ollama: weights + KV cache (f16) + runtime overhead
  const show = await ollamaShow(model.key);
  const info = show.model_info ?? {};
  const read = (suffix: string) => {
    const k = Object.keys(info).find((key) => key.endsWith(suffix));
    return k ? Number(info[k]) : undefined;
  };
  const layers = read(".block_count");
  const heads = read(".attention.head_count");
  const kvHeads = read(".attention.head_count_kv") ?? heads;
  const embedding = read(".embedding_length");
  const headDim =
    read(".attention.key_length") ?? (embedding && heads ? embedding / heads : undefined);
  const kv = layers && kvHeads && headDim ? 2 * layers * kvHeads * headDim * context * 2 : 1 * GIB;
  return model.sizeBytes + kv + 0.5 * GIB;
}

export type Verdict = "fits" | "offload" | "too-big" | "unknown";

/**
 * Where the model will go, against what is free right now:
 * - fits: entirely in the GPU with a small margin;
 * - offload: part of it spills into RAM (slower);
 * - too-big: not even VRAM plus RAM hold it, keeping 2 GiB for the system.
 */
export function verdict(needBytes: number, resources: Resources): Verdict {
  const gpu = [...resources.gpus].sort((a, b) => b.vram_free - a.vram_free)[0];
  if (!gpu) return "unknown";
  const margin = GPU_MARGIN;
  if (needBytes + margin <= gpu.vram_free) return "fits";
  const spill = needBytes + margin - gpu.vram_free;
  if (spill <= ramRoom(resources)) return "offload";
  return "too-big";
}

/** RAM a spill may use: what is available, keeping 2 GiB for the system. */
export function ramRoom(resources: Resources): number {
  return Math.max(0, resources.ram_available - 2 * GIB);
}

/** How much would not fit on the GPU, in bytes (0 when it fits). */
export function spillBytes(needBytes: number, resources: Resources): number {
  const gpu = [...resources.gpus].sort((a, b) => b.vram_free - a.vram_free)[0];
  if (!gpu) return 0;
  return Math.max(0, needBytes + GPU_MARGIN - gpu.vram_free);
}

/** Whether it is loaded right now, and with how much context when the runtime says. */
export async function loadedInfo(model: LocalModel): Promise<{ context: number | null } | null> {
  if (model.runtime === "lmstudio") {
    const loaded = await invoke<Array<Record<string, unknown>>>("lmstudio_loaded").catch(() => []);
    const hit = loaded.find((m) => [m.modelKey, m.identifier, m.path].includes(model.key));
    return hit ? { context: Number(hit.contextLength) || null } : null;
  }
  const res = await desktopFetch(`${OLLAMA}/api/ps`).catch(() => null);
  if (!res) return null;
  const { models = [] } = (await res.json()) as {
    models?: Array<{ name: string; context_length?: number }>;
  };
  const hit = models.find((m) => m.name === model.key);
  return hit ? { context: hit.context_length ?? null } : null;
}

/**
 * A quick speed test: how many tokens per second the loaded model writes.
 * One token first to wake it up, then a short text timed from the outside.
 */
export async function benchmark(baseUrl: string, modelKey: string): Promise<number | null> {
  const ask = async (maxTokens: number) => {
    const started = performance.now();
    const res = await desktopFetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelKey,
        messages: [
          { role: "user", content: "Count from 1 to 80, numbers only, separated by spaces." },
        ],
        max_tokens: maxTokens,
        temperature: 0,
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { usage?: { completion_tokens?: number } };
    const tokens = data.usage?.completion_tokens;
    const seconds = (performance.now() - started) / 1000;
    return tokens && seconds > 0 ? { tokens, seconds } : null;
  };
  try {
    await ask(1);
    const run = await ask(96);
    // Too few tokens say nothing about speed
    return run && run.tokens >= 16 ? Math.round(run.tokens / run.seconds) : null;
  } catch {
    return null;
  }
}

export interface Placement {
  /** Share of the model in VRAM, 0 to 1. */
  onGpu: number;
}

/**
 * Loads the model and reports where it landed. Ollama says it (`/api/ps`);
 * for LM Studio it is read from how much VRAM the load took.
 */
export async function load(
  model: LocalModel,
  needBytes: number,
  allowOffload: boolean,
  context = AGENT_CONTEXT
): Promise<Placement> {
  if (model.runtime === "lmstudio") {
    const before = await systemResources();
    await invoke("lmstudio_load", {
      model: model.key,
      context,
      gpu: allowOffload ? "auto" : "max",
    });
    const after = await systemResources();
    const used = (after.gpus[0]?.vram_used ?? 0) - (before.gpus[0]?.vram_used ?? 0);
    // Room left after a load means all of it is on the GPU, whatever the estimate said
    if (trustedMeasure(used, after.gpus[0]?.vram_free ?? 0, model)) {
      rememberNeed(model, context, used);
      return { onGpu: 1 };
    }
    return { onGpu: Math.max(0, Math.min(1, used / needBytes)) };
  }
  await desktopFetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model.key, keep_alive: "30m", options: { num_ctx: context } }),
  });
  const res = await desktopFetch(`${OLLAMA}/api/ps`);
  const { models = [] } = (await res.json()) as {
    models?: Array<{ name: string; size: number; size_vram: number }>;
  };
  const hit = models.find((m) => m.name === model.key);
  return { onGpu: hit && hit.size ? hit.size_vram / hit.size : 0 };
}

/** Frees the model's memory in its runtime. */
export async function unload(model: LocalModel): Promise<void> {
  if (model.runtime === "lmstudio") {
    await invoke("lmstudio_unload", { model: model.key });
    return;
  }
  await desktopFetch(`${OLLAMA}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model: model.key, keep_alive: 0 }),
  });
}

/** Where a loaded model sits, when the runtime says it (Ollama); null otherwise. */
export async function placementOf(model: LocalModel): Promise<Placement | null> {
  if (model.runtime !== "ollama") return null;
  const res = await desktopFetch(`${OLLAMA}/api/ps`).catch(() => null);
  if (!res) return null;
  const { models = [] } = (await res.json()) as {
    models?: Array<{ name: string; size: number; size_vram: number }>;
  };
  const hit = models.find((m) => m.name === model.key);
  return hit && hit.size ? { onGpu: hit.size_vram / hit.size } : null;
}

export const formatGiB = (bytes: number) => `${(bytes / GIB).toFixed(1)} GiB`;

const CHOICE_KEY = "lifeui.model";

export function savedChoice(): { runtime: RuntimeId; key: string } | null {
  try {
    const raw = localStorage.getItem(CHOICE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveChoice(model: LocalModel): void {
  try {
    localStorage.setItem(CHOICE_KEY, JSON.stringify({ runtime: model.runtime, key: model.key }));
  } catch {
    // remembered for this session only
  }
}
