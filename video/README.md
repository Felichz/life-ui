# LifeUI product film

A silent 44.5-second film, "From the chat to the calendar", made with
[HyperFrames](https://hyperframes.heygen.com) (HTML and GSAP rendered frame by frame).
Rendered at 1920 x 1200 in a light and a dark edition for the portfolio case study.

Every screen in it is the real app: `tools/capture-coach.cy.ts` runs one conversation
through the real agent and core under a controlled clock. A scripted model stands in for
the LLM and the web search is answered with real NHS pages, as in the end-to-end tests.
The person asks about a sore elbow, the coach looks it up and lays out a plan, the
roadmap card waits on "Do it", Goals shows each session's exercises with the guide
links, and the first session runs at 9:00 and is closed through the chat. The rendered
DOM of each beat goes to `capture/`; the film mounts those captures under the app's own
built CSS and moves a camera and a cursor over them. Storyline choice in
`STORYLINES.md`, shot list and rules in `SPEC.md`. The first film (a day in forty
seconds) is in the git history before this one.

## Layout

- `scenes/`: the eight scenes (source): seven written by `tools/scenes-coach.py` (the camera
  script of each is there) and `end.html`. `<!-- snap:NAME -->` marks where a captured
  screen goes.
- `compositions/`: the scenes with their captures inlined (generated).
- `capture/`: the captured screens and `rects.json`, where each scene aims
  (generated, measured at capture time).
- `assets/film.css`, `assets/film.js`: the film's layout and its camera, cursor
  and counter helpers. `assets/app.css` and `assets/rects.js` are generated.
- `tools/build.mjs`: assembles `compositions/`, `assets/app.css` and
  `assets/rects.js`.

## Make it

From the repository root:

```bash
npm run build
npx vite --port 5175 --strictPort
npx cypress run --config-file video/tools/cypress.capture.config.ts --spec video/tools/capture-coach.cy.ts --config baseUrl=http://localhost:5175
```

The first builds the app (its CSS goes into the film), the second serves it as a dev
build (the scripted model only answers outside production), and the third captures the
screens. Then, in `video/`:

```bash
npm run check
npm run render:light
npm run render:dark
```

The renders land in `video/renders/` (ignored by git).
