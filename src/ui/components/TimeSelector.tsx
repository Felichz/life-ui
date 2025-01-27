import React from "react";

import { Label } from "./shadcn/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./shadcn/select";

interface TimeSelectorProps {
  value: number; // valor en minutos (0-1440)
  onChange: (minutes: number) => void;
  label?: string;
  className?: string;
}

export const TimeSelector: React.FC<TimeSelectorProps> = ({
  value,
  onChange,
  label,
  className,
}) => {
  // Convertir minutos a horas y minutos
  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  // Manejar cambios en horas y minutos
  const handleHourChange = (newHour: string) => {
    const newMinutes = parseInt(newHour) * 60 + minutes;
    onChange(newMinutes);
  };

  const handleMinuteChange = (newMinute: string) => {
    const newMinutes = hours * 60 + parseInt(newMinute);
    onChange(newMinutes);
  };

  return (
    <div className={className}>
      {label && <Label className="mb-2">{label}</Label>}
      <div className="flex gap-2">
        <Select value={hours.toString()} onValueChange={handleHourChange}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="Hora" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Array.from({ length: 24 }, (_, i) => (
              <SelectItem key={i} value={i.toString()}>
                {i.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={minutes.toString()} onValueChange={handleMinuteChange}>
          <SelectTrigger className="w-[110px]">
            <SelectValue placeholder="Minutos" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
              <SelectItem key={minute} value={minute.toString()}>
                :{minute.toString().padStart(2, "0")}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
