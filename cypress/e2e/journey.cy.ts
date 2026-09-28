/**
 * Full UI walkthrough: library → time blocks → start the day →
 * add to the plan → focus → the closing ritual with tempos → event →
 * activity switch → end the day → review.
 */
describe("LifeUI", () => {
  it("first run: shows how it works and lets you start the day", () => {
    cy.visitFresh();
    cy.contains("h1", /Buen(os|as) (días|tardes|noches)/);
    cy.contains("Cierre honesto");
    cy.get("[data-testid=start-day]").click();
    cy.contains("h1", "Hoy");
    cy.contains("Nada en marcha");
  });

  it("walks through the full day with the closing ritual", () => {
    cy.visitFresh("/library");

    // Library: create a clear-objective activity, pinned
    cy.contains("button", "Nueva actividad").click();
    cy.get("[role=dialog]").within(() => {
      cy.get("input").first().type("Escribir informe");
      cy.contains("button", "Objetivo claro").click();
      cy.get('[role="switch"]').click();
      cy.contains("button", "Crear actividad").click();
    });
    cy.contains("«Escribir informe» está en tu biblioteca");

    // Time blocks: use the defaults
    cy.contains("[role=tab]", "Bloques horarios").click();
    cy.contains("button", "Usar estos bloques").click();
    cy.contains("Mañana");
    cy.contains("Noche");

    // Start the day
    cy.contains("a", "Hoy").click();
    cy.get("[data-testid=start-day]").click();

    // Add to the plan with N, searching the library
    cy.get("body").type("n");
    cy.get("[role=dialog]").within(() => {
      cy.get('input[aria-label="Buscar en la biblioteca"]').type("informe{enter}");
      cy.contains("Por hacer").click();
      cy.contains("button", "Añadir al plan").click();
    });
    cy.contains("«Escribir informe» añadida");

    // Start from the plan and close with the ritual
    cy.contains("button", "Empezar").first().click();
    cy.contains("En marcha");
    cy.title().should("contain", "Escribir informe");
    cy.get("[data-testid=finish-active]").click();
    cy.get("[data-testid=closing-dialog]").within(() => {
      cy.contains("¿Cómo fue «Escribir informe»?");
      // 30 min estimados × 7/7 = 30
      cy.contains("+30");
      cy.get("[data-testid=closing-confirm]").click();
    });
    cy.contains("Llevas 30 tempos · 30% de tu referencia diaria");
    cy.contains("section", "Registro").should("contain", "Escribir informe").and("contain", "+30");

    // One-off event
    cy.contains("button", "Evento").click();
    cy.get('input[aria-label="Nuevo evento"]').type("Café{enter}");
    cy.contains("Café registrado");

    // Quick start and activity switch through the closing ritual
    cy.contains("section", "Accesos rápidos").contains("button", "Escribir informe").click();
    cy.contains("En marcha");
    cy.get("body").type("t");
    cy.get("[data-testid=closing-dialog]").contains("button", "No la terminé").click();
    cy.contains("Está bien. Mañana es otra oportunidad.");

    // End the day and see the review
    cy.get('button[aria-label="Más opciones del día"]').click();
    cy.contains("[role=menuitem]", "Terminar el día").click();
    cy.get("[role=dialog]").contains("button", "Terminar el día").click();
    cy.location("pathname").should("eq", "/review");
    cy.get('section[aria-label="Tempos del día"]').should("contain", "30").and("contain", "30%");
    cy.contains("td", "Escribir informe");
    cy.contains("Sin terminar");
  });

  it("on mobile, navigates with the bottom bar", () => {
    cy.viewport(375, 812);
    cy.visitFresh();
    cy.get("[data-testid=start-day]").click();
    cy.get('nav[aria-label="Principal"]')
      .filter(":visible")
      .within(() => {
        cy.contains("Biblioteca").click();
      });
    cy.location("pathname").should("eq", "/library");
    cy.contains("Crea tu primera actividad");
  });
});

describe("Language", () => {
  it("first visit is English even with a Spanish browser", () => {
    cy.visit("/settings", {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem("lifeui.theme", "light");
        Object.defineProperty(win.navigator, "language", { value: "es-ES" });
        Object.defineProperty(win.navigator, "languages", { value: ["es-ES", "es"] });
      },
    });
    cy.contains("h1", "Settings");
    cy.get("html").should("have.attr", "lang", "en");
    cy.contains('[role="radio"]', "Español").click();
    cy.contains("h1", "Ajustes");
    cy.get("html").should("have.attr", "lang", "es");
    cy.reload();
    cy.contains("h1", "Ajustes");
    cy.get("html").should("have.attr", "lang", "es");
  });

  it("you can switch to English from Settings and it is remembered", () => {
    cy.visitFresh("/settings");
    cy.contains("h1", "Ajustes");
    cy.contains('[role="radio"]', "English").click();
    cy.contains("h1", "Settings");
    cy.contains("nav a", "Library");
    cy.reload();
    cy.contains("h1", "Settings");
    cy.get("html").should("have.attr", "lang", "en");
  });

  it("legacy Spanish routes redirect", () => {
    cy.visitFresh("/resumen");
    cy.location("pathname").should("eq", "/review");
  });
});
