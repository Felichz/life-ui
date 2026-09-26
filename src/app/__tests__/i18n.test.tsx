import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { AppProviders, AppRoutes } from "../App";
import { en } from "../i18n/en";
import { es, type MessageKey } from "../i18n/es";
import { setLocale, t, tp } from "../i18n";

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("diccionarios", () => {
  it("cada texto en inglés usa exactamente las mismas variables que en español", () => {
    const mismatches = (Object.keys(es) as MessageKey[]).filter(
      (key) => placeholders(es[key]).join() !== placeholders(en[key]).join()
    );
    expect(mismatches).toEqual([]);
  });

  it("no hay textos vacíos", () => {
    const empty = (Object.keys(es) as MessageKey[]).filter(
      (key) => !es[key].trim() || !en[key].trim()
    );
    expect(empty).toEqual([]);
  });
});

describe("t / tp", () => {
  afterEach(() => setLocale("es"));

  it("interpola y elige el plural según el idioma", () => {
    setLocale("en");
    expect(t("closing.title", { title: "Read" })).toBe("How did “Read” go?");
    expect(tp("start.pending", 1)).toBe("1 activity waiting from yesterday");
    expect(tp("start.pending", 3)).toBe("3 activities waiting from yesterday");
    setLocale("es");
    expect(tp("start.pending", 3)).toBe("3 actividades te esperan de ayer");
  });
});

describe("cambio de idioma", () => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  beforeAll(() => Object.assign(globalThis, { ResizeObserver: ResizeObserverStub }));
  afterAll(() => setLocale("es"));

  it("Ajustes cambia toda la interfaz al inglés", () => {
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
