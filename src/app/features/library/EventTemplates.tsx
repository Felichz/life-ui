import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { EventTemplate } from "../../../types";
import { Button, IconButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { Tooltip } from "../../components/ui/Tooltip";
import { useDayActions } from "../../state/actions";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { t } from "../../i18n";

export function EventTemplates() {
  const { state, core } = useSystem();
  const toast = useToast();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const templates = state.global.eventTemplates;

  const add = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (templates.some((template) => template.name.toLowerCase() === trimmed.toLowerCase())) {
      setError(t("events.duplicate"));
      return;
    }
    try {
      core.createEventTemplate(trimmed);
      setName("");
      setError(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const todayCounts = new Map<string, number>();
  const used = new Set<string>();
  const dayId = state.currentDay?.day.id;
  for (const instance of state.global.eventInstances) {
    used.add(instance.templateId);
    if (instance.dayId === dayId)
      todayCounts.set(instance.templateId, (todayCounts.get(instance.templateId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="max-w-xl text-base text-ink-2">{t("events.intro")}</p>
      <form onSubmit={add} className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <Input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError(null);
            }}
            placeholder={t("events.newPlaceholder")}
            aria-label={t("events.newLabel")}
            aria-invalid={Boolean(error) || undefined}
            className="flex-1"
          />
          <Button
            type="submit"
            variant="primary"
            disabled={!name.trim()}
            className="h-9 coarse:h-11"
          >
            <Plus />
            {t("common.add")}
          </Button>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
      </form>

      {templates.length > 0 && (
        <ul className="overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
          {templates.map((template) => (
            <EventRow
              key={template.id}
              template={template}
              todayCount={todayCounts.get(template.id) ?? 0}
              used={used.has(template.id)}
              canLog={Boolean(dayId)}
              onError={(message) =>
                toast({ tone: "error", title: t("error.save"), description: message })
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function EventRow({
  template,
  todayCount,
  used,
  canLog,
  onError,
}: {
  template: EventTemplate;
  todayCount: number;
  used: boolean;
  canLog: boolean;
  onError: (message: string) => void;
}) {
  const { core } = useSystem();
  const { logEvent } = useDayActions();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState(template.name);

  const save = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    try {
      core.updateEventTemplate(template.id, { name: draft.trim() });
      setEditing(false);
    } catch (caught) {
      onError(errorMessage(caught));
    }
  };

  if (editing) {
    return (
      <li className="border-b border-line px-3 py-2 last:border-b-0">
        <form onSubmit={save} className="flex items-center gap-2">
          <Input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label={t("events.nameLabel")}
            className="h-8 flex-1"
          />
          <IconButton label={t("common.save")} type="submit" size="sm">
            <Check />
          </IconButton>
          <IconButton
            label={t("common.cancel")}
            size="sm"
            onClick={() => {
              setDraft(template.name);
              setEditing(false);
            }}
          >
            <X />
          </IconButton>
        </form>
      </li>
    );
  }

  return (
    <li className="flex min-h-[48px] items-center gap-3 border-b border-line px-3 py-1.5 last:border-b-0">
      <span aria-hidden className="ml-1 size-2 shrink-0 rotate-45 bg-event" />
      <span className="min-w-0 flex-1 truncate text-base font-medium text-ink">
        {template.name}
      </span>
      {todayCount > 0 && (
        <span className="tabular text-sm text-ink-3">
          {t("events.todayCount", { count: todayCount })}
        </span>
      )}
      {confirming ? (
        <span className="flex items-center gap-1.5">
          <span className="text-sm text-ink-2">{t("common.deleteQuestion")}</span>
          <Button
            size="sm"
            variant="danger"
            onClick={() => {
              try {
                core.deleteEventTemplate(template.id);
              } catch (caught) {
                onError(errorMessage(caught));
              }
            }}
          >
            {t("common.yes")}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            {t("common.no")}
          </Button>
        </span>
      ) : (
        <>
          {canLog && (
            <Button size="sm" variant="subtle" onClick={() => logEvent(template.id)}>
              {t("events.log")}
            </Button>
          )}
          <Tooltip content={t("common.rename")}>
            <IconButton
              label={t("common.renameNamed", { name: template.name })}
              size="sm"
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </IconButton>
          </Tooltip>
          <Tooltip content={used ? t("events.keptForHistory") : t("common.delete")}>
            <span>
              <IconButton
                label={t("common.deleteNamed", { name: template.name })}
                size="sm"
                disabled={used}
                onClick={() => setConfirming(true)}
              >
                <Trash2 />
              </IconButton>
            </span>
          </Tooltip>
        </>
      )}
    </li>
  );
}
