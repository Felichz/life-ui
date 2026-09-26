import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { ActivityTemplate, UUID } from "../../../types";
import { Button } from "../../components/ui/Button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../components/ui/Dialog";
import { errorMessage, useSystem } from "../../state/system";
import { useToast } from "../../state/toast";
import { TemplateForm, draftFrom, templatePayload, type TemplateDraft } from "./TemplateForm";

interface TemplateSheetProps {
  open: boolean;
  templateId?: UUID;
  initialTitle?: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (template: ActivityTemplate) => void;
}

export function TemplateSheet({
  open,
  templateId,
  initialTitle,
  onOpenChange,
  onSaved,
}: TemplateSheetProps) {
  const { state, core } = useSystem();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const template = templateId
    ? state.global.activityTemplates.find((item) => item.id === templateId)
    : undefined;
  const inUseToday = Boolean(
    template && state.currentDay?.activityInstances.some((item) => item.templateId === template.id)
  );

  const save = (draft: TemplateDraft) => {
    try {
      const payload = templatePayload(draft);
      const saved = template
        ? core.updateActivityTemplate(template.id, payload)
        : core.createActivityTemplate({ ...payload, isSystemActivity: false });
      toast({ title: template ? "Cambios guardados" : `«${saved.title}» está en tu biblioteca` });
      setError(null);
      onSaved(saved);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  const remove = () => {
    if (!template) return;
    try {
      core.deleteActivityTemplate(template.id);
      toast({ title: `«${template.title}» eliminada de la biblioteca` });
      onOpenChange(false);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setError(null);
          setConfirmDelete(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent variant="sheet" aria-describedby={undefined}>
        <DialogHeader className="border-b border-line pb-4">
          <DialogTitle>{template ? "Editar actividad" : "Nueva actividad"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="py-5">
          {open && (
            <TemplateForm
              key={templateId ?? `new-${initialTitle ?? ""}`}
              id="template-form"
              initial={draftFrom(template, initialTitle)}
              onSubmit={save}
              error={error}
            />
          )}
        </DialogBody>
        <DialogFooter className="sm:justify-between">
          {template ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <Button variant="danger" size="sm" onClick={remove}>
                  Sí, eliminar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                className="text-danger hover:bg-danger/10 hover:text-danger sm:-ml-2"
                disabled={inUseToday}
                title={
                  inUseToday
                    ? "Está en el plan de hoy. Quítala del plan para poder eliminarla."
                    : undefined
                }
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 />
                Eliminar
              </Button>
            )
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button variant="primary" type="submit" form="template-form">
              {template ? "Guardar cambios" : "Crear actividad"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
