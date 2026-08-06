/// <reference types="cypress" />

/**
 * E2E Fase 10b — Banner de Tempos: progreso visual end-to-end.
 *
 * Estrategia: usar cy.clock() para fijar el tiempo en 10:00 AM, así la
 * duración de las actividades (60 min activos) cae dentro del bloque mañana
 * pre-creado, y la timeline queda visualmente coherente.
 *
 * Fórmula MVP v3.1: tempos = ceil(base × score / 7)
 *   base = resolveBaseMinutes(estimated, duration); si duration < 1 min
 *   (porque NO esperamos realmente 60 min en CI), cae al estimated.
 *
 * Verificamos:
 *  - Banner muestra el total correcto.
 *  - Banner muestra el % correcto (displayPercent).
 *  - LinearProgress (MUI) tiene el ancho visual coherente con el %.
 *  - Si total > target, displayPercent NO capea pero progressBarValue SÍ.
 */

describe("Fase 10b — Banner de Tempos: progreso visual", () => {
  beforeEach(() => {
    cy.clock(new Date("2026-04-01T10:00:00Z").getTime(), ["Date", "performance", "requestAnimationFrame"]);
    cy.visit("/start", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("qualia_control_app_state");
      },
    });
  });

  function startConBloque() {
    cy.visitStartPage();
    cy.startDay();
    cy.openTimeBlockManager();
    cy.createTimeBlock("Mañana", "09:00", "12:00");
    cy.closeTimeBlockModal();
  }

  function crear(name: string, mins: string) {
    cy.openActivityLibrary();
    cy.createNewActivity(name, "test", "Con objetivo claro", mins);
    cy.closeActivityLibraryModal();
    cy.instantiateAndVerifyInTodo(name);
    cy.activateActivity(name);
  }

  it("10b.P1: completar con score 5 × 60min → 43 tempos (43%)", () => {
    // score=5, base=60 → ceil(60*5/7) = 43
    startConBloque();
    crear("Actividad A", "60");
    cy.completeActivity("Actividad A");
    cy.dataTestId("completion-modal").should("be.visible");

    // Mover slider de 7 a 5 (delta = -2)
    cy.dataTestId("satisfaction-slider").focus();
    cy.dataTestId("satisfaction-slider").type("{leftarrow}{leftarrow}");

    cy.dataTestId("preview-total").then(($p) => {
      const v = parseInt($p.text().trim(), 10);
      expect(v, "preview").to.equal(43);
    });

    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    cy.dataTestId("tempo-total").then(($t) => {
      const v = parseInt($t.text().trim(), 10);
      expect(v).to.equal(43);
    });
    cy.dataTestId("tempo-percent").should("contain.text", "43%");
    cy.assertLinearProgressBarMatches("tempo-progress", 43, 3);
  });

  it("10b.P2: completar con score 7 × 60min → 60 tempos (60%)", () => {
    // score=7, base=60 → ceil(60*7/7) = 60
    startConBloque();
    crear("Actividad B", "60");
    cy.completeActivity("Actividad B");
    // No movemos slider, queda en default 7 = 100%
    cy.dataTestId("preview-total").then(($p) => {
      expect(parseInt($p.text().trim(), 10)).to.equal(60);
    });
    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    cy.dataTestId("tempo-total").then(($t) => {
      expect(parseInt($t.text().trim(), 10)).to.equal(60);
    });
    cy.dataTestId("tempo-percent").should("contain.text", "60%");
    cy.assertLinearProgressBarMatches("tempo-progress", 60, 3);
  });

  it("10b.P3: con score 10 × 30min → 43 tempos", () => {
    // score=10, base=30 → ceil(30*10/7) = 43
    startConBloque();
    crear("Actividad C", "30");
    cy.completeActivity("Actividad C");
    cy.dataTestId("satisfaction-slider").focus();
    // 7 -> 10 = +3
    cy.dataTestId("satisfaction-slider").type("{rightarrow}{rightarrow}{rightarrow}");

    cy.dataTestId("preview-total").then(($p) => {
      expect(parseInt($p.text().trim(), 10)).to.equal(43);
    });
    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    cy.dataTestId("tempo-total").then(($t) => {
      expect(parseInt($t.text().trim(), 10)).to.equal(43);
    });
    cy.dataTestId("tempo-percent").should("contain.text", "43%");
    cy.assertLinearProgressBarMatches("tempo-progress", 43, 3);
  });

  it("10b.P4: dos completadas suman tempos", () => {
    // 30min × score 8 = 35; 60min × score 5 = 43; total = 78 (78%)
    startConBloque();
    crear("Actividad D1", "30");
    cy.completeActivity("Actividad D1");
    cy.dataTestId("satisfaction-slider").focus();
    // 7 -> 8 = +1
    cy.dataTestId("satisfaction-slider").type("{rightarrow}");
    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    crear("Actividad D2", "60");
    cy.completeActivity("Actividad D2");
    cy.dataTestId("satisfaction-slider").focus();
    // 7 -> 5 = -2
    cy.dataTestId("satisfaction-slider").type("{leftarrow}{leftarrow}");
    cy.dataTestId("confirm-button").click();
    cy.dataTestId("completion-modal").should("not.exist");

    cy.dataTestId("tempo-total").then(($t) => {
      expect(parseInt($t.text().trim(), 10)).to.equal(78);
    });
    cy.dataTestId("tempo-percent").should("contain.text", "78%");
    cy.assertLinearProgressBarMatches("tempo-progress", 78, 3);
  });
});
