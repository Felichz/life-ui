import { useState, type FormEvent, type ReactNode } from "react";
import type { ActivityTemplate, ActivityType } from "../../../types";
import { Field, Input, Textarea } from "../../components/ui/Field";
import { Switch } from "../../components/ui/Switch";
import { TypeIcon } from "../../components/TypeIcon";
import { TYPE_META, settingsOf, type Settings } from "../../lib/domain";
import { cn } from "../../lib/cn";
import {
  DurationFields,
  defaultSettings,
  settingsForType,
  validateSettings,
} from "../activity/DurationFields";
import { t } from "../../i18n";

export interface TemplateDraft {
  title: string;
  description: string;
  type: ActivityType;
  settings: Settings;
  pinned: boolean;
}

export function draftFrom(template?: ActivityTemplate, initialTitle = ""): TemplateDraft {
  if (!template) {
    return {
      title: initialTitle,
      description: "",
      type: "clear-objective",
      settings: defaultSettings("clear-objective"),
      pinned: false,
    };
  }
  return {
    title: template.title,
    description: template.description,
    type: template.type,
    settings: { ...defaultSettings(template.type), ...settingsOf(template) },
    pinned: Boolean(template.pinned),
  };
}

/** Datos listos para createActivityTemplate / updateActivityTemplate. */
export function templatePayload(draft: TemplateDraft) {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    type: draft.type,
    pinned: draft.pinned,
    clearObjectiveSettings: undefined,
    flexibleDurationSettings: undefined,
    timeboxingSettings: undefined,
    ...settingsForType(draft.type, draft.settings),
  };
}

const TYPES: ActivityType[] = ["clear-objective", "flexible-duration", "timeboxing"];

interface TemplateFormProps {
  id: string;
  initial: TemplateDraft;
  onSubmit: (draft: TemplateDraft) => void;
  error?: string | null;
  /** Controles extra al final del formulario */
  children?: ReactNode;
}

export function TemplateForm({ id, initial, onSubmit, error, children }: TemplateFormProps) {
  const [draft, setDraft] = useState<TemplateDraft>(initial);
  const [touched, setTouched] = useState(false);
  const titleError = touched && !draft.title.trim() ? t("template.error.name") : null;
  const settingsError = touched ? validateSettings(draft.type, draft.settings) : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setTouched(true);
    if (!draft.title.trim() || validateSettings(draft.type, draft.settings)) return;
    onSubmit(draft);
  };

  const setType = (type: ActivityType) =>
    setDraft((current) => ({
      ...current,
      type,
      settings: { ...defaultSettings(type), ...stripEmpty(current.settings) },
    }));

  return (
    <form id={id} onSubmit={submit} noValidate className="flex flex-col gap-5">
      <Field label={t("template.name")} error={titleError}>
        {(fieldId, describedBy) => (
          <Input
            id={fieldId}
            autoFocus
            value={draft.title}
            aria-invalid={Boolean(titleError) || undefined}
            aria-describedby={describedBy}
            placeholder={t("template.namePlaceholder")}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          />
        )}
      </Field>

      <Field label={t("template.description")} hint={t("template.descriptionHint")}>
        {(fieldId, describedBy) => (
          <Textarea
            id={fieldId}
            rows={2}
            value={draft.description}
            aria-describedby={describedBy}
            onChange={(event) => setDraft({ ...draft, description: event.target.value })}
          />
        )}
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1.5 text-sm font-medium text-ink">
          {t("template.durationQuestion")}
        </legend>
        <div role="radiogroup" aria-label={t("template.type")} className="flex flex-col gap-1.5">
          {TYPES.map((type) => {
            const selected = draft.type === type;
            const meta = TYPE_META[type];
            return (
              <button
                key={type}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setType(type)}
                className={cn(
                  "flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-[border-color,background-color,box-shadow] duration-150",
                  selected
                    ? "border-accent bg-accent/5 ring-1 ring-accent"
                    : "border-line hover:border-line-strong hover:bg-subtle"
                )}
              >
                <TypeIcon type={type} boxed />
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-medium text-ink">{meta.label}</span>
                  <span className="block text-sm text-ink-2">{meta.hint}</span>
                </span>
                <span
                  aria-hidden
                  className={cn(
                    "mt-1 flex size-4 shrink-0 items-center justify-center rounded-full border",
                    selected ? "border-accent bg-accent" : "border-line-strong"
                  )}
                >
                  {selected && <span className="size-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="rounded-lg border border-line bg-subtle/60 p-3.5">
        <DurationFields
          type={draft.type}
          value={draft.settings}
          onChange={(settings) =>
            setDraft({ ...draft, settings: { ...draft.settings, ...settings } })
          }
          error={settingsError}
        />
      </div>

      <Field label={t("template.quickStart")}>
        {(fieldId) => (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-line px-3.5 py-3">
            <p className="text-sm text-ink-2">{t("template.quickStartHint")}</p>
            <Switch
              id={fieldId}
              checked={draft.pinned}
              onChange={(pinned) => setDraft({ ...draft, pinned })}
            />
          </div>
        )}
      </Field>

      {error && (
        <p role="alert" className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      {children}
    </form>
  );
}

function stripEmpty(settings: Settings): Settings {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  ) as Settings;
}
