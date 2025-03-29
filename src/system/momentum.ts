import type { Activity, SharedState } from "../types";

/**
 * Módulo para el cálculo y actualización del momentum (flujo de productividad)
 */
export class MomentumManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Calcula el valor actual del momentum del sistema.
   *
   * Fórmula:
   *    M = (Σ exp(-λ Δtᵢ) · sᵢ) / (Σ exp(-λ Δtᵢ))
   *
   * Donde:
   * - sᵢ es el score de la actividad i, que puede combinar eficiencia, penalización por interrupciones y satisfacción.
   * - Δtᵢ es el tiempo transcurrido (en segundos) desde la finalización de la actividad i hasta el momento actual.
   * - λ es el parámetro de decaimiento.
   *
   * Precondiciones:
   * - El estado debe contar con un historial de actividades completadas (dayHistory.activityHistory).
   * - Cada actividad considerada debe tener estado "completed" y un valor definido en instance.endTime.
   *
   * Postcondiciones:
   * - Se retorna un número normalizado entre 0 y 100, donde 0 indica bajo momentum y 100 un flujo óptimo.
   */
  public async calculateMomentum(): Promise<number> {
    // Obtener la marca de tiempo actual (Unix timestamp en segundos)
    const now = Math.floor(Date.now() / 1000);
    // Parámetro de decaimiento (ajustable según pruebas y experiencia)
    const lambda = 0.001;

    // Filtrar actividades completadas que tengan registrado endTime
    const completedActivities = this.state.currentDay.dayHistory.activityHistory.filter(
      (activity) =>
        activity.status === "completed" &&
        activity.instance !== undefined &&
        activity.instance.endTime !== undefined
    );

    let numerator = 0;
    let denominator = 0;

    for (const activity of completedActivities) {
      // Calcular el tiempo transcurrido desde la finalización de la actividad
      const deltaTime = now - activity.instance!.endTime!;
      // Factor de decaimiento exponencial
      const decay = Math.exp(-lambda * deltaTime);
      // Calcular el score de la actividad (por ejemplo, basado en eficiencia y satisfacción)
      const score = this.computeActivityScore(activity);
      numerator += decay * score;
      denominator += decay;
    }

    // Si no hay actividades, el momentum se considera 0
    const rawMomentum = denominator === 0 ? 0 : numerator / denominator;
    // Normalizar a una escala de 0 a 100
    const normalizedMomentum = Math.min(100, Math.max(0, rawMomentum * 100));
    return normalizedMomentum;
  }

  /**
   * Actualiza el valor del momentum en el estado global.
   *
   * Precondiciones:
   * - Debe poder calcularse el momentum correctamente.
   *
   * Postcondiciones:
   * - Se actualiza el registro del momentum en el estado (por ejemplo, agregándolo al historial).
   */
  public async updateMomentum(): Promise<void> {
    const momentum = await this.calculateMomentum();
    // Creamos un registro del momentum actual
    const momentumRecord = {
      timestamp: Math.floor(Date.now() / 1000),
      value: momentum,
    };

    // Actualizamos el historial de momentum en el estado global
    this.state.currentDay.dayHistory.momentumHistory.push(momentumRecord);
  }

  /**
   * Calcula el score de una actividad, combinando:
   * - Eficiencia: basada en la relación entre el tiempo real (actualMinutes) y el estimado (estimatedMinutes).
   * - Penalización por interrupciones: se reduce el score si la actividad fue interrumpida.
   * - Satisfacción: se obtiene desde el historial de satisfacción de actividades completadas.
   *
   * Precondiciones:
   * - Para actividades de tipo "goalOriented", se espera que exista dynamicProps.estimatedMinutes.
   * - La actividad debe estar completada para buscar la satisfacción.
   *
   * Postcondiciones:
   * - Se retorna un número representando el score de la actividad.
   */
  private computeActivityScore(activity: Activity): number {
    if (activity.type === "goalOriented") {
      const estimated = activity.dynamicProps.estimatedMinutes;
      // Si no se tiene tiempo real registrado, asumimos que se cumplió la estimación.
      const actual = activity.instance?.actualMinutes ?? estimated;
      // Evitar división por cero.
      const ratio = estimated > 0 ? actual / estimated : 1;
      // Eficiencia: cuanto más cerca de 1, mejor.
      const efficiency = 1 / ratio;
      // Penalización: si la actividad fue interrumpida, se reduce el score.
      const penalty = activity.status === "interrupted" ? 0.5 : 1;
      // Obtener la satisfacción desde el historial, si la actividad está completada.
      const satisfaction = this.getActivitySatisfaction(activity);
      return efficiency * penalty * satisfaction;
    } else {
      // Para otros tipos de actividad, se puede definir un score predeterminado.
      return 1;
    }
  }

  /**
   * Busca en el historial de satisfacción la puntuación para la actividad.
   *
   * Precondiciones:
   * - La actividad debe estar completada y tener un identificador único en su instancia.
   *
   * Postcondiciones:
   * - Si se encuentra un registro, se retorna la satisfacción normalizada (por ejemplo, de 1 a 1, asumiendo escala 1-10).
   * - Si no se encuentra, se retorna 1 como valor neutro.
   */
  private getActivitySatisfaction(activity: Activity): number {
    if (activity.status === "completed" && activity.instance && activity.instance.id) {
      // Suponiendo que el historial de satisfacción está en state.dayHistory.satisfactionHistory.
      const satisfactionRecord = this.state.currentDay.dayHistory.satisfactionHistory.find(
        (record) => record.activityId === activity.instance!.id
      );

      if (satisfactionRecord) {
        return satisfactionRecord.satisfactionScore / 10;
      }
    }
    return 1;
  }
}
