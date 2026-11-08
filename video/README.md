# LifeUI product film

A silent 39-second film of one day in LifeUI, made with
[HyperFrames](https://hyperframes.heygen.com) (HTML and GSAP rendered frame by frame).
Rendered at 1920 x 1200 in a light and a dark edition for the portfolio case study.

Every screen in it is the real app: `tools/capture.cy.ts` plays a day through the
real core under a controlled clock (start the day, run activities one at a time,
close Write report at 9 out of 10, end the day) and writes the rendered DOM of each
beat to `capture/`. The film mounts those captures under the app's own built CSS
and moves a camera and a cursor over them. Storyline choice in `STORYLINES.md`,
shot list and rules in `SPEC.md`.

## Layout

- `scenes/`: the seven scenes (source). `<!-- snap:NAME -->` marks where a
  captured screen goes.
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
npx cypress run --config-file video/tools/cypress.capture.config.ts --config baseUrl=http://localhost:5175
```

The first builds the app (its CSS goes into the film), the second serves it, and the
third captures the screens. Then, in `video/`:

```bash
npm run check
npm run render:light
npm run render:dark
```

The renders land in `video/renders/` (ignored by git).
