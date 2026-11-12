import { localDate } from "../../system/agendaManager";
import { formatDateShort, formatDayMinutes, parseDayMinutes } from "../lib/format";
import { intlLocale, t } from "../i18n";

/**
 * Days and times as the agents write them and as the person reads them. A
 * small model gets a weekday wrong when it works one out from a date, so
 * every date a tool gives back already carries its weekday: the model copies
 * it, it does not compute it.
 */

export const WEEKDAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Words a model may use for a weekday, in English or Spanish. */
const WEEKDAY_WORDS: Record<string, number> = {
  sun: 0,
  sunday: 0,
  dom: 0,
  domingo: 0,
  mon: 1,
  monday: 1,
  lun: 1,
  lunes: 1,
  tue: 2,
  tuesday: 2,
  mar: 2,
  martes: 2,
  wed: 3,
  wednesday: 3,
  mie: 3,
  mié: 3,
  miercoles: 3,
  miércoles: 3,
  thu: 4,
  thursday: 4,
  jue: 4,
  jueves: 4,
  fri: 5,
  friday: 5,
  vie: 5,
  viernes: 5,
  sat: 6,
  saturday: 6,
  sab: 6,
  sáb: 6,
  sabado: 6,
  sábado: 6,
};

/**
 * Every way a weekday may be written in a tool call. A model asked to turn
 * "martes, jueves y sábado" into "tue, thu, sat" gets it wrong often enough
 * (it wrote mon, wed, sat); allowed to copy the words, it does not.
 */
export const WEEKDAY_NAMES = Object.keys(WEEKDAY_WORDS);

const EVERY_DAY = /\b(todos los d[ií]as|cada d[ií]a|a diario|every ?day|daily)\b/;
const WEEKEND = /\b(fines? de semana|weekends?)\b/;
const WORKDAYS = /\b(entre semana|d[ií]as h[aá]biles|d[ií]as laborables|weekdays|work ?days)\b/;
/** What stands between two weekdays that name a stretch: "lunes a viernes", "mon to fri". */
const THROUGH = new Set(["a", "al", "hasta", "to", "through", "thru"]);

/**
 * The weekdays a sentence names, in order: one by one ("lunes, miércoles y
 * viernes"), as a stretch ("de lunes a viernes" is five days, not two), or
 * together ("todos los días", "weekends").
 */
export function weekdaysIn(text: string): number[] {
  const lower = text.toLocaleLowerCase();
  const days = new Set<number>();
  if (EVERY_DAY.test(lower)) for (let day = 0; day < 7; day++) days.add(day);
  if (WEEKEND.test(lower)) [6, 0].forEach((day) => days.add(day));
  if (WORKDAYS.test(lower)) [1, 2, 3, 4, 5].forEach((day) => days.add(day));
  const words = lower.replace(/\s*[-–—]\s*/g, " to ").split(/[^a-záéíóúñ]+/);
  for (let index = 0; index < words.length; index++) {
    const from = WEEKDAY_WORDS[words[index]];
    if (from === undefined) continue;
    const to = THROUGH.has(words[index + 1]) ? WEEKDAY_WORDS[words[index + 2]] : undefined;
    if (to === undefined) {
      days.add(from);
      continue;
    }
    for (let day = from; ; day = (day + 1) % 7) {
      days.add(day);
      if (day === to) break;
    }
    index += 2;
  }
  return [...days].sort();
}

const NOT = /\b(no|not|never|nunca|ni|salvo|excepto|except|menos|sin|without)\b|n't\b/;

/**
 * The days of a plan as a message states them, with the line that names
 * them; null when it names none, or says them with a "no" nearby ("los
 * viernes no puedo" names Friday and means the opposite).
 */
export function daysStated(message: string): { days: number[]; quote: string } | null {
  const lines = message
    .split(/\n+/)
    .map((line) => line.replace(/[*_#>|]/g, "").trim())
    .filter((line) => weekdaysIn(line).length > 0);
  if (lines.length === 0) return null;
  if (lines.some((line) => NOT.test(line.toLocaleLowerCase()))) return null;
  const days = weekdaysIn(lines.join(" "));
  // The line that says the most of them is the one worth showing
  const quote = [...lines].sort(
    (one, other) => weekdaysIn(other).length - weekdaysIn(one).length
  )[0];
  return { days, quote: quote.slice(0, 160) };
}

const THIS_AND_NEXT_MONTH =
  /\b(este mes y (el |la )?(pr[oó]ximo|que viene|siguiente)|this month and (the )?next)\b/;
const END_OF_YEAR =
  /\b((hasta|para) (el )?fin(al|es)? de(l)? a[nñ]o|(until|by|through) the end of the year)\b/;

/**
 * The weeks from today to the end a message names by the calendar: "this
 * month and the next" is to the last day of next month, which on the 12th is
 * seven weeks and not the nine of two whole months. 0 when it names none.
 */
export function weeksUntil(message: string, now: Date): number {
  const lower = message.toLocaleLowerCase();
  const end = THIS_AND_NEXT_MONTH.test(lower)
    ? new Date(now.getFullYear(), now.getMonth() + 2, 0, 12)
    : END_OF_YEAR.test(lower)
      ? new Date(now.getFullYear(), 11, 31, 12)
      : null;
  if (!end) return 0;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12);
  return Math.max(1, Math.round((end.getTime() - today.getTime()) / 86_400_000 / 7));
}

/** The weekdays a list of words names, in order; null when one is not a weekday. */
export function weekdayNumbers(words: unknown): number[] | null {
  if (!Array.isArray(words) || words.length === 0) return null;
  const days = words.map(
    (word) => WEEKDAY_WORDS[typeof word === "string" ? word.trim().toLocaleLowerCase() : ""]
  );
  if (days.some((value) => value === undefined)) return null;
  return [...new Set(days)].sort();
}

/** "lun, mié, vie", in the person's language; "every day" for all seven. */
export function weekdayNames(days: number[]): string {
  if (days.length === 7) return t("agent.everyDay");
  // 2023-01-01 was a Sunday
  return days
    .map((weekday) =>
      new Intl.DateTimeFormat(intlLocale(), { weekday: "short" })
        .format(new Date(2023, 0, 1 + weekday))
        .replace(".", "")
    )
    .join(", ");
}

/** A planned date at noon, so formatting it never slips a day. */
export const noon = (date: string) => new Date(`${date}T12:00:00`);

/** "vie 13 nov": the date with its weekday, as the person reads it. */
export const dayLabel = (date: string) => formatDateShort(noon(date));

/** "today", "tomorrow" (also when left out) or YYYY-MM-DD, as a date; null when it is none of them. */
export function startDate(value: unknown, now: Date): string | null {
  const word = typeof value === "string" ? value.trim().toLocaleLowerCase() : "";
  const start = new Date(now);
  start.setHours(12, 0, 0, 0);
  if (!word || ["tomorrow", "mañana", "manana"].includes(word)) {
    start.setDate(start.getDate() + 1);
    return localDate(start);
  }
  if (["today", "hoy"].includes(word)) return localDate(start);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(word) || Number.isNaN(noon(word).getTime())) return null;
  return word;
}

/** "15:00", "15", "9:30" as minutes of the day; null when it is not a time. */
export function timeOfDay(value: unknown): number | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  return parseDayMinutes(/^\d{1,2}$/.test(text) ? `${text}:00` : text);
}

/** "lun, mié, vie · 19:00" */
export function whenLabel(weekdays: number[], time?: number): string {
  return `${weekdayNames(weekdays)}${time !== undefined ? ` · ${formatDayMinutes(time)}` : ""}`;
}
