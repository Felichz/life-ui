# ADR-005 — Providers: simple by default, KnowGraph's catalog when asked

**Status**: Accepted
**Date**: 2026-11-10
**Decision**: The default setup is the local detection of ADR-004 and nothing else. An "Advanced settings" button opens the full provider configuration, reused from KnowGraph: direct APIs, routers, custom OpenAI-compatible endpoints and their models.

---

## Context

Most LifeUI users are expected to run local models, but many also pay for subscriptions to large models or use free hosted ones, and a large model can be the better coach for complex conversations. The author wants to try DeepSeek through OpenCode after the app is built. KnowGraph already has a provider catalog (`shared/providerCatalog.js`) and a client that handle many providers.

## Decision

- **Default**: the setup only shows the models detected in Ollama and LM Studio (ADR-004). No keys, no URLs, no provider list.
- **Advanced settings**, behind a button: KnowGraph's catalog and client, with the same capabilities (direct APIs such as OpenAI, DeepSeek, Mistral or Groq; routers such as OpenRouter; any custom OpenAI-compatible endpoint, with model discovery).
- **Keys** are kept in the operating system's credential store, never in the state file.
- **Every provider uses one contract**: the chat completions API with tools. The agent (ADR-002) does not know which provider is behind it.
- Using a remote provider is the user's explicit choice in Advanced settings, and the UI says the conversation leaves the machine (ADR-002, rule 8).

### The web version

The web build (ADR-002) has no local runtime: its setup goes straight to the cloud providers. Requests go from the browser to the provider, so only providers that accept browser requests (CORS) are offered there; the rest are marked as desktop only. Keys stay in that browser's storage and are never sent to a LifeUI server, because there is none.

### As built (2026-11-15)

The web build and the desktop app share one setup, "Use a model through an API": OpenRouter, OpenAI, Anthropic, Google Gemini, Groq, DeepSeek, Mistral, xAI, Together AI, Fireworks AI, Cerebras, MiniMax and any OpenAI-compatible endpoint (`src/app/runtime/providers.ts`). Every one of them was checked to answer a browser (CORS) from the site's origin, so the web build calls them directly; Anthropic needs its `anthropic-dangerous-direct-browser-access` header. The choice is tried with one short request before it is kept. Keys are kept in the browser's storage on the web, and for now in the app's own storage on the desktop too: the operating system's credential store is still to do.

## Consequences

- KnowGraph's catalog and client are copied in and adapted to Tauri's HTTP plugin (ADR-003).
- A later option, not decided now: a second model for heavy conversations (for example a large hosted model as coach while a local one handles routine tool calls).
