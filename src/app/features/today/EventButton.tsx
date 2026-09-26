import { useState, type FormEvent } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Flag, Plus } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Tooltip } from "../../components/ui/Tooltip";
import { useHotkey } from "../../lib/useHotkey";
import { useDayActions } from "../../state/actions";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";

/** Registrar un evento puntual ("Café", "Ibuprofeno") en dos toques. */
export function EventButton() {
  const { state, core } = useSystem();
  const { logEvent } = useDayActions();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const templates = state.global.eventTemplates;

  useHotkey("e", () => setOpen(true));

  const createAndLog = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      const existing = templates.find(
        (template) => template.name.toLowerCase() === trimmed.toLowerCase()
      );
      logEvent((existing ?? core.createEventTemplate(trimmed)).id);
      setName("");
      setOpen(false);
    } catch (caught) {
      toast({
        tone: "error",
        title: "No se pudo crear el evento",
        description: errorMessage(caught),
      });
    }
  };

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tooltip content="Registrar evento" shortcut={["E"]}>
        <Popover.Trigger asChild>
          <Button variant="secondary">
            <Flag />
            <span className="hidden sm:inline">Evento</span>
          </Button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(300px,calc(100vw-24px))] rounded-lg border border-line bg-panel p-1.5 shadow-pop data-[state=open]:animate-pop-in"
        >
          <p className="px-2 pb-1.5 pt-1 text-xs font-medium text-ink-3">Registrar ahora</p>
          {templates.length > 0 && (
            <div className="flex max-h-60 flex-col overflow-y-auto">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => {
                    logEvent(template.id);
                    setOpen(false);
                  }}
                  className="flex h-9 items-center gap-2.5 rounded px-2 text-left text-base text-ink transition-colors hover:bg-hover focus-visible:bg-hover coarse:h-11"
                >
                  <span aria-hidden className="size-2 rotate-45 bg-event" />
                  {template.name}
                </button>
              ))}
            </div>
          )}
          <form
            onSubmit={createAndLog}
            className="mt-1 flex gap-1.5 border-t border-line px-1 pb-0.5 pt-2"
          >
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={templates.length ? "Otro evento…" : "Café, ibuprofeno, llamada…"}
              aria-label="Nuevo evento"
              className="h-8 min-w-0 flex-1 rounded border border-line bg-panel px-2 text-sm outline-none placeholder:text-ink-3 focus:border-accent coarse:h-10"
            />
            <Button
              type="submit"
              size="sm"
              variant="subtle"
              disabled={!name.trim()}
              className="h-8 coarse:h-10"
            >
              <Plus />
              Registrar
            </Button>
          </form>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
