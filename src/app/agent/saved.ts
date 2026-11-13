import type { ChatMessage } from "./llm";

/**
 * What a roadmap was saved with, read from the tool's own answer, to check
 * what the coach then tells the person. The card shows the right numbers; a
 * 9B model quoted them wrong in its reply ("20 sessions from Monday the 16th"
 * for 21 from Friday the 13th). The answer is the truth, the reply is checked
 * against it.
 */
export interface SavedFacts {
  /** The session counts that are right to say: the total, and each phase's. */
  counts: Set<number>;
  /** The dates that are right to say, as "13-nov". */
  dates: Set<string>;
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const FULL: Record<string, string> = {
  enero: "ene",
  febrero: "feb",
  marzo: "mar",
  abril: "abr",
  mayo: "may",
  junio: "jun",
  julio: "jul",
  agosto: "ago",
  septiembre: "sep",
  setiembre: "sep",
  octubre: "oct",
  noviembre: "nov",
  diciembre: "dic",
};

const monthOf = (word: string): string | null => {
  const lower = word.toLocaleLowerCase();
  if (FULL[lower]) return FULL[lower];
  return MONTHS.includes(lower.slice(0, 3)) && lower.length <= 4 ? lower.slice(0, 3) : null;
};

/** "vie 13 nov" as "13-nov". */
function dateOf(label: unknown): string | null {
  if (typeof label !== "string") return null;
  const match = /(\d{1,2})\s+([a-záéíóú]{3,10})\.?/i.exec(label);
  const month = match ? monthOf(match[2]) : null;
  return match && month ? `${Number(match[1])}-${month}` : null;
}

/** The facts of the roadmaps saved in this turn (after the person's last message), or null. */
export function savedFacts(history: ChatMessage[]): SavedFacts | null {
  const from = history.map((message) => message.role).lastIndexOf("user");
  const counts = new Set<number>();
  const dates = new Set<string>();
  for (const message of history.slice(from + 1)) {
    if (message.role !== "tool" || typeof message.content !== "string") continue;
    let answer: { sessions?: unknown };
    try {
      answer = JSON.parse(message.content) as { sessions?: unknown };
    } catch {
      continue;
    }
    if (!Array.isArray(answer.sessions)) continue;
    for (const roadmap of answer.sessions as Array<Record<string, unknown>>) {
      if (typeof roadmap.total === "number") counts.add(roadmap.total);
      for (const key of ["first", "last"]) {
        const date = dateOf(roadmap[key]);
        if (date) dates.add(date);
      }
      const phases = Array.isArray(roadmap.milestones)
        ? (roadmap.milestones as Array<Record<string, unknown>>)
        : [];
      for (const phase of phases) {
        if (typeof phase.sessions === "number") counts.add(phase.sessions);
        for (const key of ["from", "to"]) {
          const date = dateOf(phase[key]);
          if (date) dates.add(date);
        }
      }
    }
  }
  return counts.size > 0 || dates.size > 0 ? { counts, dates } : null;
}

/**
 * What a reply says about the saved roadmap that the answer does not: a
 * session count that is none of the saved ones (small numbers are the days
 * a week and are left alone), and a date that is none of the saved ones.
 */
export function disagreements(reply: string, facts: SavedFacts): string[] {
  const wrong: string[] = [];
  for (const found of reply.matchAll(/(\d{1,3})\s*(?:sesiones|sessions)\b/gi)) {
    const count = Number(found[1]);
    if (count > 7 && !facts.counts.has(count)) wrong.push(`${count} sessions`);
  }
  if (facts.dates.size > 0) {
    for (const found of reply.matchAll(/(\d{1,2})\s+(?:de\s+)?([a-záéíóú]{3,10})\.?/gi)) {
      const month = monthOf(found[2]);
      if (!month) continue;
      const date = `${Number(found[1])}-${month}`;
      if (!facts.dates.has(date)) wrong.push(`${found[1]} ${month}`);
    }
  }
  return [...new Set(wrong)];
}

/** The right numbers, for the correction. */
export function describeFacts(facts: SavedFacts): string {
  return `session counts ${[...facts.counts].join(", ")}; dates ${[...facts.dates].join(", ")}`;
}
