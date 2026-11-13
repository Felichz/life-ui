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
- **A duration, a time and days of the week are also read from the person's own words**, by the code: "15 minutos… a las 7pm" gives 15 min and 19:00, "de lunes a viernes" five days, "media hora al mediodía" 30 min at 12:00. They fill in what the model filed elsewhere. **A roadmap is held to one of them only when this reading and the model's agree** (ADR-011, section 5). Each is wrong alone often enough: the code reads "los viernes no voy a poder" as Friday, and the model takes a day from a question of the coach's. When a message speaks of days, a time or a length and the two readings differ, nothing binds, and what was held before is let go.
- **A failure leaves the notes as they were.** They help the answer; they are not needed for it.
- A message too short to say anything costs no call.

The notes are kept with the conversation, so a compaction (ADR-007) does not lose them.

### 2. The notes ride next to the message

Small models act on the last thing they read. The notes go where the language reminder already went: after the person's latest message, in the request only, never in the history. First what the person has told the coach, then what this turn calls for, then the language.

### 3. The next move is decided by the code

What a coach should do next is a short policy, and it is applied here, not left to the model:

1. **The person asked something**: answer it first.
2. **Something essential is missing, and the coach has asked in fewer than two replies**: ask only for that, two things at most. What is essential is worked out from the notes: what they want; and, for a plan, how long a session can be and which days. A number the plan's own content depends on (how heavy their weights are, when they asked for the weight of each exercise) counts as one more, so three may be asked in that one message. The code reads that number from the notes and keeps it even when the model's own call comes back empty.
3. **Otherwise, for a plan**: give it now, whole; say what is assumed where something was not said; close with two or three lines on how it fits the time and the limits they gave; ask for their yes.
4. **The plan has been given** (a long reply to someone who wants a plan is taken to be it): do not write it again or change its length, days or phases unless they ask. Asked "how many tasks?", the model had laid out a second, different plan.
   - **They have not said yes**: put nothing in the app in this reply, and ask for their yes. Asked only to look something up, the model had gone on to build the roadmap.
   - **They have said yes**: put it in the app in that same reply. Whether a message is a yes is noted by the same short call as the rest, one true or false, and it belongs to that message only. Once a plan is on the table every message is noted, even one word: "sí" is what the coach is waiting for.
   - **A roadmap exists already**: the turn's notes name it, and say that a plan which is one of them is done and is not to be built again.
5. **Something was changed in this turn already**: say what was done, from the tool's answer, and do not ask for a yes to what is saved.

The count of replies with questions is kept with the notes, so a compaction does not start it again.

### 4. The first move of every turn is a choice held to a schema

Told "add reading, 20 minutes", the model answered "I have added it" and called no tool: three times out of three, with this prompt and with the one before it. The same had been seen in the planner (ADR-010, section 3b), and the same cure works. The first call of a turn is sent held to a schema (ADR-010, section 3c): one of the agent's tools, or `just_answer`, a tool that does nothing and means "this message needs nothing read and nothing changed".

- An instruction comes back as its tool call. Asked what is left for today, the model reads the day first (rule 2 of the prompt, now kept).
- `just_answer` is followed by a second, free call that writes the answer: about a second more for small talk.
- After the first move the model is free again, as before.
- A server that holds the model to nothing answers in words at once, and those are taken as they are.

Three more things are held by the code, each after a run in which a rule in the prompt did not hold:

- **Asked to look something up, the coach searches.** The notes call says whether the message asks for that. If the reply then comes with no search made ("I have looked into it…"), it is not shown, and the model is told to search.
- **The tools where a mistake costs most need a request or a yes.** Held to choosing a tool, the model chose to act: told a time of day, it planned 63 sessions nobody had agreed to; told of a bad habit, it tried to delete an activity. So the tools sent with a request depend on what the person's message is, and the notes call says which, one true or false each: an instruction, a yes, or neither. With neither, the tools that plan days ahead, cancel, delete, start or end the day, log an event or write in the ideal life are not offered. After a yes to a plan everything is offered but planning loose sessions: the plan goes in as a roadmap, which puts its own sessions on the calendar (ADR-011). A roadmap that exists can be changed on a plain request. This is rule 0 of the prompt ("act only on a request") held by construction. The tools of the day itself (add, start, finish, move) are offered in a normal turn. Holding them back always was tried and failed: the notes took "I have started reading" for talk, so the day could no longer be run. They are held back only while a plan is being shaped and the person did not ask for a change to the day: told to build a plan, a 9B model created and started an activity named after it.
- **What the person guessed about themselves, and their own measures, never go into a search.** A query that names them is refused, and the model searches the topic alone. One query had carried "TDAH", another "80kg 180cm". A measure is matched whole: the 5 inside "15 minutes" is not the person's "5 kg", and a search that named neither is not refused.
- **A first roadmap is not built before the plan was shown and accepted.** Behind the rule above, the tool itself refuses a plan that was agreed to before it was ever laid out, and says what is missing.
- **A short message can ask for a whole plan** ("armame un plan"), and it is too short to be worth the notes. When the model reaches for a planning tool and the notes do not speak of the message yet, they are taken then, before the tool runs.
- **A tool that failed twice in a turn is not run a third time.** The model is told to stop and say so plainly. It had tried the same call eight times.

### 4b. A first plan is compared with the notes before it stands

The model writes a plan with the notes in front of it and still leaves things out: told about dumbbells, it built a plan on a barbell alone; given 15 minutes, it wrote a phase of 20. Asked afterwards to compare the two, it sees it. So the first plan of a conversation goes through `planGaps` before the person keeps it:

- **Counted by the code:** a session written longer than the minutes the person gave.
- **Asked of the model, held to a schema (`check_plan`):** what they have that the plan never uses, what they asked it to contain that it does not give, a limit it goes against. As with the notes, two readings: a thing "not used" counts only if it is one of theirs and the code does not find it in the plan either.

When something is missing the plan is written once more, with the list. Once: the check improves a plan, it is not a gate. It costs a short call on the turn a plan is laid out, and one rewrite when it finds something.

The same rule, "sent back once, with the numbers", now covers three things a planner copies wrong (ADR-011): a roadmap much longer than asked, one much shorter (the sessions of a phase counted short), and one on other days than the conversation last named, with the line the days were read from. The short count is made from the weeks asked for and the days a week, not from the span on the calendar: seven weeks at three days is 21 sessions, and a plan with 18 is sent back once with "7 weeks are 21 in all". None of them binds: sent again, it stands, and the person sees it on the card.

### 4c. Small readings the code does itself

- **An end named by the calendar** ("this month and the next", "until the end of the year") is counted from today: on the 12th that is seven weeks, not the nine of two whole months.
- **What a yes comes with** ("yes, and I also want…") is kept apart for that turn, and the coach is told to put it into the plan before it is saved.
- **Notes with nothing in them** ask for no coaching: "I have started reading" is someone running their day.
- **A plan on days nobody gave** is the coach's proposal, and its last line says so and asks.
- **A note for the ideal life** is one idea, in the person's words, and it is checked before the card is shown: a card they say yes to is a note that gets written.

### 5. What stays the model's

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
