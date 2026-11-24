/**
 * The providers LifeUI can talk to through an API (ADR-005), in groups, with a
 * line each in both languages. Every one speaks the chat completions API with
 * tools. The list follows KnowGraph's, plus Anthropic and Google Gemini.
 *
 * `browser` says whether the provider answers a request that comes from a
 * web page (CORS), checked from this site's origin on 2026-11-19. The web build
 * talks to the provider directly, so a provider that does not answer a browser
 * is for the desktop app only, which sends the request from Rust.
 */
export type ProviderGroup = "direct" | "router" | "local" | "custom";

export interface Provider {
  id: string;
  name: string;
  group: ProviderGroup;
  description: { en: string; es: string };
  /** Empty for the custom endpoint, where the person writes it. */
  baseUrl: string;
  /** Where to get a key. */
  keyUrl?: string;
  /** Headers the provider needs besides the key. */
  headers?: Record<string, string>;
  /** The key can be left out (a local server). */
  keyOptional?: boolean;
  /** Whether a web page may call it directly. False: the desktop app only. */
  browser: boolean;
  /** A server on the person's own machine: shown on the desktop and in development only. */
  local?: boolean;
  /** A model to start from, for a provider that does not list its models. */
  models?: string[];
}

const direct = (
  id: string,
  name: string,
  baseUrl: string,
  description: { en: string; es: string },
  extra: Partial<Provider> = {}
): Provider => ({ id, name, group: "direct", baseUrl, description, browser: true, ...extra });

export const PROVIDERS: Provider[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    group: "router",
    baseUrl: "https://openrouter.ai/api/v1",
    keyUrl: "https://openrouter.ai/keys",
    description: {
      en: "One endpoint for a multi-provider catalog.",
      es: "Un endpoint para un catálogo de muchos proveedores.",
    },
    browser: true,
  },
  {
    id: "opencode",
    name: "OpenCode Zen",
    group: "router",
    baseUrl: "https://opencode.ai/zen/v1",
    keyUrl: "https://opencode.ai/zen",
    description: {
      en: "OpenCode's model gateway. Its free models answer only inside OpenCode itself.",
      es: "El gateway de modelos de OpenCode. Sus modelos gratis solo responden dentro de OpenCode.",
    },
    browser: false,
  },
  direct(
    "openai",
    "OpenAI",
    "https://api.openai.com/v1",
    { en: "GPT through the official API.", es: "GPT mediante la API oficial." },
    { keyUrl: "https://platform.openai.com/api-keys" }
  ),
  direct(
    "anthropic",
    "Anthropic",
    "https://api.anthropic.com/v1",
    { en: "Claude through the official API.", es: "Claude mediante la API oficial." },
    {
      keyUrl: "https://console.anthropic.com/settings/keys",
      // Anthropic answers a browser only when it says it knows the key is in the browser
      headers: { "anthropic-dangerous-direct-browser-access": "true" },
    }
  ),
  direct(
    "google",
    "Google Gemini",
    "https://generativelanguage.googleapis.com/v1beta/openai",
    {
      en: "Gemini through its OpenAI-compatible API.",
      es: "Gemini mediante su API compatible con OpenAI.",
    },
    { keyUrl: "https://aistudio.google.com/apikey" }
  ),
  direct(
    "groq",
    "Groq",
    "https://api.groq.com/openai/v1",
    { en: "Low-latency inference.", es: "Inferencia de baja latencia." },
    { keyUrl: "https://console.groq.com/keys" }
  ),
  direct(
    "deepseek",
    "DeepSeek",
    "https://api.deepseek.com/v1",
    { en: "DeepSeek models.", es: "Modelos DeepSeek." },
    { keyUrl: "https://platform.deepseek.com/api_keys" }
  ),
  direct(
    "mistral",
    "Mistral AI",
    "https://api.mistral.ai/v1",
    { en: "Mistral models.", es: "Modelos Mistral." },
    { keyUrl: "https://console.mistral.ai/api-keys" }
  ),
  direct(
    "xai",
    "xAI",
    "https://api.x.ai/v1",
    { en: "Grok models.", es: "Modelos Grok." },
    {
      keyUrl: "https://console.x.ai",
    }
  ),
  direct(
    "together",
    "Together AI",
    "https://api.together.xyz/v1",
    { en: "Open and third-party models.", es: "Modelos abiertos y de terceros." },
    { keyUrl: "https://api.together.ai/settings/api-keys" }
  ),
  direct(
    "fireworks",
    "Fireworks AI",
    "https://api.fireworks.ai/inference/v1",
    { en: "Inference for open-source models.", es: "Inferencia de modelos open-source." },
    { keyUrl: "https://fireworks.ai/account/api-keys" }
  ),
  direct(
    "cerebras",
    "Cerebras",
    "https://api.cerebras.ai/v1",
    { en: "Very fast inference.", es: "Inferencia muy rápida." },
    { keyUrl: "https://cloud.cerebras.ai" }
  ),
  direct(
    "minimax",
    "MiniMax",
    "https://api.minimax.io/v1",
    {
      en: "MiniMax models, with reasoning and streaming.",
      es: "Modelos MiniMax, con razonamiento y streaming.",
    },
    { keyUrl: "https://platform.minimax.io", models: ["MiniMax-M3"] }
  ),
  direct(
    "nvidia",
    "NVIDIA NIM",
    "https://integrate.api.nvidia.com/v1",
    { en: "NIM hosted by NVIDIA.", es: "NIM hospedado por NVIDIA." },
    { keyUrl: "https://build.nvidia.com", browser: false }
  ),
  direct(
    "huggingface",
    "Hugging Face",
    "https://router.huggingface.co/v1",
    {
      en: "Hugging Face Inference Providers router.",
      es: "Router de Inference Providers de Hugging Face.",
    },
    { keyUrl: "https://huggingface.co/settings/tokens" }
  ),
  direct(
    "perplexity",
    "Perplexity",
    "https://api.perplexity.ai",
    {
      en: "Sonar models and answers grounded in search.",
      es: "Modelos Sonar y respuestas con búsqueda.",
    },
    { keyUrl: "https://www.perplexity.ai/settings/api" }
  ),
  direct(
    "deepinfra",
    "Deep Infra",
    "https://api.deepinfra.com/v1/openai",
    { en: "Third-party models.", es: "Modelos de terceros." },
    { keyUrl: "https://deepinfra.com/dash/api_keys" }
  ),
  direct(
    "chutes",
    "Chutes",
    "https://llm.chutes.ai/v1",
    { en: "Open inference infrastructure.", es: "Infraestructura de inferencia abierta." },
    { keyUrl: "https://chutes.ai" }
  ),
  direct(
    "baseten",
    "Baseten",
    "https://inference.baseten.co/v1",
    { en: "Managed inference endpoints.", es: "Endpoints de inferencia administrados." },
    { keyUrl: "https://app.baseten.co/settings/api_keys" }
  ),
  direct(
    "moonshotai",
    "Moonshot AI / Kimi",
    "https://api.moonshot.ai/v1",
    { en: "Kimi models.", es: "Modelos Kimi." },
    { keyUrl: "https://platform.moonshot.ai/console/api-keys" }
  ),
  direct(
    "zai",
    "Z.AI",
    "https://api.z.ai/api/paas/v4",
    { en: "GLM models.", es: "Modelos GLM." },
    { keyUrl: "https://z.ai/manage-apikey/apikey-list", browser: false }
  ),
  direct(
    "stepfun",
    "StepFun",
    "https://api.stepfun.com/v1",
    { en: "Step models.", es: "Modelos Step." },
    { keyUrl: "https://platform.stepfun.com/interface-key" }
  ),
  direct(
    "alibaba",
    "Alibaba Cloud / Qwen",
    "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    { en: "Qwen through DashScope.", es: "Qwen mediante DashScope." },
    { keyUrl: "https://bailian.console.alibabacloud.com" }
  ),
  {
    id: "ollama",
    name: "Ollama",
    group: "local",
    baseUrl: "http://127.0.0.1:11434/v1",
    description: {
      en: "Models on your own machine. Without the desktop app it needs OLLAMA_ORIGINS=*.",
      es: "Modelos en tu propia máquina. Sin la app de escritorio necesita OLLAMA_ORIGINS=*.",
    },
    keyOptional: true,
    browser: true,
    local: true,
  },
  {
    id: "lmstudio",
    name: "LM Studio",
    group: "local",
    baseUrl: "http://127.0.0.1:1234/v1",
    description: {
      en: "Models on your own machine. Without the desktop app, turn on CORS in its server settings.",
      es: "Modelos en tu propia máquina. Sin la app de escritorio, activa CORS en los ajustes de su servidor.",
    },
    keyOptional: true,
    browser: true,
    local: true,
  },
  {
    id: "custom",
    name: "",
    group: "custom",
    baseUrl: "",
    description: {
      en: "A corporate proxy, vLLM or any other chat completions API.",
      es: "Un proxy de empresa, vLLM o cualquier otra API de chat completions.",
    },
    keyOptional: true,
    browser: true,
  },
];

export const GROUP_ORDER: ProviderGroup[] = ["direct", "router", "local", "custom"];

export const providerById = (id: string) => PROVIDERS.find((one) => one.id === id);

/**
 * The providers offered here: a server on the person's own machine only on the
 * desktop and in development, where a page can reach it.
 */
export function offeredProviders(desktop: boolean): Provider[] {
  const development = typeof process !== "undefined" && process.env.NODE_ENV !== "production";
  return PROVIDERS.filter((one) => !one.local || desktop || development);
}
