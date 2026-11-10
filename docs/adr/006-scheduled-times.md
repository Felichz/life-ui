# ADR-006 — Activities at an exact time

**Status**: Accepted
**Date**: 2026-11-10
**Decision**: An activity in the day's plan may carry an exact start time ("Write report at 15:00") on top of its time block. The time is a plan, not a gate: the block still decides when it can start. The timeline draws scheduled activities at their time, and an activity whose time passed without starting becomes a missed commitment the agent can help renegotiate.

---

## Context

Plans are made of time blocks today: an activity sits in "Afternoon", and it can start whenever that block is current. With the agent (ADR-002) the author wants to say "Write report at 15:00", wants the timeline to lead the interface, and wants the agent to help when a commitment was not met. All three need a time on the activity.

## Decision

### Data

- `ActivityInstance` gains an optional `scheduledStart` in minutes of the day (`DayMinutes`, 0–1439), like time blocks.
- Setting it places the activity in the block that contains that minute, or in "To do" when no block does. The core enforces this, so a time and its block never disagree.
- Within a block, scheduled activities come first, ordered by time; unscheduled ones follow in their manual order.
- A time belongs to its day: when an unfinished activity carries over to the next day, its `scheduledStart` is cleared.
- The persisted state moves to a new schema version with a migration (the field is optional, so existing data stays valid).

### Rules

- **A plan, not a gate.** The time does not lock the activity: starting is still allowed when its block is current or it is in "To do", as today. Starting at 14:40 something planned for 15:00 is fine.
- **Length on the timeline** comes from the activity's contract: the estimate, the range's minimum, or the timebox's minimum, with a short default when there is none.
- **Missed** is derived, never stored: a scheduled activity not started 15 minutes after its time and not running is shown as missed. It carries no penalty and no tempo change (ADR-001: free time costs nothing); it is only the agent's cue (ADR-002, rule 3) to offer moving, shrinking, splitting or dropping it.

### Agent tools

- `schedule_activity(activity, time)`, `unschedule_activity(activity)`, and a time in `add_to_plan`.
- The state snapshot the agent receives lists scheduled activities by time and marks the missed ones.

## Consequences

- The timeline becomes the main view: blocks as bands, scheduled activities at their time, unscheduled ones listed in their block, the "now" line, and the running activity with its clock.
- Core, persistence (migration) and tests change; the closing ritual and the tempo formula do not.
