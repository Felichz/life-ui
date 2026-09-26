import type { ActivityType, TimeboxingType } from "../../../types";
import { Field, MinutesInput } from "../../components/ui/Field";
import { Segmented } from "../../components/ui/Segmented";
import type { Settings } from "../../lib/domain";
import { t } from "../../i18n";

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
      : t("duration.error.estimate");
  }
  if (type === "flexible-duration") {
    const range = settings.flexibleDurationSettings;
    if (
      !range ||
      !positive(range.minimumDurationMinutes) ||
      !positive(range.maximumDurationMinutes)
    ) {
      return t("duration.error.range");
    }
    return range.maximumDurationMinutes >= range.minimumDurationMinutes
      ? null
      : t("duration.error.maxBelowMin");
  }
  const box = settings.timeboxingSettings;
  if (!box) return t("duration.error.timebox");
  if (box.type !== "maximum-time" && !positive(box.minimumDurationMinutes))
    return t("duration.error.min");
  if (box.type !== "minimum-time" && !positive(box.maximumDurationMinutes))
    return t("duration.error.max");
  if (
    box.type === "both" &&
    (box.maximumDurationMinutes ?? 0) <= (box.minimumDurationMinutes ?? 0)
  ) {
    return t("duration.error.maxAboveMin");
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
      <Field label={t("closing.estimate")} hint={t("duration.estimateHint")} error={error}>
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
        <p className="text-sm font-medium text-ink">{t("duration.rangeLabel")}</p>
        <div className="flex items-center gap-2">
          <div className="w-40">
            <MinutesInput
              aria-label={t("duration.minimum")}
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
          <span className="text-sm text-ink-2">{t("duration.and")}</span>
          <div className="w-40">
            <MinutesInput
              aria-label={t("duration.maximum")}
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
          {error ?? t("duration.rangeHint")}
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
        <p className="text-sm font-medium text-ink">{t("duration.timeboxType")}</p>
        <Segmented
          label={t("duration.timeboxType")}
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
            { value: "minimum-time", label: t("duration.minimum") },
            { value: "maximum-time", label: t("duration.maximum") },
            { value: "both", label: t("duration.both") },
          ]}
          className="w-full sm:w-auto"
        />
      </div>
      <div className="flex flex-wrap items-end gap-3">
        {box.type !== "maximum-time" && (
          <div className="flex w-40 flex-col gap-1.5">
            <span className="text-sm text-ink-2">{t("duration.atLeast")}</span>
            <MinutesInput
              aria-label={t("duration.minimum")}
              invalid={Boolean(error)}
              value={toValue(box.minimumDurationMinutes)}
              onChange={(minutes) => setBox({ minimumDurationMinutes: fromValue(minutes) })}
            />
          </div>
        )}
        {box.type !== "minimum-time" && (
          <div className="flex w-40 flex-col gap-1.5">
            <span className="text-sm text-ink-2">{t("duration.atMost")}</span>
            <MinutesInput
              aria-label={t("duration.maximum")}
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
            ? t("duration.hint.min")
            : box.type === "maximum-time"
              ? t("duration.hint.max")
              : t("duration.hint.both"))}
      </p>
    </div>
  );
}
