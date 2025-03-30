import React from "react";
import { useSystem } from "../../contexts/SystemContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../shadcn/dialog";
import { Button } from "../shadcn/button";
import { Input } from "../shadcn/input";
import { Label } from "../shadcn/label";

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  activityId?: string; // Si está presente, estamos editando una actividad existente
}

const ActivityFormModal: React.FC<ActivityFormModalProps> = ({ isOpen, onClose, activityId }) => {
  const system = useSystem();

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    // Función vacía para el submit del formulario
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{activityId ? "Editar Actividad" : "Crear Actividad"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input id="name" className="col-span-3" />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="duration" className="text-right">
                Duración (min)
              </Label>
              <Input id="duration" type="number" className="col-span-3" />
            </div>
            {/* Campos adicionales del formulario */}
          </div>
          <DialogFooter>
            <Button type="submit">Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ActivityFormModal;
