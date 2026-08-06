# ADR-001 — Sistema de Tempos: Diseño, Restauración y Simplificación

**Estado**: Aceptado (con correcciones)
**Fecha**: 2026-08-04
**Decisión**: Implementar sistema de tempos con fórmula porcentual + auto-evaluación honesta al completar, eliminando features secundarias que no aportan a la integridad del contrato.

---

## Contexto

### El problema real del proyecto

La app tiene un **modelo de datos sólido y completo**, pero le falta el **motor de dopamina** que justifique al usuario (persona con TDAH) mantener la disciplina de usarlo. Específicamente:

1. **El sistema de tempos existió, era sofisticado, y fue eliminado** en un commit de "restart" (`ff29264`).
2. **El código actual preserva la infraestructura de honestidad** (variables subjetivas, causas de interrupción, snapshots causales) **pero no tiene el motor de recompensa** que esa infraestructura estaba diseñada para servir.
3. **El ratio de carga cognitiva actual es 80/0**: 80% invertido en configurar el contrato (variables, causas, tipos), 0% en recibir la recompensa visible. Para una persona con TDAH, este ratio es insostenible — la voluntad se agota sin retorno visible.
4. **El core actualmente completa actividades implícitamente** desde `activateActivity()` (auto-completa la anterior), desde `QuickBarContainer` (al cambiar), y desde `DayPage.handleEndDayConfirm` (al cerrar el día). Esto entra en conflicto con el ritual obligatorio de evaluación.

### Lo que el usuario ya sabía (y el sistema actual no refleja)

El sistema viejo (commits `0e54bb5`, `30bf872`, `b784b29`, `7f2e41b`, `b6199c3`) implementaba:

| Concepto                                                 | Significado                                          |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `totalTempoBalance` / `dayTempoBalance`                  | Doble tracking: histórico + diario                   |
| `passiveTempoConsumptionRate`                            | Tiempo idle drenaba tempos (diseño problemático)     |
| `tempoGeneratingMinutes` con cap por actividad           | Generabas tempo solo hasta cubrir `totalTempoReward` |
| 3 tipos económicos: `challenge` / `neutral` / `discount` | Diferentes tasas de generación/consumo               |
| `expirationConstraints` con `penaltyAmount`              | Vencimientos aplicaban penalizaciones                |
| `tempoModificationHistory`                               | Historial auditable de cambios                       |

---

## Decisión

### A qué me refiero

Construir un sistema de tempos con las siguientes propiedades simultáneas:

1. **Recompensa inmutable, no moneda**: `temposAwarded` se guarda en cada actividad completada. No hay ledger, no hay saldo mutable, no hay gasto. El total del día se deriva sumando registros.

2. **Fórmula lineal honesta, calculada por el core (MVP v3.1)**:

   `tempos = ceil(baseMinutos × score / 7)`. La escala es lineal: cada
   punto del slider aumenta la recompensa un ~14% de la base. No hay
   umbral: score 1 ya recompensa algo, score 0 no.

   ```
   // score 0  → 0%   (no completó; coherencia con honestidad)
   // score 1  → 14%  (1/7)
   // score 5  → 71%  (5/7)
   // score 7  → 100% (default del slider: "Lo hiciste")
   // score 10 → 143% (10/7)
   //
   // base = minutos estimados (si hay) | duración real (si no)
   //
   // Si durationMinutes === 0 pero hay estimado > 0, se usa el estimado
   // (no se pierde la recompensa por haber confirmado en los primeros 30s).
   ```

   **Por qué 7 como divisor**: 7 = 100% (score 7 = 1.0×). Es un número
   natural para la escala 0-10. Otros valores comunes (10) harían que
   score 5 = 50% y dejarían poco rango entre "lo hice" (5) y "lo hice
   perfecto" (10); 7 da 71% en score 5 y 143% en score 10, permitiendo
   reflejar más finamente el esfuerzo percibido.

   **Por qué lineal y no por tabla**: la tabla anterior (MVP v3 con
   umbrales 7-10) hacía que score 1-6 = 0 tempos, lo cual contradecía
   la idea de que "cualquier progreso cuenta algo". Con la fórmula
   lineal, una tarea de 30 min con score 5 da 22 tempos (en lugar de 0),
   y score 1 da 5. Esto refleja mejor el esfuerzo del usuario.

   **Por qué la base es el estimado (no la duración real)**:

   Si el usuario confirma honestamente una tarea a los 30 segundos (antes
   de completar el primer minuto y con `Math.round` → 0), todavía debe
   recibir la recompensa correspondiente. Premiar sobre el estimado
   elimina el bug clásico de "0 tempos porque acabo de iniciar". Además,
   es coherente con la decisión de "tiempo libre es tiempo libre": no
   cobramos al usuario por no haber esperado más.

   Solo cuando **no hay estimado** (flexible-duration, timeboxing sin
   rango) se usa la duración real como base.

3. **Decisión del usuario, no heurística automática**:

   A diferencia del diseño original (donde `beatEstimate` (antes
   `canApplyBonus`) auto-ponía el slider en 10 cuando se batía el
   estimado), en MVP v3 el bonus es
   siempre decisión explícita del usuario en el slider:

   - **`beatEstimate`**: se conserva como métrica informativa del record
     (mostrada en CompletionModal como "✓ batiste el estimado") y del
     `CompletedActivityRecord.beatEstimate`, pero **NO** modifica el score
     inicial ni otorga bonus automático.
   - Score default del slider al abrir el modal: **siempre 7** (umbral).
   - El usuario decide explícitamente si su satisfacción amerita 8 (110%),
     9 (120%) o 10 (130%).

4. **Tipos de actividad y `beatEstimate`** (calculado en el core):

   - **`clear-objective`**: tiene estimado puntual. Se calcula `beatEstimate`
     para mostrarla como info, pero NO modifica la fórmula.
   - **`flexible-duration`**: rango informativo, no hay estimado puntual.
   - **`timeboxing`**: ventana intencional (respetar, no batir).

5. **Tiempo libre es tiempo libre**: no hay drenaje pasivo, no hay penalización por no estar haciendo nada. El tiempo fuera de actividades declaradas **no cuesta nada**.

6. **Un único ritual de cierre**: `CompletionModal`. Toda finalización de actividad — completar, cambiar a otra, cerrar el día, terminar timeboxing — pasa por él.

7. **El target es orientación, no obligación**: se muestra como `"42% de tu referencia diaria"`, **nunca** como `"te faltan 580 tempos"`.

8. **Interrupciones mínimas**: solo se registra `state: "interrupted"` y `durationMinutes`. Sin causas configurables, sin pregunta de evitable, sin snapshot causal. No suman tempos ni restan nada.

9. **Variables subjetivas fuera del producto**: no hay modal, no hay gráficos, no hay feature flag visible. Si existen datos históricos, se preservan en localStorage pero no se muestran ni participan en la lógica.

### Por qué razón

#### Tempos como recompensa, no moneda

Llamarlo `balance` prometía una mecánica de gasto que no existe y podía confundir el diseño futuro. En esta versión: cada actividad completada gana N tempos una sola vez. El total del día = suma. Simple, derivable, sin estado mutable adicional.

#### El core calcula, la UI solo evalúa

La UI nunca recalcula la fórmula. Solo envía:

```ts
{
  satisfactionScore: number;
}
```

El core aplica la tabla de multiplicadores, decide la base (estimado vs
duración real), calcula el total, y devuelve:

```ts
{
  record: CompletedActivityRecord,
  temposAwarded: number,
  dailyTempoTotal: number,
  targetProgress: number,   // ratio real sin cap (puede ser > 1)
  beatEstimate: boolean
}
```

Importante: `targetProgress` es **el ratio real sin capear**, puede
ser > 1 si el usuario supera su target diario (ej: 1847 / 1000 = 1.847).
La UI muestra este ratio sin cap en `displayPercent` y capeado a 100 en
`progressBarValue`.

Esto evita que la UI, una futura API, o un cliente externo implementen
reglas distintas.

#### El bonus solo donde hay un estimado puntual

`clear-objective` tiene un número concreto (`~45 min`). Es el único caso donde "batir" tiene sentido.

`flexible-duration` tiene un rango (`5-10 min`). Batir un rango no es un concepto claro.

`timeboxing` tiene una ventana intencional (mínimo o máximo). El propósito no es batirla sino respetarla.

Por eso solo el primer tipo calcula `beatEstimate`, y como **métrica
informativa únicamente**: no modifica el score inicial del slider ni
otorga bonus automático. El usuario decide explícitamente el bonus
moviendo el slider a 8/9/10.

#### El score 0 = 0 tempos totales

Si el usuario evalúa con 0, está diciendo "esto no cuenta". Por
coherencia, no hay tempos. Los scores 1-10 siempre premian algo,
escalando linealmente desde 14% (score 1) hasta 143% (score 10).

#### Una sola vía de cierre: `requestCompletion` → modal → `completeActivity`

El core expone dos métodos explícitos:

```ts
// UI invoca esto cuando quiere cerrar una actividad
requestCompletion(activityId): CompletionRequest
// → la UI abre CompletionModal con la info necesaria

// UI invoca esto cuando el usuario confirma en el modal
completeActivity(
  id: UUID,
  assessment: { satisfactionScore: number }
): CompletionResult
```

`activateActivity` ya **no** auto-completa la actividad anterior. En su lugar, marca la actividad actual como "pendiente de cierre" y la UI muestra el modal antes de proceder.

Esto aplica a:

- completar desde Kanban (botón "Completar")
- cambiar de actividad desde QuickBar
- finalizar el día
- terminar un timeboxing automáticamente (alerta al usuario)

#### Target = orientación

`dailyTempoTarget` es un número configurable (default 1000). La UI lo muestra como porcentaje del día:

```text
Hoy: 420 / 1000 tempos   (42% de tu referencia diaria)
```

Nunca:

```text
Te faltan 580 tempos   ❌ (esto nunca)
```

#### Interrupciones sin juicio moral

Una interrupción es solo un registro de "lo que estaba haciendo terminó sin completarse". No hay pregunta de "¿fue evitable?" porque ese juicio le exige al usuario algo que en el momento caliente no puede dar bien. Solo:

```ts
{ state: "interrupted", durationMinutes, dayId, ... }
```

Sin tempos, sin penalty, sin causa. El sistema aprende de los completados, no de los interrumpidos.

---

## Contrato de dominio y transiciones

### Tipos del modelo

```typescript
interface CompletedActivityRecord {
  // existentes
  id: UUID;
  activityInstanceId: UUID;
  templateId: UUID;
  templateTitle: string;
  type: ActivityType;
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  durationMinutes: number;
  dayId: UUID;

  // settings del tipo (preservan cómo se ejecutó)
  clearObjectiveSettings?: { estimatedDurationMinutes: number };
  flexibleDurationSettings?: { minimumDurationMinutes: number; maximumDurationMinutes: number };
  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: number;
    maximumDurationMinutes?: number;
  };

  // nuevos
  satisfactionScore: number; // 0-10 (entero)
  temposAwarded: number; // immutable, derivado al completar
  beatEstimate: boolean; // calculado al completar

  createdAt: ISODateTimeString;
}

interface UserPreferences {
  updatedAt: ISODateTimeString;
  dailyTempoTarget: number; // default 1000
}

interface TempoSummary {
  totalTempos: number; // del día
  target: number; // configurado
  targetProgress: number; // 0..1
  completedActivities: number;
  averageSatisfaction: number; // 0-10
  lastReward?: {
    recordId: UUID;
    activityTitle: string;
    tempos: number;
  };
}

interface TempoTrendPoint {
  date: ISODateTimeString;
  totalTempos: number;
  targetProgress: number;
  averageSatisfaction: number;
}
```

### API del core

```typescript
interface ISystemCore {
  // ...existing methods...

  // Sistema de tempos
  requestCompletion(activityId: UUID): {
    activityTitle: string;
    durationMinutes: number;
    estimatedMinutes?: number; // solo si clear-objective
    /**
     * MVP v3: métrica informativa únicamente (no afecta fórmula).
     * Indica si la actividad se completó antes del 80% del estimado.
     */
    beatEstimate: boolean;
  };

  completeActivity(
    activityId: UUID,
    assessment: { satisfactionScore: number }
  ): {
    record: CompletedActivityRecord;
    temposAwarded: number;
    dailyTempoTotal: number;
    targetProgress: number;
    beatEstimate: boolean;
  };

  interruptActivity(activityId: UUID): CompletedActivityRecord; // simplificado, sin args extra

  getTempoSummary(dayId: UUID): TempoSummary;
  getTempoTrends(range: { from: string; to: string }): TempoTrendPoint[];
}
```

### Reglas de borde explícitas

| Caso                                                          | Comportamiento                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `durationMinutes <= 0`                                        | `temposAwarded = 0` (no se puede premiar tiempo nulo)                                                                                      |
| `satisfactionScore` fuera de `[0,10]`                         | Error de validación, no se completa                                                                                                        |
| `satisfactionScore === 0`                                     | `temposAwarded = 0` (coherencia)                                                                                                           |
| Actividad ya completada (doble click)                         | El segundo `completeActivity` lanza error; UI debe prevenir                                                                                |
| Usuario abandona el modal (cierra sin confirmar)              | La actividad sigue activa; nada se registra                                                                                                |
| Actividad interrumpida                                        | Se crea `CompletedActivityRecord` con `state: "interrupted"` y `satisfactionScore: 0` (no se pregunta, no se puntúa, no se otorgan tempos) |
| Auto-completion desde `activateActivity` o cambio de QuickBar | `activateActivity` ahora **no** auto-completa. Marca como "pendiente de cierre" y emite evento para que la UI muestre el modal             |
| Migración desde estado viejo                                  | `schemaVersion` se incrementa; registros sin `satisfactionScore` quedan con `temposAwarded = 0` legacy                                     |

---

## Features que se ELIMINAN del diseño actual

### Eliminación completa

| Feature                                                              | Razón de eliminación                                                                                      |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Variables subjetivas** (Energía, Ánimo, Concentración, Estrés)     | No aportan a la integridad del tempo. Mantenerlas (incluso tras flag) preserva complejidad sin beneficio. |
| **Snapshots de variables subjetivas**                                | Análisis retrospectivo no esencial.                                                                       |
| **Multiselect causal actividad↔snapshot**                           | Misma razón.                                                                                              |
| **Causas de interrupción personalizadas**                            | El sistema solo necesita "interrumpida o no".                                                             |
| **`isAvoidable` en `CompletedActivityRecord.interruptionData`**      | Eliminado. Sin juicio moral en el momento caliente.                                                       |
| **Restricción temporal de 5 min entre actualizaciones de variables** | Sin variables, no aplica.                                                                                 |
| **`canUpdateVariables`**                                             | Eliminado.                                                                                                |
| **`SubjectiveChart`** y todo el sistema de gráficos de variables     | Eliminado.                                                                                                |
| **`SubjectiveVariableManager`**                                      | Eliminado.                                                                                                |
| **`InterruptionManager`**                                            | Reducido a `interruptActivity(id)` sin isAvoidable/causeId.                                               |
| **Pregunta "¿Fue evitable?" en `InterruptionModal`**                 | Eliminada.                                                                                                |
| **Sección de variables subjetivas en `OverviewModal`**               | Eliminada.                                                                                                |
| **Botón "Variables" en `ActionButtons`**                             | Eliminado.                                                                                                |
| **ChartsContainer sección subjective**                               | Eliminada.                                                                                                |
| **Toggle de visibilidad de variables**                               | Eliminado.                                                                                                |

### Lo que sobrevive con cambios

- **`InterruptionModal`**: **eliminado**. Se reemplaza por acción directa (botón "No la terminé" en la card → snackbar).
- **`KanbanContainer.handleInterruptActivity`**: simplificado. Sin modal. Llama `interruptActivity(id)` directamente y muestra snackbar positivo.
- **`DayMetricsContainer` y `TrendsView`**: **nuevos**. Reemplazan la complejidad de variables/interrupciones con métricas simples.

---

## Modelo de UI: CompletionModal

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   Terminaste "Escribir informe"                     │
│                                                     │
│   Tiempo real: 38 min                               │
│   Estimado: 45 min    ✓ 7 min antes                │
│                                                     │
│   ¿Qué tan satisfecho estás con lo que hiciste?     │
│                                                     │
│   ━━━━━●━━━━━━━━  5/10                              │
│   "Cumplí lo mínimo sin extras. Está bien."        │
│                                                     │
│   ┌───────────────────────────────────────┐         │
│   │  30 min × 5/7  ≈  22 tempos           │         │
│   │  ═══════════════════════════════       │         │
│   │  TOTAL                  22 tempos      │         │
│   └───────────────────────────────────────┘         │
│                                                     │
│   [ Guardar y recibir 22 tempos ]                    │
│   [ No la terminé ]                                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

   - **Sin auto-10**. El slider siempre arranca en 7 (100% de la base). El usuario decide explícitamente si su satisfacción amerita más (score 8/9/10) o menos (score 1-6). `beatEstimate` se conserva como métrica informativa (mostrada como "✓ batiste el estimado") pero no sesga el score.
- **Botón "No la terminé"** aparece siempre. Llama `interruptActivity(id)`, registra interrupción sin tempos, snackbar positivo: _"Está bien. Mañana es otra oportunidad."_
- Si el usuario cierra el modal sin elegir, la actividad sigue activa. Nada se registra.

---

## Banner siempre visible

```
┌─────────────────────────────────────────────────────┐
│  Hoy: 420 / 1000 tempos  ████░░░░  42% de tu       │
│                                   referencia diaria  │
│                                                     │
│  Última: Escribir informe  ·  +309 tempos            │
└─────────────────────────────────────────────────────┘
```

El contador **solo sube** al completar. No drena. El target es un ancla móvil, no un techo.

---

## Persistencia: versionado y migración

```typescript
const CURRENT_SCHEMA_VERSION = 2;

interface MigrationResult {
  state: AppState;
  migrated: boolean;
  warnings: string[];
}
```

Migración v1 → v2:

- Agrega `dailyTempoTarget: 1000` si falta en `userPreferences`.
- `completedActivityRecords` antiguos quedan con `temposAwarded: 0`, `satisfactionScore: 0`, `beatEstimate: false`.
- `subjectiveVariables`, `subjectiveVariableSnapshots`, `interruptionCauses` se **preservan** en localStorage (no se borran), pero **no se cargan** en `AppState`. Si el usuario exporta datos, los incluye como archivo histórico.
- `interruptionData.isAvoidable` queda ignorado.
- Si falta el schemaVersion, se asume v1 y se migra.

---

## Trade-offs explícitos

### Lo que ganamos

- **App con propósito claro**: dopamina continua sin ansiedad, sin drenaje.
- **Tiempo libre protegido**: el ocio no cuesta.
- **Honestidad concentrada**: un único momento, una sola decisión.
- **Lógica de negocio en el core**: la UI no recalcula nada.
- **Persistencia robusta**: schemaVersion previene roturas futuras.
- **API clara**: `requestCompletion` / `completeActivity` con contrato explícito.

### Lo que perdemos

- **Análisis causal profundo** (variables → actividades → outcomes): descartado.
- **Análisis de interrupciones evitables**: descartado.
- **Datos históricos con variables/causas**: se preservan en localStorage pero no son visibles en la app. (Decisión consciente.)
- **Auto-completion**: ahora el usuario **debe** confirmar cada cierre. Es deliberado: la auto-completion anterior era un agujero de honestidad.

### Lo que se preserva

- **Modelo de 3 tipos de actividad**: define el contrato de duración.
- **QuickBar** (Piloto Automático, Meditación, Descanso).
- **Kanban + bloques de tiempo**: planificación visual.
- **Timeline + estimado vs real**: feedback post-actividad.
- **localStorage como única fuente**: la app sigue siendo offline-first.

---

## Alternativas consideradas

### A. Restaurar el sistema viejo tal cual (per-minute + passive drain)

**Por qué se rechazó**:

- El drain pasivo crea ansiedad en tiempo libre.
- La acumulación per-minute añade complejidad sin beneficio proporcional.
- Los 3 tipos económicos eran sofisticación no utilizada.

### B. Score-at-completion con fórmula aditiva (score + bonus)

**Por qué se rechazó**:

- No media el esfuerzo real (minutos).
- Una tarea de 10 minutos y una de 4 horas valían lo mismo.
- El usuario corrigió con la fórmula porcentual.

### C. Mantener auto-completion con satisfaction retroactiva

**Por qué se rechazó**:

- Rompe la honestidad del ritual. Si el sistema "completa" sin preguntarte, ¿cómo sabe tu score?
- El score retroactivo es bias de confirmación.
- La UI no puede "rellenar" satisfacción de algo que ya pasó sin perder la integridad.

### D. Mantener variables subjetivas con feature flags

**Por qué se rechazó**:

- "Disponible pero opcional" se convierte en "lo vi, me agobia, lo ignoro" para una persona con TDAH.
- Si el usuario quiere análisis a largo plazo, lo construimos como módulo separado después, con su propia justificación.

---

## Plan de implementación (orden estricto)

### Fase 1 — Migración (preparación)

- `persistenceManager.ts`: agregar `CURRENT_SCHEMA_VERSION = 2`, `migrateState()`, versionado en localStorage
- Tests de migración (estado v1 → v2)

### Fase 2 — Modelo aditivo

- `types.ts`: agregar `satisfactionScore`, `temposAwarded`, `beatEstimate` a `CompletedActivityRecord`
- `types.ts`: agregar `dailyTempoTarget` a `UserPreferences`
- `types.ts`: agregar tipos `TempoSummary`, `TempoTrendPoint`
- `utilityService.ts`: agregar `calculateTemposAwarded()` puro

### Fase 3 — Core: separar `requestCompletion` de `completeActivity`

- `activityManager.ts`: refactor `activateActivity()` para **no** auto-completar. Marca como "pendiente de cierre" y emite evento
- `activityManager.ts`: nueva firma `completeActivity(id, { satisfactionScore })` que retorna `CompletionResult`
- `activityManager.ts`: `interruptActivity(id)` simplificado (sin isAvoidable, sin causeId)
- `index.tsx`: exponer en `ISystemCore`
- `analyticsManager.ts`: agregar `getTempoSummary(dayId)`, `getTempoTrends(range)`

### Fase 4 — Feature flags mínimos

- `userPreferencesManager.ts`: defaults seguros, `updateDailyTempoTarget()`
- Tests

### Fase 5 — `CompletionModal` (componente nuevo)

- `modals/CompletionModal.tsx`: slider 0-10, preview en vivo, default score = 7 (= 100% de la base, fórmula MVP v3.1 lineal), botón "No la terminó", heurísticas visibles. `beatEstimate` se muestra como info ("✓ batiste el estimado") sin alterar el score.
- Tests completos

### Fase 6 — Wire `CompletionModal` en todos los paths de cierre

- `KanbanContainer.tsx`: completar desde Kanban → modal
- `QuickBarContainer.tsx`: cambiar actividad → primero muestra modal para la activa (NO auto-complete)
- `DayPage.tsx`: finalizar día → si hay activa, primero modal
- `system/index.tsx`: helper `subscribeToPendingCompletion()` que la UI usa

### Fase 7 — `TempoBanner` siempre visible

- `components/TempoBanner.tsx`: usa `getTempoSummary(currentDayId)`
- Insertar en `DayPage.tsx` arriba

### Fase 8 — Métricas y trends

- `containers/DayMetricsContainer.tsx`
- `components/TrendsView.tsx` con recharts
- Insertar en `OverviewPage` o `OverviewModal`

### Fase 9 — Settings modal

- `modals/SettingsModal.tsx`: input de `dailyTempoTarget`

### Fase 10 — Eliminación destructiva (al final)

- Tipos: eliminar `SubjectiveVariable`, `SubjectiveVariableSnapshot`, `InterruptionCause`, `interruptionData`, `subjectiveVariables`, `subjectiveVariableSnapshots`, `interruptionCauses`, `hiddenSubjectiveVariableIds`, `SubjectiveVariablesData`, `InterruptionStatistics`
- Managers: eliminar `SubjectiveVariableManager`, reducir `InterruptionManager`
- UI: eliminar `VariableModal`, `InterruptionModal`, `SubjectiveChart`, `VariableModalContainer`, `InterruptionModalContainer`
- `ActionButtons.tsx`: quitar entrada "Variables"
- `OverviewModal.tsx`: quitar sección variables
- `ChartsContainer.tsx`: quitar sección variables
- `KanbanContainer.tsx`: quitar `VariableModalContainer`, simplificar interrupt
- `DayPage.tsx`: quitar modal de variables, action button de variables

### Fase 11 — Cleanup tests

- Eliminar tests de features removidas
- Actualizar mocks en `KanbanContainer.test`, `OverviewModal.test`
- Agregar tests de `CompletionModal`, `TempoBanner`, `getTempoSummary`, `calculateTemposAwarded`

### Fase 12 — Docs

- `README.md`: reescribir secciones afectadas
- `docs/pm/user-fluxes/`: actualizar flujos
- `docs/changelog.md`: entrada

### Fase 13 — Validación final

- Lint, typecheck, tests, build, smoke test

---

## Principios extraídos (para futuras decisiones)

1. **El tiempo libre es sagrado**. Nunca drenar, nunca penalizar por inactividad declarada.
2. **La honestidad se concentra en un momento**. Un ritual al cerrar, no fricción continua.
3. **El core calcula, la UI solo evalúa**. La lógica de negocio vive en un lugar.
4. **El esfuerzo es el multiplicador base**. Los tempos reflejan tiempo invertido × calidad auto-evaluada.
5. **La app siempre trata bien al usuario**. Tono positivo, redondeo a favor, defaults optimistas.
6. **Lo complejo vive en el modelo, lo simple vive en la UI**.
7. **Tres métricas, no veinte**. Si no mejora `{tempos, % target, satisfacción}`, no vale.
8. **Dopamina honesta, no artificial**. Sin streaks falsos, sin recompensas por mirar la pantalla.
9. **Una sola vía de cierre**. `requestCompletion` → modal → `completeActivity`. Sin atajos.
10. **El target es un ancla móvil**. Nunca se presenta como deuda.

---

## Riesgos identificados

| Riesgo                                                           | Mitigación                                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| El usuario marca 10/10 siempre                                   | El sistema no lo sabe, pero el usuario sí. Las heurísticas visibles hacen que cada número signifique algo. La auto-evaluación es un acto de integridad personal. |
| El target queda bajo y se supera siempre                         | Es configurable. Ajustar al alza cuando se estabilice.                                                                                                           |
| `activateActivity` refactorizado rompe flujos existentes         | Tests de integración en Fase 3 cubren este caso. La fase 6 (wire) valida end-to-end.                                                                             |
| Datos viejos con `interruptionData.isAvoidable` rompen el modelo | Migración Fase 1 los marca como `temposAwarded: 0` legacy. No se eliminan del localStorage.                                                                      |
| Auto-10 ofende al usuario que legítimamente merece 9             | El mensaje explícito ("Un 10 es justo aquí") hace transparente la preselección. Usuario puede ajustar.                                                           |
| El usuario cierra el modal sin elegir                            | Actividad sigue activa. Sin efecto colateral. UI debe ser clara sobre esto.                                                                                      |

---

## Conclusión

El sistema actual está **sobrediseñado en integridad y subdimensionado en dopamina**. Esta ADR invierte ese balance con tres movimientos:

1. **Restaura el motor de tempos** con un diseño más simple que la versión eliminada.
2. **Consolida la honestidad** en un único ritual que **toda finalización** debe atravesar.
3. **Elimina lo secundario** sin piedad — variables, causas, snapshots, preguntas de evitable.

El resultado: una app donde el usuario abre la app y ve un contador que sube con cada cosa que completa honestamente. Donde su tiempo libre es suyo. Donde los trends semanales muestran si está mejorando. Y donde no hay ansiedad por no estar haciendo nada.

**Es una app para que un cerebro con TDAH se quiera quedar.**
