/**
 * Lecturas de presentación sobre el estado del core. Nada aquí decide reglas
 * de negocio (tempos, validaciones): solo ordena, agrupa y nombra lo que el
 * core ya calculó o guardó.
 */
import type {
  ActivityInstance,
  ActivityTemplate,
  ActivityType,
  AppState,
  CompletedActivityRecord,
  Day,
  DynamicSettings,
  TimeBlock,
  UUID,
} from "../../types";
import { formatDayMinutes } from "./format";

export const TYPE_META: Record<
  ActivityType,
  { label: string; short: string; hint: string; color: string; bg: string; text: string }
> = {
  "clear-objective": {
    label: "Objetivo claro",
    short: "Objetivo",
    hint: "Tiene un final definido. Estimas cuánto vas a tardar.",
    color: "rgb(var(--objective))",
    bg: "bg-objective",
    text: "text-objective",
  },
  "flexible-duration": {
    label: "Duración flexible",
    short: "Flexible",
    hint: "Varía, pero sabes el rango en el que suele caer.",
    color: "rgb(var(--flexible))",
    bg: "bg-flexible",
    text: "text-flexible",
  },
  timeboxing: {
    label: "Timebox",
    short: "Timebox",
    hint: "Decides un mínimo, un máximo o ambos. Te avisamos al llegar.",
    color: "rgb(var(--timebox))",
    bg: "bg-timebox",
    text: "text-timebox",
  },
};

export type Settings = Pick<
  DynamicSettings,
  "clearObjectiveSettings" | "flexibleDurationSettings" | "timeboxingSettings"
>;

export interface Contract {
  /** Texto corto: "~45 min", "5–10 min", "mín 20 min" */
  label: string;
  estimate?: number;
  min?: number;
  max?: number;
}

export function settingsOf(source: Settings): Settings {
  return {
    clearObjectiveSettings: source.clearObjectiveSettings,
    flexibleDurationSettings: source.flexibleDurationSettings,
    timeboxingSettings: source.timeboxingSettings,
  };
}

/** Contrato de duración de una instancia (o plantilla, como respaldo). */
export function contractOf(
  type: ActivityType,
  source: Settings,
  fallback?: Settings
): Contract | null {
  const pick = <K extends keyof Settings>(key: K) => source[key] ?? fallback?.[key];

  if (type === "clear-objective") {
    const estimate = pick("clearObjectiveSettings")?.estimatedDurationMinutes;
    return estimate ? { label: `~${estimate} min`, estimate } : null;
  }
  if (type === "flexible-duration") {
    const settings = pick("flexibleDurationSettings");
    if (!settings) return null;
    const { minimumDurationMinutes: min, maximumDurationMinutes: max } = settings;
    return { label: `${min}–${max} min`, min, max };
  }
  const settings = pick("timeboxingSettings");
  if (!settings) return null;
  const { type: boxType, minimumDurationMinutes: min, maximumDurationMinutes: max } = settings;
  if (boxType === "minimum-time" && min) return { label: `mín ${min} min`, min };
  if (boxType === "maximum-time" && max) return { label: `máx ${max} min`, max };
  if (boxType === "both" && min && max) return { label: `${min}–${max} min`, min, max };
  return null;
}

export type BlockStatus = "always" | "now" | "later" | "past";

export function blockStatus(block: TimeBlock, nowMinutes: number): BlockStatus {
  if (block.isDefault) return "always";
  if (nowMinutes >= block.startMinute && nowMinutes < block.endMinute) return "now";
  return nowMinutes < block.startMinute ? "later" : "past";
}

export function blockRange(block: TimeBlock): string {
  return `${formatDayMinutes(block.startMinute)}–${formatDayMinutes(block.endMinute)}`;
}

export function blockName(block: TimeBlock): string {
  return block.isDefault ? "Por hacer" : block.name;
}

/** "Por hacer" primero, luego cronológico. */
export function sortBlocks(blocks: TimeBlock[]): TimeBlock[] {
  return [...blocks].sort((a, b) => {
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1;
    return a.startMinute - b.startMinute || a.order - b.order;
  });
}

export function templateMap(state: AppState): Map<UUID, ActivityTemplate> {
  return new Map(state.global.activityTemplates.map((template) => [template.id, template]));
}

export interface PlanItem {
  instance: ActivityInstance;
  template: ActivityTemplate | undefined;
  title: string;
  type: ActivityType;
  contract: Contract | null;
  isActive: boolean;
}

export function planItem(
  instance: ActivityInstance,
  templates: Map<UUID, ActivityTemplate>,
  activeId?: UUID
): PlanItem {
  const template = templates.get(instance.templateId);
  const type = template?.type ?? "flexible-duration";
  return {
    instance,
    template,
    title: template?.title ?? "Actividad sin plantilla",
    type,
    contract: contractOf(type, instance, template),
    isActive: instance.id === activeId,
  };
}

export function instancesInBlock(state: AppState, blockId: UUID): ActivityInstance[] {
  return (state.currentDay?.activityInstances ?? [])
    .filter((instance) => instance.blockId === blockId)
    .sort((a, b) => a.order - b.order);
}

export function recordsOfDay(state: AppState, dayId: UUID): CompletedActivityRecord[] {
  return state.global.completedActivityRecords
    .filter((record) => record.dayId === dayId)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
}

export function eventsOfDay(state: AppState, dayId: UUID) {
  return state.global.eventInstances
    .filter((event) => event.dayId === dayId)
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
}

/** Días registrados, del más reciente al más antiguo. */
export function daysNewestFirst(state: AppState): Day[] {
  return [...state.global.days].sort((a, b) =>
    (b.startTime ?? b.createdAt).localeCompare(a.startTime ?? a.createdAt)
  );
}

export function dayStart(day: Day): string {
  return day.startTime ?? day.createdAt;
}

/** Records de un día cuyo contrato permite comparar real vs. esperado. */
export function recordContract(record: CompletedActivityRecord): Contract | null {
  return contractOf(record.type, record);
}

export function withinContract(minutes: number, contract: Contract | null): boolean | null {
  if (!contract) return null;
  if (contract.estimate !== undefined) return minutes <= contract.estimate;
  if (contract.min !== undefined && minutes < contract.min) return false;
  if (contract.max !== undefined && minutes > contract.max) return false;
  return true;
}
