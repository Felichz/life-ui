import { UtilityService } from "../../../system/utilityService";
import type { ISODateTimeString, DayMinutes } from "../../../types";

/**
 * Convierte una fecha ISO a minutos desde el inicio del día (0-1439)
 * @param isoDate Fecha en formato ISO
 * @returns Minutos desde las 00:00 del día
 */
export const convertISOtoMinutes = (isoDate: ISODateTimeString): DayMinutes => {
  const date = new Date(isoDate);
  return date.getHours() * 60 + date.getMinutes();
};

/**
 * Calcula la posición porcentual para CSS basada en minutos
 * @param minutes Minutos desde el inicio del día
 * @returns Porcentaje (0-100)
 */
export const calculatePosition = (minutes: DayMinutes): number => {
  // Asegurar que el valor esté en el rango válido
  const validMinutes = Math.min(Math.max(0, minutes), 1439);
  // Convertir a porcentaje (1440 minutos = 100%)
  return (validMinutes / 1440) * 100;
};

/**
 * Formatea minutos a formato de hora "HH:MM"
 * @param minutes Minutos desde el inicio del día
 * @returns Hora formateada
 */
export const formatMinutesToTime = (minutes: number): string => {
  // Validar que los minutos estén dentro del rango permitido
  if (minutes < 0 || minutes > 1439) {
    throw new Error("Los minutos del día deben estar entre 0 y 1439");
  }

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
};

/**
 * Formatea duración en minutos a formato legible
 * @param minutes Cantidad de minutos
 * @returns Duración formateada
 */
export const formatDuration = (minutes: number): string => {
  return UtilityService.formatDuration(minutes);
};

/**
 * Genera un color basado en estado y tipo
 * @param state Estado de la actividad ("completed" | "interrupted")
 * @returns Código de color CSS
 */
export const getActivityColor = (
  state: "completed" | "interrupted",
  isWithinEstimation?: boolean
): string => {
  if (state === "completed") {
    return isWithinEstimation ? "#4caf50" : "#2196f3"; // Verde o azul
  } else {
    return isWithinEstimation ? "#ff9800" : "#f44336"; // Naranja o rojo
  }
};
