import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { AppProviders, AppRoutes } from "../App";

/**
 * The Goals page (ADR-010): the ideal life, which the person writes by hand,
 * and each roadmap with how far along it really is.
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
  Element.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => localStorage.clear());

function open(core: SystemCore) {
  render(
    <AppProviders core={core} locale="es" agentChat={async () => ({ content: "", toolCalls: [] })}>
      <MemoryRouter initialEntries={["/goals"]}>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  );
}

function coreWithRoadmap() {
  const core = new SystemCore();
  core.clearState();
  const base = core.createActivityTemplate({
    title: "Entrenar: base",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 20 },
  });
  core.saveRoadmap({
    title: "Entrenar en casa",
    why: "Sentirme fuerte",
    milestones: [
      { title: "Crear el hábito", steps: [{ templateId: base.id, unit: "times", amount: 2 }] },
      { title: "Sostenerlo", steps: [{ templateId: base.id, unit: "times", amount: 10 }] },
    ],
  });
  return { core, base };
}

describe("the Goals page", () => {
  it("lets the person write their ideal life by hand", () => {
    const core = new SystemCore();
    core.clearState();
    open(core);

    fireEvent.click(screen.getByRole("button", { name: "Escribirla" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Vida ideal" }), {
      target: { value: "## Cuerpo\n- Quiero sentirme fuerte" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(core.getIdealLife()?.text).toBe("## Cuerpo\n- Quiero sentirme fuerte");
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("shows where the person stands on a roadmap, from what they really closed", () => {
    const { core, base } = coreWithRoadmap();
    core.startDay();
    const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
    const instance = core.createActivityInstance(base.id, todo.id);
    core.activateActivity(instance.id);
    core.completeActivity(instance.id, {
      satisfactionScore: 7,
      endTime: new Date(Date.now() + 60_000).toISOString(),
    });
    open(core);

    const roadmap = screen.getByRole("article", { name: "Entrenar en casa" });
    expect(within(roadmap).getByText("Sentirme fuerte")).toBeInTheDocument();
    expect(within(roadmap).getByText("0 de 2 pasos")).toBeInTheDocument();
    expect(within(roadmap).getByText("Aquí estás")).toBeInTheDocument();
    expect(within(roadmap).getByText("1 de 2 sesiones")).toBeInTheDocument();
    // The milestone not reached yet shows its target, not a count
    expect(within(roadmap).getByText("10 sesiones")).toBeInTheDocument();
    expect(within(roadmap).getByText("Sin sesiones programadas todavía")).toBeInTheDocument();
  });

  it("says so plainly when there is nothing yet", () => {
    const core = new SystemCore();
    core.clearState();
    open(core);
    expect(screen.getByText(/Todavía no hay hojas de ruta/)).toBeInTheDocument();
  });
});
