import { useEffect, useRef } from "react";

interface HotkeyOptions {
  /** Requires ⌘ (Mac) or Ctrl (everything else) */
  mod?: boolean;
  enabled?: boolean;
  /** Allows firing even when focus is in a text field */
  allowInInputs?: boolean;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Global keyboard shortcut. `key` is compared case-insensitively. */
export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  options: HotkeyOptions = {}
) {
  const { mod = false, enabled = true, allowInInputs = false } = options;
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      const hasMod = event.metaKey || event.ctrlKey;
      if (mod !== hasMod) return;
      if (!mod && (event.altKey || event.metaKey || event.ctrlKey)) return;
      if (!allowInInputs && !mod && isTypingTarget(event.target)) return;
      // Don't compete with open dialogs unless the shortcut is global (mod)
      if (!mod && document.querySelector("[role='dialog'][data-state='open']")) return;
      event.preventDefault();
      handlerRef.current(event);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [key, mod, enabled, allowInInputs]);
}

export const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

export const modKeyLabel = isMac ? "⌘" : "Ctrl";
