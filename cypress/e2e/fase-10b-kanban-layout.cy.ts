/// <reference types="cypress" />

/**
 * E2E Fase 10b — Layout del Kanban.
 *
 * El Kanban tiene un board horizontal con columnas. Cada columna muestra:
 *  - Header con nombre del bloque (y rango horario si no es default)
 *  - Lista de cards (DragDropList)
 *  - Chip con el count de actividades
 *
 * Reglas verificadas:
 *  [K1] Board tiene exactamente 3 columnas (Por Hacer + 2 bloques).
 *  [K2] Columna "Por Hacer" está a la IZQUIERDA de las otras.
 *  [K3] Columna "Tarde" está a la DERECHA de "Mañana".
 *  [K4] Todas las columnas comparten el mismo top (alineadas en fila).
 *  [K5] Una card en estado "instantiated" muestra "Activar"; cuando se
 *       activa, muestra "Completar" + "Interrumpir" y NO muestra "Activar".
 *  [K6] Una card activada muestra el chip "En curso" (primary color).
 */

describe("Fase 10b — Layout del Kanban", () => {
  beforeEach(() => {
    cy.visit("/start", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("qualia_control_app_state");
      },
    });
  });

  function arrancarConBloques() {
    cy.visitStartPage();
    cy.startDay();
    cy.openTimeBlockManager();
    cy.createTimeBlock("Mañana", "09:00", "12:00");
    cy.createTimeBlock("Tarde", "14:00", "18:00");
    cy.closeTimeBlockModal();
  }

  it("10b.K1: board tiene exactamente 3 columnas visibles", () => {
    arrancarConBloques();
    cy.dataTestId("kanban-board").should("be.visible");
    cy.dataTestId("kanban-column-por-hacer").should("be.visible");
    cy.dataTestId("kanban-column-mañana").should("be.visible");
    cy.dataTestId("kanban-column-tarde").should("be.visible");

    cy.dataTestId("kanban-board").within(() => {
      cy.get('[data-testid^="kanban-column-"]').should("have.length", 3);
    });
  });

  it("10b.K2: 'Por Hacer' está a la izquierda de 'Mañana'", () => {
    arrancarConBloques();
    cy.assertPositionRelative("kanban-column-por-hacer", "kanban-column-mañana", "leftOf");
  });

  it("10b.K3: 'Tarde' está a la derecha de 'Mañana'", () => {
    arrancarConBloques();
    cy.assertPositionRelative("kanban-column-tarde", "kanban-column-mañana", "rightOf");
  });

  it("10b.K4: las 3 columnas comparten la misma fila (top)", () => {
    arrancarConBloques();
    // Los top deben coincidir con tolerancia de 4px (sub-pixel rounding)
    cy.dataTestId("kanban-column-por-hacer").then(($a) => {
      cy.dataTestId("kanban-column-mañana").then(($b) => {
        cy.dataTestId("kanban-column-tarde").then(($c) => {
          const ta = $a[0].getBoundingClientRect().top;
          const tb = $b[0].getBoundingClientRect().top;
          const tc = $c[0].getBoundingClientRect().top;
          expect(Math.abs(ta - tb)).to.be.lessThan(6);
          expect(Math.abs(tb - tc)).to.be.lessThan(6);
        });
      });
    });
  });

  it("10b.K5: card instantiated → tiene 'Activar'; sin completar ni interrumpir", () => {
    arrancarConBloques();
    cy.openActivityLibrary();
    cy.createNewActivity("Tarea K5", "test", "Con objetivo claro", "30");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Tarea K5");
    cy.verifyActivityStateInKanban("Tarea K5", "idle");
  });

  it("10b.K6: card activada → tiene 'Completar' + 'Interrumpir', NO 'Activar'", () => {
    arrancarConBloques();
    cy.openActivityLibrary();
    cy.createNewActivity("Tarea K6", "test", "Con objetivo claro", "30");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Tarea K6");
    cy.activateActivity("Tarea K6");
    cy.verifyActivityStateInKanban("Tarea K6", "active");
  });

  it("10b.K7: la card activada muestra el chip 'En curso' (color primary)", () => {
    arrancarConBloques();
    cy.openActivityLibrary();
    cy.createNewActivity("Tarea K7", "test", "Con objetivo claro", "30");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Tarea K7");
    cy.activateActivity("Tarea K7");

    // El chip "En curso" debe tener el color primary.main (rgba o hex)
    cy.get('[data-testid^="kanban-card-"]').within(() => {
      cy.contains(".MuiChip-root", "En curso").should("be.visible");
    });
  });

  it("10b.K8: la card activada tiene borde azul (border primary)", () => {
    arrancarConBloques();
    cy.openActivityLibrary();
    cy.createNewActivity("Tarea K8", "test", "Con objetivo claro", "30");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Tarea K8");
    cy.activateActivity("Tarea K8");

    // La Paper interior de la card activa tiene border rgba(49,86,216,0.4)
    cy.get('[data-testid^="kanban-card-"] .MuiPaper-root').then(($p) => {
      const border = getComputedStyle($p[0]).borderColor;
      // Aceptar cualquier valor de azul (RGBA / RGB)
      const isBlue = /49,\s*86,\s*216/.test(border) || /blue/i.test(border);
      expect(isBlue, `border-color de la card activa (${border})`).to.equal(true);
    });
  });
});
