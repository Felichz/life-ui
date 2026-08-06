/// <reference types="cypress" />

/**
 * E2E Fase 10b — Flow visual del CompletionModal.
 *
 * Estrategia: sembramos el estado con día activo y actividad "active" usando
 * el mismo schema que `persistenceManager.deserialize` espera, evitando
 * pasar por el setup UI completo (que tiene flakiness de comandos legacy).
 *
 * Schema v3: el localStorage key es `qualia_control_app_state`. Cargamos,
 * navegamos, y verificamos directamente el CompletionModal.
 *
 * Fórmula MVP v3.1: tempos = ceil(base × score / 7); base = estimatedMinutes
 * si durationMinutes == 0 (caso CI sin clock avanzando).
 */

describe("Fase 10b — Flow visual del CompletionModal", () => {
  // Hacer un warm-up del bundle de Vite antes de los tests para evitar
  // que el primer reload pague el costo de compilación on-demand.
  before(() => {
    cy.visit("/");
    cy.title().should("exist");
  });

  /**
   * Siembra el estado con un día activo, una actividad clara en estado activo
   * (estimated = 30 ó 60) y recarga para que SystemCore lo lea.
   */
  function sembrarActivo(estimatedMinutes: number) {
    const dayId = "sembrado-day-" + Math.random().toString(36).slice(2, 8);
    const actId = "act-modal-" + Math.random().toString(36).slice(2, 8);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("qualia_control_app_state");
      },
    });
    cy.window().then((win) => {
      const now = new Date();
      const startISO = new Date(now.getTime() - 60_000).toISOString();
      const state = {
        schemaVersion: 3,
        global: {
          days: [
            {
              id: dayId,
              state: "active",
              date: now.toISOString().slice(0, 10),
              startTime: startISO,
              endTime: null,
              createdAt: startISO,
              updatedAt: now.toISOString(),
            },
          ],
          activityTemplates: [
            {
              id: "tpl-modal",
              title: "Flow Modal Activity",
              description: "test",
              type: "clear-objective",
              isSystemActivity: false,
              clearObjectiveSettings: { estimatedDurationMinutes: estimatedMinutes },
              createdAt: startISO,
              updatedAt: now.toISOString(),
            },
          ],
          eventTemplates: [],
          timeBlocks: [
            {
              id: "default-todo",
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 1439,
              isDefault: true,
              order: 0,
              createdAt: startISO,
              updatedAt: now.toISOString(),
            },
          ],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: now.toISOString(),
          },
          completedActivityRecords: [],
          eventInstances: [],
        },
        currentDay: {
          day: {
            id: dayId,
            state: "active",
            date: now.toISOString().slice(0, 10),
            startTime: startISO,
            endTime: null,
            createdAt: startISO,
            updatedAt: now.toISOString(),
          },
          activityInstances: [
            {
              id: actId,
              templateId: "tpl-modal",
              blockId: "default-todo",
              startTime: startISO,
              state: "active",
              order: 0,
              dynamicSettings: {},
              clearObjectiveSettings: { estimatedDurationMinutes: estimatedMinutes },
              createdAt: startISO,
              updatedAt: now.toISOString(),
            },
          ],
          activeActivityInstanceId: actId,
        },
      };
      win.localStorage.setItem("qualia_control_app_state", JSON.stringify(state));
      // Esperar al siguiente tick para garantizar que setItem se persistió
      return cy.wrap(null);
    });
    cy.wait(50);
    // Recargar la página; sin onBeforeLoad para que el sembrado sobreviva.
    cy.reload();
    // En la primera ejecución tras un clear completo, el reload puede tardar
    // más. Tolerar hasta 20s para cubrir cold start del bundle.
    cy.dataTestId("day-page", { timeout: 20000 }).should("exist");
  }

  /**
   * Abre el CompletionModal desde el kanban-board haciendo click en el único
   * botón "Completar" disponible.
   */
  function openCompletionModalFromKanban() {
    // El botón complete-button sólo aparece para cards en estado active
    cy.dataTestId("complete-button").should("be.visible").click({ force: true });
    cy.dataTestId("completion-modal").should("be.visible");
  }

  it("10b.M1: al abrir, slider marca 7 y preview muestra 100% del estimado", () => {
    sembrarActivo(60);
    cy.dataTestId("complete-button", { timeout: 20000 }).should("be.visible");
    cy.dataTestId("complete-button").click({ force: true });
    cy.dataTestId("completion-modal", { timeout: 10000 }).should("be.visible");

    cy.dataTestId("score-label").should("contain.text", "7/10");
    cy.dataTestId("score-label").should("contain.text", "Lo hiciste");
    cy.dataTestId("preview-total").then(($p) => {
      // base = 60 (estimated) porque durationMinutes es 0 en CI
      // tempos = ceil(60 * 7/7) = 60
      expect(parseInt($p.text().trim(), 10)).to.equal(60);
    });
    cy.dataTestId("tempos-preview").should("contain.text", "60 min × 7/7");
  });

  it("10b.M6: confirmar score 7 × 60 → modal cierra y banner actualiza a 60", () => {
    sembrarActivo(60);
    openCompletionModalFromKanban();

    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    cy.dataTestId("tempo-total").then(($t) => {
      expect(parseInt($t.text().trim(), 10)).to.equal(60);
    });
    cy.dataTestId("tempo-percent").should("contain.text", "60%");
  });

  it("10b.M7: 'No la terminé' cierra el modal", () => {
    sembrarActivo(60);
    openCompletionModalFromKanban();

    cy.dataTestId("completion-modal").within(() => {
      cy.dataTestId("interrupt-button").click();
    });
    cy.dataTestId("completion-modal").should("not.exist");
  });
});
