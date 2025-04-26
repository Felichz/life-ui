/// <reference types="cypress" />
import type { ActivityType } from "../../../src/types";

/**
 * Comandos personalizados para acciones específicas de la aplicación Qualia Control
 * Estos comandos facilitan la escritura de tests al abstraer las acciones comunes
 */

// --- Tipos para Comandos Personalizados ---
// La definición de tipos se ha movido a cypress/support/e2e.ts

// --- Implementación de Comandos ---

// Comandos para Flujo 1: Inicio del día
Cypress.Commands.add("visitStartPage", () => {
  cy.visit("/start");
  cy.contains("Sistema para gestión consciente del tiempo y actividades", {
    timeout: 10000,
  }).should("be.visible");
});

Cypress.Commands.add("startDay", () => {
  cy.dataTestId("start-day-button").should("be.visible").click();
  cy.get("[data-testid=day-page]", { timeout: 10000 }).should("exist");
});

Cypress.Commands.add("setupMockPreviousDay", () => {
  const yesterday = {
    id: "day-123",
    state: "inactive",
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockState = {
    global: {
      days: [yesterday],
      activityTemplates: [],
      eventTemplates: [],
      subjectiveVariables: [],
      interruptionCauses: [],
      timeBlocks: [],
      userPreferences: { hiddenSubjectiveVariableIds: [], updatedAt: new Date().toISOString() },
      completedActivityRecords: [
        {
          dayId: yesterday.id,
          id: "record-123",
          activityId: "activity-123",
          templateId: "template-123",
          templateTitle: "Actividad de ejemplo",
          blockId: "block-123",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          estimatedDurationMinutes: 30,
          actualDurationMinutes: 25,
          createdAt: new Date().toISOString(),
        },
      ],
      eventInstances: [],
      subjectiveVariableSnapshots: [],
    },
    currentDay: null,
  };
});

Cypress.Commands.add("visitStartPageWithPreviousDay", () => {
  // Al utilizar directamente el objeto en lugar de la función
  const yesterday = {
    id: "day-123",
    state: "inactive",
    startTime: new Date().toISOString(),
    endTime: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockState = {
    global: {
      days: [yesterday],
      activityTemplates: [],
      eventTemplates: [],
      subjectiveVariables: [],
      interruptionCauses: [],
      timeBlocks: [],
      userPreferences: { hiddenSubjectiveVariableIds: [], updatedAt: new Date().toISOString() },
      completedActivityRecords: [
        {
          dayId: yesterday.id,
          id: "record-123",
          activityId: "activity-123",
          templateId: "template-123",
          templateTitle: "Actividad de ejemplo",
          blockId: "block-123",
          startTime: new Date().toISOString(),
          endTime: new Date().toISOString(),
          estimatedDurationMinutes: 30,
          actualDurationMinutes: 25,
          createdAt: new Date().toISOString(),
        },
      ],
      eventInstances: [],
      subjectiveVariableSnapshots: [],
    },
    currentDay: null,
  };

  cy.visit("/start", {
    onBeforeLoad(win) {
      win.localStorage.setItem("qualia_control_app_state", JSON.stringify(mockState));
    },
  });
  cy.contains("Resumen del día anterior").should("be.visible");
});

// Comandos para Flujo 2: Gestión de actividades
Cypress.Commands.add("openActivityLibrary", () => {
  // Usar el selector aria-label documentado en el archivo de referencia
  cy.get('[aria-label="abrir biblioteca de actividades"]').click();
  // Verificar que el modal se ha abierto correctamente usando el selector de role y texto
  cy.get('[role="dialog"]:contains("Biblioteca de Actividades")').should("be.visible");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando createNewActivity para crear una nueva plantilla de actividad
Cypress.Commands.add(
  "createNewActivity",
  (
    title: string,
    description: string,
    type: ActivityType = "clear-objective",
    durationEstimate: string | string[] = "45"
  ) => {
    // Mapear etiquetas en español a los códigos internos de tipo de actividad
    const typeMapping: Record<string, ActivityType> = {
      "Con objetivo claro": "clear-objective",
      "Duración flexible": "flexible-duration",
      Timeboxing: "timeboxing",
      "clear-objective": "clear-objective",
      "flexible-duration": "flexible-duration",
      timeboxing: "timeboxing",
    };
    const typeCode: ActivityType = typeMapping[type] ?? type;
    cy.dataTestId("new-activity-button").click();
    cy.dataTestId("activity-form-modal")
      .should("be.visible")
      .within(() => {
        // Rellenar título y descripción
        cy.dataTestId("activity-title-input").type(title);
        cy.dataTestId("activity-description-input").type(description);

        // Hacer clic para abrir el desplegable SI NO es el tipo por defecto
        if (typeCode !== "clear-objective") {
          cy.dataTestId("activity-type-select").click();
        }
      }); // Fin del primer within

    // Seleccionar la opción del desplegable (fuera del within, usando data-value)
    if (typeCode !== "clear-objective") {
      cy.get(`li[role='option'][data-value="${typeCode}"]`).click();
    }

    // Volver al contexto del modal para rellenar campos condicionales y guardar
    cy.dataTestId("activity-form-modal").within(() => {
      // Rellenar campos de duración condicionales (esperando visibilidad)
      if (typeCode === "clear-objective") {
        cy.dataTestId("estimated-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate}`);
      } else if (typeCode === "flexible-duration" && Array.isArray(durationEstimate)) {
        cy.dataTestId("min-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate[0]}`);
        cy.dataTestId("max-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate[1]}`);
      } else if (typeCode === "timeboxing") {
        cy.dataTestId("min-duration-input")
          .should("be.visible")
          .type(`{selectall}${durationEstimate}`);
      }

      // Clic en guardar DENTRO del modal
      cy.dataTestId("save-activity-button").click();
    }); // Fin del segundo within
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando editActivity para editar una plantilla de actividad existente
Cypress.Commands.add(
  "editActivity",
  (currentTitle: string, newTitle?: string, newDuration?: string) => {
    // Buscar la actividad y hacer clic en su botón de editar usando aria-label
    cy.contains(currentTitle).parents("div").find('[aria-label="editar"]').click();
    cy.dataTestId("activity-form-modal").should("be.visible");

    cy.dataTestId("activity-form-modal").within(() => {
      if (newTitle) {
        // Usar selectall + backspace para asegurar limpieza
        cy.dataTestId("activity-title-input")
          .click() // Asegurar foco
          .type("{selectall}{backspace}" + newTitle); // Nuevo método
      }

      if (newDuration) {
        // Usar selectall + backspace para asegurar limpieza
        cy.dataTestId("estimated-duration-input")
          .click() // Asegurar foco
          .type("{selectall}{backspace}" + newDuration); // Nuevo método
      }

      cy.dataTestId("save-activity-button").click();
    });

    // La verificación final puede seguir usando contains o mejorar con verifyActivityInLibrary
    if (newTitle) {
      cy.contains(newTitle).should("be.visible");
    } else {
      cy.contains(currentTitle).should("be.visible");
    }
  }
);

// Comandos para Flujo 3: Gestión de tablero Kanban
Cypress.Commands.add("openTimeBlockManager", () => {
  // Usar el selector aria-label según la documentación
  cy.get('[aria-label="gestionar bloques de tiempo"]').click();

  // Esperar a que el modal aparezca usando su data-testid
  cy.dataTestId("time-block-modal").should("be.visible");

  // Verificar que el botón para crear nuevo bloque esté visible
  cy.dataTestId("new-time-block-button").should("be.visible");
});

Cypress.Commands.add("createTimeBlock", (name: string, startTime: string, endTime: string) => {
  // Hacer clic en el botón Nuevo bloque usando data-testid
  cy.dataTestId("new-time-block-button").click();

  // Llenar campos del formulario usando los data-testid
  cy.dataTestId("block-name-input").type(name);
  cy.dataTestId("start-time-input").type(startTime);
  cy.dataTestId("end-time-input").type(endTime);
  // Guardar bloque
  cy.dataTestId("save-block-button").click();

  // Verificar que se creó correctamente buscándolo en la lista
  cy.dataTestId("time-blocks-list").contains(name).should("be.visible");
});

// Comando para cerrar el modal de gestión de bloques de tiempo
Cypress.Commands.add("closeTimeBlockModal", () => {
  // Hacer clic en el botón "Cerrar" usando data-testid
  cy.dataTestId("close-modal-button").click();
  cy.wait(200); // Mantenemos la espera por si acaso
  // Verificar que el modal ya no existe en el DOM
  cy.dataTestId("time-block-modal").should("not.exist"); // Volver a not.exist
});

// Comando para eliminar un bloque de tiempo
Cypress.Commands.add("deleteTimeBlock", (blockName: string) => {
  // Encontrar el bloque por su nombre y hacer clic en eliminar
  cy.contains(blockName)
    .parents('[data-testid^="time-block-"]')
    .find('[data-testid^="delete-block-"]')
    .click();

  // Confirmar la eliminación - usar el modal de confirmación
  cy.dataTestId("delete-confirmation-modal").should("be.visible");

  // Optar por mover actividades (opción más común en tests)
  cy.dataTestId("move-activities-button").click();

  // Verificar que el bloque ya no existe
  cy.contains(blockName).should("not.be.visible");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando instantiateActivityByClick para instanciar una actividad por clic (sin drag and drop)
Cypress.Commands.add("instantiateActivityByClick", (activityTitle: string) => {
  cy.log(`Haciendo clic en plantilla de actividad: "${activityTitle}"`);
  // SOLO hacer clic en la plantilla, sin esperar al modal
  // para evitar duplicidad con instantiateFromLibrary
  cy.contains(activityTitle).closest('[data-testid^="activity-template-"]').click();
  // NO esperar al modal aquí - será manejado por instantiateFromLibrary
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando findKanbanColumnByName para obtener el ID real de una columna Kanban por su nombre
Cypress.Commands.add("findKanbanColumnByName", (columnName: string) => {
  // Usar el data-testid específico para columnas según la referencia
  return cy.dataTestId(`kanban-column-${columnName.toLowerCase().replace(/ /g, "-")}`);
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando verifyActivityInColumn para verificar que una actividad está en una columna específica
Cypress.Commands.add("verifyActivityInColumn", (activityTitle: string, columnName: string) => {
  // Usar el selector data-testid para la columna
  const normalizedColumnName = columnName.toLowerCase().replace(/ /g, "-");
  cy.dataTestId(`kanban-column-${normalizedColumnName}`)
    .contains(activityTitle)
    .should("be.visible");
});

// Comando para interactuar con tarjetas Kanban
Cypress.Commands.add("getKanbanCard", (activityId: string) => {
  // Obtener la tarjeta usando su ID de draggable según la documentación
  return cy.get(`[data-rbd-draggable-id="${activityId}"]`);
});

// Comando para activar una actividad
Cypress.Commands.add("activateActivity", (activityTitle: string) => {
  cy.log(`Activando actividad: ${activityTitle}`);
  // Encontrar el título, luego buscar el ancestro más cercano que también contenga el botón,
  // y finalmente hacer clic en el botón dentro de ese contexto.
  cy.contains(activityTitle)
    // Usamos :has() para encontrar un ancestro que contenga el botón deseado,
    // esto evita depender de la estructura exacta o de [data-rbd-draggable-id]
    .closest(':has([data-testid="activate-button"])')
    .find('[data-testid="activate-button"]')
    .click({ force: true }); // Añadir force: true por si algún elemento overlay interfiere
});

// Comando para completar una actividad
Cypress.Commands.add("completeActivity", (activityTitle: string) => {
  cy.log(`Completando actividad: ${activityTitle}`);
  cy.contains(activityTitle)
    .closest(':has([data-testid="complete-button"])')
    .find('[data-testid="complete-button"]')
    .click({ force: true });
});

// Comando para interrumpir una actividad
Cypress.Commands.add("interruptActivity", (activityTitle: string) => {
  cy.log(`Interrumpiendo actividad: ${activityTitle}`);
  cy.contains(activityTitle)
    .closest(':has([data-testid="interrupt-button"])')
    .find('[data-testid="interrupt-button"]')
    .click({ force: true });
});

// Comando para arrastrar una actividad entre columnas
Cypress.Commands.add("dragActivityToColumn", (activityTitle: string, targetColumnName: string) => {
  // Obtener el elemento draggable que contiene el título de la actividad
  const draggableSource = cy.contains(activityTitle).parents("[data-rbd-draggable-id]");

  // Obtener la columna destino por su data-testid
  const normalizedColumnName = targetColumnName.toLowerCase().replace(/ /g, "-");
  const targetColumn = cy.dataTestId(`kanban-column-${normalizedColumnName}`);

  // Ejecutar el drag and drop usando el comando existente
  draggableSource.then(($source) => {
    targetColumn.then(() => {
      cy.wrap($source).dragAndDropDnd(
        `[data-rbd-draggable-id="${$source.attr("data-rbd-draggable-id")}"]`,
        `[data-testid="kanban-column-${normalizedColumnName}"]`
      );
    });
  });

  // Verificar que la actividad está en la columna correcta
  cy.verifyActivityInColumn(activityTitle, targetColumnName);
});

// Comandos para Timeline
Cypress.Commands.add("getTimelineBar", (activityId: string) => {
  cy.log(`Buscando barra de timeline con ID: ${activityId}`);
  return cy.dataTestId(`timeline-bar-${activityId}`);
});

Cypress.Commands.add("getTimelineInterruption", (interruptionId: string) => {
  return cy.dataTestId(`timeline-interruption-${interruptionId}`);
});

// --- Implementación de Nuevos Comandos ---

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("setupStandardDayWithBlocks", () => {
  cy.visitStartPage();
  cy.startDay();
  cy.openTimeBlockManager();
  cy.createTimeBlock("Mañana", "09:00", "12:00");
  cy.createTimeBlock("Tarde", "14:00", "18:00");
  // Podríamos añadir más bloques si son estándar (Ej: Noche, Por Hacer implícito)
  cy.closeTimeBlockModal();
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("getActivityIdFromTitle", (title: string) => {
  cy.contains(title)
    .closest('[data-testid^="activity-template-"]')
    .invoke("attr", "data-testid")
    .then((testId) => {
      if (!testId) {
        throw new Error(`No se pudo encontrar data-testid para la actividad "${title}"`);
      }
      const id = testId.replace("activity-template-", "");
      if (!id) {
        throw new Error(`El data-testid "${testId}" no contiene un ID válido.`);
      }
      return id;
    });
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add(
  "instantiateActivityByTitle",
  (title: string /*, targetColumnName?: string*/) => {
    // Eliminamos targetColumnName por ahora
    cy.log(`Instanciando actividad: ${title} (desde biblioteca abierta)`);

    // 1. Hacer clic en la plantilla (abre modal de configuración)
    cy.instantiateActivityByClick(title);

    // 2. Esperar, confirmar y esperar desaparición del modal EXPLICITAMENTE aquí
    cy.dataTestId("activity-instance-modal")
      .should("be.visible") // Asegurar que el modal apareció
      .within(() => {
        // Operar dentro del modal
        cy.log("Confirmando modal de instancia explícitamente");
        cy.dataTestId("confirm-button").click();
      });

    // 3. Esperar explícitamente a que el modal desaparezca
    cy.dataTestId("activity-instance-modal").should("not.exist");

    // 4. Añadir la pequeña espera por si acaso
    cy.wait(50);

    cy.log(`Instancia de "${title}" confirmada.`);
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add(
  "verifyActivityStateInKanban",
  (activityTitle: string, state: "active" | "idle") => {
    cy.log(`Verificando estado "${state}" para "${activityTitle}" en Kanban`);
    // Encuentra el contenedor de la tarjeta que contiene el título y alguno de los botones relevantes
    cy.contains(activityTitle)
      .closest(':has([data-testid="activate-button"], [data-testid="complete-button"])')
      .should("exist") // Asegurarse de que encontramos el contenedor
      .within(() => {
        if (state === "active") {
          // Buscar indicadores de actividad: botón completar/interrumpir VISIBLES, no activar
          cy.dataTestId("complete-button").should("be.visible");
          cy.dataTestId("interrupt-button").should("be.visible");
          cy.dataTestId("activate-button").should("not.exist"); // Cambiado a not.exist
          // Podríamos añadir verificación de cronómetro si tiene un selector específico
          // cy.dataTestId('active-timer').should('be.visible');
        } else {
          // 'idle' significa que está instanciada pero no activa: botón activar VISIBLE, otros no existen
          cy.dataTestId("activate-button").should("be.visible");
          cy.dataTestId("complete-button").should("not.exist"); // Cambiado a not.exist
          cy.dataTestId("interrupt-button").should("not.exist"); // Cambiado a not.exist
        }
      });
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("verifyTimelineBarState", (activityId: string, state: string) => {
  cy.log(`Verificando estado "${state}" para barra timeline act-${activityId}`);
  cy.getTimelineBar(activityId).should("have.attr", "data-state", state);
  // Se podrían añadir más aserciones si el estado implica otros estilos (color, etc.)
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add(
  "verifyTimelineBarEstimationState",
  (activityId: string, estimationState: string) => {
    cy.log(
      `Verificando estado de estimación "${estimationState}" para barra timeline act-${activityId}`
    );
    cy.getTimelineBar(activityId).should("have.attr", "data-estimation-state", estimationState);
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("advanceClock", (minutes: number) => {
  cy.log(`Avanzando reloj ${minutes} minutos`);
  cy.tick(minutes * 60 * 1000);
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("clickQuickActivity", (quickActivityTestId: string) => {
  cy.log(`Clic en actividad rápida: ${quickActivityTestId}`);
  cy.dataTestId(`quick-activity-${quickActivityTestId}`).click();
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add(
  "configureActivityInstance",
  (config: {
    duration?: string;
    minDuration?: string;
    maxDuration?: string;
    timeboxingType?: string;
  }) => {
    cy.dataTestId("activity-instance-modal").within(() => {
      cy.log("Configurando instancia de actividad:", config);
      if (config.duration) {
        cy.dataTestId("estimated-duration-input").clear().type(config.duration);
      }
      if (config.minDuration) {
        cy.dataTestId("min-duration-input").clear().type(config.minDuration);
      }
      if (config.maxDuration) {
        cy.dataTestId("max-duration-input").clear().type(config.maxDuration);
      }
      if (config.timeboxingType) {
        // Asumiendo que es un <select>
        cy.dataTestId("timeboxing-type-select").select(config.timeboxingType);
      }
    });
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("assertActivityNotInKanban", (activityId: string) => {
  cy.log(`Asegurando que actividad con ID "${activityId}" no está en el Kanban`);
  // Esperar un poco por si hay animaciones de eliminación o actualizaciones
  cy.wait(500);
  cy.dataTestId(`kanban-card-${activityId}`).should("not.exist");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("closeModalByEscape", (selector: string) => {
  cy.log(`Cerrando modal "${selector}" con Escape`);
  cy.get(selector).should("be.visible").type("{esc}");
  // Verificar que se cerró (eliminado del DOM)
  cy.get(selector).should("not.exist"); // Volver a not.exist
});

// --- Implementación de Nuevos Comandos (Añadidos) ---

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("verifyPreviousDaySummaryVisible", () => {
  cy.log("Verificando visibilidad del resumen del día anterior");
  cy.dataTestId("previous-day-summary")
    .should("be.visible")
    .within(() => {
      cy.dataTestId("completion-rate-value").should("be.visible");
      cy.dataTestId("completed-activities-count").should("be.visible");
      cy.contains("Resumen del día anterior").should("be.visible");
    });
});

// @ts-expect-error: comando personalizado esperado
Cypress.Commands.add("navigateToOverviewAndVerify", () => {
  cy.log("Navegando a vista de Resumen y verificando");
  cy.dataTestId("view-details-button").should("be.visible").click();
  cy.url().should("include", "/overview");
  // En lugar de un modal, la vista de Resumen es una página con un header
  cy.contains("Vista de Resumen - Qualia Control").should("be.visible");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("verifyActivityInLibrary", (title: string) => {
  cy.log(`Verificando actividad "${title}" en la biblioteca`);
  // Asegurarse de que estamos dentro del modal de la biblioteca
  cy.get('[role="dialog"]:contains("Biblioteca de Actividades")').within(() => {
    cy.contains(title).should("be.visible");
  });
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando instantiateFromLibrary para instanciar una actividad desde la biblioteca
Cypress.Commands.add("instantiateFromLibrary", (title: string) => {
  cy.log(`Instanciando "${title}" desde la biblioteca`);

  // 1. Hacer clic en la plantilla (ahora NO espera ni hace clic en confirmar)
  cy.instantiateActivityByClick(title);

  // 2. Esperar a que aparezca el modal
  cy.log(`Esperando modal de configuración para "${title}"`);
  cy.dataTestId("activity-instance-modal").should("be.visible");

  // 3. Confirmar usando .within() para asegurar que el clic sea dentro del modal correcto
  cy.log(`Confirmando actividad "${title}"`);
  cy.dataTestId("activity-instance-modal").within(() => {
    cy.dataTestId("confirm-button").click();
  });

  // 4. Esperar a que desaparezca
  cy.log(`Esperando a que el modal para "${title}" desaparezca`);
  cy.dataTestId("activity-instance-modal").should("not.exist");
  cy.wait(50);

  cy.log(`Instancia de "${title}" confirmada.`);
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("instantiateAndVerifyInTodo", (title: string) => {
  cy.log(`Instanciando "${title}" y verificando en 'Por Hacer'`);

  // 1. Instanciar la actividad (usa el nuevo comando corregido)
  // @ts-expect-error comando personalizado esperado
  cy.instantiateFromLibrary(title);

  // 2. Cerrar el modal de la biblioteca
  // @ts-expect-error comando personalizado esperado
  cy.closeActivityLibraryModal();

  // 3. Verificar en la columna "Por Hacer"
  cy.verifyActivityInColumn(title, "Por Hacer");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando handleSubjectiveModal para manejar el modal subjetivo
Cypress.Commands.add("handleSubjectiveModal", (action: "omit" | "confirm" = "omit") => {
  const subjectiveModalSelector = "[data-testid=variable-modal]";
  cy.log(`Manejando modal subjetivo con acción: ${action}`);
  cy.get(subjectiveModalSelector, { timeout: 10000 }).should("be.visible");
  if (action === "omit") {
    cy.dataTestId("skip-variables-button").click({ force: true });
  } else {
    cy.dataTestId("confirm-variables-button").click({ force: true });
  }
  // Restaurar la espera corta después del clic, antes de la verificación
  cy.wait(1000); // Aumentar la espera a 1000ms
  // Verificar que el MODAL ya no es visible
  cy.get(subjectiveModalSelector).should("not.be.visible");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando closeActivityLibraryModal para cerrar el modal de biblioteca de actividades
Cypress.Commands.add("closeActivityLibraryModal", () => {
  cy.log("Cerrando modal de biblioteca de actividades haciendo clic en Cerrar");
  const modalSelector = '[role="dialog"]:contains("Biblioteca de Actividades")';

  // Asegurarse de que el modal está visible antes de interactuar
  cy.get(modalSelector).should("be.visible");

  // Encontrar el botón "Cerrar" DENTRO del modal y hacer clic
  cy.get(modalSelector).contains("button", "Cerrar").click();

  // Verificar que el modal se cerró (ya no existe en el DOM)
  cy.get(modalSelector).should("not.exist");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add(
  "getInstanceIdFromKanbanCard",
  (activityTitle: string): Cypress.Chainable<string> => {
    cy.log(`Obteniendo ID de instancia para "${activityTitle}" desde tarjeta Kanban`);
    return cy
      .contains(activityTitle)
      .closest('[data-testid^="kanban-card-"]')
      .invoke("attr", "data-testid")
      .then((testId) => {
        if (!testId) {
          throw new Error(
            `No se pudo encontrar data-testid para la tarjeta Kanban "${activityTitle}"`
          );
        }
        const instanceId = testId.replace("kanban-card-", "");
        if (!instanceId) {
          throw new Error(`El data-testid "${testId}" no contiene un ID de instancia válido.`);
        }
        cy.log(`ID de instancia encontrado: ${instanceId}`);
        return cy.wrap(instanceId);
      });
  }
);

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando confirmActivityInstance para confirmar configuración de instancia
Cypress.Commands.add("confirmActivityInstance", () => {
  cy.log("Confirmando configuración de instancia de actividad");
  cy.dataTestId("activity-instance-modal").within(() => {
    cy.dataTestId("confirm-button").click();
  });
  cy.dataTestId("activity-instance-modal").should("not.exist");
  cy.wait(50); // Pequeña espera para asegurar que se procese la acción
});

// NUEVO COMANDO: Configura estado inicial con una variable y comienza el día
// @ts-expect-error: Extender Cypress con comandos personalizados
Cypress.Commands.add("setupStandardDayWithVariable", (variableName: string) => {
  cy.log(`Configurando estado inicial con variable: ${variableName}`);
  const mockState = {
    global: {
      days: [], // Sin días previos
      activityTemplates: [],
      eventTemplates: [],
      subjectiveVariables: [
        {
          id: "test-variable-id", // ID fijo para el test
          name: variableName,
          createdAt: new Date().toISOString(),
        },
      ],
      interruptionCauses: [],
      timeBlocks: [],
      userPreferences: { hiddenSubjectiveVariableIds: [], updatedAt: new Date().toISOString() },
      completedActivityRecords: [],
      eventInstances: [],
      subjectiveVariableSnapshots: [], // Sin snapshots iniciales
    },
    currentDay: null,
  };

  cy.visit("/start", {
    onBeforeLoad(win) {
      win.localStorage.setItem("qualia_control_app_state", JSON.stringify(mockState));
    },
  });
  // Verificar que la página de inicio cargó antes de iniciar el día
  cy.contains("Sistema para gestión consciente del tiempo y actividades", {
    timeout: 10000,
  }).should("be.visible");
  cy.startDay(); // Iniciar el día con el estado configurado
});

// --- Comandos para Flujo 5: Gestión de Eventos ---

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando openEventLibrary para abrir la biblioteca de eventos
Cypress.Commands.add("openEventLibrary", () => {
  cy.log("Abriendo biblioteca de eventos");
  // Usar el selector aria-label según la documentación de referencia
  cy.get('[aria-label="gestionar biblioteca de eventos"]').click();
  // Corregir selector para buscar por role y contenido, manteniendo el timeout
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")', { timeout: 10000 }).should(
    "be.visible"
  );
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando createNewEvent para crear un nuevo evento en la biblioteca
Cypress.Commands.add("createNewEvent", (eventName: string) => {
  cy.log(`Creando nuevo evento: ${eventName}`);
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")').within(() => {
    cy.contains("h6", "Nuevo evento").should("be.visible");
    // Volver a usar el selector de ID, ya que aria-label es inconsistente aquí
    cy.get("#nombre-evento-input").should("be.visible").type(eventName);
    cy.contains("button", "Crear").should("be.visible").click();
  });
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando verifyEventInLibrary para verificar si un evento existe en la biblioteca
Cypress.Commands.add("verifyEventInLibrary", (eventName: string) => {
  cy.log(`Verificando evento "${eventName}" en la biblioteca`);
  cy.get('[role="dialog"]:contains("Biblioteca de Eventos")').within(() => {
    cy.contains("li", eventName).should("be.visible");
  });
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando getEventIdFromName para obtener el ID de un evento desde la biblioteca
Cypress.Commands.add("getEventIdFromName", (eventName: string): Cypress.Chainable<string> => {
  cy.log(`Obteniendo ID para evento: ${eventName}`);
  return cy
    .get('[role="dialog"]:contains("Biblioteca de Eventos")')
    .contains(`[data-testid^="event-template-"]`, eventName)
    .invoke("attr", "data-testid")
    .then((testId) => {
      if (!testId) {
        throw new Error(`No se pudo encontrar data-testid para el evento "${eventName}"`);
      }
      const eventId = testId.replace("event-template-", "");
      if (!eventId) {
        throw new Error(`El data-testid "${testId}" no contiene un ID de evento válido.`);
      }
      cy.log(`ID de evento encontrado: ${eventId}`);
      return cy.wrap(eventId);
    });
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando closeEventLibraryModal para cerrar el modal de la biblioteca de eventos
Cypress.Commands.add("closeEventLibraryModal", () => {
  cy.log("Cerrando modal de biblioteca de eventos");
  const modalSelector = '[role="dialog"]:contains("Biblioteca de Eventos")';
  cy.get(modalSelector).should("be.visible");
  cy.get(modalSelector).contains("button", "Cerrar").click();
  cy.get(modalSelector).should("not.exist");
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando clickQuickEvent para hacer clic en un evento de acceso rápido
Cypress.Commands.add("clickQuickEvent", (eventId: string) => {
  cy.log(`Haciendo clic en evento rápido con ID: ${eventId}`);
  // Asumiendo un data-testid para eventos rápidos
  cy.dataTestId(`quick-event-${eventId}`).click();
});

// @ts-expect-error: Extender Cypress con comandos personalizados
// Comando verifyEventInTimeline para verificar que un evento está en el timeline POR NOMBRE
Cypress.Commands.add("verifyEventInTimeline", (eventName: string) => {
  cy.log(`Verificando evento con nombre "${eventName}" en el timeline`);
  // Buscar un marcador de timeline cuyo aria-label comience con "Evento [nombre] a las"
  // Esto es más robusto que buscar por ID de instancia que no tenemos fácilmente.
  cy.get(`[data-testid^="timeline-event-"][aria-label^="Evento ${eventName} a las"]`).should(
    "be.visible"
  );
});

// Asegúrate de que esto esté al final
export {};
