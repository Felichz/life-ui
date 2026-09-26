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
   *
   * En el MVP v3 esto es **métrica informativa únicamente**: no se usa
   * para calcular bonus automático en la fórmula de tempos. Sirve como
   * dato del record (`beatEstimate: boolean`) y se muestra en el modal
   * de completion como "✓ batiste el estimado". El usuario decide
   * explícitamente el bonus moviendo el slider a 8/9/10.
   *
   * Regla: solo `clear-objective` con estimado puntual puede batir.
   * `flexible-duration` (rango) y `timeboxing` (ventana intencional)
   * no son elegibles.
   *
   * @param activityType Tipo de actividad
   * @param actualMinutes Duración real en minutos
   * @param estimatedMinutes Duración estimada (solo presente para clear-objective)
   * @returns true si cumple la condición para `beatEstimate`
   */
  public static calculateBeatEstimate(
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
   * Score divisor: el porcentaje de recompensa se calcula como
   * `score / SCORE_DIVISOR`, donde SCORE_DIVISOR es el score que
   * representa 100% de la base.
   *
   * Diseño MVP v3.1:
   * - score 0  → 0%   (no completó)
   * - score 1  → 14%  (1/7)
   * - score 5  → 71%  (5/7)
   * - score 7  → 100% (default)
   * - score 10 → 143% (10/7)
   *
   * Fórmula completa: `tempos = ceil(baseMinutos × score / SCORE_DIVISOR)`.
   *
   * Ejemplo: tarea estimada 30 min, score 5 → ceil(30 × 5 / 7) = 22.
   *
   * **Esta constante es la fuente única de verdad**: tanto el cálculo
   * final (`calculateTemposAwarded`) como el preview en vivo
   * (`calculatePreviewTempos`) la consumen. Si cambia, ambos se
   * actualizan automáticamente.
   */
  public static readonly SCORE_DIVISOR = 7;

  /**
   * Resuelve la base sobre la que se calculan los tempos: estimado si
   * es válido (número > 0), sino duración real. Si ambos son 0/negativos,
   * retorna 0.
   *
   * Esta es la **fuente única** de la lógica "estimado o duración". Si
   * cambia (por ejemplo, para añadir un fallback o log), tanto el cálculo
   * final (`calculateTemposAwarded`) como el preview de la UI
   * (`calculatePreviewTempos`) la usan a través de este helper.
   *
   * Importante: `estimatedMinutes === 0` NO se considera válido (no es
   * un estimado real). Esto previene el bug en el que un estado legacy
   * o corrupto con estimado 0 hacía divergir el preview del core.
   *
   * @param estimatedMinutes Estimado de la actividad (puede ser undefined,
   *   null, 0 o negativo)
   * @param durationMinutes Duración real (puede ser 0 si se confirmó
   *   en los primeros 30s)
   * @returns La base resuelta (>= 0)
   */
  public static resolveBaseMinutes(
    estimatedMinutes: number | undefined | null,
    durationMinutes: number
  ): number {
    const estimated =
      typeof estimatedMinutes === "number" && estimatedMinutes > 0
        ? estimatedMinutes
        : durationMinutes;
    return estimated > 0 ? estimated : 0;
  }

  /**
   * Calcula el preview de tempos para un score y baseMinutos dados.
   * Usado por la UI (CompletionModal) para mostrar en vivo cuántos
   * tempos recibirá el usuario según el score seleccionado.
   *
   * Equivalente a `calculateTemposAwarded` pero sin requerir todos los
   * parámetros de duración/estimado — solo la base (que el caller
   * ya calculó como estimado o duración real) y el score actual del
   * slider.
   *
   * Fórmula: `tempos = ceil(baseMinutes × score / SCORE_DIVISOR)`.
   * Garantía: **el preview SIEMPRE coincide con el cálculo final del
   * core**. Si la fórmula cambia aquí, el preview se actualiza en la
   * misma operación.
   *
   * @param score Score 0-10 actual del slider
   * @param baseMinutes Base sobre la que se calcula (estimado si hay, sino
   *   duración real). Math.ceil aplicado al final.
   * @returns Total de tempos que se otorgarían al confirmar
   */
  public static calculatePreviewTempos(score: number, baseMinutes: number): number {
    if (typeof score !== "number" || !Number.isInteger(score)) return 0;
    if (score < 0 || score > 10) return 0;
    if (typeof baseMinutes !== "number" || baseMinutes <= 0) return 0;

    // Fórmula lineal: ceil(base × score / 7)
    return Math.ceil((baseMinutes * score) / UtilityService.SCORE_DIVISOR);
  }

  /**
   * Calcula la recompensa de tempos por una actividad completada.
   *
   * Fórmula: `tempos = ceil(baseMinutos × score / SCORE_DIVISOR)`,
   * donde baseMinutos viene de `resolveBaseMinutes(estimado, duración)`.
   *
   * Reglas:
   * - score inválido (< 0 o > 10, no entero) → 0 tempos
   * - score 0 → 0 tempos (no completó)
   * - score 1-10 → ceil(baseMinutos × score / 7). Escala lineal: cada
   *   punto del slider aumenta la recompensa un ~14% de la base.
   * - Base:
   *     - Si hay estimado válido (> 0), se premia sobre el estimado.
   *       Esto evita el bug de "0 tempos porque la actividad estuvo activa
   *       menos de 1 minuto y Math.round devolvió 0".
   *     - Si no hay estimado, se premia sobre la duración real.
   *     - Si ambos son 0/negativos, retorna 0 (no se premia nada).
   *
   * @param durationMinutes Duración real invertida (puede ser 0 si se
   *   acaba de iniciar y se confirma honestamente).
   * @param satisfactionScore Auto-evaluación 0-10
   * @param estimatedMinutes Estimado original (si hay). Si no, se usa
   *   durationMinutes como base.
   * @returns Total de tempos otorgados (>= 0)
   */
  public static calculateTemposAwarded(
    durationMinutes: number,
    satisfactionScore: number,
    estimatedMinutes: number | undefined
  ): number {
    // Validaciones de entrada: durationMinutes puede ser 0 si el usuario
    // confirma honestamente en los primeros 30s y Math.round redondea a 0.
    // El bug original era retornar 0 en ese caso; ahora usamos el
    // estimado si está disponible (ver resolveBaseMinutes).
    if (typeof durationMinutes !== "number" || durationMinutes < 0) return 0;
    if (typeof satisfactionScore !== "number") return 0;
    if (satisfactionScore < 0 || satisfactionScore > 10) return 0;
    if (!Number.isInteger(satisfactionScore)) return 0;

    // Base resuelta por helper compartido con calculatePreviewTempos.
    // estimatedMinutes === 0 o negativo NO es válido: cae a durationMinutes.
    const base = UtilityService.resolveBaseMinutes(estimatedMinutes, durationMinutes);

    // Delegamos al helper compartido (misma fuente que el preview).
    return UtilityService.calculatePreviewTempos(satisfactionScore, base);
  }
}
