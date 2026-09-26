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
import { t } from "../../i18n";

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
      toast({ title: t("toast.saved") });
      onClose();
    } catch (caught) {
      toast({ tone: "error", title: t("error.save"), description: errorMessage(caught) });
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
                {TYPE_META[template.type].label} · {t("edit.todayOnly")}
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="flex flex-col gap-5 pb-5">
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-ink">{t("block.label")}</h3>
                <BlockPicker
                  blocks={core.getTimeBlocks()}
                  value={blockId}
                  onChange={setBlockId}
                  disabled={isActive}
                />
                {isActive && <p className="text-sm text-ink-2">{t("edit.runningStays")}</p>}
              </section>
              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-ink">{t("edit.duration")}</h3>
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
                {t("common.cancel")}
              </Button>
              <Button variant="primary" onClick={save}>
                {t("common.save")}
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
