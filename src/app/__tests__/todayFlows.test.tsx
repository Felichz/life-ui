import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { AppProviders, AppRoutes } from "../App";

/**
 * Flujos críticos de Hoy contra el core real: el ritual de cierre otorga los
 * tempos que promete la vista previa, cambiar de actividad pasa por el cierre
 * y "No la terminé" registra una interrupción sin tempos.
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
    <AppProviders core={core}>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  );
  return { core, informeInstance, leerInstance };
}

const dayId = (core: SystemCore) => core.getCurrentDay()!.id;

describe("Hoy", () => {
  it("cierra la actividad en marcha con la recompensa de la vista previa", () => {
    const { core, informeInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByTestId("finish-active"));
    const dialog = screen.getByTestId("closing-dialog");
    expect(within(dialog).getByText("¿Cómo fue «Escribir informe»?")).toBeInTheDocument();

    // 30 min estimados × 9/7 → ceil(38,57) = 39
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

  it("al cambiar de actividad, cierra primero la actual y luego empieza la nueva", () => {
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

  it("cancelar el cierre deja la actividad en marcha y no registra nada", () => {
    const { core, informeInstance } = setup();
    act(() => {
      core.activateActivity(informeInstance.id);
    });

    fireEvent.click(screen.getByTestId("finish-active"));
    fireEvent.click(screen.getByRole("button", { name: "Seguir con ella" }));

    expect(core.getActiveActivity()?.id).toBe(informeInstance.id);
    expect(core.getState().global.completedActivityRecords).toHaveLength(0);
  });

  it("«No la terminé» registra una interrupción sin tempos", () => {
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

  it("los accesos rápidos empiezan una actividad anclada con un toque", () => {
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
