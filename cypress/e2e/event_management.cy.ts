/// <reference types="cypress" />

describe("Flujo 5: Manejo de eventos puntuales (E2E)", () => {
  beforeEach(() => {
    // Configuración inicial: visitar la página, comenzar día Y ASEGURAR VARIABLE
    // cy.visitStartPage(); // Reemplazado por el nuevo comando
    // cy.startDay();      // Reemplazado por el nuevo comando
    // @ts-expect-error: comando personalizado
    cy.setupStandardDayWithVariable("Energía"); // Usar el nuevo comando
  });

  it("Flujo principal: Crear, registrar evento y actualizar variables", () => {
    const eventName = "Tomar café";
    const eventName2 = "Tomar medicación";
    let eventId: string;

    // 1. Abrir la biblioteca de eventos
    // @ts-expect-error: comando personalizado
    cy.openEventLibrary();

    // 2. Crear el primer evento
    // @ts-expect-error: comando personalizado
    cy.createNewEvent(eventName);
    // @ts-expect-error: comando personalizado
    cy.verifyEventInLibrary(eventName);

    // 3. Crear el segundo evento
    // @ts-expect-error: comando personalizado
    cy.createNewEvent(eventName2);
    // @ts-expect-error: comando personalizado
    cy.verifyEventInLibrary(eventName2);

    // 4. Obtener ID del primer evento - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
    // @ts-expect-error: comando personalizado
    cy.getEventIdFromName(eventName).then((id) => {
      eventId = id;
      cy.log(`ID del evento '${eventName}': ${eventId}`);

      // 5. Cerrar la biblioteca de eventos
      // @ts-expect-error: comando personalizado
      cy.closeEventLibraryModal();

      // 6. Hacer clic en el evento rápido - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
      // @ts-expect-error: comando personalizado
      cy.clickQuickEvent(eventId);

      // 7. Manejar el modal subjetivo (confirmando)
      // @ts-expect-error: comando personalizado
      cy.handleSubjectiveModal("confirm");

      // 8. Verificar que el evento aparece en el timeline - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
      // @ts-expect-error: comando personalizado
      cy.verifyEventInTimeline(eventName);
    });
    // // Por ahora, solo cerramos el modal después de crear los eventos // COMENTADO: La lógica ahora está dentro del .then()
    // cy.closeEventLibraryModal(); // Asegurar que el modal se cierra // COMENTADO: La lógica ahora está dentro del .then()
  });

  it("Flujo alternativo A1: Registrar evento sin actualizar variables", () => {
    const eventName = "Revisión rápida correo";
    let eventId: string;

    // 1. Abrir biblioteca y crear evento
    // @ts-expect-error: comando personalizado
    cy.openEventLibrary();
    // @ts-expect-error: comando personalizado
    cy.createNewEvent(eventName);
    // @ts-expect-error: comando personalizado
    cy.verifyEventInLibrary(eventName);

    // 2. Obtener ID - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
    // @ts-expect-error: comando personalizado
    cy.getEventIdFromName(eventName).then((id) => {
      eventId = id;
      cy.log(`ID del evento '${eventName}': ${eventId}`);

      // 3. Cerrar biblioteca
      // @ts-expect-error: comando personalizado
      cy.closeEventLibraryModal();

      // 4. Clic en evento rápido - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
      // @ts-expect-error: comando personalizado
      cy.clickQuickEvent(eventId);

      // 5. Manejar modal subjetivo (omitiendo)
      // @ts-expect-error: comando personalizado
      cy.handleSubjectiveModal("omit");

      // 6. Verificar en timeline - ASUMIENDO COMANDO Y SELECTOR FUNCIONALES
      // @ts-expect-error: comando personalizado
      cy.verifyEventInTimeline(eventName);
    });
    // // Por ahora, solo cerramos el modal después de crear el evento // COMENTADO: La lógica ahora está dentro del .then()
    // cy.closeEventLibraryModal(); // Asegurar que el modal se cierra // COMENTADO: La lógica ahora está dentro del .then()
  });

  // Nota: El flujo alternativo A2 (Consulta de eventos históricos) requiere interacciones
  // de hover y clic en el timeline, que pueden ser más complejas de implementar
  // y verificar de forma robusta en E2E. Se podría añadir más adelante si es necesario.
});
