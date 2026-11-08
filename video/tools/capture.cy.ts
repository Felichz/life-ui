/**
 * Captures the real app, state by state, for the product film.
 *
 * One day is played through the real core (startDay, activateActivity,
 * completeActivity, endDay) under a controlled clock, and at each beat the
 * rendered DOM is written to video/capture/<name>.html. The film then shows
 * those exact screens with the build's own CSS.
 *
 * Run against a dev server (see video/README.md):
 *   npx cypress run --config-file video/tools/cypress.capture.config.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const OUT = "video/capture";

const at = (hour: number, minute: number, daysAgo = 0) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

/** Library, blocks and twelve past days, so the Review has a history. */
const seedLibrary = (win: any) => {
  const q = win.__lifeui;
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
  const ids = {
    report: template("Write report", "clear-objective", {
      clearObjectiveSettings: { estimatedDurationMinutes: 45 },
    }),
    read: template(
      "Read",
      "timeboxing",
      { timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 } },
      true
    ),
    email: template(
      "Check email",
      "timeboxing",
      { timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 15 } },
      true
    ),
    tidy: template("Tidy up", "flexible-duration", {
      flexibleDurationSettings: { minimumDurationMinutes: 5, maximumDurationMinutes: 10 },
    }),
    meditate: template(
      "Meditate",
      "timeboxing",
      {
        timeboxingSettings: {
          type: "both",
          minimumDurationMinutes: 10,
          maximumDurationMinutes: 20,
        },
      },
      true
    ),
    sprint: template("Plan the sprint", "clear-objective", {
      clearObjectiveSettings: { estimatedDurationMinutes: 30 },
    }),
    workout: template("Workout", "flexible-duration", {
      flexibleDurationSettings: { minimumDurationMinutes: 30, maximumDurationMinutes: 60 },
    }),
  };
  const coffee = q.createEventTemplate("Coffee");
  q.createEventTemplate("Ibuprofen");
  q.createTimeBlock("Morning", 360, 720);
  q.createTimeBlock("Afternoon", 720, 1080);
  q.createTimeBlock("Evening", 1080, 1380);

  const WinDate: DateConstructor = win.Date;
  const past = (daysAgo: number, hour: number, minute: number) => {
    const date = new WinDate();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hour, minute, 0, 0);
    return date;
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
        startTime: past(daysAgo, 8, 5).toISOString(),
        endTime: past(daysAgo, 22, 0).toISOString(),
        createdAt: past(daysAgo, 8, 5).toISOString(),
        updatedAt: past(daysAgo, 22, 0).toISOString(),
      });
      [
        [ids.meditate, 15, 8],
        [ids.email, 12, 9],
        [ids.report, Math.round(45 * mult), 10],
        [ids.read, Math.round(25 * mult), 16],
        [ids.workout, Math.round(40 * mult), 18],
      ]
        .slice(0, 3 + Math.round(mult * 2))
        .forEach(([t, duration, hour]: any) => {
          const start = past(daysAgo, hour, 10);
          const end = new WinDate(start.getTime() + duration * 60000);
          const estimate = t.clearObjectiveSettings?.estimatedDurationMinutes;
          s.global.completedActivityRecords.push({
            id: crypto.randomUUID(),
            templateId: t.id,
            templateTitle: t.title,
            state: "completed",
            type: t.type,
            clearObjectiveSettings: t.clearObjectiveSettings,
            flexibleDurationSettings: t.flexibleDurationSettings,
            timeboxingSettings: t.timeboxingSettings,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            durationMinutes: duration,
            satisfactionScore: score,
            temposAwarded: Math.ceil(((estimate || duration) * score) / 7),
            beatEstimate: false,
            dayId,
            createdAt: end.toISOString(),
          });
        });
    });
    return s;
  });
  return { ...ids, coffee };
};

/**
 * What each screen's scenes aim at: selector -> rects of its visible matches,
 * in page pixels. A `|text` suffix keeps only elements whose text is exactly that.
 */
const AIM: Record<string, Record<string, string>> = {
  "01-start": { start: "[data-testid=start-day]" },
  "02-plan": {
    plan: 'section[aria-labelledby="plan-title"]',
    evening: "h3|Evening",
    locks: '[aria-label^="Available from 18:00"]',
  },
  "03-meditate": { card: 'section[aria-label="Running"]' },
  "04-morning": { log: 'section[aria-labelledby="log-title"]' },
  "05-report": { card: 'section[aria-label="Running"]', finish: "[data-testid=finish-active]" },
  "06-close-7": { dialog: "[data-testid=closing-dialog]", nine: '[aria-label="9 out of 10"]' },
  "07-close-9": { save: "[data-testid=closing-confirm]", reward: "span|+78" },
  "08-earned": {
    meter: 'section[aria-label="Today’s tempos"]',
    log: 'section[aria-labelledby="log-title"]',
  },
  "10-review": { top: "main h1", trend: 'section[aria-labelledby="trend-title"]' },
};
const rects: Record<string, unknown> = {};

/** The rendered page, without scripts, as a fragment the film can mount, plus its aim points. */
const snap = (name: string) =>
  cy.wait(700).then(() =>
    cy.document().then((doc) => {
      const body = doc.body.cloneNode(true) as HTMLElement;
      body.querySelectorAll("script, noscript").forEach((node) => node.remove());
      cy.writeFile(`${OUT}/${name}.html`, body.innerHTML);
      const found: Record<string, unknown> = { height: doc.documentElement.scrollHeight };
      for (const [key, query] of Object.entries(AIM[name] ?? {})) {
        const [selector, text] = query.split("|");
        found[key] = [...doc.querySelectorAll(selector)]
          .filter((el) => text === undefined || el.textContent?.trim() === text)
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.width > 0 && r.height > 0)
          .map((r) => ({
            x: Math.round(r.left),
            y: Math.round(r.top + doc.defaultView!.scrollY),
            w: Math.round(r.width),
            h: Math.round(r.height),
          }));
      }
      rects[name] = found;
    })
  );

describe("film capture", () => {
  it("plays one day through the real core", () => {
    let clock: Cypress.Clock;
    cy.clock(at(8, 9), ["Date"]).then((c) => (clock = c));
    const goTo = (hour: number, minute: number) =>
      cy.then(() => clock.setSystemTime(at(hour, minute)));

    cy.viewport(1440, 1200);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem("lifeui.theme", "light");
        win.localStorage.setItem("lifeui.locale", "en");
      },
    });
    cy.window().its("__lifeui").should("exist");

    let ids: any;
    cy.window().then((win) => {
      ids = seedLibrary(win);
    });
    cy.reload();
    cy.get("[data-testid=start-day]").should("be.visible");
    snap("01-start");

    // 8:12, the day starts and gets its plan
    goTo(8, 12);
    cy.get("[data-testid=start-day]").click();
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const blocks = q.getTimeBlocks();
      const block = (name: string) => blocks.find((b: any) => b.name === name).id;
      const todo = blocks.find((b: any) => b.isDefault).id;
      q.createActivityInstance(ids.meditate.id, block("Morning"));
      q.createActivityInstance(ids.email.id, block("Morning"));
      q.createActivityInstance(ids.sprint.id, todo);
      q.createActivityInstance(ids.report.id, block("Afternoon"), {
        clearObjectiveSettings: { estimatedDurationMinutes: 60 },
      });
      q.createActivityInstance(ids.workout.id, block("Evening"));
      q.createActivityInstance(ids.read.id, block("Evening"));
    });
    snap("02-plan");

    // The morning, one activity at a time
    goTo(8, 30);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const item = q.getCurrentDay() && win.__lifeui.getState().currentDay.activityInstances;
      q.activateActivity(item.find((i: any) => i.templateId === ids.meditate.id).id);
    });
    goTo(8, 44);
    snap("03-meditate");
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      q.completeActivity(q.getActiveActivity().id, { satisfactionScore: 7 });
    });
    goTo(9, 0);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const items = q.getState().currentDay.activityInstances;
      q.activateActivity(items.find((i: any) => i.templateId === ids.email.id).id);
    });
    goTo(9, 5);
    cy.window().then((win: any) => win.__lifeui.createEventInstance(ids.coffee.id));
    goTo(9, 17);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      q.completeActivity(q.getActiveActivity().id, { satisfactionScore: 5 });
    });
    goTo(11, 40);
    snap("04-morning");

    // The afternoon: Write report runs, then the close, at normal speed
    goTo(15, 0);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const items = q.getState().currentDay.activityInstances;
      q.activateActivity(items.find((i: any) => i.templateId === ids.report.id).id);
    });
    goTo(15, 23);
    snap("05-report");
    cy.get("[data-testid=finish-active]").click();
    cy.get("[data-testid=closing-dialog]").should("be.visible");
    snap("06-close-7");
    cy.get("body").type("9");
    snap("07-close-9");
    cy.get("[data-testid=closing-confirm]").click();
    snap("08-earned");

    // The evening, then the end of the day
    goTo(18, 10);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const items = q.getState().currentDay.activityInstances;
      q.activateActivity(items.find((i: any) => i.templateId === ids.workout.id).id);
    });
    goTo(18, 52);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      q.completeActivity(q.getActiveActivity().id, { satisfactionScore: 8 });
    });
    goTo(21, 30);
    snap("09-evening");
    cy.window().then((win: any) => win.__lifeui.endDay());
    cy.visit("/review");
    cy.get("main h1").should("be.visible");
    snap("10-review");
    cy.then(() => cy.writeFile(`${OUT}/rects.json`, rects));
  });
});
