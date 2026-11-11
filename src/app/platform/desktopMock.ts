/**
 * A stand-in for the desktop shell, for working on the model dialog in a plain
 * browser (dev builds only: open the app with `?desktop-mock`). The figures were
 * measured on the author's PC on 2026-11-10 (ADR-004, section 6): LM Studio's
 * downloaded models, an 8 GiB RTX 3070 Laptop GPU with 4.27 GiB in use, and
 * LM Studio's estimate for qwen/qwen3.5-9b at a 16,384-token context.
 */
const GIB = 1024 ** 3;
const MIB = 1024 ** 2;

const MODELS = [
  {
    modelKey: "gemma4-e2b-neon-veil-rp",
    displayName: "Neon Veil E2B Instruct",
    sizeBytes: 3427873344,
    paramsString: "4.6B",
    architecture: "gemma4",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 131072,
    type: "llm",
  },
  {
    modelKey: "mistral-nemo-12b-rp",
    displayName: "Mistral Nemo 12B RP",
    sizeBytes: 7477218176,
    paramsString: "12B",
    architecture: "llama",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: false,
    maxContextLength: 1024000,
    type: "llm",
  },
  {
    modelKey: "gemma-4-e4b-it-uncensored",
    displayName: "Gemma 4 E4B Instruct Uncensored",
    sizeBytes: 5335285280,
    paramsString: "7.5B",
    architecture: "gemma4",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 131072,
    type: "llm",
  },
  {
    modelKey: "qwen3.5-9b-uncensored-hauhaucs-aggressive",
    displayName: "Qwen3.5 9B Uncensored HauhauCS Aggressive",
    sizeBytes: 6548748672,
    paramsString: "9B",
    architecture: "qwen35",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 262144,
    type: "llm",
  },
  {
    modelKey: "ministral-3-8b-nymphaea-rp",
    displayName: "Ministral 3 8B Nymphaea RP",
    sizeBytes: 6055464512,
    paramsString: "8B",
    architecture: "mistral3",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 262144,
    type: "llm",
  },
  {
    modelKey: "qwen/qwen3-1.7b",
    displayName: "Qwen3 1.7B",
    sizeBytes: 1282617842,
    paramsString: "1.7B",
    architecture: "qwen3",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 32768,
    type: "llm",
  },
  {
    modelKey: "qwen/qwen3.5-9b",
    displayName: "Qwen3.5 9B",
    sizeBytes: 6548927711,
    paramsString: "9B",
    architecture: "qwen35",
    quantization: {
      name: "Q4_K_M",
      bits: 4,
    },
    trainedForToolUse: true,
    maxContextLength: 262144,
    type: "llm",
  },
];

let loaded: string | null = null;
let loadedContext = 16384;
let serverRunning = false;

const handlers: Record<string, (args: Record<string, unknown>) => unknown> = {
  read_state: () => null,
  write_state: () => null,
  clear_state: () => null,
  runtime_status: () => ({
    lmstudio: { installed: true, running: serverRunning, port: 1234 },
    ollama: { installed: false, running: false, port: 11434 },
  }),
  system_resources: () => ({
    ram_total: 16449124 * 1024,
    ram_available: 5183144 * 1024,
    gpus: [
      {
        name: "NVIDIA GeForce RTX 3070 Laptop GPU",
        vram_total: 8192 * MIB,
        vram_used: (loaded ? 920 + 6650 : 920) * MIB,
        vram_free: (8192 - 920 - (loaded ? 6650 : 0)) * MIB,
      },
    ],
    vram_note: null,
  }),
  // Measured with gpu_processes on the author's PC, 2026-11-10
  gpu_processes: () =>
    loaded
      ? []
      : [
          { pid: 20680, name: "chrome", bytes: 177 * MIB, system: false },
          { pid: 10100, name: "msedgewebview2", bytes: 103 * MIB, system: false },
          { pid: 22020, name: "explorer", bytes: 95 * MIB, system: true },
          { pid: 7800, name: "claude", bytes: 86 * MIB, system: false },
          { pid: 24612, name: "explorer", bytes: 38 * MIB, system: true },
          { pid: 19604, name: "csrss", bytes: 35 * MIB, system: true },
        ],
  lmstudio_models: () => MODELS,
  lmstudio_loaded: () =>
    loaded ? [{ modelKey: loaded, identifier: loaded, contextLength: loadedContext }] : [],
  // LM Studio's own figures for Qwen3.5 9B: 6.95 GiB at 4K, 7.57 GiB at 16K
  lmstudio_estimate: ({ model, context }) => ({
    gpu_bytes:
      model === "qwen/qwen3.5-9b" ? (6.95 + ((Number(context) - 4096) / 4096) * 0.207) * GIB : null,
    total_bytes: null,
    raw: "",
  }),
  lmstudio_load: ({ model, context }) => {
    loaded = String(model);
    loadedContext = Number(context);
    return "";
  },
  lmstudio_unload: () => {
    loaded = null;
    return "";
  },
  start_runtime: () => {
    serverRunning = true;
    return null;
  },
};

export function installDesktopMock(): void {
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
    invoke: async (command: string, args: Record<string, unknown> = {}) => {
      await new Promise((resolve) => setTimeout(resolve, command === "lmstudio_load" ? 1200 : 120));
      const handler = handlers[command];
      if (!handler) throw new Error(`desktop mock: no handler for ${command}`);
      return handler(args);
    },
    transformCallback: () => 0,
    mock: true,
  };
  // The runtime's server: every completion takes 0.6 s and writes 34 tokens (56 tokens/s)
  const browserFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    if (!String(input).includes("127.0.0.1:1234/v1/chat/completions")) {
      return browserFetch(input, init);
    }
    const body = JSON.parse(String(init?.body ?? "{}")) as { stream?: boolean };
    if (!body.stream) {
      await new Promise((resolve) => setTimeout(resolve, 600));
      return new Response(
        JSON.stringify({
          choices: [{ message: { content: "Hola. Soy el modelo de prueba." } }],
          usage: { prompt_tokens: 3200, completion_tokens: 34 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }
    const words =
      "Soy el modelo de prueba. Puedo **planear tu día**, empezar o cerrar una actividad y registrar eventos. Dime qué quieres hacer y lo vemos paso a paso.".split(
        " "
      );
    const encoder = new TextEncoder();
    const event = (data: unknown) => encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const word of words) {
          await new Promise((resolve) => setTimeout(resolve, 45));
          controller.enqueue(event({ choices: [{ delta: { content: `${word} ` } }] }));
        }
        controller.enqueue(
          event({ choices: [], usage: { prompt_tokens: 3200, completion_tokens: 38 } })
        );
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });
    return new Response(stream, {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
  };
}
