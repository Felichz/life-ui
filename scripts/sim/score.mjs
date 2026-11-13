// Scores a simulator transcript (the .txt written by the conversation runner)
// on checks that need no judgement: what was saved against what was said.
//
//   node scripts/sim/score.mjs <transcript.txt> [more.txt ...]
//
// Exit code 1 when any check fails. Checks that do not apply are "n/a".
/* global process, console */
import fs from "node:fs";

const DAY = { lun: 1, mar: 2, mie: 3, jue: 4, vie: 5, sab: 6, dom: 0 };
const plain = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Weekdays named in a text, by their Spanish abbreviations or full names. */
function weekdays(text) {
  const days = new Set();
  const words = plain(text).split(/[^a-z]+/);
  const dayOf = (word) =>
    word && DAY[word.slice(0, 3)] !== undefined &&
    (word.length === 3 || /^(lunes|martes|miercoles|jueves|viernes|sabado|domingo)$/.test(word))
      ? DAY[word.slice(0, 3)]
      : undefined;
  for (let i = 0; i < words.length; i++) {
    const from = dayOf(words[i]);
    if (from === undefined) continue;
    const to = ["a", "al", "hasta"].includes(words[i + 1]) ? dayOf(words[i + 2]) : undefined;
    if (to === undefined) days.add(from);
    else {
      // "lunes a viernes" is every day in between
      for (let d = from; ; d = (d + 1) % 7) {
        days.add(d);
        if (d === to) break;
      }
      i += 2;
    }
  }
  return days;
}

function parts(text) {
  const [head, state = ""] = text.split("=====STATE");
  const turns = head.split(/^### TÚ$/m).slice(1);
  const person = turns.map((turn) => turn.split(/\n\s*\n/)[0].trim());
  const coach = [...head.matchAll(/^### COACH[^\n]*\n([\s\S]*?)(?=\n--- llamadas|\n### TÚ|$)/gm)].map((m) => m[1]);
  const card = /^> \*\*plan_roadmap\*\* \[done[^\n]*\n((?:> {3}- [^\n]*\n?)+)/m.exec(head);
  const lines = card ? card[1].split("\n").filter(Boolean).map((l) => l.replace(/^> {3}- /, "")) : [];
  return { person, coach, lines, state, head };
}

function score(file) {
  const { person, coach, lines, state, head } = parts(fs.readFileSync(file, "utf8"));
  const results = [];
  const add = (name, ok, detail = "") => results.push({ name, ok, detail });
  const said = person.join(" ");

  const summary = lines.find((l) => /\d+ sesiones/.test(l)) ?? "";
  const phases = lines.filter((l) => /^\d+\. /.test(l));
  const total = Number(/(\d+) sesiones/.exec(summary)?.[1] ?? NaN);
  const counts = phases.map((l) => Number(/× (\d+)/.exec(l)?.[1] ?? NaN));
  add("roadmap saved", lines.length > 0, lines.length ? "" : "no plan_roadmap card");
  if (lines.length === 0) return results;

  add("phases add up to the total", counts.reduce((a, b) => a + b, 0) === total, `${counts.join("+")} vs ${total}`);

  const cardDays = weekdays(summary.split("·")[0]);
  const askedDays = weekdays(said);
  add(
    "days are the ones the person gave",
    askedDays.size < 2 ? true : [...askedDays].sort().join() === [...cardDays].sort().join(),
    askedDays.size < 2 ? "n/a (none given)" : `${[...cardDays]} vs ${[...askedDays]}`
  );

  const weeks = /(\d+)\s*semanas|(\d+)\s*meses/i.exec(said);
  const perWeek = cardDays.size;
  if (weeks && perWeek) {
    const w = weeks[1] ? Number(weeks[1]) : Math.round(Number(weeks[2]) * 4.35);
    add("length near what was asked", Math.abs(total - w * perWeek) <= perWeek * 2, `${total} vs about ${w * perWeek}`);
  } else add("length near what was asked", true, "n/a");

  const last = coach.at(-1) ?? "";
  const stated = [...last.matchAll(/(\d{1,3})\s*sesiones/gi)].map((m) => Number(m[1])).filter((n) => n > 7);
  const right = new Set([total, ...counts]);
  add("coach quotes the saved counts", stated.every((n) => right.has(n)), stated.filter((n) => !right.has(n)).join(", "));

  const minutesAsked = /(\d+)\s*minutos/.exec(said)?.[1];
  const notes = state.split("\n").filter((l) => l.startsWith("- desde"));
  if (minutesAsked && notes.length) {
    const bad = notes.filter((n) => {
      const mins = [...n.matchAll(/\((\d+)\s*min\)|(\d+)\s*min\b/g)].map((m) => Number(m[1] ?? m[2]));
      return mins.length >= 2 && mins.reduce((a, b) => a + b, 0) > Number(minutesAsked) * 1.4;
    });
    add("a session fits its minutes", bad.length === 0, bad.length ? `${bad.length} phase(s) over ${minutesAsked}` : "");
  } else add("a session fits its minutes", true, "n/a");

  const noteText = notes.join("\n");
  add("no load left as a choice", !/\d\s*kg\s+o\s+\d+\s*kg/i.test(noteText), "");
  if (/\d\s*kg/i.test(said)) add("loads are concrete", /\d\s*kg/i.test(noteText), "");

  const afterNotes = noteText.split("⏎").filter((l) => /(^|\s)(cada|elige|escoge)\b/i.test(l)).join(" ");
  const stray = [...weekdays(afterNotes)].filter((d) => !cardDays.has(d));
  add("rules do not name other days", stray.length === 0, stray.join(","));

  const ideal = (state.split("## Vida ideal")[1] ?? "").trim();
  add(
    "ideal life holds no request",
    !/(roadmap|hoja de ruta|anota|investiga|dale\b|tendrias que)/i.test(plain(ideal)),
    ideal.slice(0, 80)
  );
  add("no error in the conversation", !/^> ERROR/m.test(head), "");
  return results;
}

let failed = 0;
for (const file of process.argv.slice(2)) {
  const results = score(file);
  const bad = results.filter((r) => !r.ok);
  failed += bad.length;
  console.log(`\n${file.split(/[\\/]/).pop()}: ${results.length - bad.length}/${results.length}`);
  for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
process.exit(failed > 0 ? 1 : 0);
