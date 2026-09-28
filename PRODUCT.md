# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the author, using the app throughout the whole day to decide what to do next, run one thing at a time, and close each activity honestly. Used equally on desktop/laptop (a tab left open while working) and on the phone (starting and closing things away from the desk).

Later: other people who want the same kind of support. The product is personal today but should be understandable to a stranger without the author explaining it — no private jargon left unexplained, no dead ends that only the author knows how to escape.

## Product Purpose

LifeUI is "a UI for real life": like a game HUD, it shows the information that matters about the day without replacing the day. Life is the only real game; the app is only its interface.

The loop: plan the day (library → time blocks), focus on exactly one active activity, close it through a single honest ritual (self-assessed satisfaction 0–10), and receive tempos. Tempos are an immutable reward, never a currency: they only go up, they never drain, and free time costs nothing.

Success: the user keeps opening the app because each honest close feels good, and the daily picture (tempos, % of reference, satisfaction, timeline) tells them something true about their day.

## Positioning

Not a todo app, not a habit tracker, not a time tracker. The distinctive mechanism is the closing ritual: every activity end passes through one self-assessment, and the reward is computed from effort (estimated or real minutes) × honesty (score / 7). Honesty is concentrated in one moment instead of spread as continuous friction.

## Operating Context

- Day lifecycle: start day → plan and execute → end day → overview. Unfinished activities carry over to the next day.
- Activity library: reusable templates with one of three duration contracts — clear objective (point estimate, "~45 min"), flexible duration (expected range), timeboxing (declared minimum, maximum, or both).
- Time blocks: user-defined, non-overlapping hour ranges (e.g. Mañana 06:00–12:00) plus the permanent "Por hacer" block. Only activities in "Por hacer" or in the block that is current right now can be activated; future/past blocks are visible but locked.
- Exactly one active activity at a time. Switching, completing, ending the day or interrupting all route through the closing ritual (requestCompletion → modal → completeActivity / interruptActivity). Closing the modal without choosing leaves the activity running.
- Events: one-tap point-in-time markers ("Tomé ibuprofeno", "Café") from reusable event templates.
- Timeline of the day: completed and interrupted activities, the running one, events.
- Overview: day metrics (tempos, % of reference, completed count, average satisfaction) and multi-day trends.
- Settings: daily tempo reference (default 100), export / import JSON, clear data.
- Offline-first; localStorage is the only source of truth.
- Bilingual UI: English and Spanish, switchable at any time; the first launch is in English and a saved choice wins after that. Spanish is the reference copy; English must stay equivalent in tone (kind, never judging).

## Capabilities and Constraints

- Architecture: `src/system` is the domain core (SystemCore + managers) and owns all business logic, including the tempo formula `ceil(base × score / 7)`. The UI never recomputes rules; it only calls the core and renders. The preview in the closing ritual uses `UtilityService.calculatePreviewTempos` / `resolveBaseMinutes`, the same source the core uses.
- Stack: React 18 + TypeScript + Vite + react-router. Jest + Testing Library for unit tests, Cypress for E2E.
- Removed on purpose (ADR-001): subjective variables, interruption causes, "was it avoidable?" questions, causal snapshots. Do not reintroduce them.
- Terminology (ES / EN): día / day, foco / focus, en marcha / running, biblioteca / library, bloque / time block, "Por hacer" / "To do", evento / event, tempos / tempos, referencia diaria / daily reference, cierre / close, satisfacción / satisfaction, "No la terminé" / "I didn't finish it".

## Brand Commitments

- Name: LifeUI (formerly Qualia Control; the old name survives only in the localStorage key so existing data keeps loading).
- Voice: always kind to the user. Positive tone, rounding in their favor, optimistic defaults. The daily target is an anchor, never a debt: "42% de tu referencia diaria", never "te faltan 58". Interruptions carry no moral judgment ("Está bien. Mañana es otra oportunidad.").
- Honest dopamine only: no fake streaks, no rewards for looking at the screen, no punitive drains.

## Evidence on Hand

- No real user data, testimonials, or metrics exist. Anything shown as sample data must be clearly synthetic.
- Product docs: `docs/adr/001-sistema-de-tempos.md` (tempo system decision record) and the original vision and flows in `docs/archive/`.

## Product Principles

1. Free time is sacred: never drain, never penalize inactivity.
2. Honesty lives in one moment: one closing ritual, no continuous friction.
3. The core calculates, the UI evaluates.
4. Three metrics, not twenty: tempos, % of reference, satisfaction.
5. The app always treats the user well.

## Accessibility & Inclusion

Low cognitive load is the design constraint: keep the number of decisions per screen small, make the single next action obvious, keep state (what is running, for how long) always visible, avoid overwhelming density and anxiety-inducing framing. Full keyboard operation on desktop and comfortable touch targets on mobile.
