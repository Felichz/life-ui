# ADR-012: The coach's notes, and its next move

- Status: accepted
- Date: 2026-11-12
- Builds on: ADR-002 (the agent), ADR-007 (conversations and context), ADR-009 (the coach)

## Context

The coach of ADR-009 runs on a 9B model that answers without thinking first (ADR-004, section 12). In a real conversation about a training plan it:

- asked the same things three times (where the equipment was, what the smallest version would be), and took eight messages to give a plan the second one had asked for;
- proposed sessions of 45 to 60 minutes to someone who had said "little time", and three months where two were asked for;
- said "you have ADHD" where the person had said "maybe I have";
- answered "how many tasks will you create?" with a number that matched nothing.

Two things were measured.

**Thinking fixes most of it, and costs too much.** With thinking on, the same model asked exactly for what was missing and then gave a plan that respected what it had been told. But this model thinks for 1,100 to 1,500 tokens whatever effort is asked for (`minimal`, `low`, `medium` and `high` were all the same; only `none` differs): one to three minutes per answer on the author's machine.

**A rule in the prompt does not hold it.** "At most two messages of questions" and "check your plan against their words" were in the prompt for both runs.

## Decision

### 1. Notes on what the person has said, kept by a short call

Before the coach answers a message that says something, one short call, held to a schema (ADR-010, section 3c), writes down what the person said in it:

- **wants**: what they want to reach, and what they asked to be made;
- **has**: what is true of them and what they have to work with;
- **limits**: what any plan has to respect;
- **unsure**: what they said as a guess about themselves, which the coach must never state as a fact;
- **plan**: once they want something to do again and again, what such a plan cannot be built without, each as they said it: how long a session can be, which days, what time, when it starts, and for how many weeks. These are also what a roadmap is held to when it is built (ADR-011, section 5).

It costs two to five seconds. What makes it dependable is what the code does around the model:

- **Nothing noted is lost.** New phrases are added to the lists; the model's answer never replaces them.
- **Only the coach's questions are passed along** with the person's message, so an answer like "yes, those days" can be read, and what the coach proposed is not written down as something the person said.
- **A duration, a time and days of the week are read from the person's own words**, by the code. They fill in what the model filed elsewhere ("15 minutos… a las 7pm" gives 15 min and 19:00), and they alone are what a roadmap is held to (ADR-011, section 5): what the model noted spares a question, it does not bind a plan.
- **A failure leaves the notes as they were.** They help the answer; they are not needed for it.
- A message too short to say anything costs no call.

The notes are kept with the conversation, so a compaction (ADR-007) does not lose them.

### 2. The notes ride next to the message

Small models act on the last thing they read. The notes go where the language reminder already went: after the person's latest message, in the request only, never in the history. First what the person has told the coach, then what this turn calls for, then the language.

### 3. The next move is decided by the code

What a coach should do next is a short policy, and it is applied here, not left to the model:

1. **The person asked something**: answer it first.
2. **Something essential is missing, and the coach has asked in fewer than two replies**: ask only for that, two things at most. What is essential is worked out from the notes: what they want; and, for a plan, how long a session can be and which days.
3. **Otherwise, for a plan**: give it now, whole; say what is assumed where something was not said; close with two or three lines on how it fits the time and the limits they gave; ask for their yes.
4. **The plan has been given** (a long reply to someone who wants a plan is taken to be it): do not write it again or change its length, days or phases unless they ask. Asked "how many tasks?", the model had laid out a second, different plan.
   - **They have not said yes**: put nothing in the app in this reply, and ask for their yes. Asked only to look something up, the model had gone on to build the roadmap.
   - **They have said yes**: put it in the app in that same reply. Whether a message is a yes is noted by the same short call as the rest, one true or false, and it belongs to that message only. Once a plan is on the table every message is noted, even one word: "sí" is what the coach is waiting for.
   - **A roadmap exists already**: the turn's notes name it, and say that a plan which is one of them is done and is not to be built again.
5. **Something was changed in this turn already**: say what was done, from the tool's answer, and do not ask for a yes to what is saved.

The count of replies with questions is kept with the notes, so a compaction does not start it again.

### 4. What stays the model's

What to recommend, in which words, and what a session should contain. The notes and the move decide when to ask, what to ask for, and when to stop asking.

## What was measured

The same conversation, the same model, thinking off, 12K of context:

|                                     | Before                                              | With notes and moves                                              |
| ----------------------------------- | --------------------------------------------------- | ----------------------------------------------------------------- |
| Questions before a plan             | 7 replies, the same ones repeated                   | 2 replies: what they want; then how long and which days           |
| The plan                            | 3 months, 45 to 60 minutes a session                | 8 weeks, 15 minutes, with the minutes added up                    |
| A guess of the person's             | stated as a fact                                    | not stated                                                        |
| Time per reply                      | 5 to 15 s                                           | 5 to 25 s (2 to 5 s of it for the notes)                          |
| What ends in the app (with ADR-011) | 7 activities, 60 items, a roadmap that counted sets | 1 activity, 24 sessions on their days, a roadmap that counts them |

## What this does not do

- **It does not make the model know more.** What a session contains is as good as the model and what it looked up (ADR-009).
- **It does not read minds.** The notes hold what was said. A plan that needs a number nobody gave says what it assumed.
- **Nothing is shown to the person yet.** The notes are the coach's. Showing them ("what I know about what you want") is a later decision.

## Consequences

- One more short call per message that says something. It is made only when a model is loaded for real, like titles (ADR-007).
- The planner (ADR-010) never thinks first, whatever the switch says: its moves are held to a schema, and thinking only added minutes.
- A note in the ideal life always asks first, in any mode, and the tool's description asks for the person's own words: the model had been writing its own summary there unasked.
