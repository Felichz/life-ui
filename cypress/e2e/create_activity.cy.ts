/// <reference types="cypress" />

describe("Flujo 2: Creación y gestión de actividades en la biblioteca (E2E)", () => {
  beforeEach(() => {
    // Visitar e iniciar un día
    cy.visitStartPage();
    cy.startDay();
  });

  it("Flujo principal: Crear actividad con objetivo claro", () => {
    const activityTitle = "Redactar informe de trabajo";
    // Abrir biblioteca de actividades
    cy.openActivityLibrary();

    // Crear nueva actividad con objetivo claro
    cy.createNewActivity(
      activityTitle,
      "Escribir informe semanal para el jefe",
      "Con objetivo claro",
      "45"
    );

    // Usar el nuevo comando para verificar en la biblioteca
    // @ts-expect-error: comando personalizado
    cy.verifyActivityInLibrary(activityTitle);
  });

  it("Flujo alternativo A1: Crear actividad con duración flexible", () => {
    const activityTitle = "Meditar";
    // Abrir biblioteca de actividades
    cy.openActivityLibrary();

    // Crear actividad con duración flexible
    cy.createNewActivity(
      activityTitle,
      "Sesión de meditación para reducir estrés",
      "Duración flexible",
      ["5", "10"]
    );

    // Verificar
    // @ts-expect-error: comando personalizado
    cy.verifyActivityInLibrary(activityTitle);
  });

  it("Flujo alternativo A2: Crear actividad con timeboxing", () => {
    const activityTitle = "Navegar redes sociales";
    // Abrir biblioteca de actividades
    cy.openActivityLibrary();

    // Crear actividad con timeboxing
    cy.createNewActivity(
      activityTitle,
      "Tiempo limitado para revisar redes sociales",
      "Timeboxing",
      "20"
    );

    // Verificar
    // @ts-expect-error: comando personalizado
    cy.verifyActivityInLibrary(activityTitle);
  });

  it("Flujo alternativo A3: Editar una actividad existente", () => {
    const originalTitle = "Revisar email";
    // Cambiar el nuevo título para que no contenga el original
    const newTitle = "Gestionar bandeja de entrada";
    const newDuration = "25"; // Cambiar también duración para variar

    // Abrir biblioteca de actividades
    cy.openActivityLibrary();

    // Crear una actividad simple para luego editarla
    cy.createNewActivity(originalTitle, "Revisión diaria de correos");

    // Editar la actividad
    cy.contains(originalTitle).parents("div").find('[aria-label="editar"]').click();

    // Verificar que abre el modal de edición
    cy.dataTestId("activity-form-modal").should("be.visible");

    // Llenar título, duración y descripción dentro del modal
    cy.dataTestId("activity-form-modal").within(() => {
      cy.dataTestId("activity-title-input").type(
        "{selectall}{backspace}Gestionar bandeja de entrada"
      );
      cy.dataTestId("estimated-duration-input").type("{selectall}{backspace}25");
      cy.dataTestId("activity-description-input").type(
        "{selectall}{backspace}Nueva descripción para la bandeja"
      );
      // Abrir selector de tipo
      cy.dataTestId("activity-type-select").click();
    });
    // Seleccionar 'Duración flexible' directamente por data-value, forzando click en el portal
    cy.get('li[role="option"][data-value="flexible-duration"]').click({ force: true });
    // Ya con el tipo seleccionado, volver al modal para rellenar min/max y guardar
    cy.dataTestId("activity-form-modal").within(() => {
      cy.dataTestId("min-duration-input").should("be.visible").type(`{selectall}5`);
      cy.dataTestId("max-duration-input").should("be.visible").type(`{selectall}15`);
      cy.dataTestId("save-activity-button").click();
    });

    // Verificar que el título antiguo no existe
    cy.contains(originalTitle).should("not.exist");
    cy.contains(newTitle).should("be.visible");
    // Podríamos añadir verificación de duración/tipo si fuera necesario
  });
});
