import React, { useState, useEffect } from "react";

import { Button } from "./shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./shadcn/dialog";
import { Input } from "./shadcn/input";

import { useSystemEngineContext } from "@/core/SystemEngineContext";
import { SystemParams } from "@/core/types";
import { useUiStateContext } from "@/ui/system-context/useUiStateContext";

interface PassiveTempoConsumptionRatioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (rate: number) => Promise<void>;
  previousDayRate?: number;
}

export const PassiveTempoConsumptionRatioModal: React.FC<
  PassiveTempoConsumptionRatioModalProps
> = ({ isOpen, onClose, onConfirm, previousDayRate }) => {
  // Valor por defecto: 100% (1.0) o el valor del día anterior si existe
  const defaultValue = previousDayRate !== undefined ? previousDayRate * 100 : 100;
  const [percentageValue, setPercentageValue] = useState<number>(defaultValue);

  // Actualizar el valor cuando cambia previousDayRate
  useEffect(() => {
    if (previousDayRate !== undefined) {
      setPercentageValue(previousDayRate * 100);
    }
  }, [previousDayRate]);

  const handleRangeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setPercentageValue(value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0 && value <= 200) {
      setPercentageValue(value);
    }
  };

  const handleConfirm = async () => {
    // Convertir el porcentaje a un valor decimal (ej: 50% -> 0.5)
    const rate = percentageValue / 100;
    await onConfirm(rate);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Establecer Capacidad Energética</DialogTitle>
          <DialogDescription>
            Define qué porcentaje de tu energía crees que puedes dar hoy. Esto afectará la tasa de
            consumo pasivo de tempo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex items-center gap-4">
            <input
              type="range"
              value={percentageValue}
              min={0}
              max={200}
              step={1}
              onChange={handleRangeChange}
              className="flex-1 h-2 bg-secondary rounded-full appearance-none"
            />
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={percentageValue}
                onChange={handleInputChange}
                min={0}
                max={200}
                className="w-20"
              />
              <span>%</span>
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            <p>
              {percentageValue < 100
                ? `Hoy me siento con menos energía (${percentageValue}% de mi capacidad normal).`
                : percentageValue > 100
                  ? `Hoy me siento con más energía (${percentageValue}% de mi capacidad normal).`
                  : "Hoy me siento con mi energía normal (100%)."}
            </p>
            <p className="mt-2">
              Tasa de consumo: {(percentageValue / 100).toFixed(2)} tempo/minuto
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PassiveTempoConsumptionRatioModal;
