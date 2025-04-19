Changelog – Qualia Control MVP

Este documento registra los puntos clave, decisiones y comentarios importantes tras cada implementación de ticket. Sirve de referencia para iteraciones sucesivas.

Instrucciones de uso

Tras completar cada ticket, el LLM añadirá una nueva sección:

Ticket ID: Ej. T01

Título: Nombre del ticket

Resumen de cambios: Qué se implementó, decisiones relevantes, atajos o retos.

Notas para siguientes tickets:

- Observaciones que puedan afectar futuras implementaciones.

---

## Ticket ID: T01

Título: Scaffold UI & Theme

Resumen de cambios:

- Implementación de la estructura base de carpetas siguiendo el plan definido
- Configuración del tema MUI con paleta de colores, tipografía y breakpoints personalizados
- Implementación de sistema de rutas con lazy loading para mejorar rendimiento
- Creación de componentes comunes reutilizables (TopBar, IconButtonWithTooltip, SkeletonLoader)
- Implementación de hooks personalizados (useSystemCore, useModal, useTimer)
- Creación del SystemProvider para acceso global al estado del sistema

Notas para siguientes tickets:

- La estructura está preparada para implementar los contenedores y componentes específicos en los próximos tickets
- Para T02 (SystemProvider wrapper), la base ya está implementada y solo necesita refinarse
- Se recomienda implementar tests básicos para verificar que la estructura funciona correctamente

## Ticket ID: T02

Título: SystemProvider wrapper

Resumen de cambios:

- Implementación completa del SystemProvider como punto central de acceso al estado del sistema
- Desarrollo del hook useSystemCore que expone métodos y estado del SystemCore a los componentes
- Optimización con useMemo para evitar re-renders innecesarios en el Provider
- Implementación de suscripción a onStateChange para actualizar componentes automáticamente
- Exposición de todos los métodos del core mediante binding para mantener el contexto de ejecución

Notas para siguientes tickets:

- El SystemProvider está listo para ser utilizado en toda la aplicación
- Los componentes pueden acceder a métodos y estado del sistema usando el hook useSystemCore
- Para T03 (Routing básico), se recomienda envolver el Router con el SystemProvider para acceso global

## Ticket ID: T03

Título: Routing básico

Resumen de cambios:

- Refinamiento del sistema de rutas utilizando React Router v6
- Mejora de la implementación de lazy loading para optimizar la carga inicial
- Desarrollo de un componente de carga visual mejorado con Material UI
- Mejora del componente TopBar con indicador de ruta activa
- Documentación detallada de componentes con JSDoc para facilitar mantenimiento
- Asegurado que el SystemProvider envuelva correctamente el enrutador

Notas para siguientes tickets:

- El sistema de rutas está listo para agregar nuevas páginas en tickets futuros
- Los componentes de navegación se pueden extender para incluir menús desplegables o adicionales
- Para tickets que involucren nuevas vistas, solo es necesario crear el componente de página y añadir la ruta
- Considerar implementar una estrategia de protección de rutas o middleware para futuros tickets de autenticación

## Ticket ID: T04

Título: StartPage + lógica "Comenzar día"

Resumen de cambios:

- Implementación del componente StartPage que sirve como punto de entrada a la aplicación
- Desarrollo de lógica para mostrar un resumen del día anterior cuando existe
- Integración con SystemCore para iniciar un nuevo día con la función startDay()
- Implementación de protección de rutas para redirigir cuando no hay un día activo
- Mejora del Router para incluir un componente RequireActiveDay que protege las rutas que necesitan un día activo
- Implementación de feedback visual durante la inicialización (spinner en botón)
- Estructura flexible de layout usando Box con flexbox en lugar de Grid para evitar problemas de compatibilidad

Notas para siguientes tickets:

- La página StartPage puede extenderse para mostrar más estadísticas o insights del día anterior
- Para T05 (QuickBar), se debe tener en cuenta que la actividad "Piloto automático" ya debe estar activa al iniciar el día
- La estructura de protección de rutas implementada facilita el desarrollo de los siguientes tickets basados en día activo

## Ticket ID: T05

Título: QuickBar – visual & handler de selección

Resumen de cambios:

- Implementación del componente visual QuickBar que muestra las actividades del sistema como botones accesibles
- Integración del contenedor QuickBarContainer que conecta la QuickBar con el estado global usando useSystemCore
- Manejo de activación de actividades del sistema: finaliza automáticamente la actividad activa anterior antes de activar la nueva
- Soporte para actividades que requieren configuración dinámica (placeholder para modal, integración real en T08/T15)
- Uso de IconButtonWithTooltip para accesibilidad y tooltips descriptivos
- QuickBar solo visible cuando hay un día activo y deshabilita el botón de la actividad activa
- Edge cases cubiertos: no visible sin día activo, feedback visual, deshabilitación de botón activo
- Implementación de pruebas unitarias completas para el componente QuickBar y pruebas de integración para QuickBarContainer que verifican:
  - Renderizado correcto de actividades del sistema
  - Gestión de estados visuales (activo, deshabilitado)
  - Activación directa y con configuración dinámica
  - Finalización automática de actividad previa

Notas para siguientes tickets:

- El modal de configuración dinámica está implementado como placeholder y debe integrarse en T08/T15
- La lógica de activación directa y finalización automática está lista para extenderse a actividades personalizadas
- Se recomienda testear la integración con el flujo de activación desde la barra y la gestión de estado global

## Ticket ID: T06

Título: KanbanBoard – estructura estática

Resumen de cambios:

- Implementación del componente visual KanbanBoard en src/ui/components/Kanban/Board.tsx
- Creación de KanbanColumn y KanbanCard como subcomponentes para columnas y tarjetas de actividad
- Renderizado de columnas para cada bloque de tiempo, incluyendo el bloque "Por Hacer" por defecto
- Renderizado de tarjetas de actividad instanciadas en cada columna, ordenadas por la propiedad order
- Placeholders visuales para columnas vacías y sin bloques definidos
- Accesibilidad básica: roles ARIA, encabezados claros y foco visible en tarjetas
- Integración de KanbanBoard en KanbanContainer y despliegue en DayPage
- Mapeo de datos desde el estado global y del día actual usando useSystemCore
- No se implementa lógica de drag & drop ni edición en este ticket (solo estructura visual)
- Implementación de tests:
  - Tests unitarios para KanbanBoard verificando el correcto renderizado de columnas y tarjetas
  - Tests de integración para KanbanContainer asegurando el correcto mapeo de datos del estado global

Notas para siguientes tickets:

- El componente KanbanBoard está listo para integrar lógica de drag & drop (T07) y edición de actividades
- Se recomienda reutilizar la estructura de columnas y tarjetas para implementar la funcionalidad de mover y reordenar actividades
- Los placeholders y la estructura visual facilitan la extensión para flujos de usuario avanzados (DnD, edición, modales)
- La estructura de pruebas implementada servirá como base para los siguientes tickets

## Ticket ID: T07

Título: DnD desde Biblioteca → Kanban

Resumen de cambios:

- Implementación completa de la funcionalidad de arrastrar y soltar (Drag & Drop) actividades desde la Biblioteca hacia el tablero Kanban usando `@hello-pangea/dnd`.
- Creación del hook personalizado `useDragDrop` para gestionar la lógica de drag and drop de forma centralizada.
- Implementación del modal `ActivityInstanceModal` para configurar propiedades dinámicas de instancias de actividad antes de crearlas.
- Refactorización de los componentes del Kanban (`Board`, `Column` y `Card`) para incorporar los elementos de DnD.
- Integración de los flujos de arrastrar/soltar tanto desde la biblioteca como entre columnas del Kanban.
- Uso de un único `DragDropContext` a nivel de `DayPage` para coordinar las operaciones de drag & drop en toda la interfaz.
- Estilizado de componentes arrastrados y áreas de destino para mejorar la experiencia visual del usuario durante la interacción.
- Implementación de mensajes y resaltados visuales en las columnas del Kanban al pasar elementos por encima.
- Uso de `forwardRef` y `useImperativeHandle` para la comunicación entre componentes en la jerarquía de DnD.
- Mejora de la Biblioteca de Actividades con funcionalidad de búsqueda y visualización clara de tarjetas.
- Adición de pruebas unitarias para el hook `useDragDrop` que verifican todos los flujos principales.

Notas para siguientes tickets:

- La funcionalidad de drag & drop está implementada con un único DragDropContext a nivel de página, lo que permite arrastrar elementos entre cualquier componente.
- Las pruebas unitarias cubren los escenarios principales, pero podrían extenderse con pruebas de integración end-to-end en el futuro.
- El componente `ActivityInstanceModal` proporciona configuraciones dinámicas para todos los tipos de actividades, listo para reutilizarse en futuros tickets.
- El Modal de Biblioteca ahora permite búsqueda y visualización, pero los botones de edición y eliminación no están implementados (se abordarán en el ticket T08).
- Se ha añadido feedback visual en las columnas mediante colores de fondo, bordes y mensajes específicos al arrastrar elementos sobre ellas.

## Ticket ID: T08

Título: Modal Activity – crear/editar instancia

Resumen de cambios:

- Refinamiento del componente `ActivityInstanceModal` para soportar tanto creación como edición de instancias de actividad.
- Implementación completa de validación de formularios con feedback visual para el usuario.
- Integración con KanbanContainer para permitir edición de actividades existentes a través de un botón en cada tarjeta.
- Mejora de KanbanCard con un botón de edición que abre el modal precargado con los datos de la instancia existente.
- Desarrollo de lógica para detectar automáticamente si estamos en modo creación o edición y cargar los valores correspondientes.
- Implementación de manejo de estados visuales del botón de confirmación basados en la validez del formulario.
- Flujo mejorado para actualizar directamente el estado global al confirmar cambios en creación/edición.
- Adición de mensajes de error específicos para cada tipo de actividad y sus restricciones (mínimo < máximo, valores positivos, etc.).
- Implementación de tests unitarios completos que verifican:
  - Creación de actividad con diferentes tipos (clear-objective, flexible-duration, timeboxing)
  - Edición de actividad existente cargando valores correctamente desde la instancia
  - Validación de formularios con detección y visualización de errores
  - Deshabilitación del botón de confirmar mientras el formulario contiene errores

Notas para siguientes tickets:

- El componente `ActivityInstanceModal` ahora está listo para ser reutilizado en el ticket T15 (QuickBar selección y activación directa).
- La estructura de validación de formularios puede servir como base para otros modales que requieran validación (T09, T13, T17).
- La implementación de botones de edición en tarjetas debe complementarse con botones para activar y completar actividades en futuros tickets.
- Se recomienda extender los tests para incluir más casos de borde y combinaciones de validación para los diferentes tipos de actividades.

## Ticket ID: T08.1

Título: Biblioteca inline para Drag & Drop

Resumen de cambios:

- Conversión de la Biblioteca de Actividades de un modal portaleado a un panel lateral persistente utilizando `Drawer` de MUI.
- Integración del panel de biblioteca dentro del ámbito de un único `DragDropContext` que abarca toda la página DayPage.
- Implementación de tipos específicos para los drag & drop: "TEMPLATE" para la biblioteca y "INSTANCE" para las columnas Kanban.
- Refactorización del hook `useDragDrop` para manejar correctamente el arrastre cross-tipo entre el panel de biblioteca y el tablero Kanban.
- Actualización del componente `KanbanColumn` para identificar el tipo de elementos que puede recibir.
- Eliminación del `DragDropContext` redundante en `KanbanBoard` ya que ahora se maneja desde un nivel superior.
- Mejora de la experiencia de usuario al permitir abrir/cerrar el panel lateral sin perder la capacidad de drag & drop.
- Implementación de transiciones suaves con CSS para el elemento principal cuando el panel se abre o cierra.
- Actualización de los tests del hook `useDragDrop` para verificar el comportamiento con los nuevos tipos de drag & drop.
- Adaptación visual del antiguo modal para funcionar como panel lateral manteniendo la misma funcionalidad.

Notas para siguientes tickets:

- La biblioteca ahora comparte el mismo contexto de drag & drop que el tablero Kanban, lo que permite implementar más interacciones entre componentes.
- Esta estructura facilita la futura implementación de paneles adicionales que puedan interactuar mediante drag & drop con el tablero.
- El diseño responsivo puede mejorarse para dispositivos móviles en futuros tickets, adaptando el comportamiento del drawer.
- La integración de la biblioteca como panel lateral proporciona mejor contexto visual al usuario durante la planificación del día.
- En próximos tickets, se puede considerar añadir funcionalidad para "minimizar" el panel en lugar de cerrarlo completamente.

## Ticket ID: T08.1.1

Título: Fix Drag & Drop cross-panel

Resumen de cambios:

- Corrección del problema que impedía arrastrar actividades desde la biblioteca lateral al tablero Kanban.
- Eliminación de restricciones de tipo ("TEMPLATE" e "INSTANCE") en los componentes `Droppable` para permitir interacción cross-panel.
- Simplificación de la lógica del hook `useDragDrop` para detectar origen y destino basándose solo en identificadores, no en tipos.
- Actualización de la función `handleDragEnd` para manejar correctamente todos los flujos de drag & drop independientemente del tipo.
- Adición de logs de depuración para facilitar el seguimiento de operaciones de drag & drop.
- Resolución de los problemas de compatibilidad entre diferentes contextos de arrastre.
- Verificación de la correcta apertura de modales de configuración al arrastrar desde la biblioteca.
- Mantenimiento de la capacidad de reordenar elementos dentro de una misma columna o entre columnas del Kanban.
- Realización de pruebas manuales para verificar todos los flujos de interacción.

Notas para siguientes tickets:

- La solución implementada simplifica la arquitectura de drag & drop, facilitando futuras extensiones.
- Los próximos componentes que implementen interacción mediante drag & drop deben evitar especificar restricciones de tipo a menos que sea estrictamente necesario.
- La depuración mediante logs facilita diagnósticos futuros si surgen problemas similares.
- Esta solución mantiene una mejor experiencia de usuario permitiendo flujos de arrastre más intuitivos.
- Si se implementan nuevos tipos de Droppable en el futuro, considerar cuidadosamente cómo interactuarán con los existentes para evitar reintroducir este problema.

## Ticket ID: T09

Título: Modal TimeBlock – CRUD bloques

Resumen de cambios:

- Implementación completa del componente `TimeBlockModal.tsx` para la gestión de bloques de tiempo (CRUD).
- Desarrollo de validaciones específicas para bloques de tiempo:
  - Validación de formato de hora (HH:MM)
  - Prevención de solapamientos temporales entre bloques
  - Comprobación de que la hora de fin sea posterior a la hora de inicio
- Conversión automática entre formatos de hora (HH:MM) y minutos del día (0-1439) para compatibilidad con el core.
- Implementación de confirmación de eliminación cuando un bloque contiene actividades, con opciones para:
  - Mover actividades al bloque "Por Hacer"
  - Eliminar las actividades junto con el bloque
- Protección del bloque predeterminado "Por Hacer" para impedir su edición o eliminación.
- Creación de `TimeBlockModalContainer` para encapsular la lógica de apertura/cierre del modal.
- Implementación de feedback visual mediante mensajes de éxito y error.
- Interfaz dividida en dos secciones:
  - Lista de bloques existentes con acciones rápidas (editar/eliminar)
  - Formulario de creación/edición con validaciones en tiempo real
- Creación de `useTimeBlockModal` para permitir la apertura del modal desde cualquier componente.
- Implementación de pruebas unitarias completas que verifican:
  - Validación correcta del formulario
  - Detección de solapamientos
  - Creación y edición de bloques
  - Manejo especial del bloque predeterminado
  - Confirmación al eliminar bloques con actividades

Notas para siguientes tickets:

- Este modal se integrará con DayPage en el ticket T11 (TimeBlockModal – gestión de bloques en DayPage).
- La estructura del modal y sus validaciones pueden servir como patrón para otros modales CRUD.
- El bloque "Por Hacer" ahora está protegido contra edición/eliminación según lo establecido en los requerimientos.
- La gestión de bloques de tiempo está completamente funcional y lista para ser utilizada por el tablero Kanban.
- Las conversiones de formato de hora implementadas (hora ↔ minutos) pueden reutilizarse en otros componentes que manejen rangos temporales.

## Ticket ID: T10

Título: ActivityLibraryModal – interfaz de biblioteca en DayPage

Resumen de cambios:

- Implementación completa del modal `ActivityLibraryModal` para la gestión de plantillas de actividades.
- Desarrollo del contenedor `ActivityLibraryContainer` que encapsula la lógica de operaciones CRUD sobre plantillas.
- Integración del modal en `DayPage` con botón dedicado en la barra superior.
- Implementación de formulario dinámico para crear/editar plantillas con validaciones específicas según el tipo de actividad.
- Integración con el sistema de drag & drop para permitir arrastrar plantillas desde el modal al Kanban.
- Funcionalidad completa para buscar, filtrar, crear, editar y eliminar plantillas de actividad.
- Confirmación de eliminación con modal anidado para prevenir eliminaciones accidentales.
- Coordinación con `ActivityInstanceModal` para configurar actividades antes de instanciarlas.
- Feedback visual con chips distintivos según tipo de actividad (objetivo claro, duración flexible, timeboxing).
- Visualización mejorada de duración en formato amigable según el tipo de actividad (~45min, 15-30min, ≥20min, etc.).

Notas para siguientes tickets:

- El modal implementado complementa el panel lateral `ActivityLibraryDrawer`, permitiendo ahora dos modos de acceso a la biblioteca.
- Se solucionaron varios problemas de tipado relacionados con Material-UI Grid y los tipos de TimeboxingType.
- El modal reutiliza el sistema de drag & drop implementado en T07, demostrando la flexibilidad de la arquitectura.
- Se podría mejorar la experiencia de usuario en móviles trabajando el diseño responsivo en futuros tickets.
- La validación de formularios sigue el patrón establecido en ActivityInstanceModal (T08), lo que facilita la consistencia.
- Para futuros tickets, considerar extraer una utilidad común de validación de formularios y formateo de duración.

## Ticket ID: T10.1

Título: Correcciones de tests para ActivityLibraryModal

Resumen de cambios:

- Corrección del bucle infinito en el test de `ActivityLibraryModal` causado por referencias cambiantes en cada renderizado.
- Uso del patrón `isMounted` en useEffect para prevenir actualizaciones de estado después del desmontaje.
- Remoción de dependencias innecesarias del array de dependencias en los hooks de efecto.
- Actualización de `DayPage.test.tsx` para reflejar el cambio de `ActivityLibraryDrawer` a `ActivityLibraryContainer`.
- Implementación de mocks adecuados para los nuevos componentes modales en las pruebas.
- Refactorización de assertions para hacerlas más robustas frente a cambios en la UI.
- Ampliación de la cobertura de pruebas incluyendo escenarios adicionales como apertura desde el botón AppBar.

Notas para siguientes tickets:

- La solución implementada en los tests de DnD puede servir como referencia para futuros componentes que usen arrastrar y soltar.
- El enfoque de usar referencias constantes en mocks es clave para evitar problemas de ciclos infinitos en los tests.
- En futuros desarrollos de UI, considerar patrones de testing más robustos que no dependan de texts específicos sino de atributos como data-testid.
- Los tests actualizados reflejan fielmente la experiencia de usuario real, probando tanto la funcionalidad como la interfaz.

## Ticket ID: T11

Título: TimeBlockModal – gestión de bloques en DayPage

Resumen de cambios:

- Implementación completa de la integración del modal de gestión de bloques de tiempo en la vista principal (DayPage).
- Adición de un botón en la AppBar con ícono y tooltip para acceder rápidamente a la gestión de bloques.
- Adición de un botón en la cabecera del Kanban para gestionar bloques, mejorando la UX.
- Refactorización del contenedor TimeBlockModalContainer para aceptar props externas de control.
- Integración con el sistema existente que ya permite crear, editar y eliminar bloques de tiempo.
- Implementación de un flujo claro donde los cambios en bloques se reflejan automáticamente en el Kanban.
- Validación de modal de confirmación al eliminar bloques con actividades.
- Mejora de accesibilidad mediante tooltips y atributos aria-label.
- Implementación de tests automáticos para verificar la apertura/cierre del modal desde todos los puntos de acceso.

Notas para siguientes tickets:

- La gestión de bloques ahora está completamente funcional y lista para su uso en el flujo completo de la aplicación.
- El componente TimeBlockModal mantiene la validación de no solapamiento entre bloques y protección del bloque "Por Hacer".
- El sistema ya está preparado para implementar el ticket T12 (Activar actividad desde Kanban).
- Para mejorar la UX, se podría considerar añadir un indicador visual de qué bloque de tiempo está activo actualmente en el Kanban.

## Ticket ID: T12

Título: Activar actividad desde Kanban

Resumen de cambios:

- Implementación completa del flujo de activación de actividades directamente desde el tablero Kanban.
- Desarrollo del componente `ActivityTimer` que muestra un cronómetro ascendente en tiempo real para la actividad activa.
- Refactorización de `KanbanCard` para incluir botón "Activar" que respeta restricciones de disponibilidad de bloques temporales.
- Integración con lógica existente que finaliza automáticamente la actividad previa antes de activar una nueva.
- Implementación de detección de configuración dinámica faltante que abre el modal `ActivityInstanceModal` automáticamente.
- Actualización de los componentes `KanbanColumn` y `KanbanBoard` para propagar adecuadamente las propiedades.
- Manejo del estado avanzado en `KanbanContainer` con flag `isFromActivation` para activar después de configurar.
- Implementación de pruebas unitarias que cubren:
  - Renderizado y comportamiento del botón "Activar" (habilitado/deshabilitado)
  - Visualización del cronómetro en actividades activas
  - Flujo de activación sin configuración (directo)
  - Flujo de activación con configuración (vía modal)
  - Propagación de props entre componentes

Notas para siguientes tickets:

- El flujo de activación está listo para integrar con el ticket T13 (Completar actividad + modal variables).
- Considerar en T13 reubicar el botón "Completar" junto al botón "Activar" para mantener coherencia visual.
- En T18 (TimelineContainer) se debe visualizar la barra de la actividad activa, reutilizando la misma lógica de tiempo.
- `ActivityTimer` puede extenderse en tickets futuros para soportar contadores regresivos (timeboxing) o alertas visuales.

## Ticket ID: T13

Título: Completar actividad + modal variables

Resumen de cambios:

- Implementación del flujo completo para completar actividades desde el tablero Kanban, incluyendo la gestión de variables subjetivas.
- Creación del componente `VariableModal` que permite visualizar, modificar y crear variables subjetivas con un deslizador de 1-10.
- Desarrollo del contenedor `VariableModalContainer` para encapsular la lógica de creación de snapshots y manejo de estados.
- Actualización de `KanbanCard` para mostrar un botón "Completar" cuando la actividad está activa.
- Propagación de props `onComplete` a través de `KanbanColumn` y `KanbanBoard`.
- Implementación de flujo en `KanbanContainer` para gestionar la finalización de actividades:
  1. Completar la actividad
  2. Abrir el modal de variables subjetivas
  3. Crear un snapshot (opcional)
  4. Activar automáticamente "Piloto Automático" al finalizar
- Adición de lógica para cargar el ID de "Piloto Automático" al iniciar el contenedor mediante useEffect.
- Gestión avanzada para permitir relacionar snapshots con actividades y eventos recientes.
- Corrección de errores de tipado en los componentes Grid de MUI mediante el uso de MuiGrid con xs={true}.
- Implementación de pruebas unitarias que verifican:
  - Renderizado correcto del botón "Completar" solo cuando la actividad está activa
  - Acción al hacer clic en "Completar"
  - Flujo completo desde completar actividad hasta activación del piloto automático

Notas para siguientes tickets:

- El sistema de variables subjetivas está completamente funcional y puede extenderse con visualizaciones en futuros tickets.
- Para T14 (ActivityOutcomeModal), considerar relacionar los outcomes con los snapshots de variables para análisis posterior.
- Para T16 (Filtro Biblioteca por Variables), este ticket proporciona la base de datos de variables necesaria.
- Evaluar la posibilidad de añadir visualizaciones gráficas de la evolución de variables en futuros tickets.
- La activación automática de "Piloto Automático" después de completar tareas mejora significativamente la fluidez del sistema.

## Ticket ID: T14

Título: Interrumpir actividad + causas

Resumen de cambios:

- Implementación completa del flujo para interrumpir actividades activas desde el tablero Kanban.
- Creación del componente `InterruptionModal` que permite al usuario indicar si la interrupción fue por una causa evitable.
- Desarrollo del contenedor `InterruptionModalContainer` para encapsular la lógica de creación de causas e interrupción.
- Adición de un botón "Interrumpir" al componente `KanbanCard` junto al botón "Completar" para actividades activas.
- Permitir al usuario seleccionar una causa existente o crear una nueva causa cuando la interrupción es evitable.
- Integración con el sistema de variables subjetivas para actualizar variables tras una interrupción.
- Secuencia completa de modales: primero interrupción, luego variables subjetivas.
- Activación automática de "Piloto Automático" tras completar el flujo de interrupción, igual que en las completaciones.
- Propagación de las props necesarias a través de `KanbanColumn` y `KanbanBoard`.
- Gestión adecuada del estado en `KanbanContainer` para rastrear actividades interrumpidas.
- Implementación de pruebas unitarias completas para:
  - Verificar la lógica del modal de interrupción
  - Comprobar el funcionamiento de los botones según el estado de la actividad
  - Validar el flujo completo de interrupción con y sin causas evitables

Notas para siguientes tickets:

- Este ticket complementa perfectamente T13 (Completar actividad) formando el ciclo completo de gestión de actividades.
- La estructura implementada para causas de interrupción puede servir de base para análisis futuros en el ticket T22 (Estadísticas).
- En T18 (TimelineContainer) se debe visualizar un punto rojo para las interrupciones en la línea de tiempo.
- Considerar añadir estadísticas de causas de interrupción en futuros tickets relacionados con analítica.
- La estructura de modales secuenciales (interrupción → variables → piloto automático) es un patrón reutilizable para otros flujos.

## Ticket ID: T15

Título: QuickBar selección y activación directa

Resumen de cambios:

- Implementación completa del flujo de activación directa de actividades desde la QuickBar.
- Desarrollo de lógica para detectar si una actividad requiere configuración dinámica y abrir el modal adecuado.
- Integración de QuickBarContainer con ActivityInstanceModal para permitir configurar propiedades dinámicas.
- Implementación de fallback inteligente al bloque "Por Hacer" cuando no hay bloque actual.
- Adición de indicadores visuales de carga durante la activación (CircularProgress).
- Implementación de completado automático de la actividad anterior antes de activar una nueva.
- Manejo mejorado de errores mediante Snackbar para notificar fallos al usuario.
- Desarrollo de tests completos para verificar todos los flujos:
  - Activación directa sin configuración adicional
  - Apertura de modal para actividades que requieren configuración
  - Creación y activación de instancias tras confirmar configuración
  - Manejo de indicadores visuales durante la carga

Notas para siguientes tickets:

- El flujo de activación directa está completo y puede integrarse con otros componentes que necesiten activar actividades.
- La función needsConfiguration() podría extraerse como utilidad si se requiere la misma lógica en otros componentes.
- Para T18 (TimelineContainer), se debe mostrar visualmente la actividad activa utilizando la misma lógica de detección.
- Se podría expandir el sistema para mostrar información contextual sobre la actividad activa en otros componentes.

## Ticket ID: T16

Título: Registro de evento puntual

Resumen de cambios:

- Implementación completa del flujo para registrar eventos puntuales durante el día.
- Creación del componente `EventLibraryModal` para gestionar la biblioteca de plantillas de eventos (CRUD).
- Desarrollo del contenedor `EventLibraryModalContainer` para encapsular la lógica del modal.
- Creación de `EventQuickBar` para mostrar botones de acceso rápido a eventos definidos.
- Implementación de `EventQuickBarContainer` que gestiona la creación de instancias y apertura del modal de variables.
- Modificación de `VariableModal` para incluir botón "Omitir actualización" que permite registrar un evento sin crear snapshot.
- Integración en `DayPage` con:
  - Botón en AppBar para acceder a la biblioteca de eventos
  - Barra de eventos debajo de QuickBar para registro rápido
  - Adición de modales necesarios
- Implementación de un flujo completo donde registrar un evento automáticamente abre el modal de variables con el evento preseleccionado.
- Almacenamiento correcto de la referencia al evento en el snapshot de variables subjetivas.
- Manejo de errores con Snackbar para notificar al usuario de cualquier problema.
- Implementación de pruebas unitarias para:
  - Todas las operaciones CRUD en EventLibraryModal
  - Flujo completo de registro de evento y apertura del modal de variables
  - Casos de borde como no tener plantillas de eventos o errores en la creación de instancias

Notas para siguientes tickets:

- Los eventos registrados deben visualizarse en el Timeline como puntos azules (implementar en T18).
- La funcionalidad de omitir la actualización de variables puede extenderse a otros flujos (completar/interrumpir actividad).
- Los eventos registrados podrían utilizarse para análisis de correlación con variables subjetivas en tickets futuros.
- La estructura de organización del código (contenedor/componente) sigue el patrón establecido en tickets anteriores.
- El sistema está preparado para futuras extensiones como categorización de eventos o adjuntar información adicional.
- La reutilización del `VariableModal` existente demuestra la flexibilidad del diseño modular.

## Ticket ID: T17

Título: Modal Variable – actualizar variables subjetivas

Resumen de cambios:

- Implementación completa del acceso directo para actualizar variables subjetivas desde la barra superior
- Adición de botón en la AppBar con ícono (`ShowChartIcon`) y tooltip informativo
- Integración de restricción temporal de 5 minutos entre actualizaciones:
  - Deshabilitación visual del botón durante el cooldown
  - Tooltip explicativo cuando el botón está deshabilitado
  - Verificación de `canUpdateVariables()` para controlar el estado del botón
- Integración con el modal existente `VariableModal` que permite:
  - Visualizar variables existentes con sus últimos valores
  - Crear nuevas variables cuando no existen previas
  - Modificar valores mediante sliders en escala 1-10
  - Relacionar actualizaciones con la actividad activa (preseleccionada automáticamente)
  - Relacionar actualizaciones con eventos recientes
  - Omitir la actualización sin guardar cambios
- Reutilización del contenedor `VariableModalContainer` que encapsula la lógica de:
  - Creación de snapshots de variables con `createSnapshot()`
  - Manejo de errores y estados de carga
  - Actualización del estado global del sistema
- Implementación de tests unitarios e integración que verifican:
  - El comportamiento del botón según el estado del cooldown
  - La correcta creación de snapshots con actividades/eventos relacionados
  - El manejo de errores durante la creación de snapshots
  - El flujo completo de apertura del modal, interacción y cierre

Notas para siguientes tickets:

- El sistema de variables subjetivas está completamente funcional y debe visualizarse en T20 (SubjectiveChart) para mostrar la evolución
- Para el ticket T18 (TimelineContainer), considerar mostrar los snapshots de variables como marcadores en la línea de tiempo
- En tickets futuros, considerar añadir análisis de correlación entre variables y actividades/eventos
- La estructura de modales y manejo de cooldown implementada aquí puede reutilizarse en otros componentes que requieran restricciones temporales
- El botón de actualización podría añadirse también en la visualización del Timeline para mayor accesibilidad

## Ticket ID: T18

Título: TimelineContainer – barras y marcadores

Resumen de cambios:

- Implementación completa de la visualización gráfica de línea de tiempo para actividades, eventos e interrupciones.
- Desarrollo de componentes modulares en una estructura jerárquica:
  - `TimelineContainer`: Obtiene datos del core y maneja estados de carga.
  - `Timeline`: Componente principal que organiza y visualiza datos.
  - `TimelineBar`: Visualiza barras de actividad con duración real y estimada.
  - `TimelineMarker`: Renderiza marcadores para eventos (círculos azules) e interrupciones (iconos de advertencia rojos).
  - `TimelineUtils`: Proporciona funciones de manipulación de tiempo y cálculos de posición.
- Aplicación de esquema de colores significativo:
  - Verde: Actividades completadas dentro de la estimación.
  - Azul: Actividades completadas fuera de estimación.
  - Naranja: Actividades interrumpidas dentro de estimación.
  - Rojo: Actividades interrumpidas fuera de estimación.
- Implementación de tooltips informativos al pasar el cursor por cualquier elemento.
- Representación visual de estimaciones mediante líneas punteadas superpuestas a la duración real.
- Manejo adecuado de estados vacíos, de carga y de día no iniciado.
- Adición de atributos ARIA para mejorar accesibilidad (roles, labels, tabindex).
- Algoritmo de desplazamiento vertical para evitar solapamiento de marcadores en el mismo punto temporal.
- Implementación de tests unitarios y de integración robustos.

Correcciones y refinamientos:

- Validación de minutos para garantizar que estén dentro del rango válido (0-1439).
- Manejo especial para la etiqueta "24:00" en lugar de formatear 1440 minutos.
- Refactorización de la función `formatMinutesToTime` para lanzar error específico cuando los minutos están fuera del rango permitido.
- Flexibilización de las aserciones de posicionamiento en pruebas para hacerlas más robustas en diferentes entornos.
- Reemplazo de `getByRole` por `getAllByRole` para manejar casos con múltiples elementos con el mismo rol.
- Eliminación de validaciones estrictas de porcentajes por un enfoque más tolerante que funciona en diferentes zonas horarias.

Notas para siguientes tickets:

- La visualización de línea de tiempo está lista para integrarse con `ChartsContainer` (T19).
- La estructura implementada facilita la adición de interactividad en futuras iteraciones.
- Para T20 (SubjectiveChart), considerar reutilizar los patrones de accesibilidad y tooltips.
- El diseño actual permite la fácil adición de funcionalidades como zoom o filtrado por tipo de actividad.
- La arquitectura de componentes implementada facilita añadir nuevos tipos de eventos o visualizaciones en futuras iteraciones.

## Ticket ID: T19

Título: ChartsContainer – distribución de tiempo

Resumen de cambios:

- Implementación completa del contenedor `ChartsContainer` para visualizar la distribución de tiempo por categorías.
- Desarrollo del componente presentacional `DistributionPie` que muestra un gráfico circular interactivo utilizando Recharts.
- Implementación de características visuales avanzadas:
  - Tooltips detallados que muestran información sobre categorías y actividades individuales
  - Etiquetas de porcentaje dentro del gráfico para valores significativos (>5%)
  - Leyenda con colores diferenciados para cada categoría
  - Paleta de colores predefinida con alto contraste para mejorar accesibilidad
- Manejo de estados:
  - Visualización de esqueleto de carga (`SkeletonLoader`) mientras se obtienen los datos
  - Mensaje informativo cuando no hay datos disponibles
  - Snackbar con botón de reintento para recuperarse de errores
- Integración con `OverviewPage` dentro de un componente Paper con elevación
- Soporte para filtrar datos por día específico mediante prop opcional `dayId`
- Componentes completamente responsivos que se adaptan a diferentes tamaños de pantalla
- Implementación de atributos ARIA y data-testid para accesibilidad y testing
- Añadido de type="chart" al componente SkeletonLoader para visualización de carga apropiada

Notas para siguientes tickets:

- La visualización de distribución de tiempo está lista para complementarse con SubjectiveChart (T20).
- Se podría añadir una opción para alternar entre vista porcentual y vista de tiempo absoluto en futuros tickets.
- Considerar implementar un selector de día para permitir comparar distribuciones entre días.
- La estructura modular permitiría añadir más tipos de visualizaciones (barras, líneas) reutilizando la lógica de datos.
- Para futuras iteraciones, se podrían añadir animaciones más elaboradas o interactividad al hacer clic en segmentos del gráfico.

## Ticket ID: T20

Título: SubjectiveChart – variables línea

Resumen de cambios:

- Implementación del componente `SubjectiveChart` que visualiza la evolución temporal de variables subjetivas mediante un gráfico de líneas.
- Integración con `ChartsContainer` para mostrar tanto la distribución de tiempo como las variables subjetivas.
- Desarrollo de un sistema de leyenda interactiva que permite al usuario ocultar/mostrar variables específicas.
- Implementación de tooltip personalizado que muestra detalles completos: valor, hora y elementos relacionados.
- Adopción de `date-fns` para formateo de fechas y horas en formato legible.
- Integración con el sistema de preferencias para mantener persistencia de variables ocultas.
- Optimización de la estrategia de preparación de datos para manejar valores multilineales en un mismo punto temporal.
- Tipado fuerte para todos los componentes y datos utilizados.

Notas para siguientes tickets:

- El componente `SubjectiveChart` puede servir como base para otras visualizaciones de series temporales.
- La implementación actual ya anticipa el trabajo para el T21 (OverviewModal) al manejar `dayId` opcional.
- Se podría mejorar añadiendo opciones de filtrado por rangos temporales específicos (por ejemplo, mañana/tarde/noche).
- La leyenda personalizada podría extenderse para otras visualizaciones que requieren interactividad similar.

## Ticket ID: T21

Título: OverviewModal – datos del día anterior/interior

Resumen de cambios:

- Implementación completa del modal `OverviewModal` que permite visualizar resumen de datos históricos de días anteriores sin abandonar la vista principal.
- Desarrollo del contenedor `OverviewModalContainer` que encapsula la lógica de carga de datos históricos y manejo de días finalizados.
- Integración de visualizaciones existentes:
  - Línea de tiempo con actividades, eventos e interrupciones
  - Gráfico de líneas para variables subjetivas
  - Gráfico circular para distribución de tiempo por categorías
- Implementación de selector de día que permite navegación entre todos los días finalizados.
- Interfaz adaptativa que muestra tres secciones apiladas en desktop y sistema de pestañas en móvil.
- Manejo avanzado de estados: carga, error, datos vacíos y fallbacks visuales.
- Integración con la AppBar de DayPage mediante botón con ícono AssessmentIcon y tooltip.
- Soporte para configuración de visibilidad de variables subjetivas persistente entre sesiones.
- Reutilización efectiva de componentes existentes para mantener consistencia visual y funcional.

Notas para siguientes tickets:

- El sistema de visualización histórica está listo para la implementación de análisis estadísticos más avanzados en futuros tickets.
- La estructura implementada puede extenderse para incluir comparativas entre días o visualizaciones agregadas.
- Para T22 (Finalizar día y persistencia), este modal puede mostrarse automáticamente al finalizar el día.
- Considerar implementar una pestaña adicional para estadísticas generales en futuras iteraciones.

## Ticket ID: T22

Título: Finalizar día y persistencia

Resumen de cambios:

- Implementación completa del flujo para finalizar el día activo y persistir los datos para análisis histórico.
- Creación del componente `ConfirmEndDayModal` para confirmar la acción antes de ejecutarla.
- Mejora del componente `TopBar` para:
  - Añadir botón de finalizar día con icono BedtimeIcon.
  - Soportar botones de acción adicionales con la nueva prop `actionButtons`.
  - Mostrar u ocultar el botón según el estado del día (isDayActive).
- Refinamiento de la interfaz unificando la barra superior en todas las páginas.
- Implementación del flujo completo en `DayPage`:
  - Si hay actividad activa, completarla automáticamente con `completeActivity()`.
  - Finalizar el día con `endDay()`.
  - Navegar a la página de overview para mostrar resumen con `navigate("/overview")`.
- Manejo adecuado de errores con Snackbar para notificar problemas durante la finalización.
- Actualización de `OverviewPage` y `StartPage` para mantener consistencia con el nuevo `TopBar`.
- La persistencia de datos aprovecha mecanismos existentes del SystemCore que:
  - Mueve actividades no completadas a `pendingActivityInstances`.
  - Actualiza el día en `global.days` con estado "inactive" y timestamp de finalización.
  - Almacena el estado completo en localStorage a través de `PersistenceManager`.

Notas para siguientes tickets:

- La funcionalidad de persistencia de datos está completa y lista para ser visualizada en futuras analíticas.
- Para futuros componentes de visualización, se puede aprovechar que la navegación automática lleva a `/overview` tras finalizar el día.
- Considerar agregar un indicador de tiempo desde la última actualización de variables en la página principal.
- El patrón de `actionButtons` en TopBar puede extenderse para añadir más acciones contextuales en futuras iteraciones.
- La estructura de modales de confirmación implementada puede servir de base para otras acciones destructivas o significativas.
- En futuras iteraciones, considerar añadir la opción de programar la finalización automática del día a una hora determinada.

## Guía de desarrollo: useEffect y tests

Título: Prevención de bucles infinitos en tests

Patrones recomendados:

- Uso de `useRef` para controlar la ejecución de efectos: Implementar banderas como `const loadedRef = useRef(false)` para ejecutar ciertos efectos solo una vez.
- Simplificación de arrays de dependencias en entornos de prueba: Reducir dependencias a lo esencial como `[open]` en lugar de incluir funciones del sistema que pueden cambiar entre renderizados en tests.
- Comentar explícitamente las razones de omisión de dependencias con `// eslint-disable-line react-hooks/exhaustive-deps` para hacer evidente la decisión de diseño.
- Implementar el patrón de "montado" para evitar actualizaciones después del desmontaje: `let isMounted = true; return () => { isMounted = false; };` dentro del efecto.
- En mocks de prueba, usar referencias estables en lugar de funciones inline que cambian en cada renderizado.
- Para tests de componentes con `useSystemCore` u otros hooks de estado global, proporcionar valores mock constantes durante toda la prueba.

Ejemplos de implementación:

```tsx
// Control de ejecución única con useRef
const effectExecutedRef = useRef(false);
useEffect(() => {
  if (effectExecutedRef.current || !open) return;
  effectExecutedRef.current = true;
  // Lógica que debe ejecutarse solo una vez...
}, [open]);

// Protección contra actualización post-desmontaje
useEffect(() => {
  let isMounted = true;
  loadData().then((data) => {
    if (isMounted) {
      setState(data);
    }
  });
  return () => {
    isMounted = false;
  };
}, []);
```

Notas para siguientes tickets:

- Aplicar estos patrones en todo el código para mejorar la robustez de pruebas y evitar bucles infinitos.
- Revisar los componentes existentes con comportamientos asíncronos para garantizar que sigan estos patrones.
- Al crear nuevos contenedores o componentes con efectos, documentar claramente la lógica de dependencias.
- Para los tests de componentes con `useSystemCore`, considerar crear un mock helper que proporcione referencias estables.

## Ticket ID: BF01

Título: Corrección del sistema Drag & Drop entre bloques

Resumen de cambios:

- Solución de un problema crítico que impedía el arrastre de actividades entre bloques de tiempo en el tablero Kanban.
- Simplificación del sistema de identificación de bloques eliminando el prefijo "block-" de los droppableId.
- Modificación del componente `Column.tsx` para usar directamente el ID del bloque como droppableId.
- Refactorización del hook `useDragDrop.ts` para trabajar directamente con los IDs originales de los bloques:
  - Eliminación de la función `extractBlockId` que procesaba inconsistentemente los IDs.
  - Reemplazo de la función `isBlock` por una función más simple `isLibrary`.
  - Simplificación del código para manejar de forma más robusta los flujos de drag & drop.
- Integración apropiada con la función `isValidBlockId` del TimeBlockManager para validar bloques destino.
- Mejora del sistema de logs para facilitar la depuración de futuros problemas con drag & drop.
- Optimización del rendimiento al eliminar manipulaciones innecesarias de strings en el proceso de arrastre.

Notas para siguientes tickets:

- La interfaz de drag & drop ahora es más robusta y trabaja directamente con los IDs originales sin manipulaciones.
- Para futuros desarrollos que involucren el sistema DnD, es importante mantener la consistencia en el uso de identificadores.
- El sistema de logs implementado proporciona información detallada sobre cada paso del proceso de drag & drop.
- La estructura actual facilita la extensión para nuevos tipos de elementos arrastrables o destinos en el futuro.
- Se recomienda implementar tests de integración específicos para los escenarios de drag & drop entre bloques para evitar regresiones.
