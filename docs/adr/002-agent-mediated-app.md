# ADR-002 — An agent between the user and the app

**Status**: Accepted
**Date**: 2026-11-10
**Decision**: The user talks to LifeUI in a chat. An LLM agent reads the state and changes it through tools that call the existing domain core, under a written philosophy. The interface stops editing state and only presents it, led by the day's timeline.

---

## Context

LifeUI today is a web app where every change is a control: dialogs to add activities, editors for the library and the time blocks, menus on each row, a closing dialog with a 0–10 scale. The domain core (`src/system`) already owns every rule and validates every change, and since `8cc42d6` it reports failures as typed `CoreError` codes instead of free text.

The author wants to use the app by writing what they want to do, have the screen follow on its own, and be able to renegotiate the day with something that understands it, especially when a commitment was not met.

## Decision

### 1. The conversation is the only way in

- The user writes in a chat. The agent answers and acts.
- The screen updates from the core's state, never from the chat's text: whatever the agent changes appears because the state changed.
- Every control whose job is to change state is removed: the add dialog, the library and block editors, the row menus, the closing dialog. What stays is presentational: the day's timeline (blocks, what is scheduled, the "now" line, what is running with its clock), the Review and a read-only library.

### 2. The agent is a harness, not a chatbot

- **Tools** are the core's methods with strict schemas (zod). Each one is marked as a read (`get_today`, `get_plan`, `get_library`, `get_review`, ...) or a mutation (`add_to_plan`, `start_activity`, `close_activity`, `move_activity`, ...), with a risk level.
- **The core validates everything.** A wrong tool call from the model fails with a `CoreError` code and changes nothing; the agent reads the code and recovers (for example `activity-already-running` leads it to propose closing what is running first).
- **Skills** are short playbooks the agent loads when the conversation needs them: plan the day, close an activity, a commitment that was not met, the end of the day.
- **Each turn** carries the philosophy, the current time and a compact snapshot of the state, sized for a small local model.

### 3. Confirm by default, auto when the user chooses it

- **Confirm mode** (default): every mutation shows as a card in the chat with what will change; nothing runs until the user accepts.
- **Auto mode**, as in agentic coding harnesses: mutations run directly and the card shows what changed, with undo.
- Every executed tool, in either mode, leaves a card in the chat with an undo action.
- Even in auto mode, four actions always ask: deleting from the library, ending the day, importing data and clearing data.

### 4. The agent's philosophy

These rules go to the model as its system prompt (`AGENT.md`) and are the test the agent's behaviour is judged by. They follow `PRODUCT.md` and ADR-001.

1. **The user decides, the agent proposes.** No change without confirmation outside auto mode.
2. **The close is inferred, never asked as a number.** When an activity ends, the agent asks how it went in plain words if the user has not said it, and infers the 0–10 satisfaction from the user's own words. The number is an internal detail of the agent: it is not shown or asked in the chat. Guardrails:

   - it is inferred only from what the user said about that activity, never from nothing and never from other activities;
   - it follows the user's words, neither inflated to please nor deflated to be strict, using a written rubric (a skill) so the same words give the same score;
   - only the core computes tempos from it, and the agent never states a number it did not read from a tool;
   - the user's sentence is kept with the record, so the Review can show what was said behind each close (proposed; needs a field in the record).

   This changes ADR-001's "honesty lives in one moment": the moment is now the user's own account in the chat, and the agent translates it into the score.

3. **Not meeting a commitment is not a moral failure.** The agent never asks why something was not done; ADR-001 removed interruption causes on purpose and the agent keeps them out. It offers ways forward: move it to another block or to tomorrow, make it smaller, split it, or let it go. Causes are discussed only if the user brings them up.
4. **Free time is sacred.** The agent does not fill gaps or push for more unless asked.
5. **One step at a time.** It proposes the next concrete action, not a reorganised day, unless asked.
6. **Everything in sight.** Every tool it runs is visible in the chat, with undo.
7. **The state is the truth.** Before saying anything about the day it reads it with a tool, instead of remembering or guessing.
8. **Local and private.** With a local model nothing leaves the machine. A remote provider is used only when the user configures one (ADR-005).
9. **Kind, never judging.** The voice of `PRODUCT.md`: progress is shown as what was reached, never as what is missing.

### 5. The model is small, so the design assumes mistakes

The first target model is Qwen 3.5 9B running locally. Small models call tools less reliably than large ones. The design compensates:

- about 12 to 15 tools, with strict schemas and short descriptions;
- low temperature; retry when the arguments do not parse;
- the core rejects anything invalid, so a model mistake never corrupts data;
- a compact state snapshot every turn.

Before the presentational interface replaces the current one, the agent is measured against the real model with a fixed set of example conversations (planning, closing, a missed commitment, an ambiguous request).

## Implementation (2026-11-10)

- `src/app/agent/`: the loop (`agent.ts`), the tools over the core (`tools.ts`), the skills (`guides.ts`: plan-day, missed-commitment, closing-rubric, end-day), the state snapshot sent each turn (`snapshot.ts`), the chat completions client (`llm.ts`) and the chat (`ChatPanel.tsx`). The system prompt is `AGENT.md`, bundled as text.
- Tools: `get_day`, `get_library`, `get_review`, `get_guide`, `start_day`, `end_day`, `add_to_plan` (creates the library activity when it is new), `schedule`, `move_to_block`, `remove_from_plan`, `start_activity`, `finish_activity` (score inferred, the person's words kept as `closingNote`), `stop_activity`, `log_event`, `delete_from_library`. Plan items are referred to by an 8-character id or by title.
- Undo restores the state exported just before the last change; only the latest change can be undone.
- The chat is a fixed column from 1280 px and a sheet below that. Today, the start screen, the sidebar and the command palette no longer change state.
- Tests drive the agent with a scripted model: in Jest (`agentFlows.test.tsx`) and in Cypress, which answers the model's HTTP calls. Dev builds read a model endpoint from `localStorage` (`lifeui.devModel`) for that; production builds ignore it.
- Not yet moved to the agent: editing the library, the time blocks and event names, which still have their own screens.

## Consequences

- The UI built for editing (dialogs, editors, menus) is retired; the presentational parts (timeline, focus card, tempo meter, log, Review) are kept and rearranged around the timeline.
- The app becomes a desktop app (ADR-003) with a local model runtime (ADR-004) and providers (ADR-005).
- The portfolio's web copy of LifeUI and its product film show the current, pre-agent app until the web build with cloud providers replaces it.

## Resolved questions

Decided by the author on 2026-11-10:

1. **A web version exists, with cloud providers only.** The same frontend builds for the web without the local model runtime (no detection, no load dialog); the agent runs on a cloud provider the user configures (ADR-005). This is what the portfolio serves.
2. **Activities can be scheduled at an exact time** ("Write report at 15:00"), on top of time blocks (ADR-006).
3. **Always confirmed, even in auto mode:** deleting from the library, ending the day, importing data and clearing data.

## Plan

1. These ADRs and `AGENT.md`, approved by the author.
2. The Tauri shell, file persistence and the model runtime with its load dialog (ADR-003, ADR-004).
3. The agent loop, the tools, confirm and auto modes and the chat, next to the current UI; tests with a scripted fake model and the measurement with Qwen.
4. The presentational, timeline-first UI.
5. Flexibility: the missed-commitment flow, the end of the day, proactive notes (for example a timebox reaching its maximum).
