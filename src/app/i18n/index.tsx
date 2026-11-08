import {
  Fragment,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { en } from "./en";
import { es, type MessageKey } from "./es";

/**
 * Minimal, typed i18n. The dictionaries are flat (`es` is the reference and
 * `en` must have exactly the same keys; TypeScript checks this).
 *
 * `t()` is a module-level function so it can also be used outside React
 * (action toasts, domain labels). When the language changes, the provider
 * remounts the tree, so all text updates.
 */

/** Product name (not translated). */
export const APP_NAME = "LifeUI";

export type Locale = "es" | "en";
export const LOCALES: Locale[] = ["en", "es"];
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { es, en };
const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", en: "en-US" };
const STORAGE_KEY = "lifeui.locale";

/** Language on first visit, whatever the browser language is. */
export const DEFAULT_LOCALE: Locale = "en";

let current: Locale = detectLocale();

/** Initial language: a saved choice wins; if there is none, English. */
export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // storage unavailable
  }
  return DEFAULT_LOCALE;
}

export function getLocale(): Locale {
  return current;
}

/** BCP 47 locale for Intl (dates, numbers). */
export function intlLocale(): string {
  return INTL_LOCALE[current];
}

/** Changes the active language (without persisting). Useful in tests. */
export function setLocale(locale: Locale) {
  current = locale;
  if (typeof document !== "undefined") document.documentElement.lang = locale;
}

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in vars ? String(vars[name]) : match
  );
}

/** Translates a key. `{name}` is replaced with `vars.name`. */
export function t(key: MessageKey, vars?: Vars): string {
  return interpolate(DICTIONARIES[current][key] ?? es[key], vars);
}

type PluralBase = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

/** Plural: uses `${base}.one` or `${base}.other`; `{count}` is available. */
export function tp(base: PluralBase, count: number, vars?: Vars): string {
  const form = new Intl.PluralRules(intlLocale()).select(count) === "one" ? "one" : "other";
  const formatted = count.toLocaleString(intlLocale());
  return t(`${base}.${form}` as MessageKey, { count: formatted, ...vars });
}

/**
 * Translation with React nodes inside the text: `{tempos}` can be a
 * `<span>`. Returns fragments ready to render.
 */
export function tr(key: MessageKey, vars: Record<string, ReactNode>): ReactNode {
  const template = DICTIONARIES[current][key] ?? es[key];
  const parts = template.split(/(\{\w+\})/g);
  return parts.map((part, index) => {
    const match = /^\{(\w+)\}$/.exec(part);
    if (!match || !(match[1] in vars)) return part;
    const value = vars[match[1]];
    return <Fragment key={index}>{value}</Fragment>;
  });
}

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initial,
}: {
  children: ReactNode;
  /** Pins the initial language (tests); otherwise it is detected. */
  initial?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const start = initial ?? detectLocale();
    setLocale(start);
    return start;
  });

  const change = useCallback((next: Locale) => {
    setLocale(next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // no persistence: applies to this session only
    }
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale: change }), [locale, change]);

  return (
    <LocaleContext.Provider value={value}>
      {/* The key remounts the app so that all text changes */}
      <Fragment key={locale}>{children}</Fragment>
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used inside <LocaleProvider>");
  return context;
}

export type { MessageKey };
