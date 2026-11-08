# SPEC: LifeUI, a day in forty seconds

GOAL: a stranger sees the whole loop of the app (start, plan, run one thing,
close it honestly, earn tempos, look back) and remembers one moment:
picking 9 out of 10 and watching +78 tempos land.
OUTPUT: HyperFrames, 1920 x 1200 (the portfolio's 16:10 clip frame), 30 fps,
rendered twice: `theme=light` and `theme=dark`. Silent.
TIME: 38.9 s x 30 = 1167 frames.

LOOK: the app's own world. Ground: the app canvas token (`--canvas`).
Product: the real app, its DOM captured from the build
(`tools/capture.cy.ts`) under the build's own CSS, shown 1:1 in a
1440 x 1200 window at x = 480 with a 1 px `--line` edge and a soft
left shadow (-24 px x, 64 px blur, 25%). Titles in the 96 px left
column: Inter Variable 640, 64 px, -0.03 em, `--ink`; one accent word
in `--accent-ink`; a time readout under it, 40 px tabular, `--ink-2`.
Indigo only on the clicked thing and the accent word; amber only on
tempos. No other colour, grain or glow.
OBJECTS: the app's Today screen, the focus card with its clock, the closing
dialog with its 0-10 scale and reward preview, the tempo meter, the
Review chart; a 56 px arrow cursor (white fill, `--ink` stroke).
MOTION: camera moves 0.5-0.6 s `expo.inOut`; title wipes 0.45 s `expo.out`
(clip-path, left to right); clicks: cursor 0.08 s down to 0.86, 0.12 s
back; counters 0.9-1.2 s `power2.out`; snapshot state changes are cuts
on the click frame, time-lapse changes are 0.3 s dissolves.

SHOTS:
0.0-2.1 start Start screen, "8:12 AM". The cursor enters and clicks
Start the day at 1.9 s; the click cuts to the plan.
2.1-7.3 plan Today with its plan. Push into the blocks; the camera
settles on the locked Evening rows: "Later blocks open
at their hour".
7.3-13.3 morning Meditate running at 8:44, then the log after the morning
(dissolve). The readout follows the screen: 8:44, then 11:40.
13.3-23.3 close 3:23 PM, Write report running. Push into the card, click
Finish: the closing ritual. Click 9: +60 counts to +78.
Click Save.
23.3-28.9 earned The tempo meter: 27 to 105, the bar passes the reference.
28.9-34.4 review The day's Review; the trend bars rise as the camera pans.
34.4-38.9 end The mark is drawn, LifeUI wipes in, the URL holds 2 s.

BANNED: dark void with floating UI; glow, particles, gradients, glass; a title
over a dimmed screenshot; three cards in a row; everything fading and
sliding up; text moving while read; the logo docked in a corner;
invented UI (every screen is a capture of the real app).
QA: frames 1.0 (start + cursor), 5.5 (locks legible), 11.0 (log),
17.0 (dialog, score 7), 19.5 (score 9, +78), 25.5 (105 tempos),
32.0 (trend chart), 38.0 (end card), in both themes.
