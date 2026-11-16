# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Primary: the author, using the app throughout the whole day to decide what to do next, run one thing at a time, and say whether each one was done. Used on desktop/laptop as a desktop app (Tauri) with a local model, and as a web build (cloud models) on the phone.

Later: other people who want the same kind of support. The product is personal today but should be understandable to a stranger without the author explaining it — no private jargon left unexplained, no dead ends that only the author knows how to escape.

## Product Purpose

LifeUI is "a UI for real life": like a game HUD, it shows the information that matters about the day without replacing the day. Life is the only real game; the app is only its interface.

The loop (ADR-015): the coach turns a goal into a roadmap of real tasks on the calendar; the person starts a task (a button, or a word to the coach), focuses on exactly one, and closes it as done or not done. A done task moves its goal forward; that progress is the reward. Since ADR-002 the person does all of this by talking to an agent in a chat column; the screens only show the day. The close is the person saying how it went in their own words, from which the agent infers the 0–10 satisfaction (never asked as a number). Tempos are an immutable reward, never a currency: they only go up, they never drain, and free time costs nothing.

Success: the user keeps opening the app because they can see themselves getting closer to their goals, and what the app counts (tasks done, sessions of each phase, the percent of the way) is true.

## Positioning

A local AI harness for your life: a personal assistant and coach, built around the person, that runs on their own machine. What sets it apart from a chatbot is the harness around the model: tools that really change the day (plans, the calendar weeks ahead, roadmaps, web searches with sources), a memory of what the person said (the coach's notes and the ideal life), and one rule held in code, that nothing changes without the person's yes. Privacy is part of the pitch: the day stays on the machine, and only the searches the person allows go out. Not a todo app, not a habit tracker, not a chatbot.

Inside the day, every activity end passes through one question: did you complete it? That answer is the only thing measured, and a yes moves the task's goal forward. It is asked in one moment, from the person's own words, instead of as continuous tracking.

## Operating Context

- Day lifecycle: start day → plan and execute → end day → overview. Unfinished activities carry over to the next day.
- Activity library: reusable templates with one of three duration contracts — clear objective (point estimate, "~45 min"), flexible duration (expected range), timeboxing (declared minimum, maximum, or both).
- Time blocks: user-defined, non-overlapping hour ranges (e.g. Morning 06:00–12:00) plus the permanent "To do" block. Only activities in "To do" or in the block that is current right now can be activated; future/past blocks are visible but locked.
- Exactly one active activity at a time. Switching, completing, ending the day or interrupting all route through the closing ritual (requestCompletion → modal → completeActivity / interruptActivity). Closing the modal without choosing leaves the activity running.
- Days ahead (ADR-008): an activity can be planned for a future date, once or repeated on weekdays for a number of weeks, with a time and notes (what to do in it: a routine, a checklist). Planned days join the plan of the day when their date comes; a date that went by is not a debt and comes along with the next day.
- The agent is also a coach (ADR-009): for a goal, a habit or a project it asks, recommends with reasons, and plans it small and exact. With the person's permission it can search the web to support its advice; only the search text leaves the machine, and every search shows in the chat.
- Direction (ADR-010): the ideal life is the person's own text about how they want to live, always in the agent's context and added to by it; a roadmap is the explicit way to one goal, in milestones made of amounts of real activities, with progress counted from what was really closed. A second agent, the roadmap planner, builds and changes roadmaps on a draft the person confirms. Both live on the Goals page.
- A roadmap owns its sessions (ADR-011): it has one activity, the days of the week it is done on, and phases that say how many sessions and what a session contains. Saving it puts every session on the calendar, and the app keeps them there as they are done, moved or dropped. It is held to what the person said: their days, their time, how long a session can be.
- The coach keeps notes on what the person has told it (ADR-012): what they want, what they have, their limits, what they said only as a guess. A short call writes them; the code decides the coach's next move from them (ask what is missing, twice at most; then recommend; put it in the app only after a yes).
- Events: one-tap point-in-time markers ("Tomé ibuprofeno", "Café") from reusable event templates.
- Timeline of the day: completed and interrupted activities, the running one, events.
- Overview: tasks done and not done per day, time on what was done, and a multi-day trend.
- Settings: the model, appearance, language, web research, updates, export / import JSON, clear data.
- Offline-first. The web build keeps its state in localStorage; the desktop app keeps it in a file (ADR-003). The agent runs on a local model through LM Studio or Ollama (ADR-004), or a cloud provider (ADR-005).
- Bilingual UI: English and Spanish, switchable at any time; the first launch is in English and a saved choice wins after that. Spanish is the reference copy; English must stay equivalent in tone (kind, never judging).

## Capabilities and Constraints

- Architecture: `src/system` is the domain core (SystemCore + managers) and owns all business logic, including a roadmap's progress counted from what was done. The UI never recomputes rules; it only calls the core and renders.
- Stack: React 18 + TypeScript + Vite + react-router. Jest + Testing Library for unit tests, Cypress for E2E.
- Removed on purpose (ADR-001): subjective variables, interruption causes, "was it avoidable?" questions, causal snapshots. Do not reintroduce them.
- Terminology (ES / EN): día / day, foco / focus, en marcha / running, biblioteca / library, bloque / time block, "Por hacer" / "To do", evento / event, meta / goal, hoja de ruta / roadmap, cierre / close, completada / completed, "No la completé" / "I didn't complete it".

## Brand Commitments

- Name: LifeUI (formerly Qualia Control; the old name survives only in the localStorage key so existing data keeps loading).
- Voice: always kind to the user. Positive tone, optimistic defaults. Progress is what was reached, never what is missing: "phase 1, 4 of 10 sessions", never "6 to go". Interruptions carry no moral judgment ("That's fine. Tomorrow is another chance.").
- Honest dopamine only: no fake streaks, no rewards for looking at the screen, no punitive drains.

## Evidence on Hand

- No real user data, testimonials, or metrics exist. Anything shown as sample data must be clearly synthetic.
- Product docs: `docs/adr/` (001 tempo system, superseded by 015; 002 agent-mediated app, 003 desktop shell, 004 local model runtime, 005 model providers, 006 scheduled times), `AGENT.md` (the agent's prompt) and the original vision and flows in `docs/archive/`.

## Product Principles

1. Free time is sacred: never drain, never penalize inactivity.
2. One question at the end of a task: did you complete it. No continuous friction.
3. The core calculates, the UI evaluates.
4. One measure that matters: was it done. Progress is toward goals, never toward a daily number.
5. The app always treats the user well.

## Accessibility & Inclusion

Low cognitive load is the design constraint: keep the number of decisions per screen small, make the single next action obvious, keep state (what is running, for how long) always visible, avoid overwhelming density and anxiety-inducing framing. Full keyboard operation on desktop and comfortable touch targets on mobile.
