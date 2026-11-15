import { useCallback, useEffect, useState } from "react";

/**
 * The context panel's width and whether it is open, kept between launches.
 * The person drags the edge between the conversation and the panel, or folds
 * the panel away to give the conversation the whole window.
 */

const WIDTH_KEY = "lifeui.panelWidth";
const OPEN_KEY = "lifeui.panelOpen";
export const PANEL_MIN = 340;
/** The conversation keeps at least this much beside the panel and the rail. */
const CHAT_MIN = 480;
const RAIL = 84;

/** The panel's width when nobody chose one: about a third of the window. */
export function defaultWidth(viewport = window.innerWidth): number {
  return Math.round(Math.min(560, Math.max(380, viewport * 0.34)));
}

/** The widest the panel can be in this window. */
export function maxWidth(viewport = window.innerWidth): number {
  return Math.max(PANEL_MIN, Math.min(960, viewport - RAIL - CHAT_MIN));
}

export function clampWidth(width: number, viewport = window.innerWidth): number {
  return Math.round(Math.min(maxWidth(viewport), Math.max(PANEL_MIN, width)));
}

function read<T>(key: string, parse: (raw: string) => T | null, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw === null ? null : parse(raw);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // kept for this session only
  }
}

export function usePanel() {
  const [chosen, setChosen] = useState<number | null>(() =>
    read(WIDTH_KEY, (raw) => (Number.isFinite(Number(raw)) ? Number(raw) : null), null)
  );
  const [open, setOpenState] = useState<boolean>(() => read(OPEN_KEY, (raw) => raw !== "0", true));
  const [viewport, setViewport] = useState(() => window.innerWidth);

  useEffect(() => {
    const onResize = () => setViewport(window.innerWidth);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const width = clampWidth(chosen ?? defaultWidth(viewport), viewport);

  const setWidth = useCallback((next: number | null) => {
    setChosen(next);
    if (next === null) {
      try {
        localStorage.removeItem(WIDTH_KEY);
      } catch {
        // nothing kept
      }
    } else write(WIDTH_KEY, String(Math.round(next)));
  }, []);

  const setOpen = useCallback((next: boolean) => {
    setOpenState(next);
    write(OPEN_KEY, next ? "1" : "0");
  }, []);

  return { width, open, setWidth, setOpen, viewport };
}
