// Measures the chat's scroll in the film, for the site's player: on ../../site it draws a real scroll box over
// the video, where the chat is, and scrolls it with the film (the visitor's own browser draws the scrollbar).
//
// It mounts compositions/app.html outside HyperFrames, seeks its timeline frame by frame (30 fps) and writes,
// per frame, in the 1920 x 1200 frame's pixels: the scroller's box [x, y, w, h], the height of what it holds
// and how far it has scrolled. Both editions lay out the same, so it measures the light one.
//
// Run from video/coach after tools/shell.mjs, with Playwright and Chrome on the machine:
//   PLAYWRIGHT=<path to a playwright package> node tools/scroll.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT ?? 'playwright');
const dir = path.resolve('.').split(path.sep).join('/') + '/';
const OUT = '../../site/media/lifeui-film-scroll.json';

const idx = fs.readFileSync('index.html', 'utf8');
// the head without the edition's script, which needs the HyperFrames runtime
const head = idx.slice(idx.indexOf('<head>') + 6, idx.indexOf('</head>')).replace(/<script>[\s\S]*?LF\.theme\(\);[\s\S]*?<\/script>/, '');
const app = fs.readFileSync('compositions/app.html', 'utf8');
const tpl = app.slice(app.indexOf('<template>') + 10, app.lastIndexOf('</template>'));

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage({ viewport: { width: 1920, height: 1200 } });
// a file:// page first, so the content below may load the film's local files
await page.goto('file:///' + dir + 'index.html');
await page.setContent(`<!doctype html><html lang="en" data-theme="light"><head><base href="file:///${dir}">${head}</head><body><div id="root"></div></body></html>`);
await page.evaluate(async (tpl) => {
  window.__timelines = {};
  window.__hfVariables = { theme: 'light' };
  LF.theme();
  // the layout is measured when the composition's script runs: the font must be in first
  await document.fonts.load('16px "Inter Variable"');
  const holder = document.createElement('div');
  holder.innerHTML = tpl;
  const scripts = [...holder.querySelectorAll('script')];
  scripts.forEach((s) => s.remove());
  document.getElementById('root').append(...holder.childNodes);
  for (const s of scripts) {
    const n = document.createElement('script');
    n.textContent = s.textContent;
    document.body.appendChild(n);
  }
}, tpl);

const rows = await page.evaluate(() => {
  const tl = window.__timelines.app;
  const sc = document.getElementById('scroller'), feed = document.getElementById('feed');
  const padB = parseFloat(getComputedStyle(sc).paddingBottom);
  const q = (n) => Math.round(n * 10) / 10;
  const rows = [];
  for (let f = 0; f <= Math.round(tl.duration() * 30); f++) {
    tl.seek(f / 30, false);
    const r = sc.getBoundingClientRect();
    const k = r.height / sc.clientHeight; // the stage's scale times the camera's
    const top = -new DOMMatrix(getComputedStyle(feed).transform).m42; // the chat scrolls by moving its list
    // what the list holds: the entries already in (an entry joins at opacity 0), down to the bottom padding
    let bottom = 0;
    for (const c of feed.children) if (parseFloat(getComputedStyle(c).opacity) > 0.02) bottom = Math.max(bottom, c.offsetTop + c.offsetHeight);
    const content = Math.max(sc.clientHeight, feed.offsetTop + bottom + padB, top + sc.clientHeight);
    rows.push([q(r.left), q(r.top), q(r.width), q(r.height), q(content * k), q(top * k)]);
  }
  return rows;
});
await browser.close();

fs.writeFileSync(OUT, JSON.stringify({ fps: 30, frame: [1920, 1200], rows }) + '\n');
console.log(`${OUT}: ${rows.length} frames`);
