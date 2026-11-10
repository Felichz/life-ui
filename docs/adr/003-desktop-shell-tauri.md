# ADR-003 — The desktop shell: Tauri, not Electron

**Status**: Accepted
**Date**: 2026-11-10
**Decision**: LifeUI ships as a Tauri 2 desktop app. The React and Vite frontend and the TypeScript core stay as they are; Rust handles what the browser cannot: system resources, starting the model servers, local files and HTTP without CORS.

---

## Context

ADR-002 turns LifeUI into an app driven by a local LLM. Its users run models on their own PCs, often with 8 GB of VRAM or less, so every megabyte the app itself uses competes with the model. The author's other desktop app, KnowGraph, uses Electron with a Node gateway.

## Options

|                                 | Electron                          | Tauri 2                                                         |
| ------------------------------- | --------------------------------- | --------------------------------------------------------------- |
| Web engine                      | Bundles Chromium                  | The system WebView (WebView2 on Windows)                        |
| Installer                       | ~100–150 MB                       | ~5–15 MB                                                        |
| Memory at idle                  | Typically 150–300 MB              | Typically well under half of that                               |
| Backend                         | Node                              | Rust (plus JavaScript in the WebView)                           |
| System info (RAM, VRAM)         | Native modules or child processes | Rust crates (`sysinfo`, NVML, DXGI)                             |
| Start Ollama or LM Studio       | `child_process`                   | Rust `Command` or the shell plugin                              |
| HTTP without CORS               | Node in the main process          | The HTTP plugin, run by Rust                                    |
| Reuse KnowGraph's gateway as is | Yes (Node)                        | Its pure modules run in the WebView; Node-only parts are ported |

## Decision

Tauri. The same result is reachable with both, and Tauri's lower memory matters here more than anywhere: the RAM the shell does not take is RAM the model can use when it offloads layers. Reading free VRAM and RAM, which the load dialog needs (ADR-004), is also natural in Rust.

- The frontend (React, Vite, Tailwind) and the core (`src/system`) do not change.
- Rust commands expose: system resources, the detection and start of model servers, and file persistence.
- Model and provider calls go through Tauri's HTTP plugin, so neither local servers nor remote APIs need CORS headers.
- State moves from `localStorage` to a JSON file in the app's data folder, written through the same `PersistenceManager` contract.

## Consequences

- The build needs the Rust toolchain (MSVC on Windows, already installed for other projects).
- KnowGraph's provider catalog and client (ADR-005) are reused by running their JavaScript in the WebView with the HTTP plugin's `fetch`; any Node-only part is ported.
- The Vite web build keeps working, which leaves a web version possible (ADR-002, open question 1).
