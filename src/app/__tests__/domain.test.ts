import type { TimeBlock } from "../../types";
import { setLocale } from "../i18n";
import { blockStatus, contractOf, sortBlocks, withinContract } from "../lib/domain";
import { formatClock, formatMinutes, parseDayMinutes } from "../lib/format";

const block = (overrides: Partial<TimeBlock>): TimeBlock => ({
  id: "b",
  name: "Bloque",
  startMinute: 0,
  endMinute: 1439,
  isDefault: false,
  order: 1,
  createdAt: "",
  updatedAt: "",
  ...overrides,
});

beforeAll(() => setLocale("es"));

describe("contractOf", () => {
  it("describe cada tipo de contrato de duración", () => {
    expect(
      contractOf("clear-objective", { clearObjectiveSettings: { estimatedDurationMinutes: 45 } })
        ?.label
    ).toBe("~45 min");
    expect(
      contractOf("flexible-duration", {
        flexibleDurationSettings: { minimumDurationMinutes: 5, maximumDurationMinutes: 10 },
      })?.label
    ).toBe("5–10 min");
    expect(
      contractOf("timeboxing", {
        timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 },
      })?.label
    ).toBe("mín 20 min");
    expect(
      contractOf("timeboxing", {
        timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 15 },
      })?.label
    ).toBe("máx 15 min");
  });

  it("usa los ajustes de la instancia y cae a la plantilla si faltan", () => {
    const template = { clearObjectiveSettings: { estimatedDurationMinutes: 30 } };
    expect(
      contractOf(
        "clear-objective",
        { clearObjectiveSettings: { estimatedDurationMinutes: 60 } },
        template
      )?.estimate
    ).toBe(60);
    expect(contractOf("clear-objective", {}, template)?.estimate).toBe(30);
  });
});

describe("blockStatus", () => {
  const morning = block({ startMinute: 360, endMinute: 720 });
  it("distingue ahora, más tarde y pasado", () => {
    expect(blockStatus(morning, 300)).toBe("later");
    expect(blockStatus(morning, 400)).toBe("now");
    expect(blockStatus(morning, 720)).toBe("past");
    expect(blockStatus(block({ isDefault: true }), 5)).toBe("always");
  });

  it("ordena Por hacer primero y luego por hora", () => {
    const sorted = sortBlocks([
      block({ id: "tarde", startMinute: 720, order: 1 }),
      block({ id: "todo", isDefault: true, order: 5 }),
      block({ id: "manana", startMinute: 360, order: 9 }),
    ]);
    expect(sorted.map((item) => item.id)).toEqual(["todo", "manana", "tarde"]);
  });
});

describe("withinContract", () => {
  it("compara el tiempo real con estimado o rango", () => {
    expect(withinContract(40, { label: "", estimate: 45 })).toBe(true);
    expect(withinContract(50, { label: "", estimate: 45 })).toBe(false);
    expect(withinContract(12, { label: "", min: 5, max: 10 })).toBe(false);
    expect(withinContract(12, null)).toBeNull();
  });
});

describe("format", () => {
  it("formatea minutos y cronómetro", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(75)).toBe("1 h 15 min");
    expect(formatClock(247_000)).toBe("04:07");
    expect(formatClock(3_723_000)).toBe("1:02:03");
  });

  it("interpreta horas HH:MM", () => {
    expect(parseDayMinutes("14:30")).toBe(870);
    expect(parseDayMinutes("24:00")).toBeNull();
    expect(parseDayMinutes("nope")).toBeNull();
  });
});
