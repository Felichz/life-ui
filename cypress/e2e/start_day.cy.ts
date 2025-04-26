/// <reference types="cypress" />

describe("Flujo 1: Inicio del día (E2E)", () => {
  it("1) Primer uso: muestra StartPage y permite iniciar día", () => {
    // Visitar la página de inicio
    cy.visitStartPage();

    // Verificar mensaje de bienvenida usando data-testid
    cy.dataTestId("welcome-message").should("be.visible");

    // Iniciar el día
    cy.startDay();

    // Comprobar elementos clave de DayPage
    cy.dataTestId("timeline").should("be.visible");
    cy.get('[aria-label="actualizar variables subjetivas"]').should("be.visible");
  });

  it("2) Con datos previos: muestra resumen del día anterior antes de iniciar", () => {
    // Visitar la página de inicio con datos simulados del día anterior
    cy.visitStartPageWithPreviousDay();

    // Usar el nuevo comando para verificar el resumen
    cy.verifyPreviousDaySummaryVisible();

    // Iniciar un nuevo día
    cy.startDay();

    // Verifica que carga el tablero
    cy.get("[data-testid=day-page]", { timeout: 10000 }).should("exist");
  });

  it("3) Flujo alternativo: Gestionar biblioteca sin iniciar día", () => {
    // Visitar la página con datos previos
    cy.visitStartPageWithPreviousDay();

    // Usar el nuevo comando para navegar y verificar la vista de resumen
    cy.navigateToOverviewAndVerify();
  });
});
