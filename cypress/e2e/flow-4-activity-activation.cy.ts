describe("Flujo 4: Activación y Finalización de Actividades", () => {
  beforeEach(() => {
    // Configuración estándar: día nuevo con bloques Mañana/Tarde
    cy.setupStandardDayWithBlocks();
    // Asegurar que la biblioteca esté abierta para crear actividades
    cy.openActivityLibrary();
  });

  it("4.1: Activa, completa (excediendo tiempo) actividad con objetivo claro", () => {
    const activityTitle = "Redactar informe E2E";
    let templateId: string;

    cy.log("Creando actividad con objetivo claro");
    cy.createNewActivity(activityTitle, "Informe mensual detallado", "Con objetivo claro", "60");
    cy.verifyActivityInLibrary(activityTitle);

    cy.log("Obteniendo ID de plantilla");
    cy.getActivityIdFromTitle(activityTitle).then((id) => {
      templateId = id;
      cy.log(`Plantilla creada con ID: ${templateId}`);

      cy.log("Instanciando actividad (desde biblioteca abierta)");
      cy.instantiateAndVerifyInTodo(activityTitle);

      cy.log("Verificando visibilidad en Kanban (redundante si ya se verificó en Por Hacer)");

      cy.log("Tomando control del reloj ANTES de activar");
      cy.clock();

      cy.log("Activando actividad");
      cy.activateActivity(activityTitle);
      cy.verifyActivityStateInKanban(activityTitle, "active");

      cy.log("Obteniendo ID de instancia desde tarjeta Kanban activa y continuando...");
      cy.getInstanceIdFromKanbanCard(activityTitle).then((instanceId) => {
        cy.log(`Instancia activa ID: ${instanceId}`);

        cy.log("Simulando paso del tiempo (70 min)");
        cy.advanceClock(70);

        cy.log("Completando actividad");
        cy.completeActivity(activityTitle);

        cy.log("Manejando modal de variables subjetivas");
        cy.handleSubjectiveModal();

        cy.log("Esperando a que desaparezca del Kanban (después del modal)");
        cy.assertActivityNotInKanban(instanceId);

        cy.log("Restaurando reloj");
        cy.clock().then((clock) => clock.restore());

        cy.log("Verificando estado final del Timeline");
        cy.getTimelineBar(instanceId).should("be.visible");
        cy.verifyTimelineBarState(instanceId, "completed");
        cy.verifyTimelineBarEstimationState(instanceId, "exceeded");
      });
    });
  });

  it("A1: Activa y completa actividad con duración flexible dentro del rango", () => {
    const activityTitle = "Barrer la casa E2E";
    let templateId: string;

    cy.log("Creando actividad flexible");
    cy.createNewActivity(activityTitle, "Limpieza rápida", "Duración flexible", ["5", "10"]);
    cy.verifyActivityInLibrary(activityTitle);

    cy.log("Obteniendo ID de plantilla");
    cy.getActivityIdFromTitle(activityTitle).then((id) => {
      templateId = id;
      cy.log(`Plantilla creada con ID: ${templateId}`);

      cy.log("Instanciando actividad y verificando en Por Hacer");
      cy.instantiateAndVerifyInTodo(activityTitle);

      cy.log("Verificando visibilidad en Kanban (redundante si ya se verificó en Por Hacer)");

      cy.log("Tomando control del reloj ANTES de activar");
      cy.clock();

      cy.log("Activando actividad");
      cy.activateActivity(activityTitle);
      cy.verifyActivityStateInKanban(activityTitle, "active");

      cy.log("Obteniendo ID de instancia desde tarjeta Kanban activa");
      cy.getInstanceIdFromKanbanCard(activityTitle).then((instanceId) => {
        cy.log(`Instancia activa ID: ${instanceId}`);

        cy.log("Simulando paso del tiempo (8 min)");
        cy.advanceClock(8);

        cy.log("Completando actividad");
        cy.completeActivity(activityTitle);

        cy.log("Manejando modal de variables subjetivas");
        cy.handleSubjectiveModal();

        cy.log("Esperando a que desaparezca del Kanban");
        cy.assertActivityNotInKanban(instanceId);

        cy.log("Restaurando reloj");
        cy.clock().then((clock) => clock.restore());

        cy.log("Verificando estado final del Timeline");
        cy.getTimelineBar(instanceId).should("be.visible");
        cy.verifyTimelineBarState(instanceId, "completed");
        cy.verifyTimelineBarEstimationState(instanceId, "within-range");
      });
    });
  });

  it("A2: Activa y completa actividad con timeboxing (mínimo), cumpliendo y extendiendo", () => {
    const activityTitle = "Leer libro E2E";
    let templateId: string;

    cy.log("Creando actividad timeboxing");
    cy.createNewActivity(activityTitle, "Lectura concentrada", "Timeboxing", "20");
    cy.verifyActivityInLibrary(activityTitle);

    cy.log("Obteniendo ID de plantilla");
    cy.getActivityIdFromTitle(activityTitle).then((id) => {
      templateId = id;
      cy.log(`Plantilla creada con ID: ${templateId}`);

      cy.log("Instanciando actividad y verificando en Por Hacer");
      cy.instantiateAndVerifyInTodo(activityTitle);

      cy.log("Verificando visibilidad en Kanban (redundante si ya se verificó en Por Hacer)");

      cy.log("Tomando control del reloj ANTES de activar");
      cy.clock();

      cy.log("Activando actividad");
      cy.activateActivity(activityTitle);
      cy.verifyActivityStateInKanban(activityTitle, "active");

      cy.log("Obteniendo ID de instancia desde tarjeta Kanban activa");
      cy.getInstanceIdFromKanbanCard(activityTitle).then((instanceId) => {
        cy.log(`Instancia activa ID: ${instanceId}`);

        cy.log("Simulando tiempo hasta mínimo (20 min) y extra (15 min)");
        cy.advanceClock(20);
        cy.advanceClock(15);

        cy.log("Completando actividad");
        cy.completeActivity(activityTitle);

        cy.log("Manejando modal de variables subjetivas");
        cy.handleSubjectiveModal();

        cy.log("Esperando a que desaparezca del Kanban");
        cy.assertActivityNotInKanban(instanceId);

        cy.log("Restaurando reloj");
        cy.clock().then((clock) => clock.restore());

        cy.log("Verificando estado final del Timeline");
        cy.getTimelineBar(instanceId).should("be.visible");
        cy.verifyTimelineBarState(instanceId, "completed");
        cy.verifyTimelineBarEstimationState(instanceId, "timebox-met");
      });
    });
  });

  it.skip("A3: Activa actividad desde acceso rápido con configuración dinámica", () => {
    const activityTitle = "Meditación Rápida E2E";
    const quickActivityTestId = "medit-quick-e2e";
    let instanceId: string | undefined;

    cy.log("Creando plantilla base para acceso rápido (si no existe)");
    cy.createNewActivity(activityTitle, "Meditación guiada corta", "Timeboxing", "5");
    cy.verifyActivityInLibrary(activityTitle);

    cy.log(`Activando desde acceso rápido (${quickActivityTestId})`);
    cy.clickQuickActivity(quickActivityTestId);

    cy.log("Configurando instancia (timeboxing 10 min)");
    cy.configureActivityInstance({ minDuration: "10" });
    cy.confirmActivityInstance();

    cy.log("Obteniendo ID de instancia y verificando estado activo");
    cy.getInstanceIdFromKanbanCard(activityTitle).then((id) => {
      instanceId = id;
      cy.log(`Instancia activa ID: ${instanceId}`);
      cy.verifyActivityStateInKanban(activityTitle, "active");

      cy.log("Tomando control del reloj ANTES de simular tiempo");
      cy.clock();

      cy.log("Simulando paso del tiempo (12 min)");
      cy.advanceClock(12);

      cy.log("Completando actividad (asumiendo que está en Kanban)");
      cy.completeActivity(activityTitle);

      cy.log("Manejando modal de variables subjetivas");
      cy.handleSubjectiveModal();

      cy.log("Esperando a que desaparezca del Kanban");
      cy.assertActivityNotInKanban(instanceId);

      cy.log("Restaurando reloj");
      cy.clock().then((clock) => clock.restore());

      cy.log("Verificando estado final del Timeline");
      if (instanceId) {
        cy.getTimelineBar(instanceId).should("be.visible");
        cy.verifyTimelineBarState(instanceId, "completed");
        cy.verifyTimelineBarEstimationState(instanceId, "timebox-met");
      } else {
        throw new Error(
          "No se pudo obtener el ID de la instancia de meditación para la verificación final."
        );
      }
    });
  });
});
