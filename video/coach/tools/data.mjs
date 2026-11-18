// Writes assets/data.js: everything the film shows that comes from the app, taken from the capture in
// ../capture (tools/capture-coach.cy.ts runs the real agent and core under a controlled clock).
// - The progress of the roadmap after each of the fifty sessions, from capture/progress.json.
// - The chat's texts, written here and checked word for word against the captured screens, so the
//   film cannot drift from what the app said. Run: node tools/data.mjs (from video/coach).
import fs from 'node:fs';

const CAP = '../capture';
const strip = (h) =>
  h
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const norm = (s) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim();

// ---------- the chat, as the app wrote it
const chat = {
  ask: 'My right elbow hurts on the outside after long days at the mouse, and my back sometimes too. Can you look up exercises and plan it for me?',
  search: 'tennis elbow exercises NHS patient leaflet',
  sources: [
    ['Tennis elbow: advice and exercises (Oxford University Hospitals, NHS)', 'ouh.nhs.uk'],
    ['Tennis elbow (University Hospitals Plymouth, NHS)', 'plymouthhospitals.nhs.uk'],
    ['Tennis elbow exercise booklet (NHS Right Decisions)', 'rightdecisions.scot.nhs.uk'],
    ['Computer workstations (OSHA)', 'osha.gov'],
  ],
  // the answer: paragraphs and the numbered plan; [bold, rest]
  answer: [
    { p: [null, "I'm not a doctor and this isn't a diagnosis, but pain on the outside of the elbow of the mouse arm is the classic overload pattern, and the NHS guides agree on what helps."] },
    { p: ['Change today:', 'elbow near 90°, the mouse close, the Mac raised with an external keyboard and mouse, a short break every 30 to 45 minutes.'] },
    { p: ['A 10-week plan, about 10 minutes a session', '(most people improve in 8 to 12 weeks):'] },
    {
      ol: [
        ['Weeks 1–2, calm it down:', 'isometric wrist hold 5 × 30 s, forearm stretch 3 × 10 s.'],
        ['Weeks 3–6, load it:', 'eccentric wrist extension 3 × 15 with a 0.5 L bottle.'],
        ['Weeks 7–10, make it strong:', 'the same with 1–2 kg, plus grip 3 × 10.'],
      ],
    },
    { p: [null, 'Every session will carry the link to the guide that shows its exercises. See a physio first if you have tingling, pain at night or swelling.'] },
    { p: [null, 'Which days, and at what time?'] },
  ],
  reply: 'Weekdays at 9, before work. No tingling. Go ahead.',
  roadmap: {
    title: 'New roadmap: “Right elbow without pain”',
    meta: 'Mon, Tue, Wed, Thu, Fri · 09:00 · 50 sessions, Mon Nov 16 to Fri Jan 22',
    lines: [
      '1. Calm it down: Elbow and back exercises × 10 (Mon Nov 16 → Fri Nov 27)',
      '2. Load it: Elbow and back exercises × 20 (Mon Nov 30 → Fri Dec 25)',
      '3. Make it strong: Elbow and back exercises × 20 (Mon Dec 28 → Fri Jan 22)',
      'New library activity: “Elbow and back exercises” (~10 min)',
    ],
  },
  done: "Done: 50 sessions, weekdays at 9:00 from today, in three phases (10, 20 and 20). Each one shows its exercises with the guide's link, and you'll find it all under Goals.",
  close: 'Done, it went well.',
  closeCard: ['Close “Elbow and back exercises”'],
  // the session's guide, as Goals and the running card show it
  steps: [
    ['Isometric wrist hold: 5 × 30 s, gentle', true],
    ['Forearm stretch: 3 × 10 s', true],
    ['Back mobility, cat and cow: 1 min', false],
    ['If the pain goes over 3/10 or lasts to the next day, go back to the previous load.', false],
    ['Bad day: only the isometric hold, 2 minutes.', false],
  ],
};

// every text must be on the captured screen it comes from
const shots = Object.fromEntries(fs.readdirSync(CAP).filter((f) => /^c\d+.*\.html$/.test(f)).map((f) => [f, norm(strip(fs.readFileSync(`${CAP}/${f}`, 'utf8')))]));
const all = Object.values(shots).join(' ');
const texts = [
  chat.ask, chat.search, ...chat.sources.flat(), chat.reply, chat.roadmap.title, chat.roadmap.meta, ...chat.roadmap.lines, chat.done, chat.close, ...chat.closeCard,
  ...chat.answer.flatMap((b) => (b.p ? [b.p.filter(Boolean).join(' ')] : b.ol.map((li) => li.join(' ')))),
  ...chat.steps.map(([s]) => s),
];
const missing = texts.filter((t) => !all.includes(norm(t)));
if (missing.length) {
  console.error('Not on any captured screen:\n' + missing.map((m) => ' - ' + m).join('\n'));
  process.exit(1);
}

// ---------- the progress, session by session
const progress = JSON.parse(fs.readFileSync(`${CAP}/progress.json`, 'utf8'));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const sessions = progress.map((s) => {
  const t = strip(s.html);
  const pct = Number((t.match(/· 09:00 (\d+) %/) || [])[1]);
  if (!Number.isFinite(pct)) throw new Error('no percentage for ' + s.date);
  const d = new Date(s.date + 'T12:00:00Z');
  return { date: s.date, label: `${DAY[d.getUTCDay()]} ${MON[d.getUTCMonth()]} ${d.getUTCDate()}`, done: s.done, pct };
});
const last = strip(progress.at(-1).html);
const phases = [
  ['Calm it down', 10],
  ['Load it', 20],
  ['Make it strong', 20],
].map(([name, total], i) => {
  const m = last.match(new RegExp(name + ' Reached on ([A-Z][a-z]{2} \\d+)'));
  if (!m) throw new Error('no reached date for ' + name);
  return { name, total, reached: m[1], until: [10, 30, 50][i] };
});
if (!/Goal reached/.test(last)) throw new Error('the last session should read "Goal reached"');

fs.writeFileSync(
  'assets/data.js',
  `/* generated by tools/data.mjs from ../capture (the real app under a controlled clock): do not edit */\nwindow.DATA = ${JSON.stringify({ chat, sessions, phases }, null, 1)};\n`,
);
console.log(`data.js: ${texts.length} texts checked against the capture, ${sessions.length} sessions, phases reached ${phases.map((p) => p.reached).join(', ')}`);
