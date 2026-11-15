/**
 * The README's screenshots, of the real app with synthetic data, in English,
 * each in a light and a dark edition. One conversation runs through the real
 * agent and core: a scripted model stands in for the LLM and the web search is
 * answered with real NHS pages (as in video/tools/capture-coach.cy.ts).
 *
 * Writes cypress/screenshots/readme/<name>-<light|dark>.png and pins.json (where
 * each panel's numbered marks go, in % of the shot). scripts/readme-panels.mjs
 * turns them into docs/readme/*.webp. Not part of the normal suite:
 *
 *   npm run dev
 *   npx cypress run --browser chrome --config-file cypress.screenshots.config.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

// A module, so its names do not meet the other specs' in the global scope
export {};

/** Monday 16 November 2026. */
const at = (hour: number, minute: number) => new Date(2026, 10, 16, hour, minute).getTime();

const MODEL = { baseUrl: `${Cypress.config("baseUrl")}/__model/v1`, model: "scripted" };
const call = (name: string, args: object = {}) => ({
  choices: [
    {
      message: {
        content: "",
        tool_calls: [
          {
            id: `c-${name}`,
            type: "function",
            function: { name, arguments: JSON.stringify(args) },
          },
        ],
      },
    },
  ],
});
const say = (content: string) => ({ choices: [{ message: { content } }] });

const GUIDES = {
  isometric: "https://www.ouh.nhs.uk/media/lsjlro5o/85220advice.pdf",
  eccentric: "https://www.plymouthhospitals.nhs.uk/display-pil/pil-tennis-elbow-4079",
  booklet: "https://rightdecisions.scot.nhs.uk/media/je5g5qzk/tennis-elbow-exercise-booklet.pdf",
};
const SEARCH = [
  [
    "Tennis elbow: advice and exercises (Oxford University Hospitals, NHS)",
    GUIDES.isometric,
    "Isometric exercise: elbow bent to 90 degrees, push the back of the hand up against the other hand. Hold 30 to 45 seconds, 5 times. Most people improve within 8 to 12 weeks.",
  ],
  [
    "Tennis elbow (University Hospitals Plymouth, NHS)",
    GUIDES.eccentric,
    "Eccentric strengthening: forearm on a table, lower a light weight slowly over 3 seconds. 3 sets of 15.",
  ],
  [
    "Tennis elbow exercise booklet (NHS Right Decisions)",
    GUIDES.booklet,
    "Exercises to strengthen the forearm muscles: wrist extension, grip, stretches.",
  ],
]
  .map(
    ([title, url, text]) =>
      `Title: ${title}\nURL: ${url}\nPublished: 2024-01-01\nHighlights:\n${text}`
  )
  .join("\n---\n");

const ASK =
  "My right elbow hurts on the outside after long days at the mouse. Can you look up exercises and plan it for me?";
const PLAN = `I'm not a doctor and this isn't a diagnosis, but pain on the outside of the elbow of the mouse arm is the classic overload pattern, and the NHS guides agree on what helps.

**A 10-week plan, about 10 minutes a session** (most people improve in 8 to 12 weeks):
1. **Weeks 1–2, calm it down:** isometric wrist hold 5 × 30 s, forearm stretch 3 × 10 s.
2. **Weeks 3–6, load it:** eccentric wrist extension 3 × 15 with a 0.5 L bottle.
3. **Weeks 7–10, make it strong:** the same with 1–2 kg, plus grip 3 × 10.

Every session will carry the link to the guide that shows its exercises. Which days, and at what time?`;
const YES = "Weekdays at 9, before work. Go ahead.";
const ROADMAP = {
  title: "Right elbow without pain",
  why: "Work at the computer without elbow pain.",
  activity: "Elbow exercises",
  session_minutes: 10,
  schedule: { weekdays: ["mon", "tue", "wed", "thu", "fri"], time: "09:00", start: "today" },
  rules: "- If the pain goes over 3/10 or lasts to the next day, go back to the previous load.",
  milestones: [
    {
      title: "Calm it down",
      sessions: 10,
      notes: `- Isometric wrist hold: 5 × 30 s, gentle ([how](${GUIDES.isometric}))\n- Forearm stretch: 3 × 10 s ([how](${GUIDES.booklet}))`,
    },
    {
      title: "Load it",
      sessions: 20,
      notes: `- Eccentric wrist extension: 3 × 15, 0.5 L bottle ([how](${GUIDES.eccentric}))\n- Forearm stretch: 3 × 10 s ([how](${GUIDES.booklet}))`,
    },
    {
      title: "Make it strong",
      sessions: 20,
      notes: `- Eccentric wrist extension: 3 × 15 with 1–2 kg ([how](${GUIDES.eccentric}))\n- Grip squeeze: 3 × 10 ([how](${GUIDES.booklet}))`,
    },
  ],
  message: "Created the roadmap: 50 sessions in three phases.",
  then: "finish",
};
const DONE =
  "Done: 50 sessions, weekdays at 9:00 from today, in three phases. Each one shows its exercises with the guide's link; it's all under Goals.";
const FINISHED = "Done, it went well. A 9.";
const CLOSED = "Closed at 9 out of 10: +13 tempos. Same time tomorrow.";

const CHAT = 'section[aria-label="Chat"]';
const HUD = '[class*="grid-area:now"]';
const pins: Record<string, Array<{ x: number; y: number }>> = {};

/** Where the marks go: the left edge of each element, at its middle, in % of the viewport. */
const mark = (name: string, targets: Array<[string, string?]>) =>
  cy.document().then((doc) => {
    const view = doc.defaultView!;
    pins[name] = targets.map(([selector, text]) => {
      const el = Array.from(doc.querySelectorAll(selector)).find(
        (one) =>
          (one as HTMLElement).offsetParent !== null &&
          (text === undefined || one.textContent?.includes(text))
      );
      if (!el) throw new Error(`no ${selector} ${text ?? ""}`);
      const r = el.getBoundingClientRect();
      return {
        x: Math.round(((r.left + 6) / view.innerWidth) * 1000) / 10,
        y: Math.round(((r.top + r.height / 2) / view.innerHeight) * 1000) / 10,
      };
    });
  });

/** The same screen in both editions. */
const shoot = (name: string) => {
  for (const theme of ["light", "dark"] as const) {
    cy.document().then((doc) => (doc.documentElement.dataset.theme = theme));
    cy.wait(250);
    cy.screenshot(`readme/${name}-${theme}`, { capture: "viewport", overwrite: true });
  }
};

describe("README screenshots", () => {
  it("one conversation with the coach, its plan, a session and its close", () => {
    let clock: Cypress.Clock;
    cy.clock(at(8, 38), ["Date"]).then((c) => (clock = c));
    const goTo = (hour: number, minute: number) =>
      cy.then(() => clock.setSystemTime(at(hour, minute)));

    const queue: object[] = [
      call("web_search", { query: "tennis elbow exercises NHS patient leaflet" }),
      say(PLAN),
      call("plan_roadmap", {
        request:
          "Build the roadmap for the plan above. Goal: right elbow without pain. Days: Monday to Friday at 09:00, starting today. Phases: 2, 4 and 4 weeks.",
      }),
      call("save_roadmap", ROADMAP),
      say(DONE),
      call("finish_activity", { how_it_went: "Done, it went well", satisfaction: 9 }),
      say(CLOSED),
    ];
    cy.intercept("POST", "**/__model/v1/chat/completions", (req) => {
      req.reply({ statusCode: 200, body: queue.shift() ?? say("…") });
    });
    cy.intercept("POST", "https://mcp.exa.ai/mcp", {
      statusCode: 200,
      body: { jsonrpc: "2.0", id: 1, result: { content: [{ type: "text", text: SEARCH }] } },
    });

    cy.viewport(1440, 900);
    cy.visit("/", {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem("lifeui.theme", "light");
        win.localStorage.setItem("lifeui.locale", "en");
        win.localStorage.setItem("lifeui.devModel", JSON.stringify(MODEL));
        win.localStorage.setItem("lifeui.web", "on");
      },
    });
    cy.window().its("__lifeui").should("exist");

    // A morning already under way: two things done, a few planned
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const WinDate: DateConstructor = win.Date;
      q.clearState();
      const template = (title: string, type: string, settings: object) =>
        q.createActivityTemplate({
          title,
          description: "",
          type,
          isSystemActivity: false,
          pinned: false,
          ...settings,
        });
      const email = template("Check email", "timeboxing", {
        timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 15 },
      });
      const report = template("Write report", "clear-objective", {
        clearObjectiveSettings: { estimatedDurationMinutes: 45 },
      });
      const read = template("Read", "timeboxing", {
        timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 },
      });
      const meditate = template("Meditate", "timeboxing", {
        timeboxingSettings: {
          type: "both",
          minimumDurationMinutes: 10,
          maximumDurationMinutes: 20,
        },
      });
      q.createTimeBlock("Morning", 360, 720);
      q.createTimeBlock("Afternoon", 720, 1080);
      q.createTimeBlock("Evening", 1080, 1380);
      q.startDay();
      const day = q.getCurrentDay();
      const blocks = q.getTimeBlocks();
      const block = (name: string) => blocks.find((b: any) => b.name === name).id;
      const record = (t: any, hour: number, minute: number, duration: number, score: number) => {
        const start = new WinDate(2026, 10, 16, hour, minute);
        const end = new WinDate(start.getTime() + duration * 60000);
        return {
          id: crypto.randomUUID(),
          templateId: t.id,
          templateTitle: t.title,
          state: "completed",
          type: t.type,
          timeboxingSettings: t.timeboxingSettings,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
          durationMinutes: duration,
          satisfactionScore: score,
          temposAwarded: Math.ceil((duration * score) / 7),
          beatEstimate: false,
          dayId: day.id,
          createdAt: end.toISOString(),
        };
      };
      q.updateState((s: any) => {
        s.currentDay.day.startTime = new WinDate(2026, 10, 16, 7, 50).toISOString();
        s.global.completedActivityRecords.push(
          record(meditate, 7, 55, 12, 8),
          record(email, 8, 10, 14, 7)
        );
        return s;
      });
      q.createActivityInstance(report.id, block("Afternoon"));
      q.createActivityInstance(read.id, block("Evening"));
    });
    cy.reload();
    cy.get(CHAT).filter(":visible").should("exist");

    // The coach looks it up and lays out a plan; the roadmap waits on its card
    goTo(8, 40);
    cy.get(`${CHAT} textarea`).filter(":visible").type(`${ASK}{enter}`, { delay: 0 });
    cy.contains(`${CHAT} p`, "Which days, and at what time?").should("be.visible");
    goTo(8, 42);
    cy.get(`${CHAT} textarea`).filter(":visible").type(`${YES}{enter}`, { delay: 0 });
    cy.contains(`${CHAT} button`, "Do it").should("be.visible");
    mark("coach", [[HUD], [`${CHAT} button`, "Do it"], ['main [aria-label="Now"]']]);
    shoot("coach");
    cy.contains(`${CHAT} button`, "Do it").click();
    cy.contains(`${CHAT} p`, "under Goals").should("be.visible");

    // Goals: the roadmap, and what a session of its first phase holds
    cy.contains("nav a", "Goals").click();
    cy.contains("Right elbow without pain").should("be.visible");
    cy.get('button[aria-label="Show what to do"]').filter(":visible").first().click();
    cy.contains("main a", "how").should("be.visible");
    mark("goals", [["main article"], ['main a[href*="nhs"]']]);
    shoot("goals");

    // 9:11, the first session runs; the close is one sentence, and its card shows the tempos
    cy.contains("nav a", "Today").click();
    goTo(9, 0);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const templateId = q.getRoadmaps()[0].milestones[0].steps[0].templateId;
      const find = () =>
        q.getState().currentDay.activityInstances.find((i: any) => i.templateId === templateId);
      if (!find()) q.bringPlannedActivities();
      q.activateActivity(find().id);
    });
    goTo(9, 11);
    cy.get('section[aria-label="Running"]').should("be.visible");
    cy.get(`${CHAT} textarea`).filter(":visible").type(`${FINISHED}{enter}`, { delay: 0 });
    cy.contains(`${CHAT} button`, "Do it").should("be.visible");
    mark("close", [['section[aria-label="Running"]'], [`${CHAT} button`, "Do it"]]);
    shoot("close");
    cy.contains(`${CHAT} button`, "Do it").click();
    cy.contains(`${CHAT} p`, "Same time tomorrow").should("be.visible");

    // The day looked back on
    cy.contains("nav a", "Review").click();
    cy.contains("h1", "Review").should("be.visible");
    shoot("review");

    // A phone: the conversation, under the same HUD
    cy.viewport(390, 844);
    cy.contains("nav a", "Coach").click();
    cy.get(CHAT).filter(":visible").should("exist");
    shoot("phone");

    cy.then(() => cy.writeFile("cypress/screenshots/readme/pins.json", pins));
  });
});
