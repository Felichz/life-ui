/**
 * Whether a reasoning model thinks before it answers (ADR-004, section 12).
 * Off by default: on an 8 GB GPU a 9B model spends about a minute thinking
 * before every reply, and answers in two seconds without.
 */

const KEY = "lifeui.reasoning";
const listeners = new Set<() => void>();

export function getReasoning(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setReasoning(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // kept for this session only: the listeners below still hear it
  }
  listeners.forEach((listener) => listener());
}

export function onReasoning(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
