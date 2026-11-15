// Builds compositions/app.html: the film's app, made of the real app's DOM as the capture wrote it
// (../capture, from tools/capture-coach.cy.ts: the real agent and core under a controlled clock), under the
// app's own compiled CSS (assets/app.css, copied from the build by this script).
//
// The shell is the last screen of the conversation (c09). What changes in the film is stacked on it as the
// other captures' versions of the same part (the HUD, the panel's pages, the two cards that wait on "Do it"),
// and tools/app.src.html animates between them. Every element the timeline drives gets an id here.
//
// Run from video/coach: node tools/shell.mjs (after `npx vite build` in the repo, for dist/assets/*.css).
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

const CAP = '../capture';
const DIST = '../../dist/assets';

// ---------- the app's CSS: transitions and keyframe animations off (the film seeks, it never plays), fonts
// declared in index.html (where the HyperFrames check looks for them)
const cssFile = fs.readdirSync(DIST).find((f) => /^index-.*\.css$/.test(f));
if (!cssFile) throw new Error('no dist/assets/index-*.css: run `npx vite build` in the repo first');
let css = fs.readFileSync(path.join(DIST, cssFile), 'utf8');
css = css
  .replace(/@font-face\{[^}]*\}/g, '')
  // the film seeks frame by frame: nothing may move on the browser's clock
  .replace(/@keyframes [\w-]+\{(?:[^{}]*\{[^}]*\})*[^{}]*\}/g, '')
  .replace(/(transition|animation)(-[a-z-]+)?:[^;}]*;?/g, '')
  // the film shows no code: one font, the app's own
  .replace(/ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,Liberation Mono,Courier New,monospace/g, 'Inter Variable,monospace');
fs.writeFileSync('assets/app.css', css);

// ---------- the captures
const load = (name) => new JSDOM(`<!doctype html><body>${fs.readFileSync(`${CAP}/${name}.html`, 'utf8')}</body>`).window.document;
const shot = Object.fromEntries(['c01-ask', 'c03-card', 'c04-saved', 'c05-goals', 'c06-notes', 'c07-running', 'c08-close', 'c09-earned', 'c10-progress'].map((n) => [n.slice(0, 3), load(n)]));
const progress = JSON.parse(fs.readFileSync(`${CAP}/progress.json`, 'utf8'));
const doc = shot.c09;

const must = (el, what) => {
  if (!el) throw new Error('not found in the capture: ' + what);
  return el;
};
const q = (root, sel, what = sel) => must(root.querySelector(sel), what);
const byText = (root, sel, text) => must([...root.querySelectorAll(sel)].find((e) => e.textContent.trim() === text), `${sel} "${text}"`);
const adopt = (el) => doc.importNode(el, true);
const id = (el, name) => {
  el.id = name;
  return el;
};
const style = (el, s) => el.setAttribute('style', `${el.getAttribute('style') ?? ''};${s}`.replace(/^;/, ''));
/** The text node holding `text` inside `el`, wrapped in a span with this id. */
const wrapText = (el, text, name) => {
  const walker = el.ownerDocument.createTreeWalker(el, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const i = n.data.indexOf(text);
    if (i < 0) continue;
    const after = n.splitText(i);
    after.splitText(text.length);
    const span = el.ownerDocument.createElement('span');
    span.id = name;
    after.replaceWith(span);
    span.textContent = text;
    return span;
  }
  throw new Error(`text "${text}" not found for #${name}`);
};
const clean = (root) => {
  root.querySelectorAll('*').forEach((e) => {
    // no CSS animation runs in a seeked film, and the clones keep no ids of the app
    [...e.classList].filter((c) => c.startsWith('animate-')).forEach((c) => e.classList.remove(c));
    if (e.id && /^radix-/.test(e.id)) e.removeAttribute('id');
  });
};

// ---------- the shell
const grid = q(doc, '#root > div');
grid.setAttribute('style', '--panel: 490px; width: 1440px; height: 900px');
grid.classList.remove('h-dvh');

// the rail: one highlight that slides between places, a live dot for the running session
const rail = q(grid, 'nav[aria-label="Main"]');
rail.classList.add('relative');
const sel = doc.createElement('span');
id(sel, 'rail-sel');
sel.className = 'absolute rounded-lg bg-hover';
rail.prepend(sel);
for (const [href, name] of [['/', 'rail-today'], ['/goals', 'rail-goals'], ['/library', 'rail-library'], ['/review', 'rail-review']]) {
  const a = [...rail.querySelectorAll('a')].find((x) => x.getAttribute('href') === href && !x.getAttribute('aria-label'));
  id(must(a, 'rail ' + href), name);
  a.classList.remove('bg-hover', 'text-ink');
  a.classList.add('relative', 'text-ink-3');
}
const liveDot = [...shot.c07.querySelectorAll('nav[aria-label="Main"] a[href="/"] span.relative > span')].pop();
if (liveDot) q(rail, '#rail-today span.relative').append(id(adopt(liveDot), 'rail-dot'));

// the HUD: the four states of the bar, stacked
const hudOf = (d) => q(d, '#root > div > div.relative', 'the HUD');
const hud = doc.createElement('div');
id(hud, 'hud');
hud.setAttribute('style', 'grid-area: now; position: relative; height: 64px');
const huds = { 'hud-a': shot.c01, 'hud-b': shot.c04, 'hud-run': shot.c07, 'hud-c': doc };
for (const [name, d] of Object.entries(huds)) {
  const h = d === doc ? hudOf(doc) : adopt(hudOf(d));
  id(h, name);
  style(h, 'position: absolute; inset: 0');
  hud.append(h);
}
grid.insertBefore(hud, q(grid, 'section[aria-label="Chat"]'));
const run = q(hud, '#hud-run');
id(q(run, '[aria-label="Elapsed time"]'), 'run-timer');
const line = q(run, 'div.absolute.inset-x-0');
const [done, over] = line.querySelectorAll(':scope > div');
id(done, 'run-line');
id(over, 'run-over');
id(q(line, ':scope > span'), 'run-tick');
id(q(run, 'section[aria-label="Running"] span.relative > span.absolute'), 'run-ring');
id(q(run, 'section[aria-label="Running"] span.hidden'), 'run-note');
const tpC = q(hud, '#hud-c a[aria-label*="tempos"] span.text-md');
wrapText(tpC, '13', 'hud-tp');
wrapText(q(hud, '#hud-c a[aria-label*="tempos"] span.text-xs:not(.ml-1)'), '13%', 'hud-pct');

// ---------- the chat
const chat = q(grid, 'section[aria-label="Chat"]');
const ctx = q(chat, 'header button[aria-label^="Context"]');
id(ctx, 'ctx');
const scroller = id(q(chat, '[aria-live="polite"]'), 'scroller');
style(scroller, 'overflow: hidden');
const feed = id(q(scroller, ':scope > div'), 'feed');
// the empty chat's greeting, from the first screen: it leaves when the first message is sent
scroller.classList.add('relative');
const hello = doc.createElement('div');
id(hello, 'hello');
hello.className = 'absolute inset-0 flex flex-col px-5 pb-7 pt-4 sm:px-8';
hello.append(adopt(q(shot.c01, '[aria-live="polite"] > div', 'the greeting')));
scroller.append(hello);
feed.classList.add('relative');
const kids = [...feed.children];
const names = ['m-ask', 'm-search', 'm-answer', 'm-reply', 'row1', 'm-done', 'm-close', 'row2', 'm-closed'];
const expect = ['My right elbow', 'Search the web', "I'm not a doctor", 'Weekdays at 9', 'New roadmap', 'Done: 50 sessions', 'Done, it went well', 'Close “Elbow', 'Closed at 9'];
if (kids.length !== names.length) throw new Error(`the chat has ${kids.length} entries, the film expects ${names.length}`);
kids.forEach((k, i) => {
  if (!k.textContent.includes(expect[i])) throw new Error(`chat entry ${i} should start "${expect[i]}": ${k.textContent.slice(0, 60)}`);
  id(k, names[i]);
});
q(feed, '#m-search a', 'a source').parentElement.querySelectorAll('a').forEach((a, i) => id(a, 'src-' + i));
// the cards that wait on "Do it", from the screens where they wait; each swaps to its done row when pressed
const waiting = (d, name) => {
  const btn = byText(q(d, '[aria-live="polite"] > div'), 'button', 'Do it');
  let card = btn;
  while (card.parentElement && !card.parentElement.matches('[aria-live="polite"] > div')) card = card.parentElement;
  card = adopt(card);
  id(card, name);
  id(byText(card, 'button', 'Do it'), name + '-do');
  return card;
};
for (const [n, d] of [['1', shot.c03], ['2', shot.c08]]) {
  const row = q(feed, '#row' + n);
  const swap = doc.createElement('div');
  id(swap, 'sw' + n);
  swap.className = 'lf-swap';
  row.replaceWith(swap);
  swap.append(waiting(d, 'card' + n), row);
}
// the composer: the text area becomes text the film types
const ta = q(chat, 'textarea');
const comp = doc.createElement('div');
comp.className = ta.className;
id(comp, 'comp');
comp.innerHTML = `<span id="ph" class="text-ink-3">${ta.getAttribute('placeholder') ?? 'Tell LifeUI what you want to do…'}</span><span id="ty-ask"></span><span id="ty-reply"></span><span id="ty-close"></span><span id="caret" class="lf-caret"></span>`;
ta.replaceWith(comp);
id(q(chat, 'button[aria-label="Send"]'), 'send');

// ---------- the panel: its pages, stacked
const main = q(grid, 'main');
const panel = doc.createElement('div');
id(panel, 'panel');
panel.className = main.className.replace('overflow-y-auto', 'overflow-hidden').replace('hidden lg:block', 'lg:block');
style(panel, 'position: relative');
const pages = { 'p-today0': shot.c01, 'p-today1': shot.c04, 'p-goals0': shot.c05, 'p-goals1': shot.c06, 'p-run': shot.c07, 'p-today2': doc, 'p-goals2': shot.c10 };
for (const [name, d] of Object.entries(pages)) {
  const m = q(d, 'main');
  const page = doc.createElement('div');
  id(page, name);
  page.className = 'lf-page bg-panel @container';
  page.innerHTML = m.innerHTML;
  panel.append(page);
}
main.replaceWith(panel);

// what grows on each page
const elbowRow = (page) => byText(q(panel, '#' + page), 'p', 'Elbow and back exercises').closest('li');
id(elbowRow('p-today1'), 't1-row');
id(q(panel, '#p-today1 section[aria-labelledby="upcoming-title"]'), 't1-coming');
id(q(panel, '#p-goals1 article li div.rounded-md.bg-subtle'), 'g1-notes');
q(panel, '#p-goals1 article li div.rounded-md.bg-subtle').querySelectorAll('a').forEach((a, i) => id(a, 'g1-how-' + i));
id(q(panel, '#p-goals0 button[aria-label="Show what to do"]'), 'g0-toggle');
id(q(panel, '#p-run div.bg-live\\/5'), 'run-card');
q(panel, '#p-run div.bg-live\\/5').querySelectorAll('a').forEach((a, i) => id(a, 'run-how-' + i));
id(q(panel, '#p-today2 ol[aria-label="Log"] > li'), 't2-log');
// the same "upcoming-title" id exists on several pages: only the shell's own stays unique
panel.querySelectorAll('[id$="-title"]').forEach((e) => e.removeAttribute('id'));

// ---------- the roadmap after the first session (c10): the ten weeks animate it
const rm = q(panel, '#p-goals2 article[aria-label="Right elbow without pain"]');
id(rm, 'rm');
const head = q(rm, 'header');
wrapText(q(head, 'p.text-3xl'), '3', 'rm-pct');
id(q(head, 'p.mt-2 > span'), 'rm-steps');
head.querySelectorAll('div.mt-4 > span > span').forEach((s, i) => id(s, 'seg-' + i));
const finalDoc = new JSDOM(`<body>${progress.at(-1).html}</body>`).window.document;
const check = q(finalDoc, 'article ol > li > span.tabular svg', 'the check of a reached step').outerHTML;
const goal = q(finalDoc, 'article header p.mt-2 > span', 'Goal reached').innerHTML;
const steps = [...rm.querySelectorAll(':scope > ol > li')];
if (steps.length !== 3) throw new Error('the roadmap should have three steps');
const subTpl = q(steps[0], 'div.ml-\\[26px\\]', "the first step's progress");
steps.forEach((li, j) => {
  id(li, 'st-' + j);
  const line = li.querySelector(':scope > span.absolute');
  if (line) id(line, 'st-line-' + j);
  const n = id(q(li, ':scope > span.tabular'), 'st-n-' + j);
  n.innerHTML = `<span id="st-num-${j}">${j + 1}</span><span id="st-ok-${j}" class="lf-ok">${check}</span>`;
  id(q(li, 'h4'), 'st-h-' + j);
  id(q(li, 'h4 + span'), 'st-tag-' + j);
  const row = q(li, 'ul > li > div.flex');
  id(q(row, 'span.truncate'), 'st-act-' + j);
  id(q(row, 'span.tabular'), 'st-cnt-' + j);
  const item = q(li, 'ul > li');
  // every step gets the progress line the current one shows, and keeps its "From …" line
  const sub = j === 0 ? q(item, 'div.ml-\\[26px\\]') : item.appendChild(subTpl.cloneNode(true));
  id(sub, 'st-sub-' + j);
  sub.classList.add('lf-grow');
  id(q(sub, 'span > span'), 'st-bar-' + j);
  id(q(sub, 'p'), 'st-next-' + j);
  const from = item.querySelector(':scope > p');
  if (from) {
    id(from, 'st-from-' + j);
    from.classList.add('lf-grow');
  }
});

clean(grid);

// ---------- the film's own overlays inside the app: the pointer, and the date of the ten weeks
const cursor = `<div id="cursor" class="lf-cursor"><span id="ring" class="lf-ring"></span><svg viewBox="0 0 24 24"><path d="M4 2l15 9-6.5 1.6L9.8 19z" fill="#16161a" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" /></svg></div>`;
const pill = `<div id="date" class="lf-date"><span id="date-d">Mon Nov 16</span><span class="lf-date-w" id="date-w">Week 1</span></div>`;

const src = fs.readFileSync('tools/app.src.html', 'utf8');
const html = src.replace('<!-- SHELL -->', `<div class="lf" id="lf">${grid.outerHTML}${cursor}${pill}</div>`).replace('/* GOAL */ null', JSON.stringify(goal));
fs.writeFileSync('compositions/app.html', html);
console.log(`compositions/app.html: ${(html.length / 1024).toFixed(0)} KB, CSS ${cssFile}`);
