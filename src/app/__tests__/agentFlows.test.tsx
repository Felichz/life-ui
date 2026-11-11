import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SystemCore } from "../../system";
import { AppProviders, AppRoutes } from "../App";
import type { ChatFn } from "../agent/agent";
import type { ChatMessage, ModelReply } from "../agent/llm";

/**
 * The day changes only through the chat (ADR-002). A scripted model stands in
 * for the LLM; the core is real. Each test checks what the person sees (the
 * card, the screen) and what the core holds.
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

beforeEach(() => localStorage.clear());

const call = (name: string, args: object = {}): ModelReply => ({
  content: "",
  toolCalls: [
    { id: `call-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } },
  ],
});
const say = (content: string): ModelReply => ({ content, toolCalls: [] });

/** A model that answers with these replies in order and records what it was sent. */
function script(...replies: ModelReply[]) {
  const seen: ChatMessage[][] = [];
  const chat: ChatFn = async (messages) => {
    seen.push(messages);
    const next = replies.shift();
    if (!next) throw new Error("script ran out");
    return next;
  };
  return { chat, seen };
}

function setup(chat: ChatFn) {
  const core = new SystemCore();
  core.clearState();
  core.startDay();
  const todo = core.getTimeBlocks().find((block) => block.isDefault)!;
  const report = core.createActivityTemplate({
    title: "Escribir informe",
    description: "",
    type: "clear-objective",
    isSystemActivity: false,
    clearObjectiveSettings: { estimatedDurationMinutes: 30 },
  });
  const reportInstance = core.createActivityInstance(report.id, todo.id);
  render(
    <AppProviders core={core} locale="es" agentChat={chat}>
      <MemoryRouter>
        <AppRoutes />
      </MemoryRouter>
    </AppProviders>
  );
  return { core, reportInstance };
}

async function write(text: string) {
  const box = screen.getAllByLabelText("Dile a LifeUI qué quieres hacer…")[0];
  fireEvent.change(box, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(box, { key: "Enter" });
  });
}

describe("the day through the chat", () => {
  it("asks before a change, and the screen follows the core", async () => {
    const { chat } = script(call("start_activity", { item: "Escribir informe" }), say("Empezado."));
    const { core, reportInstance } = setup(chat);

    await write("empiezo el informe");
    expect(await screen.findByText("Empezar «Escribir informe»")).toBeInTheDocument();
    expect(core.getActiveActivity()).toBeNull();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hazlo" }));
    });
    await screen.findByText("Empezado.");
    expect(core.getActiveActivity()?.id).toBe(reportInstance.id);
    expect(screen.getByRole("region", { name: "En marcha" })).toHaveTextContent("Escribir informe");
  });

  it("closes with the score it inferred, the tempos the card promised and the person's words", async () => {
    const { chat } = script(
      call("finish_activity", { how_it_went: "salió bien, terminé el borrador", satisfaction: 8 }),
      say("Cerrado.")
    );
    const { core, reportInstance } = setup(chat);
    core.activateActivity(reportInstance.id);

    await write("terminé, salió bien");
    // 30 estimated minutes x 8 / 7, rounded up
    expect(await screen.findByText("Cerrar «Escribir informe» · +35 tempos")).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hazlo" }));
    });
    await screen.findByText("Cerrado.");

    const record = core.getState().global.completedActivityRecords.at(-1)!;
    expect(record.satisfactionScore).toBe(8);
    expect(record.temposAwarded).toBe(35);
    expect(record.closingNote).toBe("salió bien, terminé el borrador");
  });

  it("does nothing when the person says no, and tells the model", async () => {
    const { chat, seen } = script(
      call("start_activity", { item: "Escribir informe" }),
      say("Vale.")
    );
    const { core } = setup(chat);

    await write("empieza el informe");
    await screen.findByText("Empezar «Escribir informe»");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "No" }));
    });
    await screen.findByText("Vale.");
    expect(core.getActiveActivity()).toBeNull();
    expect(JSON.stringify(seen.at(-1))).toContain("rejected");
  });

  it("in auto mode runs at once, and undo puts the day back", async () => {
    const { chat } = script(
      call("add_to_plan", { title: "Leer", minutes: 20, time: "15:00" }),
      say("Añadido.")
    );
    const { core } = setup(chat);

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    await write("leer a las 15");
    await screen.findByText("Añadido.");
    const titles = () =>
      core
        .getState()
        .currentDay!.activityInstances.map(
          (i) => core.getActivityTemplates().find((tpl) => tpl.id === i.templateId)!.title
        );
    expect(titles()).toContain("Leer");
    const added = core
      .getState()
      .currentDay!.activityInstances.find((i) => i.scheduledStart === 900);
    expect(added).toBeDefined();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Deshacer" }));
    });
    expect(titles()).not.toContain("Leer");
    expect(screen.getByText("Deshecho")).toBeInTheDocument();
  });

  it("still asks before ending the day in auto mode", async () => {
    const { chat } = script(call("end_day"), say("Hasta mañana."));
    const { core } = setup(chat);

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    await write("terminé el día");
    expect(await screen.findByText("Terminar el día")).toBeInTheDocument();
    expect(core.getCurrentDay()).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Hazlo" }));
    });
    await screen.findByText("Hasta mañana.");
    expect(core.getCurrentDay()).toBeNull();
  });

  it("hands the core's refusal back to the model as a code", async () => {
    const { chat, seen } = script(
      call("start_activity", { item: "Escribir informe" }),
      say("Ya hay algo en marcha.")
    );
    const { core, reportInstance } = setup(chat);
    const other = core.createActivityTemplate({
      title: "Correo",
      description: "",
      type: "clear-objective",
      isSystemActivity: false,
      clearObjectiveSettings: { estimatedDurationMinutes: 10 },
    });
    const otherInstance = core.createActivityInstance(other.id, reportInstance.blockId);
    core.activateActivity(otherInstance.id);

    fireEvent.click(screen.getByRole("radio", { name: "Auto" }));
    await write("empieza el informe");
    await screen.findByText("Ya hay algo en marcha.");
    await waitFor(() => expect(JSON.stringify(seen.at(-1))).toContain("activity-already-running"));
    expect(core.getActiveActivity()?.id).toBe(otherInstance.id);
  });
});
