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
 * i18n mínima y tipada. Los diccionarios son planos (`es` es la referencia y
 * `en` debe tener exactamente las mismas claves, lo comprueba TypeScript).
 *
 * `t()` es una función de módulo para poder usarla también fuera de React
 * (toasts de acciones, etiquetas de dominio). Al cambiar de idioma el
 * proveedor vuelve a montar el árbol, así que todo el texto se actualiza.
 */

/** Nombre del producto (no se traduce). */
export const APP_NAME = "LifeUI";

export type Locale = "es" | "en";
export const LOCALES: Locale[] = ["es", "en"];
export const LOCALE_NAMES: Record<Locale, string> = { es: "Español", en: "English" };

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { es, en };
const INTL_LOCALE: Record<Locale, string> = { es: "es-ES", en: "en-US" };
const STORAGE_KEY = "lifeui.locale";

let current: Locale = detectLocale();

export function detectLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "es" || stored === "en") return stored;
  } catch {
    // almacenamiento no disponible
  }
  const language = typeof navigator !== "undefined" ? navigator.language : "es";
  return language.toLowerCase().startsWith("es") ? "es" : "en";
}

export function getLocale(): Locale {
  return current;
}

/** Locale BCP 47 para Intl (fechas, números). */
export function intlLocale(): string {
  return INTL_LOCALE[current];
}

/** Cambia el idioma activo (sin persistir). Útil en tests. */
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

/** Traduce una clave. `{nombre}` se sustituye por `vars.nombre`. */
export function t(key: MessageKey, vars?: Vars): string {
  return interpolate(DICTIONARIES[current][key] ?? es[key], vars);
}

type PluralBase = {
  [K in MessageKey]: K extends `${infer Base}.one` ? Base : never;
}[MessageKey];

/** Plural: usa `${base}.one` o `${base}.other`; `{count}` queda disponible. */
export function tp(base: PluralBase, count: number, vars?: Vars): string {
  const form = new Intl.PluralRules(intlLocale()).select(count) === "one" ? "one" : "other";
  const formatted = count.toLocaleString(intlLocale());
  return t(`${base}.${form}` as MessageKey, { count: formatted, ...vars });
}

/**
 * Traducción con nodos React dentro del texto: `{tempos}` puede ser un
 * `<span>`. Devuelve fragmentos listos para renderizar.
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
  /** Fija el idioma inicial (tests); si no, se detecta. */
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
      // sin persistencia: vale para esta sesión
    }
    setLocaleState(next);
  }, []);

  const value = useMemo(() => ({ locale, setLocale: change }), [locale, change]);

  return (
    <LocaleContext.Provider value={value}>
      {/* La key vuelve a montar la app para que todos los textos cambien */}
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
