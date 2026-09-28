# ADR-001 — Tempo System: Design, Restoration, and Simplification

**Status**: Accepted (with corrections)
**Date**: 2026-08-04
**Decision**: Implement a tempo system with a percentage formula + honest self-assessment on completion, removing secondary features that do not contribute to the integrity of the contract.

---

## Context

### The project's real problem

The app has a **solid and complete data model**, but it lacks the **dopamine engine** that justifies the user keeping the discipline of using it. Specifically:

1. **The tempo system existed, was sophisticated, and was removed** in a "restart" commit (`ff29264`).
2. **The current code preserves the honesty infrastructure** (subjective variables, interruption causes, causal snapshots) **but has none of the reward engine** that infrastructure was designed to serve.
3. **The current cognitive-load ratio is 80/0**: 80% invested in setting up the contract (variables, causes, types), 0% in receiving the visible reward. For a daily user, this ratio is unsustainable — willpower runs out with no visible return.
4. **The core currently completes activities implicitly** from `activateActivity()` (auto-completes the previous one), from `QuickBarContainer` (on switch), and from `DayPage.handleEndDayConfirm` (on closing the day). This conflicts with the mandatory assessment ritual.

### What the user already knew (and the current system does not reflect)

The old system (commits `0e54bb5`, `30bf872`, `b784b29`, `7f2e41b`, `b6199c3`) implemented:

| Concept                                                  | Meaning                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `totalTempoBalance` / `dayTempoBalance`                  | Double tracking: historical + daily                  |
| `passiveTempoConsumptionRate`                            | Idle time drained tempos (problematic design)        |
| `tempoGeneratingMinutes` with a per-activity cap         | You generated tempo only up to `totalTempoReward`    |
| 3 economic types: `challenge` / `neutral` / `discount`   | Different generation/consumption rates               |
| `expirationConstraints` with `penaltyAmount`             | Expirations applied penalties                        |
| `tempoModificationHistory`                               | Auditable history of changes                         |

---

## Decision

### What I mean

Build a tempo system with all of the following properties at once:

1. **Immutable reward, not a currency**: `temposAwarded` is stored on each completed activity. No ledger, no mutable balance, no spending. The day's total is derived by summing records.

2. **Honest linear formula, computed by the core (MVP v3.1)**:

   `tempos = ceil(baseMinutes × score / 7)`. The scale is linear: each
   slider point increases the reward by ~14% of the base. There is no
   threshold: score 1 already rewards something, score 0 does not.

   ```
   // score 0  → 0%   (did not complete; honesty coherence)
   // score 1  → 14%  (1/7)
   // score 5  → 71%  (5/7)
   // score 7  → 100% (slider default: "You did it")
   // score 10 → 143% (10/7)
   //
   // base = estimated minutes (if any) | actual duration (otherwise)
   //
   // If durationMinutes === 0 but there is an estimate > 0, the estimate is used
   // (the reward is not lost for confirming within the first 30 seconds).
   ```

   **Why 7 as the divisor**: 7 = 100% (score 7 = 1.0×). It is a natural
   number for the 0-10 scale. Other common values (10) would make
   score 5 = 50% and leave little range between "I did it" (5) and "I
   did it perfectly" (10); 7 gives 71% at score 5 and 143% at score 10,
   allowing a finer reflection of perceived effort.

   **Why linear and not a table**: the previous table (MVP v3 with
   7-10 thresholds) made scores 1-6 worth 0 tempos, which contradicted
   the idea that "any progress counts for something". With the linear
   formula, a 30-minute task at score 5 yields 22 tempos (instead of 0),
   and score 1 yields 5. This reflects the user's effort better.

   **Why the base is the estimate (not the actual duration)**:

   If the user honestly confirms a task after 30 seconds (before
   completing the first minute and, with `Math.round`, a 0), they should
   still receive the corresponding reward. Rewarding on the estimate
   eliminates the classic "0 tempos because I just started" bug. It is
   also coherent with the "free time is free time" decision: we do not
   charge the user for not having waited longer.

   Only when there is **no estimate** (flexible-duration, timeboxing
   without a range) is the actual duration used as the base.

3. **The user decides, no automatic heuristics**:

   Unlike the original design (where `beatEstimate` (formerly
   `canApplyBonus`) auto-pushed the slider to 10 when the estimate was
   beaten), in MVP v3 the bonus is
   always an explicit user decision on the slider:

   - **`beatEstimate`**: kept as an informative record metric
     (shown in CompletionModal as "✓ beat the estimate") and in
     `CompletedActivityRecord.beatEstimate`, but it does **NOT** modify
     the initial score or grant an automatic bonus.
   - Default slider score when the modal opens: **always 7** (= 100% of the base).
   - The user explicitly decides whether their satisfaction deserves 8, 9, or 10;
     the preview shows the exact reward per the linear formula.

4. **Activity types and `beatEstimate`** (computed in the core):

   - **`clear-objective`**: has a point estimate. `beatEstimate` is
     computed to show as info, but does NOT modify the formula.
   - **`flexible-duration`**: informative range, no point estimate.
   - **`timeboxing`**: intentional window (respect it, don't beat it).

5. **Free time is free time**: no passive drain, no penalty for doing nothing. Time outside declared activities **costs nothing**.

6. **A single closing ritual**: `CompletionModal`. Every activity completion — completing, switching to another, closing the day, finishing a timebox — goes through it.

7. **The target is guidance, not obligation**: it is shown as `"42% of your daily reference"`, **never** as `"580 tempos to go"`.

8. **Minimal interruptions**: only `state: "interrupted"` and `durationMinutes` are recorded. No configurable causes, no avoidable question, no causal snapshot. They earn no tempos and subtract nothing.

9. **Subjective variables out of the product**: no modal, no charts, no visible feature flag. If historical data exists, it is preserved in localStorage but is neither shown nor part of the logic.

### Why

#### Tempos as a reward, not a currency

Calling it `balance` promised a spending mechanic that does not exist and could confuse future design. In this version: each completed activity earns N tempos exactly once. The day's total = the sum. Simple, derivable, no extra mutable state.

#### The core computes, the UI only assesses

The UI never recomputes the formula. It only sends:

```ts
{
  satisfactionScore: number;
}
```

The core applies the linear formula `ceil(baseMinutes × score / 7)`, decides
the base (estimate vs actual duration), computes the total, and returns:

```ts
{
  record: CompletedActivityRecord,
  temposAwarded: number,
  dailyTempoTotal: number,
  targetProgress: number,   // real uncapped ratio (can be > 1)
  beatEstimate: boolean
}
```

Important: `targetProgress` is **the real uncapped ratio**; it can
be > 1 if the user exceeds their daily target (e.g. 184 / 100 = 1.84).
The UI shows this ratio uncapped in `displayPercent` and capped at 100 in
`progressBarValue`.

This prevents the UI, a future API, or an external client from
implementing different rules.

#### The bonus only where there is a point estimate

`clear-objective` has a concrete number (`~45 min`). It is the only case where "beating" makes sense.

`flexible-duration` has a range (`5-10 min`). Beating a range is not a clear concept.

`timeboxing` has an intentional window (a minimum or a maximum). The goal is not to beat it but to respect it.

That is why only the first type computes `beatEstimate`, and purely as an
**informative metric**: it does not modify the slider's initial score nor
grant an automatic bonus. The user explicitly decides the bonus
by moving the slider to 8/9/10.

#### Score 0 = 0 tempos total

If the user assesses with 0, they are saying "this doesn't count". For
coherence, there are no tempos. Scores 1-10 always reward something,
scaling linearly from 14% (score 1) to 143% (score 10).

#### A single closing path: `requestCompletion` → modal → `completeActivity`

The core exposes two explicit methods:

```ts
// the UI invokes this when it wants to close an activity
requestCompletion(activityId): CompletionRequest
// → the UI opens CompletionModal with the necessary info

// the UI invokes this when the user confirms in the modal
completeActivity(
  id: UUID,
  assessment: { satisfactionScore: number }
): CompletionResult
```

`activateActivity` no longer auto-completes the previous activity. Instead, it marks the current activity as "pending closure" and the UI shows the modal before proceeding.

This applies to:

- completing from the Kanban ("Complete" button)
- switching activities from the QuickBar
- ending the day
- a timebox finishing automatically (the user is alerted)

#### Target = guidance

`dailyTempoTarget` is a configurable number (default 100). The UI shows it as a percentage of the day:

```text
Today: 42 / 100 tempos   (42% of your daily reference)
```

Never:

```text
580 tempos to go   ❌ (never this)
```

#### Interruptions without moral judgment

An interruption is just a record of "what I was doing ended without being completed". There is no "was it avoidable?" question, because that judgment demands something from the user that, in the hot moment, they cannot give well. Only:

```ts
{ state: "interrupted", durationMinutes, dayId, ... }
```

No tempos, no penalty, no cause. The system learns from completions, not from interruptions.

---

## Domain contract and transitions

### Model types

```typescript
interface CompletedActivityRecord {
  // existing
  id: UUID;
  activityInstanceId: UUID;
  templateId: UUID;
  templateTitle: string;
  type: ActivityType;
  startTime: ISODateTimeString;
  endTime: ISODateTimeString;
  durationMinutes: number;
  dayId: UUID;

  // type settings (preserve how it was run)
  clearObjectiveSettings?: { estimatedDurationMinutes: number };
  flexibleDurationSettings?: { minimumDurationMinutes: number; maximumDurationMinutes: number };
  timeboxingSettings?: {
    type: TimeboxingType;
    minimumDurationMinutes?: number;
    maximumDurationMinutes?: number;
  };

  // new
  satisfactionScore: number; // 0-10 (integer)
  temposAwarded: number; // immutable, derived on completion
  beatEstimate: boolean; // computed on completion

  createdAt: ISODateTimeString;
}

interface UserPreferences {
  updatedAt: ISODateTimeString;
  dailyTempoTarget: number; // default 100
}

interface TempoSummary {
  totalTempos: number; // for the day
  target: number; // configured
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

### Core API

```typescript
interface ISystemCore {
  // ...existing methods...

  // Tempo system
  requestCompletion(activityId: UUID): {
    activityTitle: string;
    durationMinutes: number;
    estimatedMinutes?: number; // only for clear-objective
    /**
     * MVP v3: informative metric only (does not affect the formula).
     * Indicates whether the activity was completed before 80% of the estimate.
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

  interruptActivity(activityId: UUID): CompletedActivityRecord; // simplified, no extra args

  getTempoSummary(dayId: UUID): TempoSummary;
  getTempoTrends(range: { from: string; to: string }): TempoTrendPoint[];
}
```

### Explicit edge rules

| Case                                                          | Behavior                                                                                                                                   |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `durationMinutes <= 0`                                        | `temposAwarded = 0` (no reward for null time)                                                                                              |
| `satisfactionScore` outside `[0,10]`                          | Validation error, no completion                                                                                                            |
| `satisfactionScore === 0`                                     | `temposAwarded = 0` (coherence)                                                                                                            |
| Activity already completed (double click)                     | The second `completeActivity` throws; the UI must prevent it                                                                               |
| User abandons the modal (closes without confirming)           | The activity stays active; nothing is recorded                                                                                             |
| Interrupted activity                                          | A `CompletedActivityRecord` is created with `state: "interrupted"` and `satisfactionScore: 0` (no question, no score, no tempos)           |
| Auto-completion from `activateActivity` or a QuickBar switch  | `activateActivity` now does **not** auto-complete. It marks "pending closure" and emits an event so the UI shows the modal                 |
| Migration from old state                                      | `schemaVersion` is bumped; records without `satisfactionScore` keep a legacy `temposAwarded = 0`                                           |

---

## Features REMOVED from the current design

### Fully removed

| Feature                                                             | Reason for removal                                                                                        |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| **Subjective variables** (Energy, Mood, Focus, Stress)               | They do not contribute to tempo integrity. Keeping them (even behind a flag) preserves complexity without benefit. |
| **Subjective variable snapshots**                                    | Retrospective analysis is not essential.                                                                  |
| **Activity↔snapshot causal multiselect**                             | Same reason.                                                                                              |
| **Custom interruption causes**                                       | The system only needs "interrupted or not".                                                               |
| **`isAvoidable` in `CompletedActivityRecord.interruptionData`**      | Removed. No moral judgment in the hot moment.                                                             |
| **5-minute time restriction between variable updates**               | No variables, so it does not apply.                                                                       |
| **`canUpdateVariables`**                                             | Removed.                                                                                                  |
| **`SubjectiveChart`** and the whole variable chart system            | Removed.                                                                                                  |
| **`SubjectiveVariableManager`**                                      | Removed.                                                                                                  |
| **`InterruptionManager`**                                            | Reduced to `interruptActivity(id)` without isAvoidable/causeId.                                           |
| **"Was it avoidable?" question in `InterruptionModal`**              | Removed.                                                                                                  |
| **Subjective variables section in `OverviewModal`**                  | Removed.                                                                                                  |
| **"Variables" button in `ActionButtons`**                            | Removed.                                                                                                  |
| **ChartsContainer subjective section**                               | Removed.                                                                                                  |
| **Variable visibility toggle**                                       | Removed.                                                                                                  |

### What survives with changes

- **`InterruptionModal`**: **removed**. Replaced by a direct action ("Didn't finish it" button on the card → snackbar).
- **`KanbanContainer.handleInterruptActivity`**: simplified. No modal. Calls `interruptActivity(id)` directly and shows a positive snackbar.
- **`DayMetricsContainer` and `TrendsView`**: **new**. They replace the variables/interruptions complexity with simple metrics.

---

## UI model: CompletionModal

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│   You finished "Write report"                       │
│                                                     │
│   Actual time: 38 min                               │
│   Estimate: 45 min    ✓ 7 min early                 │
│                                                     │
│   How satisfied are you with what you did?          │
│                                                     │
│   ━━━━━●━━━━━━━━  5/10                              │
│   "I did the minimum, no extras. That's fine."      │
│                                                     │
│   ┌───────────────────────────────────────┐         │
│   │  30 min × 5/7  ≈  22 tempos           │         │
│   │  ═══════════════════════════════       │         │
│   │  TOTAL                  22 tempos      │         │
│   └───────────────────────────────────────┘         │
│                                                     │
│   [ Save and receive 22 tempos ]                    │
│   [ Didn't finish it ]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- **No auto-10**. The slider always starts at 7 (100% of the base). The user explicitly decides whether their satisfaction deserves more (score 8/9/10) or less (score 1-6). `beatEstimate` is kept as an informative metric (shown as "✓ beat the estimate") but does not bias the score.
- **The "Didn't finish it" button** is always present. It calls `interruptActivity(id)`, records the interruption with no tempos, and shows a positive snackbar: _"That's fine. Tomorrow is another chance."_
- If the user closes the modal without choosing, the activity stays active. Nothing is recorded.

---

## Always-visible banner

```
┌─────────────────────────────────────────────────────┐
│  Today: 42 / 100 tempos   ████░░░░  42% of your   │
│                                     daily reference  │
│                                                     │
│  Last: Write report  ·  +309 tempos                 │
└─────────────────────────────────────────────────────┘
```

The counter **only goes up** on completion. It never drains. The target is a moving anchor, not a ceiling.

---

## Persistence: versioning and migration

```typescript
const CURRENT_SCHEMA_VERSION = 2;

interface MigrationResult {
  state: AppState;
  migrated: boolean;
  warnings: string[];
}
```

Migration v1 → v2:

- Adds `dailyTempoTarget: 100` if missing from `userPreferences`.
- Old `completedActivityRecords` keep `temposAwarded: 0`, `satisfactionScore: 0`, `beatEstimate: false`.
- `subjectiveVariables`, `subjectiveVariableSnapshots`, `interruptionCauses` are **preserved** in localStorage (not deleted), but are **not loaded** into `AppState`. If the user exports their data, they are included as a historical file.
- `interruptionData.isAvoidable` is ignored.
- If schemaVersion is missing, v1 is assumed and migrated.

---

## Explicit trade-offs

### What we gain

- **An app with a clear purpose**: continuous dopamine without anxiety, without drain.
- **Free time protected**: leisure costs nothing.
- **Concentrated honesty**: a single moment, a single decision.
- **Business logic in the core**: the UI never recomputes anything.
- **Robust persistence**: schemaVersion prevents future breakage.
- **Clear API**: `requestCompletion` / `completeActivity` with an explicit contract.

### What we lose

- **Deep causal analysis** (variables → activities → outcomes): dropped.
- **Avoidable-interruption analysis**: dropped.
- **Historical data with variables/causes**: preserved in localStorage but not visible in the app. (A conscious decision.)
- **Auto-completion**: the user now **must** confirm every closure. This is deliberate: the old auto-completion was an honesty hole.

### What is preserved

- **The 3-activity-type model**: defines the duration contract.
- **QuickBar** (Autopilot, Meditation, Break).
- **Kanban + time blocks**: visual planning.
- **Timeline + estimate vs actual**: post-activity feedback.
- **localStorage as the only source**: the app remains offline-first.

---

## Alternatives considered

### A. Restore the old system as-is (per-minute + passive drain)

**Why rejected**:

- Passive drain creates anxiety during free time.
- Per-minute accumulation adds complexity with no proportional benefit.
- The 3 economic types were unused sophistication.

### B. Score-at-completion with an additive formula (score + bonus)

**Why rejected**:

- It did not measure real effort (minutes).
- A 10-minute task and a 4-hour task were worth the same.
- The user corrected it with the percentage formula.

### C. Keep auto-completion with retroactive satisfaction

**Why rejected**:

- It breaks the ritual's honesty. If the system "completes" without asking you, how does it know your score?
- A retroactive score is confirmation bias.
- The UI cannot "fill in" satisfaction for something that already happened without losing integrity.

### D. Keep subjective variables behind feature flags

**Why rejected**:

- "Available but optional" becomes "I saw it, it overwhelms me, I ignore it".
- If the user wants long-term analysis, we build it later as a separate module, with its own justification.

---

## Implementation plan (strict order)

### Phase 1 — Migration (preparation)

- `persistenceManager.ts`: add `CURRENT_SCHEMA_VERSION = 2`, `migrateState()`, localStorage versioning
- Migration tests (v1 → v2 state)

### Phase 2 — Additive model

- `types.ts`: add `satisfactionScore`, `temposAwarded`, `beatEstimate` to `CompletedActivityRecord`
- `types.ts`: add `dailyTempoTarget` to `UserPreferences`
- `types.ts`: add `TempoSummary`, `TempoTrendPoint` types
- `utilityService.ts`: add a pure `calculateTemposAwarded()`

### Phase 3 — Core: separate `requestCompletion` from `completeActivity`

- `activityManager.ts`: refactor `activateActivity()` to **not** auto-complete. Marks "pending closure" and emits an event
- `activityManager.ts`: new signature `completeActivity(id, { satisfactionScore })` returning `CompletionResult`
- `activityManager.ts`: simplified `interruptActivity(id)` (no isAvoidable, no causeId)
- `index.tsx`: expose on `ISystemCore`
- `analyticsManager.ts`: add `getTempoSummary(dayId)`, `getTempoTrends(range)`

### Phase 4 — Minimal feature flags

- `userPreferencesManager.ts`: safe defaults, `updateDailyTempoTarget()`
- Tests

### Phase 5 — `CompletionModal` (new component)

- `modals/CompletionModal.tsx`: 0-10 slider, live preview, default score = 7 (= 100% of the base, linear MVP v3.1 formula), "Didn't finish it" button, visible heuristics. `beatEstimate` is shown as info ("✓ beat the estimate") without altering the score.
- Full tests

### Phase 6 — Wire `CompletionModal` into every closing path

- `KanbanContainer.tsx`: complete from Kanban → modal
- `QuickBarContainer.tsx`: switch activity → first show the modal for the active one (NO auto-complete)
- `DayPage.tsx`: end day → if one is active, modal first
- `system/index.tsx`: `subscribeToPendingCompletion()` helper used by the UI

### Phase 7 — Always-visible `TempoBanner`

- `components/TempoBanner.tsx`: uses `getTempoSummary(currentDayId)`
- Insert at the top of `DayPage.tsx`

### Phase 8 — Metrics and trends

- `containers/DayMetricsContainer.tsx`
- `components/TrendsView.tsx` with recharts
- Insert into `OverviewPage` or `OverviewModal`

### Phase 9 — Settings modal

- `modals/SettingsModal.tsx`: `dailyTempoTarget` input

### Phase 10 — Destructive removal (last)

- Types: remove `SubjectiveVariable`, `SubjectiveVariableSnapshot`, `InterruptionCause`, `interruptionData`, `subjectiveVariables`, `subjectiveVariableSnapshots`, `interruptionCauses`, `hiddenSubjectiveVariableIds`, `SubjectiveVariablesData`, `InterruptionStatistics`
- Managers: remove `SubjectiveVariableManager`, reduce `InterruptionManager`
- UI: remove `VariableModal`, `InterruptionModal`, `SubjectiveChart`, `VariableModalContainer`, `InterruptionModalContainer`
- `ActionButtons.tsx`: remove the "Variables" entry
- `OverviewModal.tsx`: remove the variables section
- `ChartsContainer.tsx`: remove the variables section
- `KanbanContainer.tsx`: remove `VariableModalContainer`, simplify interrupt
- `DayPage.tsx`: remove the variables modal and variables action button

### Phase 11 — Test cleanup

- Remove tests for removed features
- Update mocks in `KanbanContainer.test`, `OverviewModal.test`
- Add tests for `CompletionModal`, `TempoBanner`, `getTempoSummary`, `calculateTemposAwarded`

### Phase 12 — Docs

- `README.md`: rewrite affected sections
- `docs/pm/user-fluxes/`: update flows
- `docs/changelog.md`: entry

### Phase 13 — Final validation

- Lint, typecheck, tests, build, smoke test

---

## Extracted principles (for future decisions)

1. **Free time is sacred**. Never drain, never penalize declared inactivity.
2. **Honesty is concentrated in one moment**. One ritual at closing, not continuous friction.
3. **The core computes, the UI only assesses**. Business logic lives in one place.
4. **Effort is the base multiplier**. Tempos reflect time invested × self-assessed quality.
5. **The app always treats the user well**. Positive tone, rounding in their favor, optimistic defaults.
6. **The complex lives in the model, the simple lives in the UI**.
7. **Three metrics, not twenty**. If it doesn't improve `{tempos, % of target, satisfaction}`, it isn't worth it.
8. **Honest dopamine, not artificial**. No fake streaks, no rewards for staring at the screen.
9. **A single closing path**. `requestCompletion` → modal → `completeActivity`. No shortcuts.
10. **The target is a moving anchor**. Never presented as a debt.

---

## Identified risks

| Risk                                                             | Mitigation                                                                                                                                                       |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The user always marks 10/10                                      | The system doesn't know, but the user does. The visible heuristics make each number mean something. Self-assessment is an act of personal integrity.             |
| The target stays low and is always exceeded                      | It is configurable. Raise it once things stabilize.                                                                                                              |
| A refactored `activateActivity` breaks existing flows            | Integration tests in Phase 3 cover this case. Phase 6 (wiring) validates end-to-end.                                                                             |
| Old data with `interruptionData.isAvoidable` breaks the model    | Phase 1 migration marks them as legacy `temposAwarded: 0`. They are not deleted from localStorage.                                                               |
| Auto-10 offends a user who legitimately deserves a 9             | The explicit message ("A 10 is fair here") makes the preselection transparent. The user can adjust.                                                              |
| The user closes the modal without choosing                       | The activity stays active. No side effects. The UI must be clear about this.                                                                                     |

---

## Conclusion

The current system is **over-engineered on integrity and under-built on dopamine**. This ADR inverts that balance with three moves:

1. **Restore the tempo engine** with a simpler design than the removed version.
2. **Consolidate honesty** into a single ritual that **every completion** must pass through.
3. **Remove the secondary** without mercy — variables, causes, snapshots, avoidability questions.

The result: an app where the user opens it and sees a counter that goes up with every thing they honestly complete. Where their free time is theirs. Where weekly trends show whether they are improving. And where there is no anxiety about not doing anything.

**It's an app you want to stay in.**
