import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { AppProviders, AppRoutes } from "../App";

/**
 * Critical Today flows against the real core: the closing ritual awards the
 * tempos the preview promises, switching activity goes through the close,
 * and "No la terminé" (I didn't finish it) logs an interruption with no tempos.
 */

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  Object.assign(globalThis, { ResizeObserver: ResizeObserverStub });
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.hasPointerCapture = jest.fn(() => false);
  Element.prototype.releasePointerCapture = jest.fn();
});

function setup() {
  const core = new SystemCore();
  core.clearState();
  core.startDay();
  const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
  const informe = core.createActivityTemplate({
    title: "Escribir informe",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 30 },
  });
  const leer = core.createActivityTemplate({
    title: "Leer",
    description: "",
    type: "timeboxing",
    isSystemActivity: false,
    pinned: true,
    timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 },
  });
  const informeInstance = core.createActivityInstance(informe.id, todo.id);
  const leerInstance = core.createActivityInstance(leer.id, todo.id);

  render(
    <AppProviders core={core} locale="es">
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  );
  return { core, informeInstance, leerInstance };
}

const dayId = (core: SystemCore) => core.getCurrentDay()!.id;

describe("Today", () => {
  it("closes the running activity with the reward shown in the preview", () => {
    const { core, informeInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByTestId("finish-active"));
    const dialog = screen.getByTestId("closing-dialog");
    expect(within(dialog).getByText("¿Cómo fue «Escribir informe»?")).toBeInTheDocument();

    // 30 estimated min × 9/7 → ceil(38.57) = 39
    fireEvent.keyDown(dialog, { key: "9" });
    expect(within(dialog).getByText("+39")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByTestId("closing-confirm"));

    const [record] = core.getState().global.completedActivityRecords;
    expect(record.state).toBe("completed");
    expect(record.satisfactionScore).toBe(9);
    expect(record.temposAwarded).toBe(39);
    expect(core.getTempoSummary(dayId(core)).totalTempos).toBe(39);
    expect(screen.queryByTestId("closing-dialog")).not.toBeInTheDocument();
  });

  it("when switching activity, closes the current one first and then starts the new one", () => {
    const { core, informeInstance, leerInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByRole("button", { name: "Empezar Leer" }));
    const dialog = screen.getByTestId("closing-dialog");
    expect(within(dialog).getByText("Al guardar, empezará «Leer».")).toBeInTheDocument();

    fireEvent.click(within(dialog).getByTestId("closing-confirm"));
    expect(core.getActiveActivity()?.id).toBe(leerInstance.id);
    expect(core.getState().global.completedActivityRecords).toHaveLength(1);
  });

  it("cancelling the close keeps the activity running and logs nothing", () => {
    const { core, informeInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByTestId("finish-active"));
    fireEvent.click(screen.getByRole("button", { name: "Seguir con ella" }));

    expect(core.getActiveActivity()?.id).toBe(informeInstance.id);
    expect(core.getState().global.completedActivityRecords).toHaveLength(0);
  });

  it('"No la terminé" (I didn\'t finish it) logs an interruption with no tempos', () => {
    const { core, informeInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByTestId("finish-active"));
    fireEvent.click(screen.getByRole("button", { name: /No la terminé/ }));

    const [record] = core.getState().global.completedActivityRecords;
    expect(record.state).toBe("interrupted");
    expect(record.temposAwarded).toBe(0);
    expect(core.getActiveActivity()).toBeNull();
    expect(screen.getByText("Está bien. Mañana es otra oportunidad.")).toBeInTheDocument();
  });

  it("quick starts begin a pinned activity with one tap", () => {
    const { core } = setup();
    const quick = screen.getByRole("region", { name: "Accesos rápidos" });
    fireEvent.click(within(quick).getByRole("button", { name: /Leer/ }));

    const active = core.getActiveActivity();
    expect(active).not.toBeNull();
    expect(
      core.getState().global.activityTemplates.find((t) => t.id === active!.templateId)?.title
    ).toBe("Leer");
  });
});
