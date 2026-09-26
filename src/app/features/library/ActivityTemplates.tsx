import { useMemo, useState } from "react";
import { CalendarPlus, Pin, Plus, Search } from "lucide-react";
import type { ActivityType } from "../../../types";
import { Button, IconButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { Segmented } from "../../components/ui/Segmented";
import { Tooltip } from "../../components/ui/Tooltip";
import { TypeIcon } from "../../components/TypeIcon";
import { TYPE_META, contractOf } from "../../lib/domain";
import { cn } from "../../lib/cn";
import { formatNumber } from "../../lib/format";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { useShell } from "../../shell/ShellContext";

type Filter = "all" | ActivityType;

const normalize = (text: string) => text.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

export function ActivityTemplates() {
  const { state, core } = useSystem();
  const { openTemplateEditor, openAddActivity } = useShell();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const dayActive = Boolean(state.currentDay);

  const usage = useMemo(() => {
    const stats = new Map<string, { count: number; satisfaction: number }>();
    for (const record of state.global.completedActivityRecords) {
      if (record.state !== "completed") continue;
      const current = stats.get(record.templateId) ?? { count: 0, satisfaction: 0 };
      current.count += 1;
      current.satisfaction += record.satisfactionScore ?? 0;
      stats.set(record.templateId, current);
    }
    return stats;
  }, [state.global.completedActivityRecords]);

  const templates = useMemo(() => {
    const words = normalize(query).split(/\s+/).filter(Boolean);
    return state.global.activityTemplates
      .filter((template) => filter === "all" || template.type === filter)
      .filter((template) =>
        words.every((word) => normalize(`${template.title} ${template.description}`).includes(word))
      )
      .sort(
        (a, b) =>
          Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) ||
          a.title.localeCompare(b.title, "es")
      );
  }, [filter, query, state.global.activityTemplates]);

  const togglePin = (id: string, pinned: boolean) => {
    try {
      core.updateActivityTemplate(id, { pinned });
    } catch (caught) {
      toast({ tone: "error", title: "No se pudo actualizar", description: errorMessage(caught) });
    }
  };

  if (state.global.activityTemplates.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-panel px-6 py-8 shadow-xs">
        <h2 className="text-lg font-semibold text-ink">Crea tu primera actividad</h2>
        <p className="mt-1 max-w-lg text-base text-ink-2">
          Una actividad es algo que repites: escribir, leer, revisar el correo. Al crearla eliges
          cómo es su duración:
        </p>
        <ul className="mt-5 flex flex-col gap-3">
          {(Object.keys(TYPE_META) as ActivityType[]).map((type) => (
            <li key={type} className="flex gap-3">
              <TypeIcon type={type} boxed />
              <div>
                <p className="text-base font-medium text-ink">{TYPE_META[type].label}</p>
                <p className="text-sm text-ink-2">{TYPE_META[type].hint}</p>
              </div>
            </li>
          ))}
        </ul>
        <Button variant="primary" className="mt-6" onClick={() => openTemplateEditor()}>
          <Plus />
          Nueva actividad
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar actividades"
            aria-label="Buscar actividades"
            className="pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Segmented
            label="Filtrar por tipo"
            size="sm"
            value={filter}
            onChange={setFilter}
            className="flex-1 sm:flex-none"
            options={[
              { value: "all", label: "Todas" },
              { value: "clear-objective", label: "Objetivo" },
              { value: "flexible-duration", label: "Flexible" },
              { value: "timeboxing", label: "Timebox" },
            ]}
          />
          <Button variant="primary" onClick={() => openTemplateEditor()}>
            <Plus />
            <span className="hidden sm:inline">Nueva</span>
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-2">
          Ninguna actividad coincide con la búsqueda.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
          {templates.map((template) => {
            const contract = contractOf(template.type, template);
            const stats = usage.get(template.id);
            return (
              <li
                key={template.id}
                className="group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-subtle"
              >
                <TypeIcon type={template.type} boxed />
                <button
                  type="button"
                  onClick={() => openTemplateEditor({ templateId: template.id })}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-base font-medium text-ink group-hover:underline">
                      {template.title}
                    </span>
                  </span>
                  <span className="block truncate text-sm text-ink-2">
                    {TYPE_META[template.type].label}
                    {contract && <span className="tabular"> · {contract.label}</span>}
                    {stats && (
                      <span className="text-ink-3">
                        {" "}
                        · {stats.count === 1 ? "1 vez" : `${stats.count} veces`} · media{" "}
                        {formatNumber(stats.satisfaction / stats.count, 1)}
                      </span>
                    )}
                  </span>
                </button>
                <Tooltip
                  content={
                    template.pinned ? "Quitar de accesos rápidos" : "Anclar en accesos rápidos"
                  }
                >
                  <IconButton
                    label={
                      template.pinned ? "Quitar de accesos rápidos" : "Anclar en accesos rápidos"
                    }
                    size="sm"
                    onClick={() => togglePin(template.id, !template.pinned)}
                    className={cn(template.pinned && "text-accent-ink")}
                  >
                    <Pin className={cn(template.pinned && "fill-current")} />
                  </IconButton>
                </Tooltip>
                {dayActive && (
                  <Tooltip content="Añadir al plan de hoy">
                    <IconButton
                      label={`Añadir ${template.title} a hoy`}
                      size="sm"
                      onClick={() => openAddActivity({ templateId: template.id })}
                    >
                      <CalendarPlus />
                    </IconButton>
                  </Tooltip>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
