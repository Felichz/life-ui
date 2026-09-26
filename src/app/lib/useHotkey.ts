import { useEffect, useRef } from "react";

interface HotkeyOptions {
  /** Requiere ⌘ (Mac) o Ctrl (resto) */
  mod?: boolean;
  enabled?: boolean;
  /** Permite dispararse aunque el foco esté en un campo de texto */
  allowInInputs?: boolean;
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Atajo de teclado global. `key` se compara sin distinguir mayúsculas. */
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
      // No competir con diálogos abiertos salvo que el atajo sea global (mod)
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
