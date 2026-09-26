/**
 * Genera las capturas del README (inglés, tema oscuro) con datos de demo.
 * No forma parte de la suite normal: se ejecuta a mano con
 *   npx cypress run --spec cypress/e2e/readme-screenshots.cy.ts --config-file cypress.screenshots.config.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const seed = (win: any) => {
  const q = win.__lifeui;
  // Usar el reloj de la app (fijado con cy.clock), no el del runner
  const WinDate: DateConstructor = win.Date;
  q.clearState();
  const template = (title: string, type: string, settings: object, pinned = false) =>
    q.createActivityTemplate({
      title,
      description: "",
      type,
      isSystemActivity: false,
      pinned,
      ...settings,
    });
  const report = template("Write report", "clear-objective", {
    clearObjectiveSettings: { estimatedDurationMinutes: 45 },
  });
  const read = template(
    "Read",
    "timeboxing",
    { timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 } },
    true
  );
  const email = template(
    "Check email",
    "timeboxing",
    { timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 15 } },
    true
  );
  const tidy = template("Tidy up", "flexible-duration", {
    flexibleDurationSettings: { minimumDurationMinutes: 5, maximumDurationMinutes: 10 },
  });
  const meditate = template(
    "Meditate",
    "timeboxing",
    {
      timeboxingSettings: { type: "both", minimumDurationMinutes: 10, maximumDurationMinutes: 20 },
    },
    true
  );
  const sprint = template("Plan the sprint", "clear-objective", {
    clearObjectiveSettings: { estimatedDurationMinutes: 30 },
  });
  const workout = template("Workout", "flexible-duration", {
    flexibleDurationSettings: { minimumDurationMinutes: 30, maximumDurationMinutes: 60 },
  });
  const coffee = q.createEventTemplate("Coffee");
  q.createEventTemplate("Ibuprofen");
  q.createTimeBlock("Morning", 360, 720);
  q.createTimeBlock("Afternoon", 720, 1080);
  q.createTimeBlock("Evening", 1080, 1380);

  const at = (daysAgo: number, hour: number, minute: number) => {
    const date = new WinDate();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date;
  };
  const record = (
    dayId: string,
    t: any,
    start: Date,
    duration: number,
    score: number,
    interrupted = false
  ) => {
    const estimate = t.clearObjectiveSettings?.estimatedDurationMinutes;
    const end = new WinDate(start.getTime() + duration * 60000);
    return {
      id: crypto.randomUUID(),
      templateId: t.id,
      templateTitle: t.title,
      state: interrupted ? "interrupted" : "completed",
      type: t.type,
      clearObjectiveSettings: t.clearObjectiveSettings,
      flexibleDurationSettings: t.flexibleDurationSettings,
      timeboxingSettings: t.timeboxingSettings,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      durationMinutes: duration,
      satisfactionScore: interrupted ? 0 : score,
      temposAwarded: interrupted ? 0 : Math.ceil(((estimate || duration) * score) / 7),
      beatEstimate: false,
      dayId,
      createdAt: end.toISOString(),
    };
  };

  q.updateState((s: any) => {
    const history = [
      [0.9, 7],
      [1.2, 8],
      [0.6, 6],
      [1.4, 8],
      [1.0, 7],
      [0.5, 5],
      [1.1, 9],
      [1.3, 8],
      [0.8, 7],
      [1.2, 8],
      [0.7, 6],
      [1.0, 8],
    ];
    history.forEach(([mult, score], index) => {
      const daysAgo = history.length - index;
      const dayId = crypto.randomUUID();
      s.global.days.push({
        id: dayId,
        state: "inactive",
        startTime: at(daysAgo, 8, 5).toISOString(),
        endTime: at(daysAgo, 22, 0).toISOString(),
        createdAt: at(daysAgo, 8, 5).toISOString(),
        updatedAt: at(daysAgo, 22, 0).toISOString(),
      });
      [
        [meditate, 15, 8],
        [email, 12, 9],
        [report, Math.round(45 * mult), 10],
        [read, Math.round(25 * mult), 16],
        [workout, Math.round(40 * mult), 18],
      ]
        .slice(0, 3 + Math.round(mult * 2))
        .forEach(([t, duration, hour]: any) =>
          s.global.completedActivityRecords.push(
            record(dayId, t, at(daysAgo, hour, 10), duration, score)
          )
        );
    });
    return s;
  });

  q.startDay();
  const day = q.getCurrentDay();
  const blocks = q.getTimeBlocks();
  const todo = blocks.find((b: any) => b.isDefault).id;
  const afternoon = blocks.find((b: any) => b.name === "Afternoon").id;
  const evening = blocks.find((b: any) => b.name === "Evening").id;
  q.updateState((s: any) => {
    const start = at(0, 8, 12).toISOString();
    s.currentDay.day.startTime = start;
    s.currentDay.day.createdAt = start;
    s.global.days = s.global.days.map((d: any) =>
      d.id === day.id ? { ...d, startTime: start, createdAt: start } : d
    );
    s.global.completedActivityRecords.push(
      record(day.id, meditate, at(0, 8, 30), 14, 7),
      record(day.id, email, at(0, 9, 0), 17, 5),
      record(day.id, report, at(0, 9, 40), 38, 8),
      record(day.id, tidy, at(0, 11, 15), 6, 4, true)
    );
    s.global.eventInstances.push({
      id: crypto.randomUUID(),
      templateId: coffee.id,
      templateName: "Coffee",
      timestamp: at(0, 9, 5).toISOString(),
      dayId: day.id,
      createdAt: at(0, 9, 5).toISOString(),
    });
    return s;
  });
  q.createActivityInstance(sprint.id, todo);
  q.createActivityInstance(tidy.id, todo);
  q.createActivityInstance(workout.id, evening);
  q.createActivityInstance(read.id, evening);
  const running = q.createActivityInstance(report.id, afternoon, {
    clearObjectiveSettings: { estimatedDurationMinutes: 60 },
  });
  q.activateActivity(running.id);
  q.updateState((s: any) => {
    s.currentDay.activityInstances.find((x: any) => x.id === running.id).startTime = new WinDate(
      WinDate.now() - 23 * 60000 - 7000
    ).toISOString();
    return s;
  });
};

describe("README screenshots", () => {
  beforeEach(() => {
    // Hora fija para que el día se vea igual en cada captura
    cy.clock(new Date(new Date().setHours(15, 24, 0, 0)).getTime(), ["Date"]);
  });

  const shoot = (name: string, path: string, size: [number, number], then?: () => void) => {
    cy.viewport(size[0], size[1]);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem("lifeui.theme", "dark");
        win.localStorage.setItem("lifeui.locale", "en");
      },
    });
    cy.window().its("__lifeui").should("exist");
    cy.window().then((win) => seed(win));
    cy.visit(path);
    // Esperar a que la página (algunas se cargan en diferido) esté pintada
    cy.get("main h1").should("be.visible");
    cy.wait(500);
    then?.();
    cy.screenshot(name, { capture: "viewport", overwrite: true });
  };

  const openClosing = () => {
    cy.get("[data-testid=finish-active]").click();
    cy.wait(400);
  };

  it("desktop: today", () => shoot("today", "/", [1440, 900]));
  it("desktop: closing ritual", () => shoot("closing-ritual", "/", [1440, 900], openClosing));
  it("desktop: review", () => shoot("review", "/review", [1440, 900]));
  it("desktop: library", () => shoot("library", "/library", [1440, 900]));

  it("mobile", () => {
    shoot("mobile-today", "/", [390, 844]);
    shoot("mobile-closing", "/", [390, 844], openClosing);
  });
});
