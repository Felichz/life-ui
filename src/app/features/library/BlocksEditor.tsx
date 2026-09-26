import { useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import type { TimeBlock } from "../../../types";
import { DayStrip } from "../../components/DayStrip";
import { Button, IconButton } from "../../components/ui/Button";
import { Input } from "../../components/ui/Field";
import { Tooltip } from "../../components/ui/Tooltip";
import { blockRange, blockStatus, sortBlocks } from "../../lib/domain";
import { formatDayMinutes, minutesOfDay, parseDayMinutes, plural } from "../../lib/format";
import { useNow } from "../../lib/useNow";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";

const PRESETS = [
  { name: "Mañana", start: 6 * 60, end: 12 * 60 },
  { name: "Tarde", start: 12 * 60, end: 18 * 60 },
  { name: "Noche", start: 18 * 60, end: 23 * 60 },
];

interface Draft {
  name: string;
  start: string;
  end: string;
}

function parseDraft(draft: Draft): { name: string; start: number; end: number } | string {
  if (!draft.name.trim()) return "Ponle un nombre al bloque.";
  const start = parseDayMinutes(draft.start);
  const end = parseDayMinutes(draft.end);
  if (start === null || end === null) return "Indica la hora de inicio y de fin.";
  if (start >= end) return "La hora de inicio tiene que ser anterior a la de fin.";
  return { name: draft.name.trim(), start, end };
}

/** El core rechaza solapamientos; lo traducimos a un mensaje que ayude. */
function friendlyError(caught: unknown): string {
  const message = errorMessage(caught);
  return /solapa/i.test(message)
    ? "Se cruza con otro bloque. Ajusta las horas para que no se solapen."
    : message;
}

export function BlocksEditor() {
  const { state, core } = useSystem();
  const toast = useToast();
  const now = minutesOfDay(useNow(30_000));
  const blocks = sortBlocks(state.global.timeBlocks);
  const timed = blocks.filter((block) => !block.isDefault);
  const [draft, setDraft] = useState<Draft>({ name: "", start: "", end: "" });
  const [error, setError] = useState<string | null>(null);

  const add = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (typeof parsed === "string") return setError(parsed);
    try {
      core.createTimeBlock(parsed.name, parsed.start, parsed.end);
      setDraft({ name: "", start: "", end: "" });
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  const usePresets = () => {
    try {
      for (const preset of PRESETS) core.createTimeBlock(preset.name, preset.start, preset.end);
      toast({
        title: "Bloques creados",
        description: "Mañana, Tarde y Noche. Puedes ajustarlos cuando quieras.",
      });
    } catch (caught) {
      toast({ tone: "error", title: "No se pudieron crear", description: friendlyError(caught) });
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-xl text-base text-ink-2">
        Los bloques dan forma a tu día. Solo puedes empezar lo que está en{" "}
        <span className="font-medium text-ink">Por hacer</span> o en el bloque de ahora; lo demás
        espera su hora.
      </p>

      <DayStrip segments={[]} events={[]} blocks={timed} nowMinute={now} size="large" />

      <ul className="overflow-hidden rounded-lg border border-line bg-panel shadow-xs">
        {blocks.map((block) =>
          block.isDefault ? (
            <li
              key={block.id}
              className="flex min-h-[52px] items-center gap-3 border-b border-line px-4 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="text-base font-medium text-ink">Por hacer</p>
                <p className="text-sm text-ink-2">Siempre disponible. Para lo que no tiene hora.</p>
              </div>
            </li>
          ) : (
            <BlockRow key={block.id} block={block} isNow={blockStatus(block, now) === "now"} />
          )
        )}
      </ul>

      {timed.length === 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-4 py-3">
          <p className="text-sm text-ink-2">¿Sin ideas? Empieza con Mañana, Tarde y Noche.</p>
          <Button variant="secondary" size="sm" onClick={usePresets}>
            Usar estos bloques
          </Button>
        </div>
      )}

      <form onSubmit={add} className="rounded-lg border border-line bg-subtle/60 p-4" noValidate>
        <h3 className="text-sm font-semibold text-ink">Nuevo bloque</h3>
        <BlockFields draft={draft} onChange={(next) => (setDraft(next), setError(null))} />
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" className="mt-3">
          <Plus />
          Añadir bloque
        </Button>
      </form>
    </div>
  );
}

function BlockFields({ draft, onChange }: { draft: Draft; onChange: (draft: Draft) => void }) {
  return (
    <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_120px_120px]">
      <Input
        value={draft.name}
        onChange={(event) => onChange({ ...draft, name: event.target.value })}
        placeholder="Nombre (Mañana, Trabajo profundo…)"
        aria-label="Nombre del bloque"
        className="col-span-2 sm:col-span-1"
      />
      <Input
        type="time"
        value={draft.start}
        onChange={(event) => onChange({ ...draft, start: event.target.value })}
        aria-label="Hora de inicio"
        className="tabular"
      />
      <Input
        type="time"
        value={draft.end}
        onChange={(event) => onChange({ ...draft, end: event.target.value })}
        aria-label="Hora de fin"
        className="tabular"
      />
    </div>
  );
}

function BlockRow({ block, isNow }: { block: TimeBlock; isNow: boolean }) {
  const { state, core } = useSystem();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [draft, setDraft] = useState<Draft>({
    name: block.name,
    start: formatDayMinutes(block.startMinute),
    end: formatDayMinutes(block.endMinute),
  });
  const [error, setError] = useState<string | null>(null);
  const planned =
    state.currentDay?.activityInstances.filter((item) => item.blockId === block.id) ?? [];
  const hasActive = planned.some((item) => item.id === state.currentDay?.activeActivityInstanceId);

  const save = (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseDraft(draft);
    if (typeof parsed === "string") return setError(parsed);
    try {
      core.updateTimeBlock(block.id, {
        name: parsed.name,
        startMinute: parsed.start,
        endMinute: parsed.end,
      });
      setEditing(false);
      setError(null);
    } catch (caught) {
      setError(friendlyError(caught));
    }
  };

  const remove = (moveToTodo: boolean) => {
    try {
      core.deleteTimeBlock(block.id, moveToTodo);
      toast({ title: `Bloque «${block.name}» eliminado` });
    } catch (caught) {
      toast({ tone: "error", title: "No se pudo eliminar", description: errorMessage(caught) });
    }
  };

  if (editing) {
    return (
      <li className="border-b border-line px-4 py-3 last:border-b-0">
        <form onSubmit={save} noValidate>
          <BlockFields draft={draft} onChange={(next) => (setDraft(next), setError(null))} />
          {error && <p className="mt-2 text-sm text-danger">{error}</p>}
          <div className="mt-2.5 flex gap-2">
            <Button type="submit" size="sm" variant="primary">
              <Check />
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="border-b border-line px-4 py-2 last:border-b-0">
      <div className="flex min-h-[40px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-base font-medium text-ink">
            {block.name}
            {isNow && (
              <span className="rounded bg-accent/10 px-1.5 py-px text-xs font-medium text-accent-ink">
                Ahora
              </span>
            )}
          </p>
          <p className="tabular text-sm text-ink-2">
            {blockRange(block)}
            {planned.length > 0 && (
              <span className="text-ink-3">
                {" "}
                · {plural(planned.length, "actividad", "actividades")} hoy
              </span>
            )}
          </p>
        </div>
        <Tooltip content="Editar">
          <IconButton label={`Editar ${block.name}`} size="sm" onClick={() => setEditing(true)}>
            <Pencil />
          </IconButton>
        </Tooltip>
        <Tooltip content={hasActive ? "Tiene la actividad en marcha" : "Eliminar"}>
          <span>
            <IconButton
              label={`Eliminar ${block.name}`}
              size="sm"
              disabled={hasActive}
              onClick={() => setConfirming(true)}
            >
              <Trash2 />
            </IconButton>
          </span>
        </Tooltip>
      </div>
      {confirming && (
        <div className="mb-1.5 mt-1 flex flex-wrap items-center gap-2 rounded-md bg-subtle px-3 py-2 text-sm">
          <span className="mr-auto text-ink-2">
            {planned.length > 0
              ? `¿Qué hacemos con sus ${planned.length} actividades de hoy?`
              : "¿Eliminar este bloque?"}
          </span>
          {planned.length > 0 ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => remove(true)}>
                Moverlas a Por hacer
              </Button>
              <Button size="sm" variant="danger" onClick={() => remove(false)}>
                Quitarlas del plan
              </Button>
            </>
          ) : (
            <Button size="sm" variant="danger" onClick={() => remove(true)}>
              Eliminar
            </Button>
          )}
          <IconButton label="Cancelar" size="sm" onClick={() => setConfirming(false)}>
            <X />
          </IconButton>
        </div>
      )}
    </li>
  );
}
