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

When the model does not fit entirely, the dialog also lists **what is using the GPU now**, so the user knows what to close:

- each program with its PID and its dedicated VRAM, biggest first, and Windows' own processes grouped as "Windows" (they cannot be closed);
- how much has to be freed for the model to fit entirely, and a mark on any program whose closing alone would be enough.

NVML reports no per-process memory under Windows' display driver model (`nvidia-smi` shows "N/A"), so these figures come from the counters Task Manager uses (`GPU Process Memory\Dedicated Usage`), on the adapter whose total matches NVML's. A process reporting more than the whole adapter (Windows' compositor sometimes does) is left out. The dialog never closes programs itself.

### 4. After loading, check where it landed

The prediction is an estimate; the runtime's report is the truth. After loading, the dialog reads it (Ollama's `/api/ps` gives `size` and `size_vram`; for LM Studio, its loaded-model info or the change in VRAM use) and shows "100% on the GPU" or how much went to RAM.

### 5. Reading the resources

Rust commands (ADR-003): RAM from `sysinfo`; VRAM through NVML on NVIDIA GPUs and DXGI on Windows otherwise. When VRAM cannot be read, the dialog says so instead of guessing.

### 6. Measured on the author's PC (2026-11-10)

An RTX 3070 Laptop GPU with 8 GiB. LM Studio estimates `qwen/qwen3.5-9b` (Q4, 6.55 GB on disk) at 7.57 GiB of VRAM with a 16,384-token context and full GPU offload. With 4.35 GiB already in use by other programs, it would not fit entirely at that moment: the dialog has to say so, and say how much to free.

### 7. The model in sight

The loaded model is always visible: a bar at the top of the chat and a "Model" section first in Settings show its name, runtime, context and, when the runtime reports it, how much of it is on the GPU, with a button to change it. Changing reopens the picker, which marks the current model and offers to keep it; choosing another one unloads the current one first (`lms unload`, or Ollama's `keep_alive: 0`), so the load dialog sees the memory that is really free.

Next to "Change" there is an unload button (2026-11-11): it frees the model's memory in its runtime and leaves the chat at "No model loaded". The choice is kept, so the next launch asks to load it again.

### 8. Measured beats estimated (2026-11-11)

LM Studio's estimate runs high. On the author's PC it gave 7.16 GiB for Qwen3.5 9B at 8K context, and the load took 6.2 GiB (0.9 to 7.1 of 8.0 GiB), running at 56 tokens/s. That gap is enough to tell the person a model "does not fit" when it does. So after a load that leaves room on the GPU, the app keeps what the model really took (per model and context, `lifeui.modelMemory`) and uses it instead of the estimate from then on; the same load is reported as 100% on the GPU. A load that fills the GPU is not trusted, because part of it may have spilled. The first load of a model still relies on the estimate.

### 9. The context is chosen in the load dialog (2026-11-11)

The context was fixed at 16K. Now the load dialog has a slider (4K, 8K, 12K, 16K, 24K, 32K, capped by the model's own maximum) and everything in the dialog follows it as it moves: the memory needed, the bar, the verdict and the list of what to close.

- **Automatic by default:** the largest context that fits entirely on the GPU right now, and never less than 8K, which is the least that leaves room to talk after the agent's own 3.4K. A context chosen by hand is remembered per model; "Use automatic" goes back.
- **In perspective:** under the slider, what the number means: about how many words and pages it is, how much the agent uses, and how many messages are left before a compaction.
- **Estimates:** the need at every stop is asked from the runtime at once. A measured load (section 8) also records how far over the estimate ran, and that excess is taken off the model's other contexts. Before any measurement LM Studio's estimate is taken 10% lower, from the two points measured on the author's PC (13% and 14% over); this is one PC and one model, and a first load can still be off.
- **Loaded elsewhere:** a model already loaded from LM Studio is used with the context it has there (`lms ps` reports it), not the one the app would have chosen.

### 10. A speed test after loading (2026-11-11)

After a load, and when a loaded model is found at launch, the app asks the model for one token to wake it up and then for a short text, and divides the tokens written by the time taken. The result shows in the "ready" step ("56 tokens per second · it answers right away") and next to the model's name. It is timed from outside, so it includes the wait before the first token: a rough figure, good enough to tell fast from slow.

## Consequences

- The load dialog is the first screen of each session when no model is loaded.
- Models for a remote provider (ADR-005) skip this dialog.
