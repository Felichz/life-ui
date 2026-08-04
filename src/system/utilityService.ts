import { v4 as uuidv4 } from "uuid";
import type { UUID, ISODateTimeString, DayMinutes } from "../types";

/**
 * Servicio de utilidades compartidas para el sistema Qualia Control
 * Proporciona funciones comunes para evitar duplicación de código
 */
export class UtilityService {
  /**
   * Genera un identificador único en formato UUID
   * @returns UUID generado
   */
  public static generateUUID(): UUID {
    return uuidv4();
  }

  /**
   * Obtiene la fecha y hora actual en formato ISO
   * @returns Cadena de fecha/hora en formato ISO
   */
  public static getCurrentISODateTime(): ISODateTimeString {
    return new Date().toISOString();
  }

  /**
   * Calcula los minutos transcurridos desde las 00:00 del día actual
   * @returns Minutos transcurridos (0-1439)
   */
  public static getCurrentDayMinutes(): DayMinutes {
    const now = new Date();
    return now.getHours() * 60 + now.getMinutes();
  }

  /**
   * Formatea minutos a texto legible (ej. "1h 30m")
   * @param minutes Cantidad de minutos
   * @returns Texto formateado
   */
  public static formatDuration(minutes: number): string {
    if (isNaN(minutes) || minutes < 0) {
      throw new Error("Los minutos deben ser un número positivo");
    }

    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours === 0) {
      return `${mins}m`;
    } else if (mins === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${mins}m`;
    }
  }

  /**
   * Convierte minutos del día a formato hora (ej. "14:30")
   * @param dayMinutes Minutos transcurridos desde las 00:00 (0-1439)
   * @returns Hora formateada (ej. "14:30")
   */
  public static formatTime(dayMinutes: DayMinutes): string {
    if (isNaN(dayMinutes) || dayMinutes < 0 || dayMinutes >= 24 * 60) {
      throw new Error("Los minutos del día deben estar entre 0 y 1439");
    }

    const hours = Math.floor(dayMinutes / 60);
    const minutes = dayMinutes % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  /**
   * Convierte una cadena de hora a minutos del día
   * @param timeString Cadena en formato "HH:MM" (ej. "14:30")
   * @returns Minutos del día (0-1439)
   */
  public static parseTime(timeString: string): DayMinutes {
    // Valida el formato "HH:MM"
    const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
    if (!timeRegex.test(timeString)) {
      throw new Error('Formato de hora inválido. Debe ser "HH:MM"');
    }

    const [hoursStr, minutesStr] = timeString.split(":");
    const hours = parseInt(hoursStr, 10);
    const minutes = parseInt(minutesStr, 10);

    return hours * 60 + minutes;
  }

  /**
   * Realiza una copia profunda de un objeto
   * @param obj Objeto a copiar
   * @returns Copia profunda del objeto
   */
  public static deepCopy<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    // Manejo especial para instancias de Date
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as unknown as T;
    }

    // Para arrays, usar map y recursión
    if (Array.isArray(obj)) {
      return obj.map((item) => UtilityService.deepCopy(item)) as unknown as T;
    }

    // Para objetos regulares
    const copy = {} as Record<string, unknown>;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        copy[key] = UtilityService.deepCopy((obj as Record<string, unknown>)[key]);
      }
    }

    return copy as T;
  }

  /**
   * Determina si una actividad cumple la condición de "beat estimate".
   * El bonus SOLO aplica si el tipo es clear-objective y hay un estimado puntual.
   *
   * @param activityType Tipo de actividad
   * @param actualMinutes Duración real en minutos
   * @param estimatedMinutes Duración estimada (solo presente para clear-objective)
   * @returns true si cumple la condición para aplicar bonus
   */
  public static shouldApplyBonus(
    activityType: "clear-objective" | "flexible-duration" | "timeboxing",
    actualMinutes: number,
    estimatedMinutes: number | undefined
  ): boolean {
    if (activityType !== "clear-objective") return false;
    if (typeof estimatedMinutes !== "number" || estimatedMinutes <= 0) return false;
    if (actualMinutes <= 0) return false;
    return actualMinutes <= estimatedMinutes * 0.8;
  }

  /**
   * Calcula la recompensa de tempos por una actividad completada.
   *
   * Reglas:
   * - score === 0 → 0 tempos (coherencia)
   * - durationMinutes <= 0 → 0 tempos (no se premia tiempo nulo)
   * - score inválido (< 0 o > 10) → 0 tempos
   * - base = ceil(durationMinutes × score / 10) (siempre a favor del usuario)
   * - bonus = +5 si shouldApplyBonus(...) y score > 0
   *
   * @param durationMinutes Duración real invertida
   * @param satisfactionScore Auto-evaluación 0-10
   * @param canApplyBonus Si la actividad es elegible para bonus
   * @returns Total de tempos otorgados (>= 0)
   */
  public static calculateTemposAwarded(
    durationMinutes: number,
    satisfactionScore: number,
    canApplyBonus: boolean
  ): number {
    if (typeof durationMinutes !== "number" || durationMinutes <= 0) return 0;
    if (typeof satisfactionScore !== "number") return 0;
    if (satisfactionScore < 0 || satisfactionScore > 10) return 0;
    if (satisfactionScore === 0) return 0;

    const baseTempos = Math.ceil((durationMinutes * satisfactionScore) / 10);
    const bonusTempos = canApplyBonus ? 5 : 0;

    return baseTempos + bonusTempos;
  }
}
