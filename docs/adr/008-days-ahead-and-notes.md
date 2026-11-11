# ADR-008: Days ahead, and notes inside an activity

- Status: accepted
- Date: 2026-11-11
- Builds on: ADR-001 (tempos), ADR-002 (the agent), ADR-006 (scheduled times)

## Context

The app only knew today. An activity lived in the library or in the plan of the running day; whatever was not done carried over. That was enough to run a day and not enough to build a habit.

A real conversation with Qwen3.5 9B showed it. The author asked for a training plan that would last: a little every day at the same hour, a progression, the tasks created for each day, and in each task the exact routine (exercises, repetitions, load). The agent wrote a good plan in the chat and then could not put it in the app. It promised activities for each day of the week with the routine in their description; no tool did that. Asked directly, it answered: "It only works with today, not with future days."

Two things were missing, and the request named both: a place for what to do **inside** an activity, and a way to leave things planned for **days that have not come**.

## Decision

### 1. An activity of the day can carry notes

`ActivityInstance.notes` is free text (Markdown): a routine, a checklist, steps. It is written by the agent (`add_to_plan` with `notes`, or `set_notes`), shown on the plan row behind a small toggle, and shown in full in the focus panel while the activity runs, which is when a routine is read. Notes stay with the activity when it carries over.

Notes are on the instance, not on the library activity, because the same activity changes from one day to the next: "Train" on Monday is not "Train" on Thursday, and week 3 is not week 1.

### 2. Activities can be planned for days ahead

A `PlannedActivity` is a library activity with a date (`YYYY-MM-DD`, the person's calendar day), and optionally a time and notes. Planned activities wait in `global.plannedActivities`, outside any day.

- **Repetition is expanded when it is planned.** "Monday, Wednesday and Friday at 17:00 for eight weeks" becomes 24 dated items that share a `seriesId`. There is no recurrence rule to evaluate later. Each item can then be different (its own notes) or be cancelled on its own, and what the person sees is exactly what is stored.
- **They join the day when their date comes:** when that day is started, at once when something is planned for a day that is already running, and on a check every minute for a day left running overnight. The item becomes an ordinary plan item: its time puts it in the block that holds it (ADR-006), its notes go with it.
- **A date is a plan, not a debt.** An item whose date went by without a day being started is not lost and is not marked as missed: it comes along with the next day that is started, without its time, like anything that carries over. Nothing counts the days that were skipped.
- **Limits:** 400 planned items at once, 26 weeks per series. Deleting a library activity removes its planned days.

### 3. The agent plans ahead, and only when asked

New tools: `plan_ahead` (once on a date, or weekdays for a number of weeks, with time and notes), `get_agenda`, `cancel_planned` (by title, optionally within dates) and `set_notes`. The day's snapshot now carries today's date in the person's time zone (it was UTC, wrong near midnight), the weekday and how many items are planned ahead.

A `plan-ahead` guide tells the agent how: agree the shape in words first; one call per distinct session, with the exact content in the notes; for a progression, plan the first phase with real dates and offer the next one when it ends. ADR-002 still holds: free time is sacred, so nothing is planned ahead that the person did not ask for, and in confirm mode each series is one card ("Plan «Train» · Mon, Wed, Fri · 17:00 · 12 Nov to 5 Jan (24 times)") that can be undone as a whole.

The time guard of the harness applies here too: a time the person did not say is refused.

### 4. On screen

"Coming days" lists what is planned, by date, for the next two weeks, under the plan of the day and on the start screen. It is read-only like the rest: planned, changed and cancelled in the chat.

## What this does not do

- **No recurrence without an end.** A habit is planned for a number of weeks and renewed. An endless rule would fill the agenda without the person ever deciding to go on.
- **No reminders or notifications.** The app shows what is planned; it does not interrupt.
- **No planning a whole future day in blocks.** A planned item has a date and at most a time. Blocks belong to the day once it runs.
- **Starting a day is still the person's act.** Nothing starts on its own.

## Consequences

- The rule added the same day to the agent's prompt ("the app plans today only") is replaced: the agent now promises only what a tool does and does it in the same turn.
- A small model has to produce several `plan_ahead` calls for a routine with different sessions. The guide keeps each call simple; the confirm card shows the count so a wrong span is caught before it runs.
- The state gains one optional field in `global` and one on instances. Older saved states load unchanged.
