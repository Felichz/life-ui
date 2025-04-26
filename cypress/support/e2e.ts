/// <reference types="cypress" />
/// <reference types="cypress-real-events" />
/// <reference types="@4tw/cypress-drag-drop" />

// Declaraciones de tipos para comandos personalizados
declare namespace Cypress {
  interface Chainable<Subject = any> {
    // Comandos básicos
    dataTestId(testId: string): Chainable<JQuery<HTMLElement>>;

    // Comandos para inicio de día
    visitStartPage(): Chainable<void>;
    startDay(): Chainable<void>;
    setupMockPreviousDay(): Chainable<void>;
    visitStartPageWithPreviousDay(): Chainable<void>;

    // Comandos para gestión de actividades
    openActivityLibrary(): Chainable<void>;
    createNewActivity(
      title: string,
      description: string,
      type?: "Con objetivo claro" | "Duración flexible" | "Timeboxing",
      durationEstimate?: string | string[]
    ): Chainable<void>;
    editActivity(currentTitle: string, newTitle?: string, newDuration?: string): Chainable<void>;

    // Comandos para gestión de bloques de tiempo
    openTimeBlockManager(): Chainable<void>;
    createTimeBlock(name: string, startTime: string, endTime: string): Chainable<void>;
    closeTimeBlockModal(): Chainable<void>;
    deleteTimeBlock(blockName: string): Chainable<void>;

    // Comandos para tablero Kanban
    instantiateActivityByClick(activityTitle: string): Chainable<void>;
    findKanbanColumnByName(columnName: string): Chainable<JQuery<HTMLElement>>;
    verifyActivityInColumn(activityTitle: string, columnName: string): Chainable<void>;
    getKanbanCard(activityId: string): Chainable<JQuery<HTMLElement>>;
    activateActivity(activityTitle: string): Chainable<void>;
    completeActivity(activityTitle: string): Chainable<void>;
    interruptActivity(activityTitle: string): Chainable<void>;
    dragActivityToColumn(activityTitle: string, targetColumnName: string): Chainable<void>;

    // Comandos para Timeline
    getTimelineBar(activityId: string): Chainable<JQuery<HTMLElement>>;
    getTimelineEvent(eventId: string): Chainable<JQuery<HTMLElement>>;
    getTimelineInterruption(interruptionId: string): Chainable<JQuery<HTMLElement>>;

    // Nuevos comandos
    setupStandardDayWithBlocks(): Chainable<void>;
    getActivityIdFromTitle(title: string): Chainable<string>;
    instantiateActivityByTitle(title: string): Chainable<void>;
    verifyActivityStateInKanban(activityTitle: string, state: "active" | "idle"): Chainable<void>;
    verifyTimelineBarState(activityId: string, state: string): Chainable<void>;
    verifyTimelineBarEstimationState(activityId: string, estimationState: string): Chainable<void>;
    advanceClock(minutes: number): Chainable<void>;
    clickQuickActivity(quickActivityTestId: string): Chainable<void>;
    configureActivityInstance(config: {
      duration?: string;
      minDuration?: string;
      maxDuration?: string;
      timeboxingType?: string;
    }): Chainable<void>;
    assertActivityNotInKanban(activityId: string): Chainable<void>;
    closeModalByEscape(selector: string): Chainable<void>;

    // Comandos adicionales
    verifyPreviousDaySummaryVisible(): Chainable<void>;
    navigateToOverviewAndVerify(): Chainable<void>;
    verifyActivityInLibrary(title: string): Chainable<void>;
    instantiateFromLibrary(title: string): Chainable<void>;
    instantiateAndVerifyInTodo(title: string): Chainable<void>;
    handleSubjectiveModal(action?: "omit" | "confirm"): Chainable<void>;
    closeActivityLibraryModal(): Chainable<void>;
    getInstanceIdFromKanbanCard(activityTitle: string): Chainable<string>;
    confirmActivityInstance(): Chainable<void>;
  }
}

// Importar los comandos personalizados
import "./commands/app-actions";

// Importar paquetes de plugins
import "@4tw/cypress-drag-drop";
import "cypress-real-events";

// Comando global para data-testid
Cypress.Commands.add("dataTestId", (testId: string) => {
  return cy.get(`[data-testid=${testId}]`);
});

// Prevenir fallos por errores no controlados
Cypress.on("uncaught:exception", () => {
  return false;
});

// Exportar un objeto vacío para evitar problemas ESM
export {};
