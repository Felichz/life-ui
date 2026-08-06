/// <reference types="cypress" />

/**
 * E2E Fase 10b — Layout relativo de la UI (no pixel-perfect, sí con ratios).
 *
 * Inventario de selectores confiables mapeados:
 *
 *  StartPage (/start)
 *   - start-day-button              (data-testid)
 *   - welcome-message               (data-testid, shown si no hay días previos)
 *   - previous-day-summary          (data-testid, shown si hay días previos)
 *     - completion-rate-value       (data-testid)
 *     - completed-activities-count  (data-testid)
 *   - view-details-button           (data-testid)
 *
 *  DayPage (/)
 *   - day-page                      (data-testid)
 *   - tempo-banner                  (data-testid) ARRIBA de todo
 *     - tempo-total                 (data-testid)
 *     - tempo-percent               (data-testid)
 *     - tempo-progress              (data-testid, LinearProgress)
 *     - last-reward                 (data-testid)
 *   - kanban-container              (data-testid)
 *     - kanban-board                (data-testid)
 *       - kanban-column-<slug>      (data-testid por columna)
 *         - kanban-card-<id>        (data-testid por card)
 *           - activate-button       (data-testid, si instantiated)
 *           - complete-button       (data-testid, si active)
 *           - interrupt-button      (data-testid, si active)
 *   - timeline                      (data-testid, dentro de timeline-container)
 *     - timeline-bar-<id>           (data-testid, posición % según start/end)
 *     - timeline-bar-estimation-<id>(data-testid, ancho = estimación)
 *     - timeline-event-<id>         (data-testid)
 *     - timeline-interruption-<id>  (data-testid)
 *
 *  TopBar (presente en todas las páginas autenticadas)
 *   - tiene los botones "Hoy" y "Resumen" como RouterLink
 *
 * Reglas de layout a verificar:
 *
 *  [A] TempoBanner aparece ARRIBA de Kanban en DayPage.
 *  [B] TempoBanner ocupa casi todo el ancho del viewport (>60%).
 *  [C] El número total + "/100" se ven en la misma línea (h4 + body1).
 *  [D] LinearProgress está DEBAJO del número "X / 100 tempos".
 *  [E] Dentro de "Lo que ocurrió" (sección Timeline), timeline está
 *      DENTRO de los bordes del Paper.
 *  [F] CompletionModal está centrado horizontalmente en el viewport.
 *  [G] CompletionModal tiene el slider ENTRE el título y el preview.
 *  [H] En el preview, el total (h4) está a la izquierda de "tempos" (body1).
 *  [I] El botón "No la terminé" está a la IZQUIERDA del "Guardar" (en actions).
 */

describe("Fase 10b UI visual — layout relativo", () => {
  // Warm-up del bundle de Vite para evitar costo de compilación on-demand
  // en el primer test que cronometra tamaños relativos.
  before(() => {
    cy.visit("/");
    cy.title().should("exist");
  });

  beforeEach(() => {
    cy.visit("/start", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("qualia_control_app_state");
      },
    });
  });

  function startCleanDay() {
    cy.visitStartPage();
    cy.startDay();
  }

  it("10b.A: TempoBanner está arriba del Kanban en DayPage", () => {
    startCleanDay();
    cy.dataTestId("day-page").should("be.visible");
    cy.dataTestId("tempo-banner").should("be.visible");
    cy.dataTestId("kanban-container").should("be.visible");

    cy.dataTestId("tempo-banner").then(($banner) => {
      cy.dataTestId("kanban-container").then(($kanban) => {
        const bannerTop = $banner[0].getBoundingClientRect().top;
        const kanbanTop = $kanban[0].getBoundingClientRect().top;
        expect(bannerTop).to.be.lessThan(kanbanTop);
      });
    });
  });

  it("10b.B: TempoBanner ocupa >60% del ancho del viewport", () => {
    startCleanDay();
    cy.dataTestId("tempo-banner").should("be.visible");
    cy.assertWidthFraction("tempo-banner", 0.6, 1.0);
  });

  it("10b.C: 'X / 100' tempos se ven en la misma línea horizontal", () => {
    startCleanDay();
    cy.dataTestId("tempo-total").should("be.visible");
    cy.dataTestId("tempo-percent").should("be.visible");
    cy.assertAlignedHorizontally("tempo-total", "tempo-percent", 0.5);
  });

  it("10b.D: LinearProgress está debajo del número 'X/100'", () => {
    startCleanDay();
    cy.assertPositionRelative("tempo-total", "tempo-progress", "above");
  });

  it("10b.E: timeline está dentro del Paper 'Lo que ocurrió'", () => {
    startCleanDay();
    // El Paper "Lo que ocurrió" envuelve TimelineContainer. Buscamos el
    // ancestor común de la timeline vía .parents() y verificamos que el
    // timeline-bar (cuando se renderice) quede dentro.
    cy.dataTestId("timeline").should("exist");
    cy.dataTestId("timeline").then(($t) => {
      // Subir al Paper ancestro: el contenedor de Timeline está dentro del
      // Box que está dentro del Paper. Usamos closest("div") que tenga un
      // Paper de MUI (border-radius inherente).
      const paper = $t.closest("div").parent().parent();
      const tRect = $t[0].getBoundingClientRect();
      const pRect = (paper as unknown as HTMLElement).getBoundingClientRect();
      expect(tRect.top).to.be.at.least(pRect.top - 1);
      expect(tRect.left).to.be.at.least(pRect.left - 1);
      expect(tRect.right).to.be.at.most(pRect.right + 1);
      expect(tRect.bottom).to.be.at.most(pRect.bottom + 1);
    });
  });

  it("10b.F: CompletionModal está centrado horizontalmente en el viewport", () => {
    startCleanDay();
    cy.openActivityLibrary();
    cy.createNewActivity("Doc Layout", "Para validar modal", "Con objetivo claro", "60");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Doc Layout");
    cy.activateActivity("Doc Layout");
    cy.completeActivity("Doc Layout");

    cy.dataTestId("completion-modal").should("be.visible");
    cy.dataTestId("completion-modal").then(($modal) => {
      const r = $modal[0].getBoundingClientRect();
      const vw = Cypress.config("viewportWidth") as number;
      const center = r.left + r.width / 2;
      // Centro del modal está dentro de ±40px del centro del viewport
      expect(Math.abs(center - vw / 2)).to.be.lessThan(40);
    });
  });

  it("10b.G: el slider aparece entre el título y la vista previa", () => {
    startCleanDay();
    cy.openActivityLibrary();
    cy.createNewActivity("Doc Layout 2", "Slider order test", "Con objetivo claro", "60");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Doc Layout 2");
    cy.activateActivity("Doc Layout 2");
    cy.completeActivity("Doc Layout 2");

    cy.dataTestId("completion-modal").should("be.visible");
    // Título arriba, slider en medio, preview abajo
    cy.assertPositionRelative("satisfaction-slider", "tempos-preview", "above");
    cy.dataTestId("completion-modal").within(() => {
      // El título (Typography) está antes en el DOM
      cy.contains("h2, .MuiDialogTitle-root", "Terminaste").should("be.visible");
      cy.get(".MuiDialogTitle-root").should("exist").then(($title) => {
        cy.dataTestId("satisfaction-slider").then(($slider) => {
          const titleBottom = $title[0].getBoundingClientRect().bottom;
          const sliderTop = $slider[0].getBoundingClientRect().top;
          expect(sliderTop).to.be.greaterThan(titleBottom - 2);
        });
      });
    });
  });

  it("10b.H: total del preview a la izquierda de 'tempos' (baseline aligned)", () => {
    startCleanDay();
    cy.openActivityLibrary();
    cy.createNewActivity("Doc Layout 3", "Preview alignment", "Con objetivo claro", "60");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Doc Layout 3");
    cy.activateActivity("Doc Layout 3");
    cy.completeActivity("Doc Layout 3");

    cy.dataTestId("completion-modal").should("be.visible");
    cy.assertPositionRelative("preview-total", "tempos-preview", "leftOf");
    // Y ambos en la misma línea vertical (baseline)
    cy.assertAlignedHorizontally("preview-total", "tempos-preview", 0.5);
  });

  it("10b.I: 'No la terminé' está a la izquierda de 'Guardar y recibir'", () => {
    startCleanDay();
    cy.openActivityLibrary();
    cy.createNewActivity("Doc Layout 4", "Buttons order", "Con objetivo claro", "60");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Doc Layout 4");
    cy.activateActivity("Doc Layout 4");
    cy.completeActivity("Doc Layout 4");

    cy.dataTestId("completion-modal").should("be.visible");
    cy.dataTestId("completion-modal").within(() => {
      cy.dataTestId("interrupt-button").then(($int) => {
        cy.dataTestId("confirm-button").then(($ok) => {
          const rint = $int[0].getBoundingClientRect();
          const rok = $ok[0].getBoundingClientRect();
          expect(rint.right).to.be.lessThan(rok.left + 1);
        });
      });
    });
  });

  it("10b.J: el modal respeta su ancho máximo (maxWidth sm ≈ 600px)", () => {
    startCleanDay();
    cy.openActivityLibrary();
    cy.createNewActivity("Doc Layout 5", "Modal width", "Con objetivo claro", "60");
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo("Doc Layout 5");
    cy.activateActivity("Doc Layout 5");
    cy.completeActivity("Doc Layout 5");

    cy.dataTestId("completion-modal").should("be.visible");
    // Mui maxWidth sm = 600px; la Paper interna mide menos, ~528px.
    // Toleramos 480-620.
    cy.dataTestId("completion-modal").then(($m) => {
      const r = $m[0].getBoundingClientRect();
      expect(r.width).to.be.at.least(480);
      expect(r.width).to.be.at.most(640);
    });
  });
});
