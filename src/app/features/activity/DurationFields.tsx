import type { ActivityType, TimeboxingType } from "../../../types";
import { Field, MinutesInput } from "../../components/ui/Field";
import { Segmented } from "../../components/ui/Segmented";
import type { Settings } from "../../lib/domain";

export function defaultSettings(type: ActivityType): Settings {
  if (type === "clear-objective")
    return { clearObjectiveSettings: { estimatedDurationMinutes: 30 } };
  if (type === "flexible-duration") {
    return { flexibleDurationSettings: { minimumDurationMinutes: 10, maximumDurationMinutes: 30 } };
  }
  return { timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 } };
}

/** Deja solo los ajustes del tipo elegido (el core guarda el que venga). */
export function settingsForType(type: ActivityType, settings: Settings): Settings {
  if (type === "clear-objective")
    return { clearObjectiveSettings: settings.clearObjectiveSettings };
  if (type === "flexible-duration")
    return { flexibleDurationSettings: settings.flexibleDurationSettings };
  const box = settings.timeboxingSettings;
  if (!box) return { timeboxingSettings: undefined };
  return {
    timeboxingSettings: {
      type: box.type,
      minimumDurationMinutes: box.type === "maximum-time" ? undefined : box.minimumDurationMinutes,
      maximumDurationMinutes: box.type === "minimum-time" ? undefined : box.maximumDurationMinutes,
    },
  };
}

export function validateSettings(type: ActivityType, settings: Settings): string | null {
  const positive = (value: number | undefined) => typeof value === "number" && value >= 1;
  if (type === "clear-objective") {
    return positive(settings.clearObjectiveSettings?.estimatedDurationMinutes)
      ? null
      : "Indica cuántos minutos estimas.";
  }
  if (type === "flexible-duration") {
    const range = settings.flexibleDurationSettings;
    if (
      !range ||
      !positive(range.minimumDurationMinutes) ||
      !positive(range.maximumDurationMinutes)
    ) {
      return "Indica el mínimo y el máximo en minutos.";
    }
    return range.maximumDurationMinutes >= range.minimumDurationMinutes
      ? null
      : "El máximo no puede ser menor que el mínimo.";
  }
  const box = settings.timeboxingSettings;
  if (!box) return "Configura el timebox.";
  if (box.type !== "maximum-time" && !positive(box.minimumDurationMinutes))
    return "Indica el mínimo en minutos.";
  if (box.type !== "minimum-time" && !positive(box.maximumDurationMinutes))
    return "Indica el máximo en minutos.";
  if (
    box.type === "both" &&
    (box.maximumDurationMinutes ?? 0) <= (box.minimumDurationMinutes ?? 0)
  ) {
    return "El máximo tiene que ser mayor que el mínimo.";
  }
  return null;
}

const toValue = (value: number | undefined): number | "" =>
  typeof value === "number" && !Number.isNaN(value) ? value : "";
const fromValue = (value: number | "") => (value === "" ? 0 : value);

interface DurationFieldsProps {
  type: ActivityType;
  value: Settings;
  onChange: (value: Settings) => void;
  error?: string | null;
}

export function DurationFields({ type, value, onChange, error }: DurationFieldsProps) {
  if (type === "clear-objective") {
    return (
      <Field
        label="Estimado"
        hint="Una aproximación basta. Lo comparamos con el tiempo real al cerrar."
        error={error}
      >
        {(id, describedBy) => (
          <div className="w-44">
            <MinutesInput
              id={id}
              describedBy={describedBy}
              invalid={Boolean(error)}
              value={toValue(value.clearObjectiveSettings?.estimatedDurationMinutes)}
              onChange={(minutes) =>
                onChange({
                  clearObjectiveSettings: { estimatedDurationMinutes: fromValue(minutes) },
                })
              }
            />
          </div>
        )}
      </Field>
    );
  }

  if (type === "flexible-duration") {
    const range = value.flexibleDurationSettings ?? {
      minimumDurationMinutes: 0,
      maximumDurationMinutes: 0,
    };
    return (
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">Suele durar entre</p>
        <div className="flex items-center gap-2">
          <div className="w-40">
            <MinutesInput
              aria-label="Mínimo"
              invalid={Boolean(error)}
              value={toValue(range.minimumDurationMinutes)}
              onChange={(minutes) =>
                onChange({
                  flexibleDurationSettings: {
                    ...range,
                    minimumDurationMinutes: fromValue(minutes),
                  },
                })
              }
            />
          </div>
          <span className="text-sm text-ink-2">y</span>
          <div className="w-40">
            <MinutesInput
              aria-label="Máximo"
              invalid={Boolean(error)}
              value={toValue(range.maximumDurationMinutes)}
              onChange={(minutes) =>
                onChange({
                  flexibleDurationSettings: {
                    ...range,
                    maximumDurationMinutes: fromValue(minutes),
                  },
                })
              }
            />
          </div>
        </div>
        <p className={error ? "text-sm text-danger" : "text-sm text-ink-2"}>
          {error ?? "Es una expectativa, no un límite. Sin avisos mientras la haces."}
        </p>
      </div>
    );
  }

  const box = value.timeboxingSettings ?? { type: "minimum-time" as TimeboxingType };
  const setBox = (next: Partial<NonNullable<Settings["timeboxingSettings"]>>) =>
    onChange({ timeboxingSettings: { ...box, ...next } });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-medium text-ink">Tipo de timebox</p>
        <Segmented
          label="Tipo de timebox"
          value={box.type}
          onChange={(type) =>
            setBox({
              type,
              minimumDurationMinutes:
                type === "maximum-time"
                  ? box.minimumDurationMinutes
                  : box.minimumDurationMinutes || 20,
              maximumDurationMinutes:
                type === "minimum-time"
                  ? box.maximumDurationMinutes
                  : box.maximumDurationMinutes || 45,
            })
          }
          options={[
            { value: "minimum-time", label: "Mínimo" },
            { value: "maximum-time", label: "Máximo" },
            { value: "both", label: "Mín. y máx." },
          ]}
          className="w-full sm:w-auto"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {box.type !== "maximum-time" && (
          <div className="flex w-40 flex-col gap-1.5">
            <span className="text-sm text-ink-2">Al menos</span>
            <MinutesInput
              aria-label="Mínimo"
              invalid={Boolean(error)}
              value={toValue(box.minimumDurationMinutes)}
              onChange={(minutes) => setBox({ minimumDurationMinutes: fromValue(minutes) })}
            />
          </div>
        )}
        {box.type !== "minimum-time" && (
          <div className="flex w-40 flex-col gap-1.5">
            <span className="text-sm text-ink-2">Como máximo</span>
            <MinutesInput
              aria-label="Máximo"
              invalid={Boolean(error)}
              value={toValue(box.maximumDurationMinutes)}
              onChange={(minutes) => setBox({ maximumDurationMinutes: fromValue(minutes) })}
            />
          </div>
        )}
      </div>
      <p className={error ? "text-sm text-danger" : "text-sm text-ink-2"}>
        {error ??
          (box.type === "minimum-time"
            ? "Para vencer la resistencia inicial: te avisamos al cumplir el mínimo y puedes seguir."
            : box.type === "maximum-time"
              ? "Para que no se expanda: te avisamos antes de llegar al máximo."
              : "Un compromiso mínimo para arrancar y un límite para no pasarte.")}
      </p>
    </div>
  );
}
