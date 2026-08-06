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
  cy.get('[aria-label="gestionar bloques de tiempo"]').first().click();
  cy.dataTestId("time-block-modal").should("be.visible");
  cy.dataTestId("new-time-block-button").should("be.visible");
});

Cypress.Commands.add("createTimeBlock", (name: string, startTime: string, endTime: string) => {
  cy.dataTestId("new-time-block-button").click();
  cy.dataTestId("block-name-input").type(name);
  cy.dataTestId("start-time-input").type(startTime);
  cy.dataTestId("end-time-input").type(endTime);
  // Esperar a que el botón save deje de estar disabled (validateForm es asíncrono)
  cy.dataTestId("save-block-button").should("not.be.disabled");
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
  cy.get(modalSelector).last().should("be.visible");
  cy.get(modalSelector).last().contains("button", "Cerrar").click();
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
  cy.get('[aria-label="gestionar biblioteca de eventos"]').first().click();
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

// --- Comandos para layout/mediciones relativas ---

/**
 * Lee un bounding box (left, top, width, height) desde el DOM como Promise<DOMRect>.
 * Cypress no expone .rect() encadenable, así que medimos con .then().
 */
Cypress.Commands.add("getBox", (selector: string) => {
  return cy.dataTestId(selector).then(($el) => {
    const r = $el[0].getBoundingClientRect();
    return cy.wrap({
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
      right: r.right,
      bottom: r.bottom,
    });
  });
});



/**
 * Assert: el selector A está a la izquierda/encima del B dentro del viewport.
 * Usa el ancho del viewport (viewportWidth) para tolerar layouts responsive.
 */
Cypress.Commands.add(
  "assertPositionRelative",
  (aSelector: string, bSelector: string, relation: "leftOf" | "rightOf" | "above" | "below") => {
    cy.dataTestId(aSelector).then(($a) => {
      cy.dataTestId(bSelector).then(($b) => {
        const ra = $a[0].getBoundingClientRect();
        const rb = $b[0].getBoundingClientRect();
        switch (relation) {
          case "leftOf":
            expect(ra.right).to.be.lessThan(rb.left + 1);
            break;
          case "rightOf":
            expect(ra.left).to.be.greaterThan(rb.right - 1);
            break;
          case "above":
            expect(ra.bottom).to.be.lessThan(rb.top + 1);
            break;
          case "below":
            expect(ra.top).to.be.greaterThan(rb.bottom - 1);
            break;
        }
      });
    });
  }
);

/**
 * Assert: dos selectores comparten la misma fila horizontal (sus top/bottom
 * se solapan por encima de un mínimo de píxeles).
 */
Cypress.Commands.add("assertAlignedHorizontally", (aSelector: string, bSelector: string, minOverlapRatio = 0.5) => {
  cy.dataTestId(aSelector).then(($a) => {
    cy.dataTestId(bSelector).then(($b) => {
      const ra = $a[0].getBoundingClientRect();
      const rb = $b[0].getBoundingClientRect();
      const overlap = Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top);
      const minHeight = Math.min(ra.height, rb.height);
      expect(overlap).to.be.greaterThan(minHeight * minOverlapRatio);
    });
  });
});

/**
 * Assert: dos selectores comparten la misma columna vertical (sus left/right
 * se solapan por encima de un mínimo de píxeles).
 */
Cypress.Commands.add("assertAlignedVertically", (aSelector: string, bSelector: string, minOverlapRatio = 0.5) => {
  cy.dataTestId(aSelector).then(($a) => {
    cy.dataTestId(bSelector).then(($b) => {
      const ra = $a[0].getBoundingClientRect();
      const rb = $b[0].getBoundingClientRect();
      const overlap = Math.min(ra.right, rb.right) - Math.max(ra.left, rb.left);
      const minWidth = Math.min(ra.width, rb.width);
      expect(overlap).to.be.greaterThan(minWidth * minOverlapRatio);
    });
  });
});

/**
 * Assert: el ancho del selector está dentro de [minFrac*viewport, maxFrac*viewport].
 * Útil para verificar que un banner ocupa un % esperado del viewport.
 */
Cypress.Commands.add(
  "assertWidthFraction",
  (selector: string, minFrac: number, maxFrac: number) => {
    cy.dataTestId(selector).then(($el) => {
      const r = $el[0].getBoundingClientRect();
      const vw = Cypress.config("viewportWidth") as number;
      const frac = r.width / vw;
      expect(frac, `widthFraction de ${selector}`).to.be.at.least(minFrac);
      expect(frac, `widthFraction de ${selector}`).to.be.at.most(maxFrac);
    });
  }
);

/**
 * Assert: la altura del selector está dentro de un rango absoluto (px).
 */
Cypress.Commands.add("assertHeightBetween", (selector: string, minPx: number, maxPx: number) => {
  cy.dataTestId(selector).then(($el) => {
    const r = $el[0].getBoundingClientRect();
    expect(r.height, `altura de ${selector}`).to.be.at.least(minPx);
    expect(r.height, `altura de ${selector}`).to.be.at.most(maxPx);
  });
});

/**
 * Assert: el progreso lineal (% del tempos target) tiene un ratio
 * progressBarWidth/totalWidth coherente con el porcentaje indicado.
 *
 * MUI LinearProgress: el contenedor tiene aria-valuenow y la barra interior
 * aplica `transform: translateX(-X%)` para esconder la parte NO rellenada.
 * Por lo tanto el porcentaje "rellenado" = 100 - |translateXPx|/containerWidth * 100.
 */
Cypress.Commands.add("assertLinearProgressBarMatches", (barSelector: string, expectedPct: number, tolerance = 5) => {
  cy.dataTestId(barSelector).then(($el) => {
    const r = $el[0].getBoundingClientRect();
    const fill = $el[0].querySelector(".MuiLinearProgress-bar") as HTMLElement | null;
    expect(fill, `fill de la barra ${barSelector}`).to.not.equal(null);
    const transform = getComputedStyle(fill!).transform;
    // Si no hay transform (status "indeterminate" o 0%), trátalo como 0%.
    let emptyPct: number;
    if (!transform || transform === "none") {
      // Transformado = 100% → valor = 0%. Pero para valor=100%, MUI no
      // aplica transform; en ese caso, fill debería estar a 100%.
      // Distinguimos vía aria-valuenow.
      const v = $el[0].getAttribute("aria-valuenow");
      emptyPct = v === null || v === "100" ? 0 : 100;
    } else {
      const matrix = new DOMMatrix(transform);
      emptyPct = (-matrix.e / r.width) * 100;
    }
    const clampedExpected = Math.max(0, Math.min(100, expectedPct));
    const filledPct = 100 - emptyPct;
    expect(Math.abs(filledPct - clampedExpected)).to.be.lessThan(tolerance);
  });
});

/**
 * Assert: la posición left% de un selector coincide con el porcentaje
 * esperado con tolerancia (en puntos porcentuales).
 */
Cypress.Commands.add(
  "assertLeftPercent",
  (selector: string, parentSelector: string, expectedPct: number, tolerance = 1.5) => {
    cy.dataTestId(parentSelector).then(($parent) => {
      cy.dataTestId(selector).then(($child) => {
        const rp = $parent[0].getBoundingClientRect();
        const rc = $child[0].getBoundingClientRect();
        const leftPct = ((rc.left - rp.left) / rp.width) * 100;
        // La usamos robusta porque la barra TimelineBar está centrada
        // y translateX(-50%) se aplica al marker, pero no a la barra.
        expect(Math.abs(leftPct - expectedPct)).to.be.lessThan(tolerance);
      });
    });
  }
);

/**
 * Assert: el ancho visual de un selector es la fracción exacta del
 * padre (con tolerancia) respecto al % esperado.
 */
Cypress.Commands.add(
  "assertWidthRatioOf",
  (selector: string, parentSelector: string, expectedPct: number, tolerance = 1.5) => {
    cy.dataTestId(parentSelector).then(($parent) => {
      cy.dataTestId(selector).then(($child) => {
        const rp = $parent[0].getBoundingClientRect();
        const rc = $child[0].getBoundingClientRect();
        const widthPct = (rc.width / rp.width) * 100;
        expect(Math.abs(widthPct - expectedPct)).to.be.lessThan(tolerance);
      });
    });
  }
);

/**
 * Assert: el número de hijos con data-testid que cumplen /^prefix-/ dentro
 * de un contenedor es exactamente count.
 */
Cypress.Commands.add("assertCountPrefix", (containerSelector: string, prefix: string, count: number) => {
  cy.dataTestId(containerSelector).within(() => {
    cy.get(`[data-testid^="${prefix}"]`).should("have.length", count);
  });
});

export {};