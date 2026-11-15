# The product film: the brief, and how it was done

Status (2026-11-15): **done.** The new film is `video/coach/` (HyperFrames, 52 s, light and
dark): the chat, the web search, the plan, the yes, the calendar, the roadmap, a session closed
through the chat, and the ten weeks on the roadmap to Goal reached, all from `capture/`. It
plays on the site (`site/media/lifeui-film-*.mp4`) and in the portfolio. Render it with
`npm run render:light` and `npm run render:dark` in `video/coach/`; the web copies are those
renders re-encoded with `-crf 24 -tune animation -movflags +faststart`, and each poster is the
frame at 20.8 s (the roadmap card waiting on Do it). The rest of this file is the brief it was
made from.

## What was asked

A film of LifeUI as it is now: the person talks to the coach, the coach researches the web,
lays out a plan, makes the tasks for two months or more and the roadmap, the roadmap is
shown, and the person's progress through it is shown to the end, with an animation that
makes it quick and clear. Mocked from the tests' flows is fine. It should feel as well made
as KnowGraph's film (knowgraph.medanolabs.com).

## What was tried, and why it was rejected

Commit `2e76283` added a ninth scene to the film in this folder: ten weeks in four seconds,
the Goals page after each of the fifty sessions, to "Goal reached". Felix watched the render
and rejected it: it has glitches and does not feel smooth or well made. Nobody has listed the
glitches frame by frame yet; the likely causes, from how it was made:

1. **Not rendered by `hyperframes render`.** The Mac it was made on has no `ffprobe`, so each
   frame was taken with `hyperframes snapshot` in batches of 103, each batch a fresh page
   load, and encoded with the ffmpeg inside Cypress at CRF 27. Every 3.4 s the page started
   over (fonts, layout, image decoding), so a jump at the batch edges is likely, and CRF 27
   smears small text.
2. **The time-lapse is fifty hard cuts.** The scene swaps the roadmap's captured HTML fifty
   times in 3.8 s (`FILM.lapse`): bars and numbers jump from one capture to the next instead
   of moving, and text can reflow between captures.
3. **Captured DOM under a zooming camera.** Every scene is the app's DOM, captured, under a
   camera at 1.6 to 2.5x: state changes are cuts on a click frame, and small text is
   scaled up, not laid out at that size.

What did work and can be kept: the capture (`tools/capture-coach.cy.ts`) runs the real agent
and core with a scripted model and real NHS pages, and then runs and closes all fifty
sessions under the clock. `capture/progress.json` has the roadmap after every session with
its date: the real numbers for the progress animation (3%, 47% in week 4, "Calm it down"
reached on Nov 27, "Load it" on Dec 25, 100% and "Goal reached" on Jan 22).

## How to make it well

- **Do it the way KnowGraph's film was made.** Its film recreates the UI inside the
  composition, with the real numbers of one study session, so every change is an animation
  of real elements (a bar that grows, a counter that counts, a check that draws), not a cut
  between screenshots. Its source is not in the KnowGraph repo (`docs/DEPLOY.md` says so):
  find it before starting, and use it as the reference for pace, type size and camera.
- **Recreate the few screens that carry the story** as composition components in the app's
  own tokens (`src/app/styles.css`) and type: the chat with the search card and the plan, the
  roadmap card with Do it, the Goals roadmap. Take their text and numbers from the capture
  (`capture/*.html`, `capture/progress.json`), so nothing is invented.
- **The progress as one continuous animation:** the overall bar and percentage tween from
  0 to 100, each phase's bar fills, its check draws and "Reached on ..." appears on its real
  date, the week and date counter counts, and "Goal reached" lands at the end. About 4 to 6
  seconds, eased, no cuts.
- **Fewer, slower camera moves.** Lay screens out at the size they are read at instead of
  zooming into a 1440 px capture.
- **Render with `hyperframes render`** on a machine with ffmpeg and ffprobe (Felix's Windows
  PC), at the default quality or CRF 18 to 20, in light and dark
  (`npm run render:light`, `npm run render:dark`).
- **QA by watching it play**, both editions, start to end, before it goes anywhere; then the
  frames listed in `SPEC.md`.

## Where it goes when it's done

- `site/media/lifeui-film-light.mp4` and `-dark.mp4`, with a poster of each; then the
  player on `site/index.html` becomes the one on knowgraph.medanolabs.com (the window with
  its chapter strip, light and dark by the system's setting).
- The portfolio: `src/assets/motion/lifeui-film-{light,dark}.mp4`, the still
  `src/assets/shots/lifeui-film-{light,dark}.webp`, and the film's description in
  `src/data/projects.ts` (the gallery entry of LifeUI).
- The README's demo, if it gets one.
