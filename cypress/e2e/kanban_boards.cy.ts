/// <reference types="cypress" />

describe("Flujo 3: Organización de actividades en el tablero Kanban (E2E)", () => {
  beforeEach(() => {
    // Visitar e iniciar un día
    cy.visitStartPage();
    cy.startDay();
  });

  it("Flujo principal: Crear bloques de tiempo y organizar actividades", () => {
    // 1. Abrir el gestor de bloques de tiempo
    cy.openTimeBlockManager();

    // 2. Crear tres bloques de tiempo para el día
    cy.createTimeBlock("Mañana", "06:00", "12:00");
    cy.createTimeBlock("Mediodía", "12:00", "15:00");
    cy.createTimeBlock("Tarde", "15:00", "19:00");

    // 3. Cerrar modal
    cy.closeTimeBlockModal();

    // 4. Abrir biblioteca de actividades y crear algunas actividades
    cy.openActivityLibrary();
    const activity1Title = "Redactar informe de trabajo";
    cy.createNewActivity(
      activity1Title,
      "Escribir informe semanal para el jefe",
      "Con objetivo claro",
      "60"
    );
    cy.verifyActivityInLibrary(activity1Title); // Verificar creación

    const activity2Title = "Reunión semanal";
    cy.createNewActivity(activity2Title, "Reunión con el equipo para revisión", "Timeboxing", "45");
    cy.verifyActivityInLibrary(activity2Title); // Verificar creación

    // 5. Instanciar la actividad y verificar en 'Por Hacer' usando el nuevo comando
    cy.instantiateFromLibrary(activity1Title); // Solo instancia

    // 6. Instanciar la segunda actividad y verificar en 'Por Hacer'
    cy.instantiateFromLibrary(activity2Title); // Solo instancia

    // 7. Cerrar la biblioteca ahora que terminamos de instanciar
    cy.closeActivityLibraryModal(); // Cerrar una vez

    // 8. Verificar ambas actividades en la columna 'Por Hacer' ahora que la biblioteca está cerrada
    cy.verifyActivityInColumn(activity1Title, "Por Hacer");
    cy.verifyActivityInColumn(activity2Title, "Por Hacer"); // Esta era la verificación que fallaba
  });

  it("Flujo alternativo A1: Instanciar múltiples actividades", () => {
    // Primero configuramos un ambiente con bloques y actividades
    cy.openTimeBlockManager();
    cy.createTimeBlock("Mañana", "06:00", "12:00");
    cy.closeTimeBlockModal();

    cy.openActivityLibrary();

    // Crear dos actividades
    const activity1Title = "Tarea 1";
    const activity2Title = "Tarea 2";
    cy.createNewActivity(activity1Title, "Primera tarea");
    cy.verifyActivityInLibrary(activity1Title);
    cy.createNewActivity(activity2Title, "Segunda tarea");
    cy.verifyActivityInLibrary(activity2Title);

    // Instanciar ambas actividades y verificar en 'Por Hacer'
    cy.instantiateFromLibrary(activity1Title);
    cy.instantiateFromLibrary(activity2Title);

    // Cerrar la biblioteca
    cy.closeActivityLibraryModal();

    // Verificar ambas en "Por Hacer"
    cy.verifyActivityInColumn(activity1Title, "Por Hacer");
    cy.verifyActivityInColumn(activity2Title, "Por Hacer");

    // NOTA: El reordenamiento dentro de la columna requiere drag and drop
    // que es complicado en Cypress. Esta parte se implementará más adelante.
    cy.log("El reordenamiento de actividades será implementado en el futuro");
  });
});
