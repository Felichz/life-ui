/// <reference types="cypress" />
/// <reference types="cypress-real-events" />
/// <reference types="@testing-library/cypress" />

declare namespace Cypress {
  interface Chainable<Subject = any> {
    /**
     * Selector personalizado por atributo data-cy
     */
    dataCy(value: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Selector personalizado por atributo data-testid
     */
    dataTestId(value: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Selector personalizado por atributo data-testid - alias con nombre más explícito
     */
    findByTestId(value: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Comando para arrastrar y soltar elementos usando @hello-pangea/dnd
     */
    dragAndDropDnd(sourceSelector: string, destinationSelector: string): Chainable<void>;

    /**
     * Guarda el estado actual del localStorage
     */
    saveLocalStorage(): void;

    /**
     * Restaura el localStorage previamente guardado
     */
    restoreLocalStorage(): void;

    /**
     * Guarda un valor en localStorage
     */
    setLocalStorage(key: string, value: string): void;

    /**
     * Obtiene un snapshot del localStorage
     */
    getLocalStorageSnapshot(): Chainable<Record<string, string>>;

    /**
     * Visita la página de inicio de la aplicación y espera a que cargue
     */
    visitStartPage(): Chainable<JQuery<HTMLElement>>;

    /**
     * Hace clic en el botón "Comenzar día" y espera a que la página del día se cargue
     */
    startDay(): Chainable<JQuery<HTMLElement>>;

    /**
     * Prepara un objeto de estado simulado con un día anterior
     */
    setupMockPreviousDay(): any;

    /**
     * Visita la página de inicio con un estado que incluye un día anterior
     */
    visitStartPageWithPreviousDay(): Chainable<JQuery<HTMLElement>>;

    /**
     * Abre el modal de biblioteca de actividades
     */
    openActivityLibrary(): Chainable<JQuery<HTMLElement>>;

    /**
     * Crea una nueva actividad con los parámetros especificados
     */
    createNewActivity(
      title: string,
      description: string,
      type?: string,
      durationEstimate?: string | string[]
    ): Chainable<JQuery<HTMLElement>>;

    /**
     * Edita una actividad existente
     */
    editActivity(
      currentTitle: string,
      newTitle?: string,
      newDuration?: string
    ): Chainable<JQuery<HTMLElement>>;

    /**
     * Abre el gestor de bloques de tiempo
     */
    openTimeBlockManager(): Chainable<JQuery<HTMLElement>>;

    /**
     * Crea un nuevo bloque de tiempo
     */
    createTimeBlock(
      name: string,
      startTime: string,
      endTime: string
    ): Chainable<JQuery<HTMLElement>>;

    /**
     * Cierra el modal de gestión de bloques de tiempo
     */
    closeTimeBlockModal(): Chainable<JQuery<HTMLElement>>;

    /**
     * Elimina un bloque de tiempo existente
     */
    deleteTimeBlock(blockName: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Instancia una actividad haciendo clic en ella desde la biblioteca
     */
    instantiateActivityByClick(activityTitle: string): Chainable<void>;

    /**
     * Obtiene el ID real de una columna Kanban buscando por su nombre visible
     */
    findKanbanColumnByName(columnName: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Verifica que una actividad aparece en una columna específica del Kanban
     */
    verifyActivityInColumn(activityTitle: string, columnName: string): Chainable<void>;

    /**
     * Obtiene la tarjeta Kanban por su ID de actividad
     */
    getKanbanCard(activityId: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Activa una actividad (botón activar)
     */
    activateActivity(activityTitle: string): Chainable<void>;

    /**
     * Marca como completada una actividad (botón completar)
     */
    completeActivity(activityTitle: string): Chainable<void>;

    /**
     * Interrumpe una actividad (botón interrumpir)
     */
    interruptActivity(activityTitle: string): Chainable<void>;

    /**
     * Arrastra una actividad desde su ubicación actual a una columna específica
     */
    dragActivityToColumn(activityTitle: string, targetColumnName: string): Chainable<void>;

    /**
     * Obtiene la barra de actividad en el timeline por ID
     */
    getTimelineBar(activityId: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Obtiene el evento en el timeline por ID
     */
    getTimelineEvent(eventId: string): Chainable<JQuery<HTMLElement>>;

    /**
     * Obtiene la interrupción en el timeline por ID
     */
    getTimelineInterruption(interruptionId: string): Chainable<JQuery<HTMLElement>>;
  }
}
