// Qualia Control - Events & Interruptions Management Module

import type {
  DiscreteEvent,
  EventId,
  InterruptionCause,
  InterruptionCauseId,
  SharedState,
} from "../types";

/**
 * Módulo para la gestión de eventos discretos y causas de interrupción
 */
export class EventManagement {
  private state: SharedState;

  constructor(state: SharedState) {
    this.state = state;
  }

  /**
   * Gestión de eventos discretos
   */

  /**
   * Crea un nuevo evento discreto
   */
  public async createEvent(event: Omit<DiscreteEvent, "id">): Promise<DiscreteEvent> {
    const eventId = `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newEvent: DiscreteEvent = {
      ...event,
      instance: {
        id: eventId,
        timestamp: Date.now(),
      },
    };

    // Guardar en el historial de eventos del día
    this.state.currentDay.dayHistory.eventHistory.push(newEvent);

    // Guardar en la colección de eventos
    this.state.discreteEvents[event.templateId] = {
      ...event,
      instance: undefined, // La plantilla no debe tener instancia
    };

    return newEvent;
  }

  /**
   * Obtiene eventos en un rango de fechas
   */
  public async getEvents(dateFrom: number, dateTo: number): Promise<DiscreteEvent[]> {
    return this.state.currentDay.dayHistory.eventHistory.filter((event) => {
      const timestamp = event.instance?.timestamp;
      return timestamp && timestamp >= dateFrom && timestamp <= dateTo;
    });
  }

  /**
   * Obtiene un evento por su ID
   */
  public async getEventById(eventId: EventId): Promise<DiscreteEvent | undefined> {
    return this.state.currentDay.dayHistory.eventHistory.find(
      (event) => event.instance?.id === eventId
    );
  }

  /**
   * Actualiza un evento existente
   */
  public async updateEvent(eventUpdates: Partial<DiscreteEvent> & { id: EventId }): Promise<void> {
    const { id, ...updates } = eventUpdates;

    // Actualizar en el historial de eventos
    this.state.currentDay.dayHistory.eventHistory =
      this.state.currentDay.dayHistory.eventHistory.map((event) => {
        if (event.instance?.id === id) {
          return { ...event, ...updates };
        }
        return event;
      });

    // Actualizamos la plantilla si corresponde
    // Verificamos si el evento a actualizar tiene un templateId que coincide con una plantilla existente
    for (const event of this.state.currentDay.dayHistory.eventHistory) {
      if (
        event.instance?.id === id &&
        updates.templateId &&
        this.state.discreteEvents[event.templateId]
      ) {
        // Si cambia el templateId, actualizamos la plantilla solo si es necesario
        if (updates.templateId !== event.templateId) {
          // Si no existe la plantilla para el nuevo templateId, la creamos
          if (!this.state.discreteEvents[updates.templateId]) {
            this.state.discreteEvents[updates.templateId] = {
              ...event,
              ...updates,
              instance: undefined,
            };
          }
        } else {
          // Actualizar la plantilla existente
          this.state.discreteEvents[event.templateId] = {
            ...this.state.discreteEvents[event.templateId],
            ...updates,
            instance: undefined,
          };
        }
        break;
      }
    }
  }

  /**
   * Elimina un evento
   */
  public async removeEvent(eventId: EventId): Promise<void> {
    // Eliminar del historial de eventos
    this.state.currentDay.dayHistory.eventHistory =
      this.state.currentDay.dayHistory.eventHistory.filter(
        (event) => event.instance?.id !== eventId
      );

    // Nota: No eliminamos la plantilla de evento ya que puede ser usada para futuros eventos
  }

  /**
   * Gestión de causas de interrupción
   */

  /**
   * Crea una nueva causa de interrupción
   */
  public async createInterruptionCause(
    cause: Omit<InterruptionCause, "id">
  ): Promise<InterruptionCause> {
    const causeId = `cause-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newCause: InterruptionCause = {
      ...cause,
      id: causeId,
    };

    // Guardar en la colección de causas de interrupción
    this.state.interruptionCauses[causeId] = newCause;

    return newCause;
  }

  /**
   * Obtiene una causa de interrupción por su ID
   */
  public async getInterruptionCause(
    causeId: InterruptionCauseId
  ): Promise<InterruptionCause | undefined> {
    return this.state.interruptionCauses[causeId];
  }

  /**
   * Obtiene todas las causas de interrupción
   */
  public async getInterruptionCauses(): Promise<InterruptionCause[]> {
    return Object.values(this.state.interruptionCauses);
  }

  /**
   * Actualiza una causa de interrupción existente
   */
  public async updateInterruptionCause(
    causeUpdates: Partial<InterruptionCause> & { id: InterruptionCauseId }
  ): Promise<void> {
    const { id, ...updates } = causeUpdates;

    if (this.state.interruptionCauses[id]) {
      this.state.interruptionCauses[id] = {
        ...this.state.interruptionCauses[id],
        ...updates,
      };
    }
  }

  /**
   * Elimina una causa de interrupción
   */
  public async removeInterruptionCause(causeId: InterruptionCauseId): Promise<void> {
    delete this.state.interruptionCauses[causeId];
  }
}
