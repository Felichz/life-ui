# LifeUI product film

A silent 33-second film, "From the chat to the calendar", made with
[HyperFrames](https://hyperframes.heygen.com) (HTML and GSAP rendered frame by frame) in
`coach/`. Rendered at 1920 x 1200 in a light and a dark edition, for the site and the
portfolio case study.

Every screen in it is the real app: `tools/capture-coach.cy.ts` runs one conversation
through the real agent and core under a controlled clock, at 1440 x 900. A scripted model
stands in for the LLM and the web search is answered with real NHS pages, as in the
end-to-end tests. The person asks about a sore elbow, the coach looks it up and lays out a
plan, the roadmap card waits on "Do it", Goals shows each session's exercises with the guide
links, and the first session runs at 9:00 and is closed through the chat. Then every
weekday's session for ten weeks is run and closed through the core, and the roadmap is
captured after each one, to "Goal reached".

## Layout

- `capture/`: the captured screens (`c01` to `c10`) and `progress.json`, the roadmap after
  each of the fifty sessions with its date (generated).
- `coach/tools/data.mjs`: checks every text the film relies on against the captures and
  writes `coach/assets/data.js` (the sessions and phases with their real numbers).
- `coach/tools/shell.mjs`: builds `coach/compositions/app.html` from
  `coach/tools/app.src.html`: the shell is the last screen of the conversation, with the
  other captures' versions of the HUD, the panel's pages and the two waiting cards stacked
  on it, each part the timeline drives given an id. It also copies the app's built CSS to
  `coach/assets/app.css`, with every transition and keyframe animation taken out (the film
  is seeked frame by frame).
- `coach/tools/app.src.html`: the timeline: the camera, the chat that scrolls as messages
  join, typing, the pointer, the panel's pages, the HUD's states and the ten weeks as one
  continuous animation of the roadmap. `coach/compositions/end.html` is the end card.

## Make it

From the repository root:

```bash
npx vite build
npx vite --port 5174 --strictPort
npx cypress run --browser chrome --config-file video/tools/cypress.capture.config.ts --spec video/tools/capture-coach.cy.ts
```

The first builds the app (its CSS goes into the film), the second serves it as a dev
build (the scripted model only answers outside production), and the third captures the
screens. Then, in `video/coach/`:

```bash
npm run check
npm run render:light
npm run render:dark
```

The renders land in `video/renders/` (ignored by git).
