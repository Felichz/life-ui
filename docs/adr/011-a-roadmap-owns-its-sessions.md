# ADR-011: A roadmap owns its sessions

- Status: accepted
- Date: 2026-11-12
- Builds on: ADR-008 (days ahead), ADR-010 (the ideal life and roadmaps)
- Changes: ADR-010, sections 2 and 3 (who plans a roadmap's dates, and the shape of the planner's tools)

## Context

ADR-010 split the work in two: the planner said how much (a roadmap, in steps counted in sessions), and the coach said when (planning those sessions ahead, one call at a time). A real conversation with Qwen3.5 9B showed what that split costs. The person asked for a two-month training plan of fifteen minutes a session. What ended up in the app:

- seven library activities, one per exercise, of about twenty minutes each;
- sixty planned items: five of those activities on every training day, a hundred minutes where fifteen were asked for;
- a roadmap whose first phase (four weeks) was reached after three sessions, because "3 sets" had been read as "3 sessions";
- a separate activity for the first day, which no step of the roadmap counted.

Each call was valid on its own. Nothing held them together: the roadmap and the calendar were two things a small model had to keep in step by itself, and it did not.

The author's reading of it: the roadmap has to be anchored to the real tasks, and the agent's tools have to make that kind of operation easy to do right.

## Decision

### 1. A roadmap has a schedule, and the core keeps its sessions planned

A roadmap now carries when its sessions happen: the days of the week, a time if the person wants one, and a start. With a schedule, **the core itself plans every session that is left**, phase after phase:

- the sessions of a milestone start after the last session of the one before;
- each planned session belongs to its step (`PlannedActivity.roadmap`), carries what a session of that step consists of (`RoadmapStep.notes`), then what holds in every session (`Roadmap.rules`), and its own length when the phase's sessions are longer or shorter than the activity's usual (`RoadmapStep.sessionMinutes`);
- what was closed is not planned again; a session waiting in today's plan counts as one of those left;
- a day holds one session of a step: after one was done, dropped or brought in today, the next is on a later day. A session that was dropped is not made up: the plan simply runs one day longer;
- a paused roadmap has nothing planned; deleting a roadmap takes its sessions with it.

This runs when a roadmap is saved and whenever the day's plan is brought up to date, and changes nothing when nothing changed. Saving the roadmap and planning its sessions is one operation with one undo. Progress is still counted from what the person really closes (ADR-010), not from the calendar.

The answer to "should the tasks be created first?" is that neither comes first. An order would still depend on a model making two calls that agree. Here there is one call, and the tasks are made from the roadmap by the core.

### 2. The planner's tool has the shape of the thing

Errors that explain were not enough. Told that a milestone has at most three steps and that the parts of a session go in notes, the model dropped two exercises to fit the limit and said the rest were in the notes. So the main tool was reshaped until the mistake had nowhere to go:

- `save_roadmap` takes **one activity** for the roadmap (what the person sits down to do in a session) and its session length, the **schedule**, the **rules**, and milestones that each say **how many sessions** (or minutes in all) and, in `notes`, **what one session of that phase consists of**. A milestone may name another activity, or its own session length, when a phase really differs.
- There is no list of steps to fill in the usual case, so there is no place to put an exercise except the notes, and no number to give except whole sessions.
- A roadmap cannot be created without a schedule. When the request does not say the days, the planner calls `cannot_do`, and the coach asks the person: nobody chooses days for someone.
- `set_schedule` moves a roadmap's sessions to other days, another time or a new start. `add_step` remains for the rare phase with two kinds of session, with the limits and errors of before (three steps to a milestone, three new activities to a request).
- An edit that is refused leaves the draft exactly as it was.

With the same request that produced the result above, the planner now saves one activity, three phases of twelve sessions with the whole routine in each phase's notes, the rules under them, and thirty-six sessions on their days.

### 3. The card and the answer carry real dates

- The card the person confirms shows the days, the time, how many sessions and the first and last date, then each phase with its own dates. A plan called "two months" that runs to February is seen before it is saved.
- What the coach gets back has every date with its weekday ("vie 13 nov"), how far the first one is ("tomorrow", "in 4 days"), and the count per phase, with one line telling it to say them as they are. A small model that works a weekday out from a date gets it wrong; one that copies it does not.

### 4. Planning ahead, for what is not a roadmap

`plan_ahead` stays, for one thing on a date or one habit without phases:

- it can repeat a number of **times** (`sessions`), not only for a number of weeks;
- its answer has its dates with their weekdays;
- when a day ahead ends up with four or more planned activities, or three hours of them, the answer says so, and that parts of one session belong in one activity;
- it refuses an activity that a roadmap plans, and says which tool moves a roadmap's sessions.

### 5. A roadmap is held to what the person said

In a later run of the same conversation the structure was right and the content had drifted. The coach, writing the plan out again for the planner, added a fourth phase: 62 sessions running to April for a plan asked for "this month and the next". The planner turned "martes, jueves y sábado" into Monday, Wednesday and Saturday, and left the time out. The person would have seen it on the card, but nothing stopped it.

So what the person said is passed along, and checked where the roadmap is built:

- **What binds is what two readings agree on.** A duration, an hour and days of the week are read twice: from the words the person wrote, by the code, and from the model's notes (ADR-012). When both say the same, a new roadmap is held to it: refused when the sessions of its first phase are longer than they said, or when its days are not theirs; and the time they gave is used whatever the planner wrote. When the two differ, nothing binds and the planner works from the conversation. Both simpler rules were tried and each broke a run: bound to the model's notes alone, a plan of three days a week was left with Mondays only, because the notes had taken "lunes" from a question of the coach's; bound to the person's words alone, "los viernes no voy a poder, pásame a lunes, miércoles y sábado" was read as four days, and the right change was refused eight times.
- **How long the plan runs is said, not enforced.** How many weeks "this month and the next" means is the model's reading. When a new roadmap runs clearly longer than that, the card says so in its first line ("you asked for about 8 weeks and this one runs 21"), it asks for a yes even in auto mode, and the coach is told to say it and offer to shorten it. The person decides.
- **Three refusals in a row end the planner's run.** Each try writes the whole roadmap again, a minute at a time on the author's machine; the coach is told what stood in the way.
- The planner is given **the conversation itself**: the coach's latest messages and the person's. The plan the person agreed to is there, as they read it. The coach's request becomes a few sentences, which saved a minute or more on the author's machine and takes away the step where the plan drifted.
- The days of the week are written **in the words they were said in**. The tool takes "martes" as well as "tue": nothing to translate, nothing to get wrong.
- `save_roadmap` ends with a line for the coach and `then: "finish"`, and that closes the run. Asked again after a good save, the model had sent the whole roadmap a second time.

## What this does not do

- **No calendar of its own for a roadmap.** Sessions are ordinary planned activities (ADR-008): they join the day's plan when the day comes and can be done, moved or dropped like any other.
- **No making up.** A session that was dropped does not come back the same day.
- **No days chosen by the model.**

## Consequences

- The Goals page shows a roadmap's days, each step's notes with the rules, and from when a later phase runs.
- A roadmap created before this has no schedule and keeps working as before; it gets one when the planner next moves or rewrites it.
- The state gains optional fields (`schedule`, `rules`, step `notes` and `sessionMinutes`, and the link on a planned activity). Older states load unchanged.
- One roadmap plans at most 200 sessions.
