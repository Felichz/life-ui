/**
 * Captures the real app for the product film "From the chat to the calendar".
 *
 * One conversation runs through the real agent and the real core: a scripted
 * model stands in for the LLM (Cypress answers its HTTP calls, as in
 * cypress/e2e/journey.cy.ts) and the web search is answered with real NHS
 * pages. The person asks about a sore elbow, the coach looks it up and lays
 * out a plan, the person says yes, the roadmap card waits for "Do it", and the
 * sessions land on the calendar. Then the first session runs at 9:00 with its
 * exercises on screen, and is closed at 9 out of 10.
 *
 * At each beat the rendered DOM is written to video/capture/<name>.html, with
 * where the scenes aim and how far the chat was scrolled (a cloned page keeps
 * no scroll position).
 *
 *   npx cypress run --config-file video/tools/cypress.capture.config.ts \
 *     --spec video/tools/capture-coach.cy.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

const OUT = "video/capture";
/** Monday 16 November 2026: the sessions start the same morning. */
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

/** The guides the search returns: real NHS and OSHA pages. */
const GUIDES = {
  isometric: "https://www.ouh.nhs.uk/media/lsjlro5o/85220advice.pdf",
  eccentric: "https://www.plymouthhospitals.nhs.uk/display-pil/pil-tennis-elbow-4079",
  booklet: "https://rightdecisions.scot.nhs.uk/media/je5g5qzk/tennis-elbow-exercise-booklet.pdf",
  desk: "https://osha.gov/etools/computer-workstations/additional-information",
};
const SEARCH = [
  [
    "Tennis elbow: advice and exercises (Oxford University Hospitals, NHS)",
    GUIDES.isometric,
    "2024-03-01",
    "Isometric exercise: elbow bent to 90 degrees at your side, push the back of the hand up against the other hand without moving it. Hold 30 to 45 seconds, 5 times, at a comfortable effort. Most people improve within 8 to 12 weeks of the right exercises.",
  ],
  [
    "Tennis elbow (University Hospitals Plymouth, NHS)",
    GUIDES.eccentric,
    "2023-06-01",
    "Eccentric strengthening: forearm on a table, palm down, hand over the edge with a light weight. Lift with the other hand, lower slowly over 3 seconds. 3 sets of 15. Increase the weight when it is easy and pain stays low.",
  ],
  [
    "Tennis elbow exercise booklet (NHS Right Decisions)",
    GUIDES.booklet,
    "2024-01-01",
    "Exercises to strengthen the forearm muscles ease the strain on the elbow: wrist extension, grip, stretches. Pictures of each exercise.",
  ],
  [
    "Computer workstations (OSHA)",
    GUIDES.desk,
    "2022-01-01",
    "Elbows at about 90 degrees, the mouse close to the body, the laptop raised with a separate keyboard and mouse, short breaks.",
  ],
]
  .map(
    ([title, url, date, text]) =>
      `Title: ${title}\nURL: ${url}\nPublished: ${date}\nHighlights:\n${text}`
  )
  .join("\n---\n");

const ASK =
  "My right elbow hurts on the outside after long days at the mouse, and my back sometimes too. Can you look up exercises and plan it for me?";

const PLAN = `I'm not a doctor and this isn't a diagnosis, but pain on the outside of the elbow of the mouse arm is the classic overload pattern, and the NHS guides agree on what helps.

**Change today:** elbow near 90°, the mouse close, the Mac raised with an external keyboard and mouse, a short break every 30 to 45 minutes.

**A 10-week plan, about 10 minutes a session** (most people improve in 8 to 12 weeks):
1. **Weeks 1–2, calm it down:** isometric wrist hold 5 × 30 s, forearm stretch 3 × 10 s.
2. **Weeks 3–6, load it:** eccentric wrist extension 3 × 15 with a 0.5 L bottle.
3. **Weeks 7–10, make it strong:** the same with 1–2 kg, plus grip 3 × 10.

Every session will carry the link to the guide that shows its exercises. See a physio first if you have tingling, pain at night or swelling.

Which days, and at what time?`;

const YES = "Weekdays at 9, before work. No tingling. Go ahead.";

const ROADMAP = {
  title: "Right elbow without pain",
  why: "Work at the computer without elbow or back pain.",
  activity: "Elbow and back exercises",
  session_minutes: 10,
  schedule: { weekdays: ["mon", "tue", "wed", "thu", "fri"], time: "09:00", start: "today" },
  rules:
    "- If the pain goes over 3/10 or lasts to the next day, go back to the previous load.\n- Bad day: only the isometric hold, 2 minutes.",
  milestones: [
    {
      title: "Calm it down",
      sessions: 10,
      notes: `- Isometric wrist hold: 5 × 30 s, gentle ([how](${GUIDES.isometric}))\n- Forearm stretch: 3 × 10 s ([how](${GUIDES.booklet}))\n- Back mobility, cat and cow: 1 min`,
    },
    {
      title: "Load it",
      sessions: 20,
      notes: `- Eccentric wrist extension: 3 × 15, 3 s down, 0.5 L bottle ([how](${GUIDES.eccentric}))\n- Forearm stretch: 3 × 10 s ([how](${GUIDES.booklet}))\n- Back mobility: 1 min`,
    },
    {
      title: "Make it strong",
      sessions: 20,
      notes: `- Eccentric wrist extension: 3 × 15 with 1–2 kg ([how](${GUIDES.eccentric}))\n- Grip squeeze: 3 × 10 ([how](${GUIDES.booklet}))\n- Plank: 3 × 20 s`,
    },
  ],
  message: "Created the roadmap: 50 sessions in three phases.",
  then: "finish",
};

const DONE =
  "Done: 50 sessions, weekdays at 9:00 from today, in three phases (10, 20 and 20). Each one shows its exercises with the guide's link, and you'll find it all under Goals.";

const FINISHED = "Done, it went well. A 9.";
const CLOSED = "Closed at 9 out of 10: +13 tempos. Same time tomorrow.";

/** What each screen's scenes aim at: selector -> rects of its visible matches. `|text` keeps exact text. */
const CHAT = 'section[aria-label="Chat"]';
const AIM: Record<string, Record<string, string>> = {
  "c01-ask": {
    chat: CHAT,
    input: `${CHAT} textarea`,
    send: `${CHAT} button[aria-label="Send"]`,
    plan: 'section[aria-labelledby="plan-title"]',
  },
  "c02-answer": {
    chat: CHAT,
    list: `${CHAT} [aria-live="polite"]`,
    sources: `${CHAT} a[href*="nhs"]`,
  },
  "c03-card": { chat: CHAT, list: `${CHAT} [aria-live="polite"]`, doit: `${CHAT} button|Do it` },
  "c04-saved": { chat: CHAT, list: `${CHAT} [aria-live="polite"]` },
  "c05-goals": {
    roadmap: 'section[aria-labelledby="roadmaps-title"]',
    toggle: 'button[aria-label="Show what to do"]',
  },
  "c06-notes": {
    roadmap: 'section[aria-labelledby="roadmaps-title"]',
    links: 'main a[href*="nhs"]',
  },
  "c07-running": {
    card: 'section[aria-label="Running"]',
    links: 'section[aria-label="Running"] a',
    chat: CHAT,
    input: `${CHAT} textarea`,
  },
  "c08-close": { chat: CHAT, list: `${CHAT} [aria-live="polite"]`, doit: `${CHAT} button|Do it` },
  "c09-earned": {
    chat: CHAT,
    list: `${CHAT} [aria-live="polite"]`,
    meter: 'section[aria-label="Today’s tempos"]',
  },
};
const rects: Record<string, unknown> = {};

const snap = (name: string) =>
  // A cloned page starts at its top: it is measured there too
  cy
    .window()
    .then((win) => win.scrollTo(0, 0))
    .wait(700)
    .then(() =>
      cy.document().then((doc) => {
        const body = doc.body.cloneNode(true) as HTMLElement;
        body.querySelectorAll("script, noscript").forEach((node) => node.remove());
        cy.writeFile(`${OUT}/${name}.html`, body.innerHTML);
        const list = doc.querySelector(`${CHAT} [aria-live="polite"]`) as HTMLElement | null;
        const found: Record<string, unknown> = {
          height: doc.documentElement.scrollHeight,
          // the chat's scroll, which the film puts back: a clone starts at the top
          chatScroll: list ? Math.round(list.scrollTop) : 0,
          chatScrollMax: list ? Math.round(list.scrollHeight - list.clientHeight) : 0,
        };
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

describe("film capture: from the chat to the calendar", () => {
  it("plays one conversation and its first session through the real app", () => {
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

    cy.viewport(1440, 1200);
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

    // A plain morning: the day started, a few things planned
    cy.window().then((win: any) => {
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
      const email = template(
        "Check email",
        "timeboxing",
        {
          timeboxingSettings: { type: "maximum-time", maximumDurationMinutes: 15 },
        },
        true
      );
      const report = template("Write report", "clear-objective", {
        clearObjectiveSettings: { estimatedDurationMinutes: 45 },
      });
      const read = template(
        "Read",
        "timeboxing",
        {
          timeboxingSettings: { type: "minimum-time", minimumDurationMinutes: 20 },
        },
        true
      );
      q.createTimeBlock("Morning", 360, 720);
      q.createTimeBlock("Afternoon", 720, 1080);
      q.createTimeBlock("Evening", 1080, 1380);
      q.startDay();
      const blocks = q.getTimeBlocks();
      const block = (name: string) => blocks.find((b: any) => b.name === name).id;
      q.createActivityInstance(email.id, block("Morning"));
      q.createActivityInstance(report.id, block("Afternoon"));
      q.createActivityInstance(read.id, block("Evening"));
    });
    cy.reload();
    cy.get(CHAT).filter(":visible").should("exist");

    // 8:40, the person asks
    goTo(8, 40);
    cy.get(`${CHAT} textarea`).filter(":visible").type(ASK, { delay: 0 });
    snap("c01-ask");
    cy.get(`${CHAT} textarea`).filter(":visible").type("{enter}");
    cy.contains(`${CHAT} p`, "Which days, and at what time?").should("be.visible");
    snap("c02-answer");

    // The yes: the roadmap waits on its card
    goTo(8, 42);
    cy.get(`${CHAT} textarea`).filter(":visible").type(`${YES}{enter}`);
    cy.contains(`${CHAT} button`, "Do it").should("be.visible");
    snap("c03-card");
    cy.contains(`${CHAT} button`, "Do it").click();
    cy.contains(`${CHAT} p`, "under Goals").should("be.visible");
    snap("c04-saved");

    // Goals: the roadmap, and what a session of its first phase holds
    cy.contains("a", "Goals").filter(":visible").first().click();
    cy.contains("Right elbow without pain").should("be.visible");
    snap("c05-goals");
    cy.get('button[aria-label="Show what to do"]').filter(":visible").first().click();
    cy.contains("main a", "how").should("be.visible");
    snap("c06-notes");

    // 9:00, the first session runs with its exercises on screen
    cy.contains("a", "Today").filter(":visible").first().click();
    goTo(9, 0);
    cy.window().then((win: any) => {
      const q = win.__lifeui;
      const templateId = q.getRoadmaps()[0].milestones[0].steps[0].templateId;
      const find = () =>
        q.getState().currentDay.activityInstances.find((i: any) => i.templateId === templateId);
      // Today's session is in today's plan; brought from the calendar if it is not yet
      if (!find()) q.bringPlannedActivities();
      q.activateActivity(find().id);
    });
    goTo(9, 11);
    cy.get('section[aria-label="Running"]').should("be.visible");
    cy.get(`${CHAT} textarea`).filter(":visible").type(FINISHED, { delay: 0 });
    snap("c07-running");

    // Closed through the chat, as everything else: the card shows the tempos it earns
    cy.get(`${CHAT} textarea`).filter(":visible").type("{enter}");
    cy.contains(`${CHAT} button`, "Do it").should("be.visible");
    snap("c08-close");
    cy.contains(`${CHAT} button`, "Do it").click();
    cy.contains(`${CHAT} p`, "Same time tomorrow").should("be.visible");
    snap("c09-earned");
    cy.then(() => cy.writeFile(`${OUT}/rects.json`, rects));
  });
});
