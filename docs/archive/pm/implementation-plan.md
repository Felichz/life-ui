Plan de Implementación – Qualia Control MVP (React + Material‑UI)

1. Visión mental del prototipo única
   Vista principal (DayPage)

Kanban + Timeline en un único layout de escritorio.

Quick Bar para actividades del sistema.

Botones fijos para abrir modales:

Biblioteca de actividades

Gestión de bloques de tiempo

Registro de evento puntual

Actualizar variables subjetivas

Finalizar día

Overview histórico accesible desde un botón (abre modal o redirige a /overview).

Modales centralizados

ActivityLibraryModal: grilla de plantillas con búsqueda y creación.

TimeBlockModal: lista y creación/edición de bloques.

EventModal, VariableModal, InterruptionModal.

OverviewModal (opcional) para mostrar datos del día anterior/interior.

Componentes clave
KanbanBoard, Timeline, QuickBar, ActivityCard, TimeBlockColumn, ModalManager, SubjectiveChart, DistributionPie, TopBar.

2. Implicaciones técnicas
   React 18 + TypeScript

Material‑UI (@mui/material) para componentes y theming

React Router v6 (react-router-dom) para rutas mínimas

Drag & Drop: @hello-pangea/dnd para arrastrar desde biblioteca al Kanban

Charts: recharts para gráficas de líneas y pastel

Context API + custom hooks (useSystemCore, useModal, useTimer, useDragDrop)

State Management: SystemCore expuesto vía SystemProvider

Timers: requestAnimationFrame o setInterval encapsulados en useTimer

Persistencia: gestionada internamente por SystemCore

3. Arquitectura modular
   Core (SystemCore): lógica de dominio, gestión de estado y persistencia.

UI Context: SystemProvider expone estado y acciones del core.

Pages: DayPage, OverviewPage (rutas principales).

Containers (Smart): conectan useSystemCore a componentes de presentación.

Components (Dumb): presentan datos y disparan callbacks (e.g. KanbanBoard, ActivityCard).

Modals: formularios reutilizables (ActivityLibraryModal, TimeBlockModal, etc.).

Hooks auxiliares: useModal, useDragDrop, useTimer, useSubscription.

Theme: configuración MUI en theme/index.ts.

4. Estructura de carpetas
   plaintext
   Copy
   Edit
   src/
   system/ # EXISTENTE
   ui/
   context/
   SystemProvider.tsx
   pages/
   DayPage.tsx # Vista única del día
   OverviewPage.tsx # Pantalla histórica
   containers/
   KanbanContainer.tsx
   QuickBarContainer.tsx
   TimelineContainer.tsx
   ChartsContainer.tsx
   components/
   Kanban/
   Board.tsx
   Column.tsx
   Card.tsx
   Common/
   TopBar.tsx
   IconButtonWithTooltip.tsx
   SkeletonLoader.tsx
   modals/
   ActivityLibraryModal.tsx
   TimeBlockModal.tsx
   EventModal.tsx
   VariableModal.tsx
   InterruptionModal.tsx
   OverviewModal.tsx
   hooks/
   useSystemCore.ts
   useTimer.ts
   useModal.ts
   useDragDrop.ts
   theme/
   index.ts
   AppRouter.tsx # Routing mínimo
   main.tsx
5. Routing mínimo

Ruta Componente Redirección
/ DayPage n/a
/overview OverviewPage n/a 6. Flujos de integración (ejemplo Activar desde Kanban)
UI → el usuario hace clic en Activar de ActivityCard.

Modal ConfirmStartModal (opcional) se abre para ajustar dinámicas.

API → SystemCore.activateActivity(id).

Core actualiza estado y dispara notifyStateChanged().

Context (useSystemCore) detecta cambio y provoca re‑render de KanbanContainer, TimelineContainer y QuickBar.

Flujos similares para QuickBar, Completar, Interrumpir, Evento y Snapshot.

7. Flujos de datos unidireccionales
   sql
   Copy
   Edit
   User Event → Container → Core Action → State Change → Context Provider → Presentational Components
   No callbacks circulares. Los timers actualizan la UI local y, al concluir, llaman a acciones del core.

8. Component boundaries (props principales)
   KanbanBoard

columns: TimeBlockWithActivities[]

onDragEnd(result)

ActivityCard

activity: ActivityInstance

onActivate(): void

onEdit(): void

onDelete(): void

QuickBar

systemActivities: ActivityTemplate[]

onSelect(activityId: UUID): void

Timeline

segments: TimelineSegment[]

markers: TimelineMarker[]

SubjectiveChart

data: SubjectiveVariablesData

hiddenVariables: UUID[]

onToggle(varId: UUID): void

9. Gestión de ciclo de vida
   SystemProvider se monta una vez → en useEffect suscribe a SystemCore.onStateChange, limpia al desmontar.

useTimer crea y cancela requestAnimationFrame/setInterval en mount/unmount.

ModalContext remueve modales y listeners al unmount.

10. Estados de carga y error
    SkeletonLoader para Kanban y listas mientras se hidrata el core.

Spinners en botones de acciones (patrón async) aunque SystemCore sea sync.

Snackbar global para errores via ErrorBoundary + Context.

11. Accesibilidad básica
    Roles ARIA esenciales (button, dialog, list, listitem).

aria-label y aria-labelledby en iconos y modales.

Focus visible en botones y campos.

Contraste WCAG AA.

12. Plantilla de ticket (ejemplo)
    markdown
    Copy
    Edit

### Título

<imperativo, ≤60 caráct>

**Objetivo**
¿Qué resultado aporta al usuario / sistema?

**Descripción**
Pasos y alcance.

**Detalles de implementación**

- Librerías, hooks, componentes afectados.
- Edge cases a cubrir.

**Criterios de aceptación**

- [ ] Condición observable nº1
- [ ] Condición observable nº2

**Casos de prueba**

1. Test unitario con Jest + React Testing Library para el comportamiento principal.
2. Test de integración con Jest/RTL para un edge case relevante.

**Contexto opcional**

- Firma de API: `SystemCore.createActivityTemplate()`

**Flujos de usuario de referencia**

- Ejemplo: Flujo 2 (Creación de actividad), Flujo 3 (Kanban DnD)

13. Casos de prueba (mínimo por ticket)
    Cada ticket debe incluir al menos dos pruebas automatizadas en Jest + React Testing Library:

Happy path: comportamiento esperado.

Edge case: condición límite o error.

14. Backlog de tickets
    Nota: numeración secuencial, sin dependencias ocultas. Cada ticket es autocontenible y ordenado lógicamente.

T01 – Scaffold UI & Theme
Objetivo
Crear la base React + MUI con routing mínimo y theme.

Descripción

Instalar @mui/material y react-router-dom.

Configurar ThemeProvider y breakpoints.

Estructura mínima de carpetas.

Detalles de implementación

main.tsx monta ThemeProvider y BrowserRouter.

Definir tema con colores neutrales y mode: "light".

Criterios de aceptación

Renderiza / sin errores.

Se aplican estilos MUI globales.

Casos de prueba

Renderizar un componente dummy y verificar texto con Jest + RTL.

Snapshot test del theme aplicado.

Contexto opcional

No aplica.

T02 – SystemProvider wrapper
Objetivo
Exponer SystemCore a la UI vía Context.

Descripción

Crear SystemProvider y hook useSystemCore.

Suscribir a onStateChange.

Detalles de implementación

Usar useRef para la instancia única de SystemCore.

Empaquetar métodos (startDay, activateActivity…).

Criterios de aceptación

useSystemCore devuelve estado inicial.

Acciones provocan re-render al actualizar el core.

Casos de prueba

Mock de SystemCore → startDay() actualiza contexto (Jest + RTL).

Verificar cleanup de suscripción con fake timers.

Contexto opcional

Firma: new SystemCore()

T03 – Routing básico
(Y así sucesivamente hasta T26, siguiendo la misma plantilla y referenciando siempre los flujos de usuario correspondientes)

ID Título
T03 Routing básico
T04 StartPage + lógica “Comenzar día”
T05 QuickBar – visual & handler de selección
T06 KanbanBoard – estructura estática
T07 DnD desde Biblioteca → Kanban
T08 Modal Activity – crear/editar instancia
T09 Modal TimeBlock – CRUD bloques
T10 ActivityLibraryModal – interfaz de biblioteca en DayPage
T11 TimeBlockModal – gestión de bloques en DayPage
T12 Activar actividad desde Kanban
T13 Completar actividad + modal variables
T14 Interrumpir actividad + causas
T15 QuickBar selección y activación directa
T16 Registro de evento puntual
T17 Modal Variable – actualizar variables subjetivas
T18 TimelineContainer – barras y marcadores
T19 ChartsContainer – distribución de tiempo
T20 SubjectiveChart – variables línea
T21 OverviewModal – datos del día anterior/interior
T22 Finalizar día y persistencia
T23 Skeleton & error states globales
T24 Unit tests para hooks y componentes (Jest + RTL)
T25 Lint & Prettier + Husky pre‑commit
T26 Documentación README + issue template en .github/ISSUE_TEMPLATE
