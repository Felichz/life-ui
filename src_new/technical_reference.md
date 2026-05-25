# Qualia Control — Technical Reference for Rebuild

> Documento extraído del análisis completo del source code existente en `src/`.
> Objetivo: contener TODA la información técnica necesaria para reconstruir la app desde cero.

---

## 1. Stack Tecnológico Original

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Runtime | React 18 + TypeScript 5.6 | Strict mode |
| Build | Vite 6 | `vite.config.ts` |
| UI Library | MUI 7 (`@mui/material`, `@mui/icons-material`) | + Emotion |
| Drag & Drop | `@hello-pangea/dnd` | También tenían `@dnd-kit` instalado pero usaban Pangea |
| Charts | `recharts`, `chart.js` + `react-chartjs-2`, `@nivo/bullet` | Múltiples librerías, limpiar en rebuild |
| Routing | `react-router-dom` v7 | 3 rutas |
| Utils | `uuid`, `date-fns`, `lodash.merge` | |
| Testing | Jest 29 + RTL 16, Cypress 14 | Unit + Integration + E2E |
| Styling extra | Tailwind CSS 3, shadcn/ui, Radix primitives | Mezclados con MUI - limpiar en rebuild |

### Recomendación para Rebuild
Simplificar: elegir **una** librería UI (MUI o Radix+Tailwind, no ambas), **una** librería de charts (recharts es suficiente), y mantener `@hello-pangea/dnd` para drag-and-drop del Kanban.

---

## 2. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────┐
│                      UI Layer                           │
│  Pages → Containers → Components/Modals → Hooks         │
│                         ↕                               │
│               SystemProvider (Context)                  │
│                         ↕                               │
│                    SystemCore                           │
│        ┌────────────────┼────────────────┐              │
│        ↓                ↓                ↓              │
│  ActivityManager  TimeBlockManager  DayManager          │
│  EventManager     SubjectiveVarMgr  InterruptionMgr    │
│  AnalyticsManager UserPrefsMgr      PersistenceMgr     │
│  UtilityService                                        │
│                         ↕                               │
│               localStorage (JSON)                       │
└─────────────────────────────────────────────────────────┘
```

### Flujo de datos unidireccional
```
User Event → Container → SystemCore action → State Change → Context Provider → Re-render
```

### Patrón de State Management
- `SystemCore` mantiene un objeto `AppState` en memoria
- Cada operación usa `updateState(updater: (state) => state)` (patrón funcional)
- Después de cada `updateState`, notifica a todos los listeners suscritos
- `SystemProvider` se suscribe via `onStateChange` y actualiza `useState` → re-render React
- **No hay Redux, Zustand ni state management externo**. Es un patrón pub/sub casero simple

---

## 3. Modelo de Datos Completo

### Tipos Básicos
```typescript
type UUID = string;
type ISODateTimeString = string;  // ISO 8601
type MinutesNumber = number;
type DayMinutes = number;         // 0-1439 (minutos dentro del día)
```

### Enums/Unions
```typescript
type ActivityType = "clear-objective" | "flexible-duration" | "timeboxing";
type ActivityState = "in-library" | "instantiated" | "active" | "completed" | "interrupted";
type TimeboxingType = "minimum-time" | "maximum-time" | "both";
type DayState = "active" | "inactive";
```

### Entidades Principales

#### ActivityTemplate (plantilla en biblioteca)
```typescript
interface ActivityTemplate {
  id: UUID;
  title: string;
  description: string;
  type: ActivityType;
  isSystemActivity: boolean;  // Piloto Auto, Meditación, Descanso Consciente
  clearObjectiveSettings?: { estimatedDurationMinutes: MinutesNumber };
  flexibleDurationSettings?: { minimumDurationMinutes: MinutesNumber; maximumDurationMinutes: MinutesNumber };
  timeboxingSettings?: { type: TimeboxingType; minimumDurationMinutes?: MinutesNumber; maximumDurationMinutes?: MinutesNumber };
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
```

#### ActivityInstance (instancia en Kanban / activa)
```typescript
interface ActivityInstance {
  id: UUID;
  templateId: UUID;
  blockId: UUID;       // bloque de tiempo donde está
  order: number;       // orden dentro del bloque
  state: ActivityState;
  // Mismas settings que template pero para ESTA instancia:
  clearObjectiveSettings?: { estimatedDurationMinutes: MinutesNumber };
  flexibleDurationSettings?: { minimumDurationMinutes: MinutesNumber; maximumDurationMinutes: MinutesNumber };
  timeboxingSettings?: { type: TimeboxingType; minimumDurationMinutes?: MinutesNumber; maximumDurationMinutes?: MinutesNumber };
  startTime?: ISODateTimeString;  // solo cuando está activa
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
```

#### CompletedActivityRecord (historial)
```typescript
interface CompletedActivityRecord {
  id: UUID;
  activityInstanceId: UUID;
  templateId: UUID;
  templateTitle: string;
  state: "completed" | "interrupted";
  type: ActivityType;
  // Settings usadas (copiadas de la instancia)
  clearObjectiveSettings?: { ... };
  flexibleDurationSettings?: { ... };
  timeboxingSettings?: { ... };
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  durationMinutes: MinutesNumber;
  interruptionData?: { isAvoidable: boolean; causeId?: UUID; causeDescription?: string };
  dayId: UUID;
  createdAt: ISODateTimeString;
}
```

#### TimeBlock
```typescript
interface TimeBlock {
  id: UUID;
  name: string;
  startMinute: DayMinutes;  // 0-1439
  endMinute: DayMinutes;
  isDefault: boolean;       // true para "Por Hacer"
  order: number;            // orden visual
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}
```

#### EventTemplate & EventInstance
```typescript
interface EventTemplate { id: UUID; name: string; createdAt; updatedAt; }
interface EventInstance { id: UUID; templateId: UUID; templateName: string; timestamp: ISODateTimeString; dayId: UUID; createdAt; }
```

#### SubjectiveVariable & Snapshot
```typescript
interface SubjectiveVariable { id: UUID; name: string; createdAt; updatedAt; }

interface SubjectiveVariableSnapshot {
  id: UUID;
  timestamp: ISODateTimeString;
  dayId: UUID;
  values: { variableId: UUID; variableName: string; previousValue: number; currentValue: number }[];
  relatedActivityIds: UUID[];
  relatedEventIds: UUID[];
  createdAt: ISODateTimeString;
}
```

#### InterruptionCause
```typescript
interface InterruptionCause { id: UUID; description: string; createdAt; updatedAt; }
```

#### Day
```typescript
interface Day { id: UUID; state: DayState; startTime?: ISODateTimeString; endTime?: ISODateTimeString; createdAt; updatedAt; }
```

#### UserPreferences
```typescript
interface UserPreferences { hiddenSubjectiveVariableIds: UUID[]; updatedAt: ISODateTimeString; }
```

### Estado de la Aplicación
```typescript
interface AppState {
  global: GlobalState;
  currentDay: CurrentDayState | null;
}

interface GlobalState {
  days: Day[];
  activityTemplates: ActivityTemplate[];
  eventTemplates: EventTemplate[];
  subjectiveVariables: SubjectiveVariable[];
  interruptionCauses: InterruptionCause[];
  timeBlocks: TimeBlock[];                         // persisten entre días
  userPreferences: UserPreferences;
  completedActivityRecords: CompletedActivityRecord[];
  eventInstances: EventInstance[];
  subjectiveVariableSnapshots: SubjectiveVariableSnapshot[];
  pendingActivityInstances?: ActivityInstance[];    // transferir entre días
}

interface CurrentDayState {
  day: Day;
  activityInstances: ActivityInstance[];
  activeActivityInstanceId?: UUID;
}
```

---

## 4. Reglas de Negocio Críticas (extraídas del código)

### DayManager
1. **Solo un día activo a la vez** — `startDay()` lanza error si ya hay día activo
2. **Al iniciar día**: recupera `pendingActivityInstances` del global (actividades no completadas del día anterior)
3. **Al finalizar día**: guarda actividades no activas como `pendingActivityInstances`, marca día como `inactive`
4. **Día siempre requerido** para crear instancias, activar actividades, registrar eventos, etc.

### ActivityManager
5. **Crear template**: valida title no vacío, type válido, settings consistentes con type
6. **Crear instancia**: verifica que template existe, que blockId existe (no necesita estar en horario actual), hereda settings del template (override permitido via `dynamicSettings`)
7. **Activar actividad**: si hay otra actividad activa → la **completa automáticamente** antes de activar la nueva. Verifica que instancia está en estado `instantiated`. Establece `startTime` y `activeActivityInstanceId`
8. **Completar actividad**: crea `CompletedActivityRecord`, calcula duración, marca instancia como `completed`, **elimina la instancia del Kanban**, limpia `activeActivityInstanceId`
9. **Interrumpir actividad**: igual que completar pero estado `interrupted`, agrega `interruptionData`, y si es evitable puede asociar `causeId`
10. **Mover instancia entre bloques**: verifica que ambos bloques existen, reordena `order` de todas las instancias afectadas
11. **No se puede eliminar instancia activa** — error

### TimeBlockManager
12. **Bloque "Por Hacer" (default)**: `isDefault=true`, siempre existe, no se puede eliminar, `startMinute=0, endMinute=0`
13. **Validación solapamiento**: al crear/editar bloque, verifica que no se solape con otros bloques existentes
14. **Bloque disponible**: compara la hora actual del sistema con `startMinute/endMinute` del bloque. El bloque default siempre está disponible
15. **Al eliminar bloque**: las actividades se mueven al bloque default (opcionalmente se eliminan si `moveActivitiesToTodo=false`)

### SubjectiveVariableManager
16. **Snapshot inmutable**: cada actualización crea un nuevo registro con TODOS los valores (incluso los que no cambiaron), con `previousValue` y `currentValue`
17. **Cooldown de 5 minutos**: `canUpdateVariables()` retorna false si hay un snapshot con menos de 5 min de antigüedad
18. **Multi-select causal**: cada snapshot puede referenciar múltiples actividades Y múltiples eventos como causas
19. **No eliminar variable en uso**: error si hay snapshots que la referencian

### EventManager
20. **Template → Instance patrón**: primero crear template en biblioteca, luego instanciar con `createEventInstance(templateId)`
21. **No eliminar template en uso**: error si hay instancias que la referencian
22. **Eventos recientes**: `getRecentEvents(minutesWindow=30)` — ventana configurable

### InterruptionManager
23. **Causas reutilizables**: se guardan globalmente para seleccionar en futuras interrupciones
24. **Estadísticas**: calcula total, evitables, no evitables, porcentaje, top causas

### AnalyticsManager (stateless — solo computa)
25. **Timeline data**: convierte `CompletedActivityRecords` en segmentos con posición temporal
26. **Time distribution**: agrupa por tipo de actividad, calcula porcentajes
27. **Subjective variables data**: formato para gráficos de líneas con relaciones causales
28. **Activity stats**: instancias total, completadas, interrumpidas, completion rate, estimation accuracy
29. **Estimation accuracy**: solo para `clear-objective` — compara `estimatedDurationMinutes` vs `durationMinutes` real

### PersistenceManager
30. **localStorage con key `qualia_control_app_state`**
31. **Validación al cargar**: verifica estructura básica (tiene `global`, `currentDay` es object o null)
32. **Guardado automático**: `SystemCore` llama `saveState` después de cada `updateState`

### UtilityService (static)
33. **generateUUID**: usa `uuid` v4
34. **getCurrentISODateTime**: `new Date().toISOString()`
35. **getCurrentDayMinutes**: `hours * 60 + minutes`
36. **formatDuration**: `"1h 30m"` format
37. **formatTime**: `DayMinutes → "HH:MM"`
38. **parseTime**: `"HH:MM" → DayMinutes`
39. **deepCopy**: recursiva, maneja Date y arrays

---

## 5. Estructura de UI

### Routing (3 rutas)
| Ruta | Página | Protección |
|------|--------|------------|
| `/` | `DayPage` | Requiere día activo → redirect a `/start` |
| `/start` | `StartPage` | Si ya hay día activo → redirect a `/` |
| `/overview` | `OverviewPage` | Sin protección |

### Pages

#### StartPage
- Muestra resumen del día anterior (si existe): completion rate, actividades completadas, duración
- Botón prominente "Comenzar día"
- Mensaje de bienvenida si es primer uso
- Enlace a OverviewPage para detalles

#### DayPage (página principal)
- Layout con múltiples secciones:
  - **TopBar** (barra superior)
  - **ActionButtons** (abrir modales: biblioteca, bloques, eventos, variables, finalizar día, overview)
  - **ActivityLibraryDrawer** (sidebar/drawer con actividades de la biblioteca para drag-and-drop)
  - **KanbanContainer** → KanbanBoard (columnas de bloques de tiempo con tarjetas de actividades)
  - **QuickBarContainer** → QuickBar (barra de acceso rápido con actividades del sistema)
  - **EventQuickBarContainer** → EventQuickBar (barra de eventos rápidos)
  - **TimelineContainer** → Timeline (línea de tiempo horizontal)
  - **ChartsContainer** → DistributionPie + SubjectiveChart
- **Modales**: ActivityInstanceModal, ActivityLibraryModal, TimeBlockModal, EventLibraryModal, VariableModal, InterruptionModal, OverviewModal, ConfirmEndDayModal

#### OverviewPage
- TimelineContainer (barras y marcadores históricos)
- ChartsContainer (distribución + variables subjetivas)

### Componentes Clave

#### Kanban/Board.tsx
- Wrapper de `DragDropContext` de `@hello-pangea/dnd`
- Renderiza columnas ordenadas por `TimeBlock.order`

#### Kanban/Column.tsx
- `Droppable` de hello-pangea/dnd
- Muestra nombre del bloque, hora inicio-fin
- Indicador visual si el bloque está activo (hora actual dentro del rango)

#### Kanban/Card.tsx
- `Draggable` de hello-pangea/dnd
- Muestra: título, tipo, settings según tipo, timer si está activa
- Botones: Activar, Completar, Interrumpir, Editar, Eliminar
- Visual diferente según estado (instantiated, active, completed)

#### QuickBar.tsx
- Lista horizontal de actividades del sistema (Piloto Auto, Meditación, Descanso)
- Icons con tooltips
- Click → activa directamente o abre modal de config

#### Timeline/
- `Timeline.tsx`: contenedor principal
- `TimelineBar.tsx`: barra de actividad (color según tipo, largo proporcional a duración)
- `TimelineMarker.tsx`: punto para eventos e interrupciones
- `TimelineUtils.ts`: conversiones de posición temporal a pixeles

#### Charts/
- `SubjectiveChart.tsx`: gráfico de líneas de variables con toggle de visibilidad
- `DistributionPie.tsx`: gráfico circular de distribución de tiempo

### Containers (Smart Components)
Conectan `useSystemCore()` con los componentes de presentación:
- `KanbanContainer`: obtiene timeBlocks + activityInstances, monta Board
- `QuickBarContainer`: filtra actividades del sistema, maneja activateActivity
- `EventQuickBarContainer`: obtiene eventTemplates, maneja createEventInstance
- `TimelineContainer`: obtiene getTimelineData(), pasa a Timeline
- `ChartsContainer`: obtiene distribution + subjective data, pasa a charts
- `ActivityLibraryContainer`: obtiene templates, maneja CRUD
- Containers de modales: `InterruptionModalContainer`, `OverviewModalContainer`, `VariableModalContainer`, `TimeBlockModalContainer`, `EventLibraryModalContainer`

### Hooks Personalizados
1. **`useSystemCore()`** — acceso a TODA la API del sistema via Context
2. **`useModal()`** — `{ isOpen, open, close, toggle }`
3. **`useTimer(duration, options)`** — temporizador con requestAnimationFrame
4. **`useDragDrop(options)`** — gestiona drag-and-drop entre biblioteca → Kanban y entre columnas
5. **`useSubscription(subscribe, callback, deps)`** — wrapper genérico para suscripciones

---

## 6. Modales y sus Responsabilidades

| Modal | Propósito | Triggers |
|-------|----------|----------|
| `ActivityLibraryModal` | CRUD de plantillas de actividad (crear, editar, eliminar templates) | Botón "Biblioteca" |
| `ActivityInstanceModal` | Configurar dynamic settings al crear instancia (drag-to-kanban o quickbar) | Drag desde biblioteca a columna, click en quickbar |
| `TimeBlockModal` | CRUD de bloques de tiempo | Botón "Gestionar bloques" |
| `EventLibraryModal` | CRUD de plantillas de eventos | Botón "Gestionar eventos" |
| `VariableModal` | Crear variables + actualizar snapshot con multi-select causal | Botón "Variables", post-completar, post-evento |
| `InterruptionModal` | Registrar causa de interrupción (evitable/no, seleccionar/crear causa) | Al interrumpir actividad |
| `OverviewModal` | Ver resumen y estadísticas del día | Botón "Overview" |
| `ConfirmEndDayModal` | Confirmación antes de finalizar día | Botón "Finalizar día" |

---

## 7. Flujos de Usuario Clave

### Flujo 1: Inicio del Día
1. Usuario abre app → ve StartPage con resumen del día anterior
2. Click "Comenzar día" → `startDay()` → redirect a DayPage
3. Kanban aparece con columna "Por Hacer" + actividades pendientes del día anterior
4. Piloto Automático debería activarse por defecto (nota: esto está en la spec pero no parece estar implementado completamente en el código actual)

### Flujo 2: Gestión de Biblioteca
1. Abrir ActivityLibraryModal
2. Crear template: título, descripción, seleccionar tipo
3. Según tipo, configurar settings específicos:
   - Clear-objective: `estimatedDurationMinutes`
   - Flexible: `min` y `max` duration
   - Timeboxing: tipo (min/max/both) + duraciones
4. Guardar → template disponible en biblioteca

### Flujo 3: Organizar Kanban
1. Crear bloques de tiempo via TimeBlockModal (nombre, hora inicio, hora fin)
2. Drag & drop actividades desde biblioteca a columnas del Kanban
3. Al soltar → ActivityInstanceModal abre para configurar dynamic settings
4. Confirmar → instancia creada en la columna destino
5. Reordenar dentro de misma columna o entre columnas via drag

### Flujo 4: Activar y Completar
1. Click "Activar" en card → si hay otra activa, se completa automáticamente
2. Timer empieza a correr
3. Click "Completar" → `CompletedActivityRecord` creado, instancia eliminada del Kanban
4. Modal de variables subjetivas aparece con actividad preseleccionada
5. Automáticamente vuelve a "Piloto Automático"

### Flujo 5: Registrar Evento
1. Crear template en EventLibraryModal
2. Click en evento en EventQuickBar → `createEventInstance()`
3. Evento aparece en timeline como marcador
4. Modal de variables subjetivas aparece con evento preseleccionado

### Flujo 6: Interrumpir Actividad
1. Click "Interrumpir" en card activa → InterruptionModal
2. ¿Evitable? Sí → seleccionar/crear causa
3. ¿Evitable? No → solo registrar
4. Modal de variables subjetivas aparece
5. Vuelve a "Piloto Automático"

### Flujo 7: Variables Subjetivas
1. Crear variables: nombre + slider 1-10
2. Actualizar: ajustar valores, seleccionar actividades/eventos relacionados
3. Crear snapshot inmutable con todos los valores + referencias causales
4. Cooldown de 5 minutos entre actualizaciones

### Flujo 8: Finalizar Día
1. Click "Finalizar día" → ConfirmEndDayModal
2. Confirmar → `endDay()`: finaliza actividad activa, guarda pending instances
3. Redirect a StartPage/OverviewPage
4. Actividades no completadas persisten para el próximo día

---

## 8. Tests Existentes (Specs de Comportamiento)

### System Layer — Unit Tests (11 archivos)
- `activityManager.test.ts` (30KB) — CRUD templates, create/move/activate/complete/interrupt instances
- `analyticsManager.test.ts` (28KB) — timeline data, distribution, subjective data, stats
- `dayManager.test.ts` (5KB) — start/end day, states
- `eventManager.test.ts` (3KB) — CRUD event templates, create instances
- `index.test.ts` (17KB) — SystemCore integration, state management
- `interruptionManager.test.ts` (10KB) — CRUD causes, stats
- `persistenceManager.test.ts` (6KB) — save/load/clear from localStorage
- `subjectiveVariableManager.test.ts` (19KB) — CRUD vars, snapshots, cooldown, latest values
- `timeBlockManager.test.ts` (32KB) — CRUD blocks, overlap validation, availability
- `userPreferencesManager.test.ts` (3KB) — preferences, toggle visibility
- `utilityService.test.ts` (5KB) — UUID, datetime, formatters

### System Layer — Integration Tests (6 archivos)
- `activityLibrary.test.ts` — flujo completo de biblioteca
- `dayStart.test.ts` — inicio de día con pending activities
- `eventManagement.test.ts` — eventos end-to-end
- `interruptionManagement.test.ts` — flujo interrupción completo
- `kanbanOrganization.test.ts` — drag-drop, reorder, blocks
- `subjectiveVariables.test.ts` — snapshots, cooldown, relaciones causales

### UI Layer — Component Tests (14 archivos)
- Tests de modales: ActivityInstanceModal, ActivityLibraryModal, EventLibraryModal, TimeBlockModal
- Tests de containers: KanbanContainer, QuickBarContainer, EventQuickBarContainer, VariableModalContainer
- Tests de pages: DayPage (2 archivos), StartPage
- Tests de componentes: KanbanBoard, QuickBar, AppRouter

---

## 9. Detalles de Implementación a Preservar

### SystemCore: Inicialización
```
constructor() → PersistenceManager.loadState() || createDefaultState()
  → initialize() (ensure default block exists)
  → cada manager recibe referencia a SystemCore
```

### Default State Factory
```typescript
const defaultState: AppState = {
  global: {
    days: [],
    activityTemplates: [],
    eventTemplates: [],
    subjectiveVariables: [],
    interruptionCauses: [],
    timeBlocks: [],  // default block se crea en initialize()
    userPreferences: { hiddenSubjectiveVariableIds: [], updatedAt: "" },
    completedActivityRecords: [],
    eventInstances: [],
    subjectiveVariableSnapshots: [],
  },
  currentDay: null,
};
```

### Default Block "Por Hacer"
```typescript
{ name: "Por Hacer", startMinute: 0, endMinute: 0, isDefault: true, order: 0 }
```

### Export/Import de Datos
- `exportData()`: `JSON.stringify(state)` — todo el AppState
- `importData(json)`: parsea, valida, reemplaza estado, guarda en localStorage

### SystemProvider Pattern
```typescript
const coreRef = useRef<ISystemCore>(new SystemCore());
const [state, setState] = useState(coreRef.current.getState());

useEffect(() => {
  const unsubscribe = coreRef.current.onStateChange((newState) => setState(newState));
  return () => unsubscribe();
}, []);
```

### Drag & Drop Pattern
- Source `library` = arrastrar desde biblioteca → abre modal de configuración
- Source `blockId` → destination `blockId` = mover entre columnas → `moveActivityInstance()`
- Same source/destination same index = no-op

---

## 10. Funcionalidades NO Implementadas (de la visión del README)

Estas funcionalidades están contempladas en el README pero no están implementadas en el código actual:

1. **Planes de Acción** — agrupaciones predefinidas de actividades con orden sugerido
2. **Declaraciones Default por Grupos de Días** — patrones L-V, S-D, etc.
3. **Actividad "Piloto Automático" como fallback activo** — la spec dice que debe estar activa por defecto pero no hay código que active automáticamente al iniciar día
4. **Actividades del sistema predefinidas** — Piloto Auto, Meditación, Descanso Consciente deberían existir como templates del sistema, pero no se crean automáticamente
5. **Momentum** — variable derivada calculada que no está implementada
6. **Notificaciones de timeboxing** — alertar cuando se alcanza mínimo/máximo
7. **Barra de eventos de acceso rápido completa** — el componente existe pero limitado
8. **Correlación causal avanzada** — el sistema sugiere eventos recientes relacionados
9. **Manejo de medianoche** — auto-finalizar día
10. **Categorías/etiquetas para actividades** — mencionadas en README pero no en types

---

## 11. Problemas Conocidos del Código Actual

1. **Mezcla de librerías UI**: MUI + Radix + shadcn + Tailwind instalados simultáneamente → inconsistencia
2. **Múltiples librerías de charts**: recharts + chart.js + nivo → elegir una
3. **State mutation**: algunos managers mutan `state` directamente dentro del updater en vez de crear copias (ej: `state.global.eventTemplates.push(...)` en EventManager)
4. **Console.log de desarrollo**: muchos `console.log("Drag end result", ...)` en código de producción
5. **useTimer con requestAnimationFrame**: el `animate` callback tiene closure sobre `elapsed` e `isRunning` que puede causar stale closures
6. **Circular dependency potencial**: managers importan `SystemCore` que importa managers
7. **No hay validación en la UI**: la lógica del sistema valida, pero los errores se propagan como exceptions no manejadas en algunos containers

---

## 12. Arquitectura de Testing Recomendada para Rebuild

### System Layer
- Mantener la misma estructura de tests unitarios por manager
- Los integration tests son **muy valiosos** como specs — cubren los 8 flujos de usuario
- Agregar tests para funcionalidades faltantes (Planes de Acción, Declaraciones Default, Momentum)

### UI Layer
- Tests con React Testing Library para containers y modales
- Tests E2E con el browser tool de Antigravity en vez de Cypress
- Tests de visual regression via capturas del browser

---

## 13. API Completa del SystemCore (ISystemCore)

```typescript
interface ISystemCore {
  // State
  getState(): AppState;
  updateState(updater: (state: AppState) => AppState): void;
  onStateChange(callback: (newState: AppState) => void): () => void;

  // Day
  startDay(): Day;
  endDay(): Day;
  getCurrentDay(): Day | null;
  isDayActive(): boolean;

  // Activity Templates (CRUD)
  createActivityTemplate(data): ActivityTemplate;
  updateActivityTemplate(id, data): ActivityTemplate;
  deleteActivityTemplate(id): void;
  getActivityTemplates(): ActivityTemplate[];

  // Activity Instances (lifecycle)
  createActivityInstance(templateId, blockId, dynamicSettings?): ActivityInstance;
  updateActivityInstance(id, data): ActivityInstance;
  moveActivityInstance(id, targetBlockId, newOrder?): ActivityInstance;
  deleteActivityInstance(id): void;
  activateActivity(id): ActivityInstance;
  completeActivity(id): CompletedActivityRecord;
  interruptActivity(id, isAvoidable, causeId?): CompletedActivityRecord;
  getActiveActivity(): ActivityInstance | null;

  // Time Blocks
  createTimeBlock(name, startMinute, endMinute): TimeBlock;
  updateTimeBlock(id, data): TimeBlock;
  deleteTimeBlock(id, moveActivitiesToTodo?): void;
  getTimeBlocks(): TimeBlock[];
  getCurrentTimeBlock(): TimeBlock | null;
  isTimeBlockAvailable(blockId): boolean;
  isTimeBlockExisting(blockId): boolean;

  // Subjective Variables
  createSubjectiveVariable(name): SubjectiveVariable;
  updateSubjectiveVariable(id, data): SubjectiveVariable;
  deleteSubjectiveVariable(id): void;
  createSnapshot(values[], relatedActivityIds?, relatedEventIds?): SubjectiveVariableSnapshot | null;
  getSnapshots(filters?): SubjectiveVariableSnapshot[];
  getLatestValues(): Record<UUID, number>;
  canUpdateVariables(): boolean;

  // Events
  createEventTemplate(name): EventTemplate;
  updateEventTemplate(id, data): EventTemplate;
  deleteEventTemplate(id): void;
  createEventInstance(templateId): EventInstance;
  getEventInstances(filters?): EventInstance[];
  getRecentEvents(minutesWindow?): EventInstance[];

  // Interruptions
  createInterruptionCause(description): InterruptionCause;
  updateInterruptionCause(id, data): InterruptionCause;
  deleteInterruptionCause(id): void;
  getInterruptionCauses(): InterruptionCause[];
  getInterruptionStatistics(): InterruptionStatistics;

  // Analytics (read-only computations)
  getTimelineData(dayId?): TimelineData;
  getTimeDistributionData(dayId?): TimeDistributionData;
  getSubjectiveVariablesData(dayId?): SubjectiveVariablesData;
  getActivityStats(templateId?): ActivityStatistics;
  getCompletionRate(): number;
  getInterruptionRate(): number;
  getEstimationAccuracy(): number;

  // User Preferences
  updateUserPreferences(prefs): UserPreferences;
  getUserPreferences(): UserPreferences;
  toggleVariableVisibility(variableId): void;
  isVariableVisible(variableId): boolean;

  // Persistence
  exportData(): string;
  importData(jsonData: string): AppState;
  clearState(): void;
}
```
