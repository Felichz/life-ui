# SPEC: LifeUI, from the chat to the calendar

GOAL: a stranger sees what LifeUI is now, a coach in a chat that changes the
day for you, and remembers one moment: a sentence about a sore elbow becomes
50 sessions on the calendar, each one with its exercises and the guide that
shows them.
OUTPUT: HyperFrames, 1920 x 1200 (the portfolio's 16:10 clip frame), 30 fps,
rendered twice: `theme=light` and `theme=dark`. Silent.
TIME: 44.5 s x 30 = 1335 frames.

LOOK: the app's own world. Ground: the app canvas token (`--canvas`).
Product: the real app, its DOM captured from the build
(`tools/capture-coach.cy.ts`: the real agent and core, a scripted model, the
web search answered with real NHS pages) under the build's own CSS. The 1440 x
1200 capture fills the frame at 4/3 (home); the camera pushes in from there.
The chat column (x 1029-1440 of the capture) is read at 2.3-2.5x.
Captions: the pill at the bottom centre (`.f-cap`), Inter 650, 32 px, one
accent word in `--accent-ink`. Indigo only on the clicked thing and the
accent word; amber only on tempos. No other colour, grain or glow.
OBJECTS: the Today screen with its chat, the search card with its sources,
the coach's plan, the roadmap card waiting on "Do it", the Goals page with a
phase's exercises and their links, the running session with its exercises,
the close card with its tempos, the tempo meter; a 56 px arrow cursor
(white fill, `--ink` stroke).
MOTION: camera moves 0.5-0.7 s `expo.inOut`; reading pans 2.5-3.5 s
`power1.inOut`; clicks: cursor 0.08 s down to 0.86, 0.12 s back, a ring;
typing is a left-to-right reveal of the composer's text, 2.2 s, `none`;
snapshot state changes are cuts on the click frame; counters 0.9-1.2 s
`power2.out`.

SHOTS:
0.0-6.0 ask Monday 8:40, Today with its chat. Push into the composer;
the message types itself in; the cursor clicks Send at 5.3 s.
"Tell it what is going on".
6.0-14.0 answer The coach's answer: the search card with its NHS sources,
then a slow pan down the plan (three phases, the question at
the end). "It looks it up", then "and lays out a plan".
14.0-20.0 card "Weekdays at 9, before work". The roadmap card waits: the
camera settles on it, the cursor clicks Do it at 18.4 s.
"Nothing changes without your yes".
20.0-24.0 saved The card is done and the coach says what is on the calendar.
"50 sessions on your calendar".
24.0-31.0 goals Goals: the roadmap, its three phases. The cursor opens what a
session of the first phase holds (cut at 27.2 s): exercises
with their guide links. "Each one says what to do".
31.0-36.0 run 9:11, the first session runs, its exercises on screen. The
camera moves to the composer: "Done, it went well. A 9."
"9:00. The first session".
36.0-40.0 close The close card shows its tempos; the cursor clicks Do it at
37.6 s; the coach confirms, the meter shows the day.
"Closed honestly, in a sentence".
40.0-44.5 end The mark is drawn, LifeUI wipes in, the URL holds 2 s.

BANNED: dark void with floating UI; glow, particles, gradients, glass; a title
over a dimmed screenshot; three cards in a row; everything fading and sliding
up; text moving while read (pans stop before a caption is read); the logo
docked in a corner; invented UI (every screen is a capture of the real app,
the conversation is a scripted run of the real agent).
QA: frames 3.0 (composer typing), 8.0 (sources legible), 12.5 (plan phases),
18.0 (card and Do it), 22.0 (the coach's summary), 29.0 (exercise links),
33.0 (running session), 38.5 (close card, tempos), 42.5 (end card), in both
themes.
