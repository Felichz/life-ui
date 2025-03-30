import React from "react";
import { useSystem } from "../../contexts/SystemContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../shadcn/dialog";
import { Button } from "../shadcn/button";
import { Input } from "../shadcn/input";
import { Label } from "../shadcn/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../shadcn/tabs";
import { Checkbox } from "../shadcn/checkbox";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const system = useSystem();

  const handleSave = (): void => {
    // Función vacía para guardar ajustes
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Ajustes</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="notifications">Notificaciones</TabsTrigger>
            <TabsTrigger value="variables">Variables</TabsTrigger>
          </TabsList>
          <TabsContent value="general">
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="username" className="text-right">
                  Nombre de usuario
                </Label>
                <Input id="username" className="col-span-3" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label htmlFor="theme" className="text-right">
                  Tema
                </Label>
                <select id="theme" className="col-span-3">
                  <option value="light">Claro</option>
                  <option value="dark">Oscuro</option>
                  <option value="system">Sistema</option>
                </select>
              </div>
              {/* Más ajustes generales */}
            </div>
          </TabsContent>
          <TabsContent value="notifications">
            <div className="grid gap-4 py-4">
              <div className="flex items-center space-x-2">
                <Checkbox id="notify-activities" />
                <Label htmlFor="notify-activities">Notificar actividades programadas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox id="notify-reminders" />
                <Label htmlFor="notify-reminders">Recordatorios diarios</Label>
              </div>
              {/* Más ajustes de notificaciones */}
            </div>
          </TabsContent>
          <TabsContent value="variables">
            <div className="grid gap-4 py-4">{/* Ajustes de variables personalizadas */}</div>
          </TabsContent>
        </Tabs>
        <DialogFooter>
          <Button onClick={handleSave}>Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsModal;
