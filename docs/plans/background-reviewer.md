# Plan: a reviewer agent that runs in the background

- Status: proposed (nothing of the agent below is built yet; section 2 is what exists)
- Date: 2026-11-14
- Builds on: ADR-002 (the agent), ADR-009 (the coach), ADR-011 (a roadmap owns its sessions), ADR-012 (the coach's notes; section 4e is the first, simple version of a second reading)
- Written to be picked up on another machine: it says what was measured, what exists, what to build, in what order, and how to run and measure it.

## 0. One paragraph

The coach (a 9B local model, Qwen 3.5 9B in LM Studio) makes mistakes it cannot see: a source it never found, "three days a week" for a plan of every day, a plan said to be saved when it was not. A first second-reading (section 2) asked the same model to judge its own answer. Measured, it found 2 real mistakes and invented 4, so it is off by default. The idea of this plan: stop asking the model to *judge*; give a second agent its own harness, **read-only tools** that open the real data, and one output that needs **evidence the code can verify**. It runs whenever the GPU is not serving the coach, the coach always has priority, and what it finds reaches the person through the main agent or through a card that is still waiting for a yes.

## 1. Where the project stands (commit `c759b2e` on `main`)

LifeUI: React 18 + TypeScript + Vite + Tailwind, desktop shell in Tauri 2. The coach is in `src/app/agent` (`agent.ts` the turn loop, `brief.ts` the notes and the checks of a plan, `when.ts` days and weeks, `tools.ts`, `roadmapAgent.ts` and `roadmapDraft.ts` the planner subagent, `guides.ts`, `saved.ts`, `llm.ts` the client, `web.ts` the search). The core (calendar, roadmaps, library) is in `src/system`. `AGENT.md` is the coach's system prompt. 450 tests (`npm test`), `npx tsc --noEmit -p .` and `npx eslint src scripts/sim` are clean.

Commits that are new in this push (oldest first):

- `81848b0` a plan's phases run on one clock; what is done once is a task for today
- `9b26a89` a phase "from week N on" counts as four weeks
- `963af81` the second reading (`review.ts`), the "Check every answer" switch, "antes de trabajar" reads an hour as the morning, a request with phases on two clocks goes back to the coach once
- `c759b2e` the second reading keeps only what the code can back; the days a week in a reply are checked against the saved roadmap
- the commit that adds this document and `scripts/sim/kit/` (section 9)

The film in `video/` and the demo images in `docs/screenshots` were updated earlier (`80de64d`). The portfolio repo (`C:\Users\felix\dev\portfolio`) has the new film as **uncommitted** changes; that is a separate decision (see section 10).

## 2. What exists: the simple second reading

`src/app/agent/review.ts`, wired in `agent.ts` (`Agent.review`, `Agent.settled`), a switch in the chat (`ShieldCheck` button, setting `lifeui.review`, off by default), `SIM_REVIEW=on` in the simulator.

After an answer of at least 160 characters, one call asks the model, held to a schema, for up to three problems of six kinds (`contradicts_tool`, `open_choice`, `not_their_words`, `unknown_source`, `missed_question`, `unsafe`), each with the sentence that shows it. The code keeps a finding only when the sentence is where the model says it is and the kind's own check passes (see `confirmed()`), finds links no search returned by itself, and a second call writes a short "Una corrección:" message that is added after the answer, marked "Second reading". A new message from the person aborts it. Tests: `src/app/__tests__/agentReview.test.ts`.

### 2.1 What was measured

Same code, seven conversations, with and without the reading (first version of the reading):

| scenario | without | with |
| --- | --- | --- |
| gym | 12/12 | 12/12 |
| english | 11/11 | 11/11 |
| running | 11/11 | 11/11 |
| guitar | 11/11 | 11/11 |
| plain day | 2/2 | 2/2 |
| sleep | 2/2 | 2/2 |
| elbow | 12/12 | 11/12 (no correction in it: run-to-run variation) |

The scores did not move, so the scorer cannot see what the reading is for. Seven corrections were posted. Read by hand against the tool answers:

| correction | verdict |
| --- | --- |
| "The plan starts Monday 20 Nov, not the 16th" | **false** (the tool said Monday 16; the 20th is a Friday) |
| "The plan has no 65 sessions" | **false** (the tool saved 65) |
| "The plan is not created yet" (gym) | **false** (it was saved) |
| "The NHS does not confirm 9 weeks" (running) | **false** (the search result said 9 weeks) |
| "I did not mention SixStrings" (guitar) | **partly false**: the reply did name SixStrings; what the search returned was only Rockshop, so the real error is a source that no search returned, and the correction text itself got it backwards |
| "It is every day, not three days a week" (guitar) | **real** |
| "The link may not work" | noise |

So: 2 real, 4 false, 1 noise. A false correction costs more than a missed error: it teaches the person to distrust the next answer too. `c759b2e` tightened the checks with exactly these cases as tests (a number stands only if no tool gave it; "you told me" only when the reply says it as theirs and they did not; a named source only if no result nor message holds it; days a week are checked before the reply is shown). The tightened version has **not** been measured with the model beyond one scenario (gym: no correction, 2/2). Measuring it is `bash .sim/ab-on.sh ab2` (about 40 minutes of GPU).

### 2.2 Why it fails, and what that says

A 9B model reading its own answer is good at *extracting* (what numbers, dates, names and sources does this say?) and bad at *judging* (is it right?). Every false alarm was a judgment made from a fact it did not have (a date, an hour, a total). The design below keeps the model on extraction and makes the code the judge.

## 3. The reviewer in one view

```
 person ──► MAIN AGENT (coach, planner, notes)            ┐
                │ answers, tool calls, cards              │ one GPU queue
                ▼                                         │ main first
        conversation log ─────────────► REVIEWER AGENT ◄──┘ background, preempted
                                           │ read-only tools: app state, conversation,
                                           │ coach notes, search results, fetch a source page
                                           ▼
                                  report_finding(evidence refs)
                                           │ the code opens each ref and checks it says what is claimed
                                           ▼
                         finding ──► waiting card? ──► fix the card before the yes
                                 └─► answer wrong?  ──► note to the main agent, said in its next turn
                                 └─► repeated kind? ──► a log, to become a fixed check in code
```

## 4. The pieces

### 4.1 One queue for the model, main first

Everything that calls the model today goes through the `chat` function that `AgentProvider.tsx` builds (`chat(current, messages, tools, signal, options)` from `llm.ts`): the coach's moves, the planner subagent, the notes, titles and the second reading. Put a scheduler in front of it.

- Two classes: `foreground` (anything in a turn the person is waiting for, the planner and the notes included) and `background` (the reviewer, its jobs).
- A foreground request never waits behind a background one: if a background call is running when a foreground one arrives, abort it (its `AbortSignal`) and re-queue it. Background work is written to be restartable, one small step per call.
- Check what LM Studio's `PARALLEL 4` really gives. With llama.cpp the context is shared across slots, so 4 slots on a 12k context may leave each slot 3k, and extra slots cost VRAM on an 8 GB card. Options: (a) one slot, strict preemption (simplest, start here); (b) two slots, one for each agent, if the memory and the context allow it. Decide with a measurement of tokens/s and context use, not by assumption.
- Pause the background when the GPU is busy with something else (a game): read utilisation before each background call, back off.
- Hard caps, because this machine freezes under sustained load (section 8): a budget of background GPU minutes per hour, the same temperature gate the safe runner uses (wait below 72 °C, stop at 87 °C), and a global off switch (the existing "Check every answer" setting, renamed).

Where: a new `src/app/agent/scheduler.ts`, injected in `AgentProvider.tsx` and `scripts/sim/sim.ts` (the simulator must use the same queue so measurements are honest). Tests with fake `chat` functions: preemption, ordering, re-queue, caps.

### 4.2 The reviewer harness

Its own loop (like `roadmapAgent.ts` is the planner's), its own system prompt (`REVIEWER.md` next to `AGENT.md`), its own small context, never the coach's history in full: it gets a pointer to the turn to review and fetches what it needs.

Read-only tools (none of them can change the day, the library, the notes or a roadmap):

- `get_turn(n)`: the person's message, the coach's reply, the tool calls and their answers for turn n.
- `get_state(kind)`: roadmaps with their phases and sessions, the plan of a day, the library. The same snapshot functions the coach reads (`snapshot.ts`), not the model's memory.
- `get_notes()`: the coach's notes on the person (the Brief of ADR-012).
- `get_search(id)`: what a search returned: titles, urls, the text the coach saw.
- `fetch_source(url)`: open a source page and return the part that matters (goes through `web.ts`; respects the web setting of ADR-009; only urls that came from a search or that the person wrote).
- `check_link(url)`: does it answer.

One output: `report_finding({kind, claim, evidence: [{tool, ref}], correction})`. The code, not the model, then **opens each evidence ref and checks it**: the claim's number is in that record, the source text contains what the reply attributed to it, the date is not the one in the calendar, and so on. A finding without evidence the code can verify is dropped. This replaces `confirmed()` in `review.ts`, which only checks that a quote exists.

Finding kinds, in the order they pay off (they are the mistakes seen in real runs):

1. A number, date, day or time in a reply that differs from the app's state (counts of sessions, start date, days a week, the hour).
2. A source named as found that no search returned; a link no search returned (this part is already deterministic in `review.ts`: `inventedLinks`).
3. "Source X says Y" where the source text does not say Y (the only check that needs the model: one claim, one fragment, a yes/no question, never the whole conversation).
4. "You told me ..." about something not in the person's messages or the notes.
5. A question of the person's that the reply does not answer (extract the questions, then one yes/no per question).
6. Safety: a diagnosis, a medication or a dose, or "keep going through sharp pain" (the coach's guide in `guides.ts` forbids both).
7. A plan card that breaks a limit the person gave (minutes, days), which the draft checks in `roadmapDraft.ts` already catch for roadmaps; the reviewer covers plans said in the chat.

The model's part is extraction and the small yes/no of kind 3. Everything else is code against real data. That also makes most of the reviewer independent of the model's size.

### 4.3 Its own chat: a log per conversation

A persisted record per conversation (`reviewer` next to the coach's `history`, saved with the same store): which turns were reviewed, which findings were reported, verified or dropped, and why. It never repeats a review, it can look back at earlier turns, and it is the data for section 6. The person does not see this chat; a developer view (like the existing `lifeui.devNotes`) can show it.

### 4.4 Delivery: findings never speak to the person directly

- **A card still waiting for a yes** (a roadmap proposal): correct it in place before the person accepts. The draft already has a path for sending a plan back (`roadmapDraft.ts` `check()`); the reviewer's finding can feed it.
- **A wrong answer that was already shown:** pass the finding to the main agent as a note (the same mechanism as `[Automatic note, not from the person: ...]` in `agent.ts`), to be said naturally in its next turn ("by the way, earlier I said three days a week; it is every day"). This replaces the separate "Second reading" message of section 2.
- **A mistake that repeats:** write it to a log for the developer. A kind that shows up three times becomes a fixed check in code (this is how `saved.ts`'s days-a-week check came to exist).
- Cosmetic findings are logged, never shown.

### 4.5 What it does when nothing is pending

Ordered by value, each one a small restartable job:

1. Check that the links saved in roadmap sessions still answer.
2. Compare a roadmap with what the person said after it was made (the notes changed: a new limit, a new piece of equipment) and propose an adjustment through the coach.
3. Read tomorrow's session notes before they arrive.
These come last; the core is 4.1 to 4.4.

## 5. Order of work

Each step ends green (`npm test`, `npx tsc --noEmit -p .`, `npx eslint src scripts/sim`) and is committed on its own.

1. **Scheduler** (`scheduler.ts`): queue, priority, preemption, caps. Wire it into `AgentProvider` and the simulator. Tests. Measure what a second slot costs (section 4.1) before choosing one or two.
2. **Reviewer harness** (`reviewer.ts`, `REVIEWER.md`): the loop, the read-only tools, `report_finding` with evidence verification. Port kinds 1 and 2 first (all code), then 3 to 6. Replace `review.ts`'s judge by this; keep its tested helpers (`quoted`, `inventedLinks`, `numbersIn`).
3. **Reviewer log and delivery** (4.3, 4.4): persisted per conversation; the note to the main agent; the in-place fix of a waiting card.
4. **Measure** (section 6). Only then decide whether it is on by default.
5. **Background jobs** (4.5).
6. Write **ADR-013** (a reviewer agent and a scheduler for the model); keep `docs/adr/012` section 4e as the history of the first version.

## 6. How to measure (the part that decides)

The scorer (`npm run sim:score`) cannot see the reviewer's work: scores did not change. Measure the reviewer by its own findings.

- Play the seven conversations (`scripts/sim/kit/conversations/`) with the reviewer on. Every finding is written to the transcript (the simulator prints `[revisión ...]` lines and the posted corrections).
- Label each finding by hand against the tool answers as `real`, `false` or `noise`, in a table like the one in 2.1. Precision = real / (real + false). Target before it is on by default: **precision of at least 90 %** with several real findings across the seven runs, and no false finding in front of the person.
- Also seed known mistakes on purpose (a transcript where the coach says three days a week for a daily plan; a source it never found) and check the reviewer reports them: recall on the cases that matter.
- Compare time: the reviewer must never delay the coach's reply (foreground first). Log the foreground latency with and without the reviewer.
- Keep the labelled tables in `docs/plans/` or the ADR as the evidence, not only in chat.

## 7. Risks and decisions to take

- **Freezes.** The PC hard-froze several times under sustained model load (Kernel-Power 41, BugcheckCode 0). An always-on reviewer is sustained load. Mitigation is part of 4.1: caps, the temperature gate, a global off switch, off by default until measured. See section 8.
- **One 8 GB GPU.** Qwen 3.5 9B fills it (about 6.5 GB plus the KV cache); LM Studio's "Keep model in memory" and mmap interact with a ~300 MB free RAM floor. A bigger or second model for the reviewer is not an option on this card; the plan is built so it does not need one.
- **Precision over recall.** When in doubt the reviewer stays silent.
- **Privacy.** `fetch_source` goes through the same web path as the coach's search and obeys the same setting; the reviewer never sends the person's data anywhere.
- **Open:** one slot or two (measure). Whether findings go in the next turn or sooner (a toast?). Whether the background jobs of 4.5 are worth their GPU time (measure).

## 8. The freeze context (so it is not lost)

- Symptom: the whole PC hangs during local model runs. Windows Event Log: Kernel-Power 41, bugcheck 0 (a hard hang, not a crash with a dump).
- Seen: llama-server holds about 7 GB of RAM with the model fully on the GPU, leaving about 300 MB free; a prompt processed at 147 tok/s just before one of the freezes.
- Not changed without asking: the user's LM Studio runtime and settings. Suggestions made to the user: turn off LM Studio "Keep model in memory", try without mmap, lower the GPU power limit.
- Tools for the next freeze (`scripts/sim/kit/diag/`): `telemetry.ps1` writes GPU, CPU, RAM and the current marker every few seconds to a CSV that survives a hang; `after-freeze.ps1` collects the Event Log, the minidumps and the last telemetry into a report folder and prints a summary. `run.sh` starts the logger, waits for the GPU to be below 72 °C before each message, and has a watchdog that stops the run at 87 °C; it writes a marker for every step.
- Run one runner at a time: an earlier batch was left running in the background and reloaded the model after it had been unloaded. Check for stray runners before and after (`Get-CimInstance Win32_Process` for `node` and `bash` whose command line mentions `.sim/` or `lifeui-sim`).

## 9. How to continue on another machine

```bash
git clone <this repo> life-ui && cd life-ui
npm install
npm test                       # 450 passing
npx tsc --noEmit -p . && npx eslint src scripts/sim
```

The simulator talks to a local OpenAI-compatible server (LM Studio, `http://127.0.0.1:1234/v1`, model `qwen/qwen3.5-9b`, context 12288; `SIM_URL`, `SIM_MODEL`, `SIM_CONTEXT`, `SIM_REVIEW=on|off`, `SIM_NOTES`, `SIM_WEB`, `SIM_REASONING` change the defaults). The runners live in `scripts/sim/kit/` and expect to be under `.sim/` (that folder is git-ignored, with the transcripts):

```bash
mkdir -p .sim && cp -r scripts/sim/kit/. .sim/
export LIFEUI_ROOT="$PWD"      # the scripts default to the author's path
lms server start && lms load qwen/qwen3.5-9b --context-length 12288 --gpu max -y

bash .sim/run.sh my1 .sim/conversations/elbow.txt   # one conversation, safe runner
SIM_REVIEW=on bash .sim/run.sh my2 .sim/conversations/gym3.txt
bash .sim/ab-on.sh ab2          # the seven conversations with the reading on, then the scores
bash .sim/ab.sh ab              # without and with: the A/B of section 2.1
npm run sim:score -- .sim/transcripts/my1.txt
lms unload --all                # free the VRAM when done
```

What is in the kit: `run.sh` (safe runner), `run-all.sh`, `ab.sh`, `ab-on.sh`, `ab-resume.sh` (resumes a batch that was cut), `conversations/` (the user's messages: `gym3`, `english2`, `run-plan`, `guitar-plan`, `plain2`, `sleep`, `elbow` are the seven scenarios; `yes`, `change`, `gym`, `gym2` are shorter continuations), `reference/elbow.md` (what the author-as-coach would answer in the elbow case, with the links the answer should carry), `diag/` (section 8). The `.ps1` logger is Windows PowerShell; on another OS replace the telemetry with `nvidia-smi`/`sensors` and keep the markers.

## 10. Other things open from this session

- **The earlier goal is not met:** the 9B model's judgment of *what* a plan holds (one-off task or recurring, balance between phases) varies from run to run in the elbow case, and no general rule closed it. The reviewer here is one way to attack it; the other is to let the code propose the skeleton of a plan (phases and their weeks from the days and the weeks asked) and leave the model only the exercises, doses and links.
- **Portfolio:** the new LifeUI film (`src/assets/motion/lifeui-film-{dark,light}.mp4`, `src/assets/shots/lifeui-film-{dark,light}.webp`, `src/data/projects.ts`) is uncommitted in the portfolio repo, which has its own rules (commits as the owner, no trailers, `main` only, pushing deploys). Whether LifeUI's preview there becomes the video, as KnowGraph's is, is undecided.
- **Deploy:** `npm run deploy` (build, then `wrangler deploy`) publishes `lifeui.medanolabs.com` as a Cloudflare Worker with static assets; `npm run deploy:staging` goes to `lifeui-stg.medanolabs.com`.
