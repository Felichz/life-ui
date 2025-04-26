# Referencia de Selectores para Pruebas con Cypress

Este documento proporciona una referencia estructurada de todos los selectores disponibles para pruebas end-to-end con Cypress. Los componentes están organizados siguiendo la estructura de carpetas de la aplicación. Documento actualizado con los selectores implementados en la aplicación.

## Índice

- [Componentes](#componentes)
  - [Kanban](#kanban)
  - [Common](#common)
- [Modales](#modales)
  - [TimeBlockModal](#timeblockmodal)
  - [ActivityInstanceModal](#activityinstancemodal)
  - [ActivityLibraryModal](#activitylibrarymodal)
- [Contenedores](#contenedores)
  - [KanbanContainer](#kanbancontainer)
  - [ActivityLibraryContainer](#activitylibrarycontainer)
- [Páginas](#páginas)
  - [DayPage](#daypage)
- [Timeline](#timeline)
- [Comandos Personalizados](#comandos-personalizados)
- [Recomendaciones para Test E2E](#recomendaciones-para-test-e2e)

## Componentes

### Kanban

#### Board.tsx

| Elemento       | Selector                       | Notas           |
| -------------- | ------------------------------ | --------------- |
| Tablero Kanban | `[data-testid="kanban-board"]` | ✅ Implementado |

#### Column.tsx

| Elemento                      | Selector                                                   | Notas                                                    |
| ----------------------------- | ---------------------------------------------------------- | -------------------------------------------------------- |
| Columna Kanban                | `[data-rbd-droppable-id="{blockId}"]`                      | ✅ Usar el ID del bloque de tiempo                       |
| Columna con nombre específico | `[role="list"][aria-label="Columna Mañana"]`               | ✅ Usando `aria-label` con el nombre de la columna       |
| Encontrar columna dinámica    | `cy.contains("Mañana").parents("[data-rbd-droppable-id]")` | ✅ Para obtener el ID real de la columna                 |
| Columna por nombre            | `[data-testid="kanban-column-mañana"]`                     | ✅ Usando data-testid con nombre en minúsculas y guiones |

#### Card.tsx

| Elemento                | Selector                                 | Notas                            |
| ----------------------- | ---------------------------------------- | -------------------------------- |
| Tarjeta de actividad    | `[data-rbd-draggable-id="{activityId}"]` | ✅ Usar el ID de la actividad    |
| Botón Editar en tarjeta | `[aria-label="editar actividad"]`        | ✅ Usando `aria-label` existente |
| Botón Activar           | `[data-testid="activate-button"]`        | ✅ Implementado                  |
| Botón Completar         | `[data-testid="complete-button"]`        | ✅ Implementado                  |
| Botón Interrumpir       | `[data-testid="interrupt-button"]`       | ✅ Implementado                  |

### Common

#### ActionButtons.tsx

| Elemento                     | Selector                                         | Notas           |
| ---------------------------- | ------------------------------------------------ | --------------- |
| Botón Gestionar bloques      | `[aria-label="gestionar bloques de tiempo"]`     | ✅ Implementado |
| Botón Biblioteca actividades | `[aria-label="abrir biblioteca de actividades"]` | ✅ Implementado |
| Botón Actualizar variables   | `[aria-label="actualizar variables subjetivas"]` | ✅ Implementado |
| Botón Gestionar eventos      | `[aria-label="gestionar biblioteca de eventos"]` | ✅ Implementado |
| Botón Ver resumen            | `[aria-label="ver resumen histórico"]`           | ✅ Implementado |

## Modales

### TimeBlockModal

| Elemento                    | Selector                                    | Notas           |
| --------------------------- | ------------------------------------------- | --------------- |
| Modal de bloques            | `[data-testid="time-block-modal"]`          | ✅ Implementado |
| Botón "Nuevo bloque"        | `[data-testid="new-time-block-button"]`     | ✅ Implementado |
| Campo nombre                | `[data-testid="block-name-input"]`          | ✅ Implementado |
| Campo hora inicio           | `[data-testid="start-time-input"]`          | ✅ Implementado |
| Campo hora fin              | `[data-testid="end-time-input"]`            | ✅ Implementado |
| Botón "Guardar/Crear"       | `[data-testid="save-block-button"]`         | ✅ Implementado |
| Botón "Cerrar"              | `[data-testid="close-modal-button"]`        | ✅ Implementado |
| Lista de bloques            | `[data-testid="time-blocks-list"]`          | ✅ Implementado |
| Bloque específico           | `[data-testid="time-block-{id}"]`           | ✅ Implementado |
| Botón editar bloque         | `[data-testid="edit-block-{id}"]`           | ✅ Implementado |
| Botón eliminar bloque       | `[data-testid="delete-block-{id}"]`         | ✅ Implementado |
| Modal confirmación eliminar | `[data-testid="delete-confirmation-modal"]` | ✅ Implementado |
| Botón cancelar eliminación  | `[data-testid="cancel-delete-button"]`      | ✅ Implementado |
| Botón eliminar actividades  | `[data-testid="delete-activities-button"]`  | ✅ Implementado |
| Botón mover actividades     | `[data-testid="move-activities-button"]`    | ✅ Implementado |

### ActivityInstanceModal

| Elemento                 | Selector                                   | Notas           |
| ------------------------ | ------------------------------------------ | --------------- |
| Modal de instancia       | `[data-testid="activity-instance-modal"]`  | ✅ Implementado |
| Campo duración estimada  | `[data-testid="estimated-duration-input"]` | ✅ Implementado |
| Duración mínima          | `[data-testid="min-duration-input"]`       | ✅ Implementado |
| Duración máxima          | `[data-testid="max-duration-input"]`       | ✅ Implementado |
| Selector tipo timeboxing | `[data-testid="timeboxing-type-select"]`   | ✅ Implementado |
| Botón "Confirmar"        | `[data-testid="confirm-button"]`           | ✅ Implementado |
| Botón "Cancelar"         | `[data-testid="cancel-button"]`            | ✅ Implementado |

### ActivityLibraryModal

| Elemento                      | Selector                                      | Notas                                                      |
| ----------------------------- | --------------------------------------------- | ---------------------------------------------------------- |
| Modal biblioteca              | `[data-testid="activity-library-modal"]`      | 🆕 Implementado (`role="dialog"` también podría funcionar) |
| Campo búsqueda                | `input[placeholder="Buscar actividades..."]`  | ✅ Por placeholder                                         |
| Actividad específica          | `[data-testid="activity-template-{id}"]`      | ✅ Implementado con ID dinámico                            |
| Botón Nueva Actividad         | `[data-testid="new-activity-button"]`         | 🆕 Implementado                                            |
| Botón Cerrar                  | `[data-testid="close-library-modal-button"]`  | 🆕 Implementado (si existe un botón cerrar dedicado)       |
| Modal Formulario Creac/Edic   | `[data-testid="activity-form-modal"]`         | 🆕 Implementado                                            |
| Input Título (Form)           | `[data-testid="activity-title-input"]`        | 🆕 Implementado                                            |
| Textarea Descripción (Form)   | `[data-testid="activity-description-input"]`  | 🆕 Implementado                                            |
| Select Tipo Actividad (Form)  | `[data-testid="activity-type-select"]`        | 🆕 Implementado                                            |
| Input Duración Est. (Form)    | `[data-testid="estimated-duration-input"]`    | 🆕 Implementado                                            |
| Input Duración Min (Form)     | `[data-testid="min-duration-input"]`          | 🆕 Implementado                                            |
| Input Duración Max (Form)     | `[data-testid="max-duration-input"]`          | 🆕 Implementado                                            |
| Select Tipo Timeboxing (Form) | `[data-testid="timeboxing-type-select"]`      | 🆕 Implementado                                            |
| Botón Guardar (Form)          | `[data-testid="save-activity-button"]`        | 🆕 Implementado                                            |
| Botón Cancelar (Form)         | `[data-testid="cancel-activity-form-button"]` | 🆕 Implementado                                            |

### OverviewModal (Nuevo)

| Elemento                  | Selector                                       | Notas           |
| ------------------------- | ---------------------------------------------- | --------------- |
| Modal Resumen             | `[data-testid="overview-modal"]`               | 🆕 Implementado |
| Msg Error Timeline        | `[data-testid="timeline-error-message"]`       | 🆕 Implementado |
| Msg No Datos Timeline     | `[data-testid="no-timeline-data-message"]`     | 🆕 Implementado |
| Msg Error Subjetivas      | `[data-testid="subjective-error-message"]`     | 🆕 Implementado |
| Msg No Datos Subjetivas   | `[data-testid="no-subjective-data-message"]`   | 🆕 Implementado |
| Msg Error Distribución    | `[data-testid="distribution-error-message"]`   | 🆕 Implementado |
| Msg No Datos Distribución | `[data-testid="no-distribution-data-message"]` | 🆕 Implementado |
| Msg No Hay Días           | `[data-testid="no-days-data-message"]`         | 🆕 Implementado |

### VariableModal (Nuevo)

| Elemento        | Selector                                   | Notas           |
| --------------- | ------------------------------------------ | --------------- |
| Modal Variables | `[data-testid="variable-modal"]`           | 🆕 Implementado |
| Botón Omitir    | `[data-testid="skip-variables-button"]`    | 🆕 Implementado |
| Botón Confirmar | `[data-testid="confirm-variables-button"]` | 🆕 Implementado |

## Contenedores

### KanbanContainer

| Elemento          | Selector                           | Notas           |
| ----------------- | ---------------------------------- | --------------- |
| Contenedor Kanban | `[data-testid="kanban-container"]` | ✅ Implementado |

### ActivityLibraryContainer

| Elemento                 | Selector                                                | Notas                                              |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------------- |
| Panel lateral biblioteca | `[role="dialog"]:contains("Biblioteca de Actividades")` | ✅ Implementado como modal en vez de panel lateral |

## Páginas

### DayPage

| Elemento             | Selector                              | Notas           |
| -------------------- | ------------------------------------- | --------------- |
| Página principal día | `[data-testid="day-page"]`            | ✅ Implementado |
| QuickBar             | `[data-testid="quick-bar"]`           | ✅ Implementado |
| Actividad rápida     | `[data-testid="quick-activity-{id}"]` | ✅ Implementado |
| Timeline             | `[data-testid="timeline"]`            | ✅ Implementado |

### StartPage (Nuevo)

| Elemento                 | Selector                                     | Notas           |
| ------------------------ | -------------------------------------------- | --------------- |
| Botón Comenzar Día       | `[data-testid="start-day-button"]`           | 🆕 Implementado |
| Mensaje Bienvenida       | `[data-testid="welcome-message"]`            | 🆕 Implementado |
| Resumen Día Anterior     | `[data-testid="previous-day-summary"]`       | 🆕 Implementado |
| Valor Tasa Completación  | `[data-testid="completion-rate-value"]`      | 🆕 Implementado |
| Valor Activ. Completadas | `[data-testid="completed-activities-count"]` | 🆕 Implementado |
| Botón Ver Detalles       | `[data-testid="view-details-button"]`        | 🆕 Implementado |

## Timeline

| Elemento        | Selector                                         | Notas                           |
| --------------- | ------------------------------------------------ | ------------------------------- |
| Timeline        | `[data-testid="timeline"]`                       | ✅ Implementado                 |
| Barra actividad | `[data-testid="timeline-bar-act-{id}"]`          | ✅ Implementado con ID dinámico |
| Evento          | `[data-testid="timeline-event-evt-{id}"]`        | ✅ Implementado con ID dinámico |
| Interrupción    | `[data-testid="timeline-interruption-int-{id}"]` | ✅ Implementado con ID dinámico |

## Comandos Personalizados

Cypress incluye comandos personalizados que facilitan las pruebas:

```javascript
// Encuentra elementos por data-testid (implementado)
cy.findByTestId("kanban-column-mañana");
```

## Recomendaciones para Test E2E

### Mejores Prácticas para Selectores

1. **Preferir atributos data-testid**:

   - Son más estables ante cambios visuales o de estructura
   - Agregar donde falten para facilitar testing

2. **Evitar selectores frágiles**:

   - No confiar en índices (`.first()`, `:first-of-type`)
   - No depender de clases CSS que pueden cambiar

3. **Para modales anidados**:

   - Utilizar patrones como `:within()` o `.parent().find()`
   - Evitar dependencias en el orden de aparición

4. **Para elementos dinámicos**:
   - Usar `data-testid` con formato consistente
   - Verificar que el elemento exista antes de interactuar
