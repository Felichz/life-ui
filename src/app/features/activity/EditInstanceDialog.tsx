import { useEffect, useState } from "react";
import type { UUID } from "../../../types";
import { Button } from "../../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog";
import { TYPE_META, settingsOf, templateMap, type Settings } from "../../lib/domain";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { BlockPicker } from "./BlockPicker";
import {
  DurationFields,
  defaultSettings,
  settingsForType,
  validateSettings,
} from "./DurationFields";

/** Ajusta bloque y duración de una actividad del plan de hoy. */
export function EditInstanceDialog({
  instanceId,
  onClose,
}: {
  instanceId: UUID | null;
  onClose: () => void;
}) {
  const { state, core } = useSystem();
  const toast = useToast();
  const instance = state.currentDay?.activityInstances.find((item) => item.id === instanceId);
  const template = instance ? templateMap(state).get(instance.templateId) : undefined;
  const isActive = instance?.id === state.currentDay?.activeActivityInstanceId;

  const [blockId, setBlockId] = useState<UUID>("");
  const [settings, setSettings] = useState<Settings>({});
  const [touched, setTouched] = useState(false);

  useEffect(() => {
    if (instance && template) {
      setBlockId(instance.blockId);
      setSettings({
        ...defaultSettings(template.type),
        ...settingsOf(template),
        ...stripUndefined(settingsOf(instance)),
      });
      setTouched(false);
    }
    // Solo al abrir otra instancia
  }, [instanceId]);

  const open = Boolean(instance && template);
  const error = touched && template ? validateSettings(template.type, settings) : null;

  const save = () => {
    if (!instance || !template) return;
    setTouched(true);
    if (validateSettings(template.type, settings)) return;
    try {
      core.updateActivityInstance(instance.id, settingsForType(template.type, settings));
      if (blockId !== instance.blockId && !isActive)
        core.moveActivityInstance(instance.id, blockId);
      toast({ title: "Cambios guardados" });
      onClose();
    } catch (caught) {
      toast({ tone: "error", title: "No se pudo guardar", description: errorMessage(caught) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent size="md">
        {instance && template && (
          <>
            <DialogHeader>
              <DialogTitle>{template.title}</DialogTitle>
              <DialogDescription>
                {TYPE_META[template.type].label} · Los cambios valen solo para hoy; la biblioteca no
                cambia.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-5 pb-5">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-ink">Bloque</h3>
                <BlockPicker
                  blocks={core.getTimeBlocks()}
                  value={blockId}
                  onChange={setBlockId}
                  disabled={isActive}
                />
                {isActive && (
                  <p className="text-sm text-ink-2">
                    Está en marcha, así que se queda en su bloque.
                  </p>
                )}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-ink">Duración</h3>
                <div className="rounded-lg border border-line bg-subtle/60 p-3.5">
                  <DurationFields
                    type={template.type}
                    value={settings}
                    onChange={(next) => setSettings({ ...settings, ...next })}
                    error={error}
                  />
                </div>
              </section>
            </DialogBody>
            <DialogFooter>
              <Button variant="secondary" onClick={onClose}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={save}>
                Guardar
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function stripUndefined(settings: Settings): Settings {
  return Object.fromEntries(
    Object.entries(settings).filter(([, value]) => value !== undefined)
  ) as Settings;
}
