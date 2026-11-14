# Reference: elbow and back pain (Felix, 2026-11-13)

The coach's turns as Claude would play them, to compare Qwen against. One section per turn.

## Turn 1

**Person:** pain in the elbow and sometimes the back; programmer, long hours at the same desk, PC with USB keyboard and mouse, Mac with touchpad. Asks for a short- and long-term plan, what kind of exercises, and to research it.

**In the app:**
- `web_search` ×2 (the person asked): exercise evidence for lateral elbow pain in mouse users; computer workstation ergonomics (elbow, mouse, laptop, back, breaks).
- Nothing else: no task, no roadmap (where it hurts and how much time they have are unknown, and there is no yes yet). No ideal-life note yet.

**What the reply does (the checklist to compare against):**
1. Says it is not a doctor and this is not a diagnosis, once, without lecturing.
2. Leads with what the search found, and says how solid each part is (systematic review / BMJ vs. a vendor's page).
3. Short term, concrete and safe without knowing more: elbow near 90°, not resting the inner elbow on the desk edge, mouse close and moved from the elbow, laptop raised with an external keyboard and mouse (the touchpad for hours is what guides say to avoid), short breaks (and that sources disagree on how often).
4. Long term: progressive loading (eccentric wrist extensors) as the best-supported option for the outer-elbow pattern; the 3×15, pain ≤ 2–3/10 dose marked as from a vendor; for the back, less unbroken sitting and general strength.
5. Red flags, when to see a professional now: tingling or numbness in the fingers, night pain, swelling, no improvement in 2–3 weeks.
6. Asks two questions only, the ones that change the plan: where exactly and which arm (and tingling), and how much time a day and when.
7. Says what it will propose next (6–8 week plan) and does not build anything yet.
8. Names its sources.

**Proposed next, after answers and a yes:** a repeated active break during the workday (`plan_ahead`), and a 6–8 week exercise roadmap (`plan_roadmap`) with phases: learn the movements, progressive load, maintenance, with a bad-day version.

**Reply text (Spanish), as given:** see the conversation of 2026-11-13; the sections above are what any reply should cover, in any words.

## Turn 2

**Person:** outer elbow, right arm (the mouse arm). Asks that every task it creates carries a link to a guide showing how the exercise is done. Did not say days, time, or tingling.

**In the app:**
- `web_search`: NHS patient leaflets on tennis-elbow exercises with pictures (isometric, eccentric wrist extension, stretch).
- Nothing saved: no days and no yes yet.

**What the reply does:**
1. Names the pattern (outer elbow of the mouse arm, the "tennis elbow" kind) without calling it a diagnosis.
2. Says how long it takes, from a source (most people improve in 8–12 weeks), and sizes the plan to it (10 weeks).
3. Gives the whole plan, about 10 minutes a session: phase 1 (weeks 1–2) isometric wrist extension 5 × 30–45 s at low effort, forearm stretch 3 × 10 s, 1 min back mobility; phase 2 (weeks 3–6) eccentric wrist extension 3 × 15, 3 s down, with a 0.5 L bottle, up to 1 L when the next-day pain stays at 3/10 or less; phase 3 (weeks 7–10) 1–2 kg, grip squeeze 3 × 10, a short plank; a bad-day version (isometric only, 2 min).
4. Promises a guide link in every session's notes, as asked.
5. Adds a one-time setup task (desk: raised Mac, external keyboard and mouse, elbow near 90°).
6. Asks only what the app still needs and one safety check: which days and at what time (suggests daily or weekdays, before starting work, as a fixed cue), and tingling in the fingers (see a physio first if so).
7. Asks for the yes.

**After yes and days (what the app should end with):**
- `plan_roadmap`: "Codo derecho sin dolor", one activity (~10 min), 3 phases over 10 weeks on the given days and time, each phase's notes listing its exercises with a Markdown link to an NHS leaflet; rules: back off a load when pain > 3/10 or lasts to the next day; bad-day version.
- `add_to_plan`: "Ajustar el escritorio" (~15 min) today, its checklist in the notes, with the OSHA link.
- Then tells what is on the calendar from the tool's answer.

**Links used:** OUH (isometric, stretch) https://www.ouh.nhs.uk/media/lsjlro5o/85220advice.pdf ; Plymouth (eccentric) https://www.plymouthhospitals.nhs.uk/display-pil/pil-tennis-elbow-4079 ; Leicestershire https://www.leicspart.nhs.uk/wp-content/uploads/2026/06/LPT-CHSMSK17-Tennis-Elbow.pdf ; NHS Right Decisions booklet https://rightdecisions.scot.nhs.uk/media/je5g5qzk/tennis-elbow-exercise-booklet.pdf ; OSHA https://osha.gov/etools/computer-workstations/additional-information

**New requirement from this turn (general, not this case's):** when the coach looked something up, the tasks and sessions it creates carry the link to the guide in their notes.

## Turn 3 (simulated by Claude as Felix: his answer had not come)

**Person:** Monday to Friday at 9, before starting work; no tingling; yes, build it.

**In the app (the end state to compare against):**
- `plan_roadmap`: weekdays (mon–fri) at 09:00, starting on the next weekday, 10 weeks = 50 sessions; 3 phases of 2, 4 and 4 weeks = 10, 20, 20 sessions; one activity of ~10 min; each phase's notes list its exercises with numbers (sets, reps or seconds, load) and a Markdown link to a guide for each; rules with the pain limit (3/10, back off) and the bad-day version.
- `add_to_plan`: a one-time desk setup task today, with its checklist and a link.

**What the reply does:** says what is on the calendar from the tool's answer (days, time, first and last date, how many), where to see it, and nothing more to ask.
