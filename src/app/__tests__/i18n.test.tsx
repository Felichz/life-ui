import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { CORE_ERROR_MESSAGES, CoreError, type CoreErrorCode } from "../../system/errors";
import { errorMessage } from "../state/system";
import { AppProviders, AppRoutes } from "../App";
import { en } from "../i18n/en";
import { es, type MessageKey } from "../i18n/es";
import { DEFAULT_LOCALE, detectLocale, setLocale, t, tp } from "../i18n";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  it("every English string uses exactly the same variables as the Spanish one", () => {
    const mismatches = (Object.keys(es) as MessageKey[]).filter(
      (key) => placeholders(es[key]).join() !== placeholders(en[key]).join()
    );
    expect(mismatches).toEqual([]);
  });

  it("has no empty strings", () => {
    const empty = (Object.keys(es) as MessageKey[]).filter(
      (key) => !es[key].trim() || !en[key].trim()
    );
    expect(empty).toEqual([]);
  });
});

describe("initial language", () => {
  const original = Object.getOwnPropertyDescriptor(window.navigator, "language");
  beforeEach(() => {
    localStorage.clear();
    Object.defineProperty(window.navigator, "language", { value: "es-ES", configurable: true });
  });
  afterEach(() => {
    localStorage.clear();
    if (original) Object.defineProperty(window.navigator, "language", original);
    else delete (window.navigator as { language?: string }).language;
  });

  it("the first visit is in English even if the browser is in Spanish", () => {
    expect(DEFAULT_LOCALE).toBe("en");
    expect(detectLocale()).toBe("en");
  });

  it("a saved choice wins", () => {
    localStorage.setItem("lifeui.locale", "es");
    expect(detectLocale()).toBe("es");
  });

  it("ignores unknown saved values", () => {
    localStorage.setItem("lifeui.locale", "fr");
    expect(detectLocale()).toBe("en");
  });
});

describe("t / tp", () => {
  afterEach(() => setLocale("es"));

  it("interpolates and picks the plural form for the language", () => {
    setLocale("en");
    expect(t("closing.title", { title: "Read" })).toBe("How did “Read” go?");
    expect(tp("start.pending", 1)).toBe("1 activity waiting from yesterday");
    expect(tp("start.pending", 3)).toBe("3 activities waiting from yesterday");
    setLocale("es");
    expect(tp("start.pending", 3)).toBe("3 actividades te esperan de ayer");
  });
});

describe("language switch", () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  beforeAll(() => Object.assign(globalThis, { ResizeObserver: ResizeObserverStub }));
  afterAll(() => setLocale("es"));

  it("Settings switches the whole interface to English", () => {
    const core = new SystemCore();
    core.clearState();
    render(
      <AppProviders core={core} locale="es">
        <MemoryRouter initialEntries={["/settings"]}>
          <AppRoutes />
        </MemoryRouter>
      </AppProviders>
    );
    expect(screen.getByRole("heading", { level: 1, name: "Ajustes" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("radio", { name: "English" }));

    expect(screen.getByRole("heading", { level: 1, name: "Settings" })).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /Library/ }).length).toBeGreaterThan(0);
    expect(document.documentElement.lang).toBe("en");
  });
});

describe("core error messages", () => {
  afterEach(() => setLocale("es"));

  it("translates core errors by code, in the current language", () => {
    const overlap = new CoreError("block-overlap");
    setLocale("en");
    expect(errorMessage(overlap)).toBe(en["coreError.block-overlap"]);
    setLocale("es");
    expect(errorMessage(overlap)).toBe(es["coreError.block-overlap"]);
  });

  it("every core error code has a message", () => {
    setLocale("en");
    for (const code of Object.keys(CORE_ERROR_MESSAGES) as CoreErrorCode[]) {
      expect(errorMessage(new CoreError(code))).not.toBe(t("error.generic"));
    }
  });

  it("never shows a technical message for unexpected errors", () => {
    const spy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    setLocale("en");
    expect(errorMessage(new Error("Cannot read properties of undefined"))).toBe(t("error.generic"));
    spy.mockRestore();
  });
});
