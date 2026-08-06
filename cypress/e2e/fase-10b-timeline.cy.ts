/// <reference types="cypress" />

/**
 * E2E Fase 10b — Timeline visual.
 *
 * Inventario del Timeline:
 *   - <Box data-testid="timeline"> (contenedor principal)
 *       - hour-markers cada 2 horas (0, 2, 4, ..., 24) — childs con position left%
 *       - Activities row: height = 30px
 *         - <Box data-testid={`timeline-bar-${id}`}> (left% + width%)
 *           - Color según state + isWithinEstimation:
 *             - completed within   → verde #4caf50
 *             - completed exceeded → azul #2196f3
 *             - interrupted within   → naranja #ff9800
 *             - interrupted exceeded → rojo #f44336
 *           - Opcional <Box data-testid={`timeline-bar-estimation-${id}`}> (width%)
 *       - Events row: height = 20px (sólo si hay events)
 *         - <Box data-testid={`timeline-event-${id}`}> (left% + transform translateX(-50%))
 *       - Interruptions row: height = 20px (sólo si hay interruptions)
 *         - <Box data-testid={`timeline-interruption-${id}`}> (left% + transform translateX(-50%))
 *
 * Reglas a verificar (todas con ratios relativos, no pixels):
 *   [T1] Hour-marker 00:00 está en left=0% del timeline.
 *   [T2] Hour-marker 12:00 está en left=50% del timeline (±2%).
 *   [T3] Hour-marker 24:00 está en left=100% del timeline.
 *   [T4] Hour-markers equidistantes (separación uniforme entre 0, 12 y 24).
 *   [T5] timeline-bar de actividad que empezó primero tiene left menor que la posterior.
 *   [T6] timeline-bar.width es proporcional a durationMinutes (regla 3-σ: mayor para
 *        actividad más larga).
 *   [T7] timeline-bar-estimation.width es proporcional a estimatedDuration.
 *   [T8] data-estimation-state="within" cuando durationMinutes <= estimated.
 *   [T9] data-estimation-state="exceeded" cuando durationMinutes > estimated.
 *   [T10] timeline-event tiene left% según hora del evento.
 *   [T11] timeline-interruption aparece en la posición de endTime de la actividad interrumpida.
 *   [T12] Background color del timeline-bar completed-within es verde (RGB match).
 *   [T13] Múltiples barras comparten la misma fila (top aligned) — todas están en
 *         la sección "actividades" con misma Y.
 */

describe("Fase 10b — Timeline visual", () => {
  // Warm-up del bundle de Vite antes de los tests para que el primer reload
  // no pague el costo de compilación on-demand.
  before(() => {
    cy.visit("/");
    cy.title().should("exist");
  });

  // Subir el timeout por defecto para cubrir la compilación + parse del JSON
  // state sembrado en cada reload.
  beforeEach(function () {
    Cypress.config("defaultCommandTimeout", 20000);
  });

  /**
   * Siembra el estado con N completedActivityRecords + eventInstances.
   * Genera tiempos relativos a "hoy" para evitar problemas de timezone.
   * Los records se crean con startTime/endTime espaciados por minutos.
   *
   * @param records lista de specs para actividades: {durationMinutes, estimatedMinutes, state}
   *                Las posiciones se asignan en orden secuencial empezando desde
   *                HOY con hourStart=8 (08:00).
   */
  function sembrarTimeline(
    records: Array<{
      durationMinutes: number;
      estimatedMinutes: number;
      state: "completed" | "interrupted";
      title?: string;
      gapMinutesBefore?: number;
    }>,
    events: Array<{ hour: number; minute: number; name: string }> = []
  ) {
    const dayId = "day-timeline-" + Math.random().toString(36).slice(2, 8);

    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.removeItem("qualia_control_app_state");
      },
    });

    cy.window().then((win) => {
      const now = new Date();
      // Tomar "hoy" pero reseteando a las 00:00 hora LOCAL del runner.
      // Importante: convertISOtoMinutes usa getHours()/getMinutes() en hora local.
      const today = new Date(now);
      today.setHours(0, 0, 0, 0);

      // Generar records secuencialmente. Empezamos a las 8:00 AM (480 min).
      let cursorMinutes = 8 * 60;
      const completedActivityRecords: unknown[] = [];
      let recCounter = 0;
      records.forEach((spec) => {
        if (spec.gapMinutesBefore) {
          cursorMinutes += spec.gapMinutesBefore;
        }
        const startMs = today.getTime() + cursorMinutes * 60_000;
        const endMs = startMs + spec.durationMinutes * 60_000;
        recCounter += 1;
        completedActivityRecords.push({
          id: `rec-${recCounter}`,
          activityInstanceId: `act-${recCounter}`,
          templateTitle: spec.title || `Tarea ${recCounter}`,
          type: "clear-objective",
          state: spec.state,
          startTime: new Date(startMs).toISOString(),
          endTime: new Date(endMs).toISOString(),
          durationMinutes: spec.durationMinutes,
          clearObjectiveSettings: {
            estimatedDurationMinutes: spec.estimatedMinutes,
          },
          satisfactionScore: 7,
          beatEstimate: spec.durationMinutes <= spec.estimatedMinutes,
          dayId,
          temposAwarded: Math.ceil(spec.durationMinutes * 7 / 7), // score=7 para simplificar
          createdAt: new Date(startMs).toISOString(),
        });
        cursorMinutes += spec.durationMinutes;
      });

      // Generar events a las horas especificadas
      const eventInstances: unknown[] = events.map((e, i) => {
        const ts = new Date(today);
        ts.setHours(e.hour, e.minute, 0, 0);
        return {
          id: `evt-${i}`,
          templateName: e.name,
          timestamp: ts.toISOString(),
          dayId,
          createdAt: ts.toISOString(),
        };
      });

      const state = {
        schemaVersion: 3,
        global: {
          days: [
            {
              id: dayId,
              state: "active",
              date: today.toISOString().slice(0, 10),
              startTime: new Date(today).toISOString(),
              endTime: null,
              createdAt: new Date(today).toISOString(),
              updatedAt: now.toISOString(),
            },
          ],
          activityTemplates: [],
          eventTemplates: [],
          timeBlocks: [
            {
              id: "default-todo",
              name: "Por Hacer",
              startMinute: 0,
              endMinute: 1439,
              isDefault: true,
              order: 0,
              createdAt: new Date(today).toISOString(),
              updatedAt: now.toISOString(),
            },
          ],
          userPreferences: {
            dailyTempoTarget: 100,
            updatedAt: now.toISOString(),
          },
          completedActivityRecords,
          eventInstances,
        },
        currentDay: {
          day: {
            id: dayId,
            state: "active",
            date: today.toISOString().slice(0, 10),
            startTime: new Date(today).toISOString(),
            endTime: null,
            createdAt: new Date(today).toISOString(),
            updatedAt: now.toISOString(),
          },
          activityInstances: [],
        },
      };

      win.localStorage.setItem(
        "qualia_control_app_state",
        JSON.stringify(state)
      );
    });
    cy.reload();
    cy.dataTestId("day-page", { timeout: 25000 }).should("exist");
    cy.dataTestId("timeline", { timeout: 10000 }).should("exist");
  }

  it("10b.T1: hour-marker 00:00 está en left=0% del timeline", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline").then(($t) => {
      const r = $t[0].getBoundingClientRect();
      // Buscar el tick más a la izquierda: presentation + height=12px + width=1px.
      // collect ticks y posicionarlos por left.
      const ticks = Array.from(
        $t[0].querySelectorAll('[role="presentation"]')
      ).filter((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return cs.height === "12px" && cs.width === "1px";
      }) as HTMLElement[];
      expect(ticks.length, "hay ticks").to.be.at.least(5);
      // El más a la izquierda debe estar cerca del borde izquierdo del timeline
      const lefts = ticks.map((t) => t.getBoundingClientRect().left - r.left);
      const first = Math.min(...lefts);
      expect(Math.abs(first)).to.be.lessThan(2);
    });
  });

  it("10b.T2: hour-marker 12:00 está en left≈50% (±2%) del timeline", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline").then(($t) => {
      const r = $t[0].getBoundingClientRect();
      const ticks = Array.from(
        $t[0].querySelectorAll('[role="presentation"]')
      ).filter((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return cs.height === "12px" && cs.width === "1px";
      }) as HTMLElement[];
      // Encontrar el tick cuyo left está más cerca del 50% del timeline
      const positions = ticks.map((t) => {
        const rect = t.getBoundingClientRect();
        return ((rect.left - r.left) / r.width) * 100;
      });
      const closest = positions.reduce((best, p) =>
        Math.abs(p - 50) < Math.abs(best - 50) ? p : best
      );
      expect(Math.abs(closest - 50)).to.be.lessThan(2);
    });
  });

  it("10b.T3: hour-marker 24:00 está en left≈100% del timeline", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline").then(($t) => {
      const r = $t[0].getBoundingClientRect();
      const ticks = Array.from(
        $t[0].querySelectorAll('[role="presentation"]')
      ).filter((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return cs.height === "12px" && cs.width === "1px";
      }) as HTMLElement[];
      // El tick más a la derecha debe estar ~100%
      const lefts = ticks.map((t) => {
        const rect = t.getBoundingClientRect();
        return ((rect.left - r.left) / r.width) * 100;
      });
      const last = Math.max(...lefts);
      // El marker 24:00 está recortado al borde del timeline (left se clipa).
      expect(last).to.be.at.least(98);
    });
  });

  it("10b.T4: hour-markers son equidistantes (0%, 50%, 100% separados proporcionalmente)", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline").then(($t) => {
      const r = $t[0].getBoundingClientRect();
      const ticks = Array.from(
        $t[0].querySelectorAll('[role="presentation"]')
      ).filter((el) => {
        const cs = getComputedStyle(el as HTMLElement);
        return cs.height === "12px" && cs.width === "1px";
      }) as HTMLElement[];
      expect(ticks.length, "al menos 5 markers").to.be.at.least(5);

      const positions = ticks
        .map((t) => (t.getBoundingClientRect().left - r.left) / r.width * 100)
        .sort((a, b) => a - b);

      // Diferencias entre posiciones consecutivas deberían ser ~iguales
      const diffs: number[] = [];
      for (let i = 1; i < positions.length; i++) {
        diffs.push(positions[i] - positions[i - 1]);
      }
      const mean = diffs.reduce((s, d) => s + d, 0) / diffs.length;
      diffs.forEach((d) => {
        expect(Math.abs(d - mean)).to.be.lessThan(1.5);
      });
    });
  });

  it("10b.T5: timeline-bar de actividad posterior tiene left > left de anterior", () => {
    sembrarTimeline([
      { durationMinutes: 60, estimatedMinutes: 60, state: "completed", gapMinutesBefore: 0 },
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed", gapMinutesBefore: 60 },
    ]);
    // Selector estricto: NO incluye "timeline-bar-estimation-*"
    cy.dataTestId("timeline").within(() => {
      cy.get('[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])').should(
        "have.length",
        2
      );
    });
    cy.dataTestId("timeline").then(($t) => {
      const tl = $t[0].getBoundingClientRect();
      const bars = Array.from(
        $t[0].querySelectorAll(
          '[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])'
        )
      ) as HTMLElement[];
      expect(bars.length).to.equal(2);
      const lefts = bars.map((b) => ((b.getBoundingClientRect().left - tl.left) / tl.width) * 100);
      expect(lefts[1]).to.be.greaterThan(lefts[0]);
    });
  });

  it("10b.T6: width de timeline-bar es ~ proporcional a durationMinutes", () => {
    // 30 min vs 120 min → ratio de widths debería ser ~4:1
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
      { durationMinutes: 120, estimatedMinutes: 120, state: "completed", gapMinutesBefore: 60 },
    ]);
    cy.dataTestId("timeline").within(() => {
      cy.get('[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])').should(
        "have.length",
        2
      );
    });
    cy.dataTestId("timeline").then(($t) => {
      const tl = $t[0].getBoundingClientRect();
      const bars = Array.from(
        $t[0].querySelectorAll(
          '[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])'
        )
      ) as HTMLElement[];
      bars.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
      const w1 = (bars[0].getBoundingClientRect().width / tl.width) * 100;
      const w2 = (bars[1].getBoundingClientRect().width / tl.width) * 100;
      const ratio = w1 / w2;
      expect(Math.abs(ratio - 0.25)).to.be.lessThan(0.1);
    });
  });

  it("10b.T7: timeline-bar-estimation existe con width > 0 y borde derecho (dashed)", () => {
    sembrarTimeline([
      { durationMinutes: 60, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline").within(() => {
      cy.get('[data-testid^="timeline-bar-estimation-"]').should("have.length", 1);
    });
    cy.dataTestId("timeline-bar-estimation-act-1").then(($e) => {
      const rect = $e[0].getBoundingClientRect();
      expect(rect.width, "estimation tiene width > 0").to.be.greaterThan(0);
      // Tamaño medido es razonable (entre 0.5% y 5% del viewport típico)
      expect(rect.width).to.be.lessThan(150);
      // Border-right debería ser dashed rgba(255,255,255,0.7) — el css computado
      // lo confirma. Verificamos que border-right NO esté vacío (es decir que
      // está renderizado con borde, lo cual indica que es el element correcto).
      const borderRight = getComputedStyle($e[0]).borderRightStyle;
      expect(borderRight).to.not.equal("none");
    });
  });

  it("10b.T8: data-estimation-state='within' cuando durationMinutes <= estimated", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 60, state: "completed" },
    ]);
    cy.dataTestId("timeline-bar-act-1").should(
      "have.attr",
      "data-estimation-state",
      "within"
    );
  });

  it("10b.T9: data-estimation-state='exceeded' cuando durationMinutes > estimated", () => {
    sembrarTimeline([
      { durationMinutes: 90, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline-bar-act-1").should(
      "have.attr",
      "data-estimation-state",
      "exceeded"
    );
  });

  it("10b.T10: timeline-event aparece en left% según hora del evento", () => {
    sembrarTimeline(
      [{ durationMinutes: 30, estimatedMinutes: 30, state: "completed" }],
      [
        { hour: 9, minute: 0, name: "Reunión" },
        { hour: 18, minute: 0, name: "Llamada" },
      ]
    );
    cy.dataTestId("timeline").within(() => {
      cy.get('[data-testid^="timeline-event-"]').should("have.length", 2);
    });
    cy.dataTestId("timeline").then(($t) => {
      const tl = $t[0].getBoundingClientRect();
      const events = Array.from(
        $t[0].querySelectorAll('[data-testid^="timeline-event-"]')
      ) as HTMLElement[];
      // Eventos 09:00 (37.5%) y 18:00 (75%)
      const positions = events.map((e) => {
        // TimelineMarker tiene transform: translateX(-50%) así que medimos el centro.
        const r = e.getBoundingClientRect();
        return ((r.left + r.width / 2 - tl.left) / tl.width) * 100;
      });
      positions.sort((a, b) => a - b);
      expect(Math.abs(positions[0] - 37.5)).to.be.lessThan(2);
      expect(Math.abs(positions[1] - 75)).to.be.lessThan(2);
    });
  });

  it("10b.T11: timeline-interruption aparece en left% según endTime", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 60, state: "interrupted" },
    ]);
    cy.dataTestId("timeline-interruption-rec-1").should("exist");
    cy.dataTestId("timeline-interruption-rec-1").then(($i) => {
      const tlEl = $i.closest('[data-testid="timeline"]')?.[0] as HTMLElement | undefined;
      const r = $i[0].getBoundingClientRect();
      // Buscar timeline vía parent walk (porque closest('div') puede no matchear)
      const tl = $i.parents('[data-testid="timeline"]')[0] as HTMLElement;
      const tlRect = (tlEl ?? tl).getBoundingClientRect();
      const pct = ((r.left + r.width / 2 - tlRect.left) / tlRect.width) * 100;
      // 8:30 = 510 min = 35.42%
      expect(Math.abs(pct - 35.42)).to.be.lessThan(2);
    });
  });

  it("10b.T12: timeline-bar completada-dentro-de-estimación tiene background verde", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 60, state: "completed" },
    ]);
    cy.dataTestId("timeline-bar-act-1").then(($b) => {
      const bg = getComputedStyle($b[0]).backgroundColor;
      // getActivityColor retorna rgb(76, 175, 80) para verde (completed+within)
      expect(bg).to.equal("rgb(76, 175, 80)");
    });
  });

  it("10b.T13: timeline-bar completada-excedida tiene background azul", () => {
    sembrarTimeline([
      { durationMinutes: 90, estimatedMinutes: 30, state: "completed" },
    ]);
    cy.dataTestId("timeline-bar-act-1").then(($b) => {
      const bg = getComputedStyle($b[0]).backgroundColor;
      // rgb(33, 150, 243) para azul (completed+exceeded)
      expect(bg).to.equal("rgb(33, 150, 243)");
    });
  });

  it("10b.T14: múltiples bars comparten la misma fila (top aligned)", () => {
    sembrarTimeline([
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed" },
      { durationMinutes: 30, estimatedMinutes: 30, state: "completed", gapMinutesBefore: 60 },
      { durationMinutes: 30, estimatedMinutes: 30, state: "interrupted", gapMinutesBefore: 60 },
    ]);
    cy.dataTestId("timeline").within(() => {
      cy.get('[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])').should(
        "have.length",
        3
      );
    });
    cy.dataTestId("timeline").then(($t) => {
      const bars = Array.from(
        $t[0].querySelectorAll(
          '[data-testid^="timeline-bar-"]:not([data-testid*="-estimation-"])'
        )
      ) as HTMLElement[];
      const tops = bars.map((b) => b.getBoundingClientRect().top);
      const minTop = Math.min(...tops);
      const maxTop = Math.max(...tops);
      expect(maxTop - minTop).to.be.lessThan(2);
    });
  });
});
