# ADR-015 — Goals, not tempos: a task is done or not, and progress is toward a goal

**Status**: Accepted
**Date**: 2026-11-15
**Supersedes**: ADR-001 (the tempo system) and the closing score of ADR-002
**Decision**: Tempos, the daily reference and the 0 to 10 satisfaction go away. Closing a task records one thing: whether the person did it. The reward the app shows is progress toward a goal: the sessions of a roadmap closed as done, phase by phase, to the goal reached. Any task of today can be started from the panel with a button, and the coach is told and answers.

---

## Context

Since ADR-009 to ADR-012 the coach turns a goal into a roadmap whose sessions are real tasks on the calendar, and the Goals page counts its progress from what was closed. Tempos were a second reward next to that one: minutes times a score, toward a daily number. The author asked to drop them: what matters is to measure well whether each task was done, as the person says it when it ends, and to see the way to the goal.

Starting a task was only possible by telling the coach ("I'm starting X"), and the author, as a user, did not find how to start the day and then a task planned for today.

## Decision

- **A close is done or not done.** The record keeps `state: "completed" | "interrupted"` (done / not done), the real minutes and the person's words. No score, no tempos, no daily target.
- **The coach reads it from their words** ("terminé", "lo hice a medias", "no llegué"). Done means they did what the task asked; if their words do not say, it asks "did you complete it?" in plain words. It never asks for a number.
- **The reward is the goal.** The HUD shows the goal closest to the running task (or the first active one) and its progress; a close that moves a roadmap says what it reached. The day's summary counts tasks done and not done, without a target.
- **Start from the panel.** Every task of today has a Start button. If the day has not started, starting a task starts it. The person's message in the chat says what they did ("Empecé «X»"), the coach answers it, and does not start it again. Finishing from the panel asks "Did you complete it?" with two answers and an optional sentence, and the coach is told the same way.
- **Old data**: records keep their state (done or not done); their scores and tempos, and the daily reference, are dropped by the persistence pipeline on every load and save (`stripTempos`), so an old file or an import comes in without them. The schema version stays at 3: nothing new is stored.

## Consequences

- ADR-001's formula, the reward preview, the tempo meter, the tempo trend and the daily reference are removed from the core and the UI.
- The product film and the README pictures still show tempos until they are made again.
