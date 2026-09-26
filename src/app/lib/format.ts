import { intlLocale, t } from "../i18n";

/** 45 → "45 min", 60 → "1 h", 75 → "1 h 15 min" */
export function formatMinutes(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** Compacto para tablas y chips: "45m", "1h 15m" */
export function formatMinutesShort(total: number): string {
  const minutes = Math.max(0, Math.round(total));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/** Cronómetro: "04:07", "1:02:03" */
export function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** ISO → "14:30" en hora local */
export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale(), { hour: "numeric", minute: "2-digit" });
}

/** Minutos del día → "14:00" */
export function formatDayMinutes(dayMinutes: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(dayMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** "14:30" → 870 */
export function parseDayMinutes(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "Jueves, 26 de septiembre" / "Thursday, September 26" */
export function formatDateLong(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return capitalize(
    value.toLocaleDateString(intlLocale(), { weekday: "long", day: "numeric", month: "long" })
  );
}

/** "jue 26 sep" */
export function formatDateShort(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value
    .toLocaleDateString(intlLocale(), { weekday: "short", day: "numeric", month: "short" })
    .replace(/\./g, "")
    .replace(",", "");
}

/** "26 sep" */
export function formatDayMonth(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return value
    .toLocaleDateString(intlLocale(), { day: "numeric", month: "short" })
    .replace(".", "");
}

export function formatNumber(value: number, maximumFractionDigits = 0): string {
  return value.toLocaleString(intlLocale(), { maximumFractionDigits });
}

export function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes() + date.getSeconds() / 60;
}

export function greeting(date = new Date()): string {
  const hour = date.getHours();
  if (hour < 6) return t("greeting.night");
  if (hour < 13) return t("greeting.morning");
  if (hour < 20) return t("greeting.afternoon");
  return t("greeting.night");
}
