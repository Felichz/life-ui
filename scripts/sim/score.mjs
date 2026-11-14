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
  // "Todos los días" is the seven
  if (/(todos los dias|cada dia|a diario)/.test(plain(text)))
    for (let d = 0; d < 7; d++) days.add(d);
  const words = plain(text).split(/[^a-z]+/);
  const dayOf = (word) =>
    word &&
    DAY[word.slice(0, 3)] !== undefined &&
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
  const coach = [
    ...head.matchAll(/^### COACH[^\n]*\n([\s\S]*?)(?=\n--- llamadas|\n### TÚ|$)/gm),
  ].map((m) => m[1]);
  const card = /^> \*\*plan_roadmap\*\* \[done[^\n]*\n((?:> {3}- [^\n]*\n?)+)/m.exec(head);
  const lines = card
    ? card[1]
        .split("\n")
        .filter(Boolean)
        .map((l) => l.replace(/^> {3}- /, ""))
    : [];
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
  // A phase of one sitting is shown without "× N"
  const counts = phases.map((l) => Number(/× (\d+)/.exec(l)?.[1] ?? 1));
  // A conversation that never tried to build a roadmap has nothing of one to check
  if (lines.length === 0 && !/plan_roadmap/.test(head)) {
    add("roadmap saved", true, "n/a (no roadmap was asked for)");
    add("no error in the conversation", !/^> ERROR/m.test(head), "");
    return results;
  }
  add("roadmap saved", lines.length > 0, lines.length ? "" : "no plan_roadmap card");
  if (lines.length === 0) return results;

  add(
    "phases add up to the total",
    counts.reduce((a, b) => a + b, 0) === total,
    `${counts.join("+")} vs ${total}`
  );

  const cardDays = weekdays(summary.split("·")[0]);
  const askedDays = weekdays(said);
  add(
    "days are the ones the person gave",
    askedDays.size < 2 ? true : [...askedDays].sort().join() === [...cardDays].sort().join(),
    askedDays.size < 2 ? "n/a (none given)" : `${[...cardDays]} vs ${[...askedDays]}`
  );

  const given =
    /a las (\d{1,2})/.exec(plain(said)) ??
    /(\d{1,2}) de la (?:manana|tarde|noche)/.exec(plain(said));
  const shown = /· (\d{2}):\d{2}/.exec(summary);
  add(
    "the hour is the one the person gave",
    !given || (shown !== null && Number(shown[1]) % 12 === Number(given[1]) % 12),
    given ? `said ${given[1]}, card ${shown ? shown[1] : "none"}` : "n/a"
  );

  // Numbers said in words count too: "en tres meses", "dos semanas"
  const WORDS = {
    un: 1,
    una: 1,
    uno: 1,
    dos: 2,
    tres: 3,
    cuatro: 4,
    cinco: 5,
    seis: 6,
    siete: 7,
    ocho: 8,
    nueve: 9,
    diez: 10,
    doce: 12,
  };
  const numbered = plain(said).replace(
    /\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|doce)\s+(semanas?|mes(?:es)?)\b/g,
    (_, n, unit) => `${WORDS[n]} ${unit}`
  );
  const weeks = /(\d+)\s*semanas?\b|(\d+)\s*mes(?:es)?\b/i.exec(numbered);
  const perWeek = cardDays.size;
  if (weeks && perWeek) {
    const w = weeks[1] ? Number(weeks[1]) : Math.round(Number(weeks[2]) * 4.35);
    add(
      "length near what was asked",
      Math.abs(total - w * perWeek) <= perWeek * 2,
      `${total} vs about ${w * perWeek}`
    );
  } else add("length near what was asked", true, "n/a");

  const last = coach.at(-1) ?? "";
  const stated = [...last.matchAll(/(\d{1,3})\s*sesiones/gi)]
    .map((m) => Number(m[1]))
    .filter((n) => n > 7);
  const right = new Set([total, ...counts]);
  add(
    "coach quotes the saved counts",
    stated.every((n) => right.has(n)),
    stated.filter((n) => !right.has(n)).join(", ")
  );

  const minutesAsked = /(\d+)\s*minutos/.exec(said)?.[1];
  const notes = state.split("\n").filter((l) => l.startsWith("- desde"));
  if (minutesAsked && notes.length) {
    // Line by line: a line that gives its own total ("x 4 = 16 min") counts that
    // total; an interval ("1 min run / 4 min walk") without one is not summed
    const minutesOf = (line) => {
      if (/^[\s*-]*(total|regla|rule|progres|objetiv|nota|note|si |if )/i.test(line.trim()))
        return 0;
      const total = /=\s*(\d+)\s*min/.exec(line);
      if (total) return Number(total[1]);
      if (/\d\s*min[^/]*\/[^/]*\d\s*min/.test(line)) return 0;
      return [...line.matchAll(/(\d+)\s*min\b/g)].reduce((sum, m) => sum + Number(m[1]), 0);
    };
    // A line per week ("Semana 2: … = 30 min") is that week's whole session: the longest counts
    const weekLine = (l) => /^[\s*-]*(semanas?|weeks?|d[ií]as?|days?)\s*\d/i.test(l.trim());
    const bad = notes.filter((n) => {
      const session = n.split("⏎  ⏎")[0];
      const lines = session.split("⏎").map((l) => l.replace(/^- desde [^·]*· /, ""));
      const parts = lines
        .filter((l) => !weekLine(l))
        .map(minutesOf)
        .filter((m) => m > 0);
      const weeks = lines.filter(weekLine).map(minutesOf);
      const total = parts.reduce((a, b) => a + b, 0) + Math.max(0, ...weeks);
      return parts.length + (weeks.length ? 1 : 0) >= 2 && total > Number(minutesAsked) * 1.1;
    });
    add(
      "a session fits its minutes",
      bad.length === 0,
      bad.length ? `${bad.length} phase(s) over ${minutesAsked}` : ""
    );
  } else add("a session fits its minutes", true, "n/a");

  const noteText = notes.join("\n");
  add("no load left as a choice", !/\d\s*kg\s+o\s+\d+\s*kg/i.test(noteText), "");
  if (/\d\s*kg/i.test(said)) add("loads are concrete", /\d\s*kg/i.test(noteText), "");

  const afterNotes = noteText
    .split("⏎")
    .filter((l) => /(^|\s)(cada|elige|escoge)\b/i.test(l))
    .join(" ")
    // "Cada día…" in a rule says what holds every session, not a schedule
    .replace(/cada d[ií]a|todos los d[ií]as/gi, "");
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
  for (const r of results)
    console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.detail ? `  (${r.detail})` : ""}`);
}
process.exit(failed > 0 ? 1 : 0);
