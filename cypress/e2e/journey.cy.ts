/**
 * Recorrido completo de la UI: biblioteca → bloques → empezar el día →
 * añadir al plan → foco → ritual de cierre con tempos → evento → cambio de
 * actividad → terminar el día → resumen.
 */
describe("LifeUI", () => {
  it("primer uso: muestra cómo funciona y permite empezar el día", () => {
    cy.visitFresh();
    cy.contains("h1", /Buen(os|as) (días|tardes|noches)/);
    cy.contains("Cierre honesto");
    cy.get("[data-testid=start-day]").click();
    cy.contains("h1", "Hoy");
    cy.contains("Nada en marcha");
  });

  it("recorre el día completo con el ritual de cierre", () => {
    cy.visitFresh("/library");

    // Biblioteca: crear una actividad con objetivo claro, anclada
    cy.contains("button", "Nueva actividad").click();
    cy.get("[role=dialog]").within(() => {
      cy.get("input").first().type("Escribir informe");
      cy.contains("button", "Objetivo claro").click();
      cy.get('[role="switch"]').click();
      cy.contains("button", "Crear actividad").click();
    });
    cy.contains("«Escribir informe» está en tu biblioteca");

    // Bloques: usar los predeterminados
    cy.contains("[role=tab]", "Bloques horarios").click();
    cy.contains("button", "Usar estos bloques").click();
    cy.contains("Mañana");
    cy.contains("Noche");

    // Empezar el día
    cy.contains("a", "Hoy").click();
    cy.get("[data-testid=start-day]").click();

    // Añadir al plan con N, buscando en la biblioteca
    cy.get("body").type("n");
    cy.get("[role=dialog]").within(() => {
      cy.get('input[aria-label="Buscar en la biblioteca"]').type("informe{enter}");
      cy.contains("Por hacer").click();
      cy.contains("button", "Añadir al plan").click();
    });
    cy.contains("«Escribir informe» añadida");

    // Empezar desde el plan y cerrar con el ritual
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

    // Evento puntual
    cy.contains("button", "Evento").click();
    cy.get('input[aria-label="Nuevo evento"]').type("Café{enter}");
    cy.contains("Café registrado");

    // Acceso rápido y cambio de actividad a través del cierre
    cy.contains("section", "Accesos rápidos").contains("button", "Escribir informe").click();
    cy.contains("En marcha");
    cy.get("body").type("t");
    cy.get("[data-testid=closing-dialog]").contains("button", "No la terminé").click();
    cy.contains("Está bien. Mañana es otra oportunidad.");

    // Terminar el día y ver el resumen
    cy.get('button[aria-label="Más opciones del día"]').click();
    cy.contains("[role=menuitem]", "Terminar el día").click();
    cy.get("[role=dialog]").contains("button", "Terminar el día").click();
    cy.location("pathname").should("eq", "/review");
    cy.get('section[aria-label="Tempos del día"]').should("contain", "30").and("contain", "30%");
    cy.contains("td", "Escribir informe");
    cy.contains("Sin terminar");
  });

  it("en móvil navega con la barra inferior", () => {
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

describe("Idioma", () => {
  it("la primera visita es en inglés aunque el navegador esté en español", () => {
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

  it("se puede cambiar a inglés desde Ajustes y se recuerda", () => {
    cy.visitFresh("/settings");
    cy.contains("h1", "Ajustes");
    cy.contains('[role="radio"]', "English").click();
    cy.contains("h1", "Settings");
    cy.contains("nav a", "Library");
    cy.reload();
    cy.contains("h1", "Settings");
    cy.get("html").should("have.attr", "lang", "en");
  });

  it("las rutas antiguas en español redirigen", () => {
    cy.visitFresh("/resumen");
    cy.location("pathname").should("eq", "/review");
  });
});
