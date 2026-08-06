/// <reference types="cypress" />
import type { ActivityType } from "../../../src/types";

/**
 * Comandos personalizados para acciones específicas de la aplicación Qualia Control
 *
 * Schema v2+: tempos, sin modal subjetivo ni causa de interrupción.
 * Schema v3: persistencia con migración automática de legacy fields.
 */

// --- Comandos para Flujo 1: Inicio del día ---

Cypress.Commands.add("visitStartPage", () => {
  cy.visit("/start");
  cy.contains("Menos fricci", { timeout: 10000 }).first().should("be.visible");
});

Cypress.Commands.add("startDay", () => {
  cy.dataTestId("start-day-button").should("be.visible").click();
  cy.get("[data-testid=day-page]", { timeout: 10000 }).should("exist");
});

Cypress.Commands.add("endDay", () => {
  // Botón de cierre de día en TopBar/ActionButtons
  cy.dataTestId("end-day-button").should("be.visible").click();
  // Confirmar en el modal
  cy.dataTestId("confirm-end-day-button").click({ force: true });
});

// --- Comandos para Flujo 2: Gestión de actividades ---

Cypress.Commands.add("openActivityLibrary", () => {
  cy.get('[aria-label="abrir biblioteca de actividades"]').first().click();
  cy.get('[role="dialog"]:contains("Biblioteca de Actividades")').should("be.visible");
});

Cypress.Commands.add(
  "createNewActivity",
  (
    title: string,
    description: string,
    type: ActivityType = "clear-objective",
    durationEstimate: string | string[] = "45"
  ) => {
    const typeMapping: Record<string, ActivityType> = {
      "Con objetivo claro": "clear-objective",
      "Duraci": "flexible-duration",
      "flexible-duration": "flexible-duration",
      "clear-objective": "clear-objective",
      "timeboxing": "timeboxing",
    };
    const typeCode: ActivityType = typeMapping[type] ?? type;
    cy.dataTestId("new-activity-button").first().click();
    cy.dataTestId("activity-form-modal")
      .should("be.visible")
      .within(() => {
        cy.dataTestId("activity-title-input").type(title);
        cy.dataTestId("activity-description-input").type(description);
        if (typeCode !== "clear-objective") {
          cy.dataTestId("activity-type-select").click();
        }
      });

    if (typeCode !== "clear-objective") {
      cy.get(`li[role='option'][data-value="${typeCode}"]`).click();
    }

    cy.dataTestId("activity-form-modal").within(() => {
      if (typeCode === "clear-objective") {
        cy.dataTestId("estimated-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate}`);
      } else if (typeCode === "flexible-duration" && Array.isArray(durationEstimate)) {
        cy.dataTestId("min-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate[0]}`);
        cy.dataTestId("max-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate[1]}`);
      } else if (typeCode === "timeboxing") {
        cy.dataTestId("min-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate}`);
      }
      cy.dataTestId("save-activity-button").click();
    });
  }
);

Cypress.Commands.add(
  "editActivity",
  (currentTitle: string, newTitle?: string, newDuration?: string) => {
    cy.contains(currentTitle).parents("div").find('[aria-label="editar"]').click();
    cy.dataTestId("activity-form-modal").should("be.visible");
    cy.dataTestId("activity-form-modal").within(() => {
      if (newTitle) {
        cy.dataTestId("activity-title-input").click().type("{selectall}{backspace}" + newTitle);
      }
      if (newDuration) {
        cy.dataTestId("estimated-duration-input").click().type("{selectall}{backspace}" + newDuration);
      }
      cy.dataTestId("save-activity-button").click();
    });
    if (newTitle) {
      cy.contains(newTitle).should("be.visible");
    } else {
      cy.contains(currentTitle).should("be.visible");
    }
  }
);

// --- Comandos para Flujo 3: Time Blocks ---

Cypress.Commands.add("openTimeBlockManager", () => {
  cy.get('[aria-label="gestionar bloques de tiempo"]').click();
  cy.dataTestId("time-block-modal").should("be.visible");
  cy.dataTestId("new-time-block-button").should("be.visible");
});

Cypress.Commands.add("createTimeBlock", (name: string, startTime: string, endTime: string) => {
  cy.dataTestId("new-time-block-button").click();
  cy.dataTestId("block-name-input").type(name);
  cy.dataTestId("start-time-input").type(startTime);
  cy.dataTestId("end-time-input").type(endTime);
  cy.dataTestId("save-block-button").click();
  cy.dataTestId("time-blocks-list").contains(name).should("be.visible");
});

Cypress.Commands.add("closeTimeBlockModal", () => {
  cy.dataTestId("close-modal-button").click();
  cy.wait(200);
  cy.dataTestId("time-block-modal").should("not.exist");
});

Cypress.Commands.add("deleteTimeBlock", (blockName: string) => {
  cy.contains(blockName)
    .parents('[data-testid^="time-block-"]')
    .find('[data-testid^="delete-block-"]')
    .click();
  cy.dataTestId("delete-confirmation-modal").should("be.visible");
  cy.dataTestId("move-activities-button").click();
  cy.contains(blockName).should("not.be.visible");
});

// --- Comandos para Kanban ---

Cypress.Commands.add("instantiateActivityByClick", (activityTitle: string) => {
  cy.contains(activityTitle).closest('[data-testid^="activity-template-"]').click();
});

Cypress.Commands.add("findKanbanColumnByName", (columnName: string) => {
  return cy.dataTestId(`kanban-column-${columnName.toLowerCase().replace(/ /g, "-")}`);
});

Cypress.Commands.add("verifyActivityInColumn", (activityTitle: string, columnName: string) => {
  const normalizedColumnName = columnName.toLowerCase().replace(/ /g, "-");
  cy.dataTestId(`kanban-column-${normalizedColumnName}`)
    .contains(activityTitle)
    .should("be.visible");
});

Cypress.Commands.add("getKanbanCard", (activityId: string) => {
  return cy.get(`[data-rbd-draggable-id="${activityId}"]`);
});

Cypress.Commands.add("activateActivity", (activityTitle: string) => {
  // Solo buscar dentro del Kanban (no en el drawer lateral)
  cy.get('[data-testid="kanban-board"]')
    .contains(activityTitle)
    .closest('[data-testid^="kanban-card-"]')
    .find('[data-testid="activate-button"]')
    .click({ force: true });
});

// --- Comandos para completion / interrupt (schema v2+) ---

Cypress.Commands.add("completeActivity", (activityTitle: string) => {
  cy.get('[data-testid="kanban-board"]')
    .contains(activityTitle)
    .closest('[data-testid^="kanban-card-"]')
    .find('[data-testid="complete-button"]')
    .click({ force: true });
});

Cypress.Commands.add("interruptActivity", (activityTitle: string) => {
  cy.get('[data-testid="kanban-board"]')
    .contains(activityTitle)
    .closest('[data-testid^="kanban-card-"]')
    .find('[data-testid="interrupt-button"]')
    .click({ force: true });
});

Cypress.Commands.add("confirmCompletionWithScore", (score: number) => {
  cy.dataTestId("completion-modal").should("be.visible");
  // Mover slider al score deseado (MVP v3: slider inicia en 7, NO en 5)
  const delta = score - 7;
  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      cy.dataTestId("satisfaction-slider").focus().type("{rightarrow}");
    }
  } else if (delta < 0) {
    for (let i = 0; i < -delta; i++) {
      cy.dataTestId("satisfaction-slider").focus().type("{leftarrow}");
    }
  }
  cy.dataTestId("confirm-button").click();
  cy.dataTestId("completion-modal").should("not.exist");
});

Cypress.Commands.add("interruptWithoutReason", () => {
  cy.dataTestId("completion-modal").should("be.visible");
  cy.dataTestId("interrupt-button").click();
  cy.dataTestId("completion-modal").should("not.exist");
});

// --- Comandos para Timeline ---

Cypress.Commands.add("getTimelineBar", (activityId: string) => {
  return cy.dataTestId(`timeline-bar-${activityId}`);
});

Cypress.Commands.add("getTimelineInterruption", (interruptionId: string) => {
  return cy.dataTestId(`timeline-interruption-${interruptionId}`);
});

// --- Comandos utilitarios ---

Cypress.Commands.add("setupStandardDayWithBlocks", () => {
  cy.visitStartPage();
  cy.startDay();
  cy.openTimeBlockManager();
  cy.createTimeBlock("Ma", "09:00", "12:00");
  cy.createTimeBlock("Tarde", "14:00", "18:00");
  cy.closeTimeBlockModal();
});

Cypress.Commands.add("getActivityIdFromTitle", (title: string) => {
  cy.contains(title)
    .closest('[data-testid^="activity-template-"]')
    .invoke("attr", "data-testid")
    .then((testId) => {
      if (!testId) {
        throw new Error(`No se pudo encontrar data-testid para la actividad "${title}"`);
      }
      const id = testId.replace("activity-template-", "");
      if (!id) {
        throw new Error(`El data-testid "${testId}" no contiene un ID válido.`);
      }
      return id;
    });
});

Cypress.Commands.add(
  "instantiateActivityByTitle",
  (title: string) => {
    cy.instantiateActivityByClick(title);
    cy.dataTestId("activity-instance-modal")
      .should("be.visible")
      .within(() => {
        cy.dataTestId("confirm-button").click();
      });
    cy.dataTestId("activity-instance-modal").should("not.exist");
    cy.wait(50);
  }
);

Cypress.Commands.add(
  "verifyActivityStateInKanban",
  (activityTitle: string, state: "active" | "idle") => {
    cy.contains(activityTitle)
      .closest(':has([data-testid="activate-button"], [data-testid="complete-button"])')
      .should("exist")
      .within(() => {
        if (state === "active") {
          cy.dataTestId("complete-button").should("be.visible");
          cy.dataTestId("interrupt-button").should("be.visible");
          cy.dataTestId("activate-button").should("not.exist");
        } else {
          cy.dataTestId("activate-button").should("be.visible");
          cy.dataTestId("complete-button").should("not.exist");
          cy.dataTestId("interrupt-button").should("not.exist");
        }
      });
  }
);

Cypress.Commands.add("verifyTimelineBarState", (activityId: string, state: string) => {
  cy.getTimelineBar(activityId).should("have.attr", "data-state", state);
});

Cypress.Commands.add(
  "verifyTimelineBarEstimationState",
  (activityId: string, estimationState: string) => {
    cy.getTimelineBar(activityId).should("have.attr", "data-estimation-state", estimationState);
  }
);

Cypress.Commands.add("advanceClock", (minutes: number) => {
  cy.tick(minutes * 60 * 1000);
});

Cypress.Commands.add("clickQuickActivity", (quickActivityTestId: string) => {
  cy.dataTestId(`quick-activity-${quickActivityTestId}`).click();
});

Cypress.Commands.add(
  "configureActivityInstance",
  (config: {
    duration?: string;
    minDuration?: string;
    maxDuration?: string;
    timeboxingType?: string;
  }) => {
    cy.dataTestId("activity-instance-modal").within(() => {
      if (config.duration) {
        cy.dataTestId("estimated-duration-input").clear().type(config.duration);
      }
      if (config.minDuration) {
        cy.dataTestId("min-duration-input").clear().type(config.minDuration);
      }
      if (config.maxDuration) {
        cy.dataTestId("max-duration-input").clear().type(config.maxDuration);
      }
      if (config.timeboxingType) {
        cy.dataTestId("timeboxing-type-select").select(config.timeboxingType);
      }
    });
  }
);

Cypress.Commands.add("assertActivityNotInKanban", (activityId: string) => {
  cy.wait(500);
  cy.dataTestId(`kanban-card-${activityId}`).should("not.exist");
});

Cypress.Commands.add("closeModalByEscape", (selector: string) => {
  cy.get(selector).should("be.visible").type("{esc}");
  cy.get(selector).should("not.exist");
});

Cypress.Commands.add("verifyPreviousDaySummaryVisible", () => {
  cy.dataTestId("previous-day-summary")
    .should("be.visible")
    .within(() => {
      cy.dataTestId("completion-rate-value").should("be.visible");
      cy.dataTestId("completed-activities-count").should("be.visible");
      cy.contains("Resumen del día anterior").should("be.visible");
    });
});

Cypress.Commands.add("navigateToOverviewAndVerify", () => {
  cy.dataTestId("view-details-button").should("be.visible").click();
  cy.url().should("include", "/overview");
  cy.contains("Vista de Resumen - Qualia Control").should("be.visible");
});

Cypress.Commands.add("verifyActivityInLibrary", (title: string) => {
  cy.get('[role="dialog"]:contains("Biblioteca de Actividades")').within(() => {
    cy.contains(title).should("be.visible");
  });
});

Cypress.Commands.add("instantiateFromLibrary", (title: string) => {
  cy.instantiateActivityByClick(title);
  cy.dataTestId("activity-instance-modal").should("be.visible");
  cy.dataTestId("activity-instance-modal").within(() => {
    cy.dataTestId("confirm-button").click();
  });
  cy.dataTestId("activity-instance-modal").should("not.exist");
  cy.wait(50);
});

Cypress.Commands.add("instantiateAndVerifyInTodo", (title: string) => {
  cy.instantiateFromLibrary(title);
  cy.closeActivityLibraryModal();
  cy.verifyActivityInColumn(title, "Por Hacer");
});

Cypress.Commands.add("closeActivityLibraryModal", () => {
  const modalSelector = '[role="dialog"]:contains("Biblioteca de Actividades")';
  cy.get(modalSelector).should("be.visible");
  cy.get(modalSelector).contains("button", "Cerrar").click();
  cy.get(modalSelector).should("not.exist");
});

Cypress.Commands.add(
  "getInstanceIdFromKanbanCard",
  (activityTitle: string): Cypress.Chainable<string> => {
    return cy
      .contains(activityTitle)
      .closest('[data-testid^="kanban-card-"]')
      .invoke("attr", "data-testid")
      .then((testId) => {
        if (!testId) {
          throw new Error(
            `No se pudo encontrar data-testid para la tarjeta Kanban "${activityTitle}"`
          );
        }
        const instanceId = testId.replace("kanban-card-", "");
        if (!instanceId) {
          throw new Error(`El data-testid "${testId}" no contiene un ID de instancia válido.`);
        }
        return cy.wrap(instanceId);
      });
  }
);

Cypress.Commands.add("confirmActivityInstance", () => {
  cy.dataTestId("activity-instance-modal").within(() => {
    cy.dataTestId("confirm-button").click();
  });
  cy.dataTestId("activity-instance-modal").should("not.exist");
  cy.wait(50);
});

// --- Comandos para Flujo 5: Eventos ---

Cypress.Commands.add("openEventLibrary", () => {
  cy.get('[aria-label="gestionar biblioteca de eventos"]').click();
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")', { timeout: 10000 }).should(
    "be.visible"
  );
});

Cypress.Commands.add("createNewEvent", (eventName: string) => {
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")').within(() => {
    cy.contains("h6", "Nuevo evento").should("be.visible");
    cy.get("#nombre-evento-input").should("be.visible").type(eventName);
    cy.contains("button", "Crear").should("be.visible").click();
  });
});

Cypress.Commands.add("verifyEventInLibrary", (eventName: string) => {
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")').within(() => {
    cy.contains("li", eventName).should("be.visible");
  });
});

Cypress.Commands.add("getEventIdFromName", (eventName: string): Cypress.Chainable<string> => {
  return cy
    .get('[role="dialog"]:contains("Biblioteca de Eventos")')
    .contains(`[data-testid^="event-template-"]`, eventName)
    .invoke("attr", "data-testid")
    .then((testId) => {
      if (!testId) {
        throw new Error(`No se pudo encontrar data-testid para el evento "${eventName}"`);
      }
      const eventId = testId.replace("event-template-", "");
      if (!eventId) {
        throw new Error(`El data-testid "${testId}" no contiene un ID de evento válido.`);
      }
      return cy.wrap(eventId);
    });
});

Cypress.Commands.add("closeEventLibraryModal", () => {
  const modalSelector = '[role="dialog"]:contains("Biblioteca de Eventos")';
  cy.get(modalSelector).should("be.visible");
  cy.get(modalSelector).contains("button", "Cerrar").click();
  cy.get(modalSelector).should("not.exist");
});

Cypress.Commands.add("clickQuickEvent", (eventId: string) => {
  cy.dataTestId(`quick-event-${eventId}`).click();
});

Cypress.Commands.add("verifyEventInTimeline", (eventName: string) => {
  cy.get(`[data-testid^="timeline-event-"][aria-label^="Evento ${eventName} a las"]`).should(
    "be.visible"
  );
});

export {};