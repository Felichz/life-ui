# ADR-004 — The local model: detection, loading and resources

**Status**: Accepted
**Date**: 2026-11-10
**Decision**: LifeUI detects the models already downloaded in Ollama and LM Studio, and on every launch with nothing loaded it asks before loading the chosen one. The same dialog shows the PC's free VRAM and RAM, predicts whether the model fits entirely on the GPU, warns before a load that could freeze the PC, and confirms after loading where the model actually ended up.

---

## Context

The target users already run local models (ADR-002), on PCs with about 8 GB of VRAM or less. The author's model is Qwen 3.5 9B and they want to be sure it runs entirely on the GPU. A model that spills into system RAM runs far slower, and one that does not fit can freeze the machine.

## Decision

### 1. Everything stays on the machine

Detection and loading only talk to `localhost` (Ollama on port 11434, LM Studio on port 1234) and to the operating system. Nothing leaves the PC.

### 2. First run: pick from what is already downloaded

- Ollama's downloaded models (`GET /api/tags`, details from `/api/show`) and LM Studio's (`lms ls --json`) are listed together, with name, size, quantization, parameter count and maximum context.
- Models not trained for tool use are listed last and marked: the agent depends on tool calls. LM Studio reports this per model (`trainedForToolUse`); for Ollama it is read from the model's capabilities in `/api/show`.
- If a runtime is installed but not running, the app offers to start it (`ollama serve`, `lms server start`). If neither is installed, it says so and links to both; it does not install anything.
- The chosen model and runtime are remembered.

### 3. Every launch: ask, then load

When the app opens and the chosen model is not loaded, a dialog asks to load it. It never loads one without asking. The dialog shows:

- **the resources now**: free and total VRAM per GPU, free and total RAM;
- **the prediction for this model**, at the context length the agent will use:
  - LM Studio estimates it itself without loading (`lms load <model> --estimate-only --gpu max -c <context>`), which LifeUI uses as is;
  - for Ollama, LifeUI computes it: the weights' size plus the KV cache (layer count, KV heads and head size from `/api/show`) plus a margin;
  - either way, compared against the VRAM free at that moment;
- **the verdict**, in one of three states:
  - **fits on the GPU**: a plain Load button;
  - **partial offload**: how much would spill into RAM and that it will be slower; the Load button asks for confirmation;
  - **does not fit** (not enough VRAM plus RAM): a warning that the PC may freeze; the Load button needs an explicit "load anyway".

The prediction adapts to the selected model and to the resources at that moment (other programs may be using the GPU).

### 4. After loading, check where it landed

The prediction is an estimate; the runtime's report is the truth. After loading, the dialog reads it (Ollama's `/api/ps` gives `size` and `size_vram`; for LM Studio, its loaded-model info or the change in VRAM use) and shows "100% on the GPU" or how much went to RAM.

### 5. Reading the resources

Rust commands (ADR-003): RAM from `sysinfo`; VRAM through NVML on NVIDIA GPUs and DXGI on Windows otherwise. When VRAM cannot be read, the dialog says so instead of guessing.

### 6. Measured on the author's PC (2026-11-10)

An RTX 3070 Laptop GPU with 8 GiB. LM Studio estimates `qwen/qwen3.5-9b` (Q4, 6.55 GB on disk) at 7.57 GiB of VRAM with a 16,384-token context and full GPU offload. With 4.35 GiB already in use by other programs, it would not fit entirely at that moment: the dialog has to say so, and say how much to free.

## Consequences

- The load dialog is the first screen of each session when no model is loaded.
- Models for a remote provider (ADR-005) skip this dialog.
