# ADR-010: The ideal life, roadmaps, and a planner that owns them

- Status: accepted
- Date: 2026-11-11
- Builds on: ADR-002 (the agent), ADR-008 (days ahead), ADR-009 (the coach)

## Context

The app could run a day and, since ADR-008, plan the days ahead. It had no idea what the days were for. The coach of ADR-009 could talk about a goal, and then the goal lived only in a conversation that would be compacted away.

The author asked for three things that belong together:

1. **The ideal life**: a document the person writes and edits whenever they want, and that the agent also writes in as they talk, keeping what the person says about how they want to live and what they want to reach. Always in the model's context, as the anchor of its help.
2. **Roadmaps**: explicit plans from here to a goal, anchored to the person's real tasks, with a screen that shows the whole plan and where it stands, so the distance to the goal is something concrete.
3. **A specialised subagent** for roadmaps, because the models are small: it carries the roadmap's context and owns it, the coach calls a tool to activate it, and its own tool is the whole API over the roadmap's data, returning errors when it is used wrongly.

## Decision

### 1. The ideal life is one text, the person's

`global.idealLife` is Markdown. On the Goals page the person writes and edits it by hand: it is the one exception to "the day changes only through the chat" (ADR-002), because these are their own words about their own life, and nothing in the app depends on its shape.

The agent adds to it, never rewrites it:

- `note_ideal_life` appends one note under a heading, creating the heading when it is missing. It refuses a note that is already there.
- `edit_ideal_life` replaces an exact passage, which has to appear once. A passage that is not there is refused, so the model reads before it writes.
- There is no tool that replaces the whole text. A small model cannot lose what the person wrote.

Both are changes like any other: a card in confirm mode, undoable.

**Always in context.** Every request carries the text under "Their ideal life", cut at 1,500 characters (about 450 tokens) with a note that the rest can be read. The prompt tells the agent to use it as the anchor: to tie advice to what is written there, to say when a plan pulls against it, and to offer to note what lasts (a wish, a value, a goal), never today's tasks or what the person did not say.

### 2. A roadmap is made only of real activities, and its progress is read, not written

A roadmap leads to one goal: a title, a why, and milestones in order. A milestone has steps. **A step is an amount of one activity of the person's library**: a number of sessions, or a total of minutes. There is no other kind of step.

- **Anchored by construction.** The core refuses, whole, a roadmap with a step that points at no activity, has no amount, or a milestone with no steps. An activity a roadmap is built on cannot be deleted from under it.
- **Progress is derived.** Nobody, person or model, marks a step as done. The app counts the closes of that activity since the roadmap was made: `roadmapProgress` walks the milestones in order, and a step counts only what was closed after the milestone before it was reached, so the same activity can be a step of two milestones without counting twice. An activity stopped without finishing does not count. What was done before the roadmap existed does not count.
- **Each step knows its dates.** How many sessions of its activity are planned ahead (ADR-008), and the next one. A step with nothing planned says so, plainly.

This is what makes the distance to a goal concrete: "3 of 8 sessions" is a count of things that happened.

### 3. The roadmap planner: a second agent with its own context

The coach's context is the scarce thing (about 5K tokens are fixed before a word is said). Everything about how roadmaps are built stays out of it.

- The coach has one tool, `plan_roadmap`, with one argument: a request in words. It also has `get_roadmaps` to read where the person stands, and one line per roadmap in the day's snapshot.
- The **planner** is a separate run of the same model with its own prompt (what a roadmap is, how to build one), its own state (the ideal life, every roadmap with its real progress, the library with session lengths, what is planned ahead) and its own eight tools: `save_roadmap` (a whole roadmap in one call), `set_roadmap`, `delete_roadmap`, `add_milestone`, `remove_milestone`, `add_step`, `set_step`, `remove_step`. It cannot talk to the person, so the coach is told to agree the shape first and put everything in the request.
- **Errors that teach.** The planner's tools work on a draft and check every call: an activity that is not in the library ("…is not in the person's library. Library: … Use one of those, or create it by adding session_minutes"), a step with no amount or with both, a milestone that would be left empty, a roadmap or milestone that does not exist (with the list of those that do). The planner reads the error and fixes the call.
- **A draft, then a yes.** Nothing the planner does reaches the core while it works. When it finishes, the person is shown the resulting roadmap, milestone by milestone, with any activity it would add to the library; on their yes it is saved in one go, and one undo takes all of it back. Deleting a roadmap asks even in auto mode. When the planner changed nothing, nothing is shown and the coach is told why.
- **A short way back.** The coach gets a few lines: what was saved, what the planner said, and, when the first milestone has no sessions planned, a note to offer planning them. Planning dates stays with the coach (`plan_ahead`): a roadmap says how much, the agenda says when.

Its conversation is thrown away after each request. It is capped at eight steps.

### 3b. What a real 9B model did with it

The first version was run against Qwen3.5 9B in LM Studio, with the request a person would type. Four things came out of it, and each changed the design:

- **It said "I have created the roadmap" and called no tool.** The coach repeated it to the person, and nothing existed. Now the planner's first call is sent with `tool_choice: "required"`. If it still answers in words while the draft is untouched, it is told that nothing exists and asked again, twice at most, each time with a forced call. After a call that failed it is free again, so it can say what is missing instead of inventing a roadmap. A server that refuses `required` gets the same request as a free choice.
- **The coach believed the planner's words.** When nothing changed, `plan_roadmap` now answers with an error (`nothing-saved`: "No roadmap was created or changed. Do NOT tell the person it was"), with what the planner said marked as said and not done.
- **It gave both `times` and `minutes`**, reading "minutes" as how long a session lasts, and wrote a sentence in a step's title. The fields are now named after what they are: `sessions`, `total_minutes`, and `session_minutes` for a new activity. A step has no title of its own: it is named after its activity, and what a phase is for goes in the milestone's note. The old names are still understood.
- **One forced call ran for eight minutes** (5,726 tokens of output). Every planner call is now limited to 1,500 tokens, the coach's to 2,048, and a runaway answer is cut to 300 characters before the next try so it cannot fill the context. While thinking is on, a call gets 4,096 more, because what the model thinks counts against the same limit.

After the first three changes one run of the same request ended with the roadmap saved: two milestones, two new activities, a note on each milestone.

**Still open.** A later run, through the app's own streaming client and with the token limit in place, failed three times in a row: the model wrote the call as text (`save_roadmap(title=…)`) and went on until the limit, 120 s each time. LM Studio does not hold the model to `tool_choice: "required"`. The limit bounded the damage and the coach was told that nothing was saved, but no roadmap was made. A probe showed what LM Studio does enforce: `response_format` with a JSON schema (`{name, arguments}`, one shape per tool) gave well-formed JSON every time, with tools in the request and with streaming. The next step is to make every planner move a schema-held call, with `finish` and `cannot_do` as the ways out, and a step schema that cannot carry both `sessions` and `total_minutes`. It is not built yet.

### 4. The Goals page

A fifth section, "Metas" / "Goals".

- **Ideal life**: the text, rendered, with "Edit"; an editor when editing; and an empty state that says what it is for.
- **Roadmaps**: one card each. The goal, its why, the percentage and "N of M steps". Under it a bar cut into one segment per milestone, as wide as its share of the steps. Then the milestones down a rail: reached (with its date), "You are here", and later. Under the current milestone each step shows its count, its own bar, and its next planned date.
- Today shows one line per active roadmap, linking to the page.

The page is read-only apart from the ideal life: roadmaps are built and changed in the chat.

## What this does not do

- **No step that is not an activity.** "Buy a barbell" is an activity done once. The rule has no exceptions on purpose: it is what keeps progress honest.
- **No progress by hand.** There is no "mark as done".
- **No deadline to fail.** A target date is shown as a hope. Nothing counts days late.
- **No roadmap without the person asking**, and none saved without their yes (ADR-002).

## Consequences

- Building a roadmap costs several model calls (the planner's), which on a small model takes a while; a line in the chat says it is being prepared, and it can be stopped.
- A small model will sometimes write a poor roadmap. The person sees it whole before it is saved, and can ask for changes in words.
- The fixed part of every request had grown to about 6.5K tokens. With this added, the prompt was rewritten more tightly and the tool descriptions shortened: it is now about 5K, plus the ideal life.
- The state gains two optional fields in `global`. Older saved states load unchanged.
