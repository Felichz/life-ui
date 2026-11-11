/**
 * The day through the chat (ADR-002), in a real browser: a scripted model
 * stands in for the LLM (Cypress answers its HTTP calls), the app and the
 * core are real. Start the day, plan, run, close, log an event, end the day,
 * and see it all in the Review.
 */

// Same origin as the app; Cypress answers every call to it
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

/** The model answers these, in order, one per request. */
function script(replies: object[]) {
  const queue = [...replies];
  cy.intercept("POST", "**/__model/v1/chat/completions", (req) => {
    req.reply({ statusCode: 200, body: queue.shift() ?? say("…") });
  }).as("model");
}

function visitWithModel(path = "/") {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem("lifeui.theme", "light");
      win.localStorage.setItem("lifeui.locale", "es");
      win.localStorage.setItem("lifeui.devModel", JSON.stringify(MODEL));
    },
  });
}

const chat = () => cy.get('section[aria-label="Chat"]').filter(":visible");
const write = (text: string) =>
  chat().find('textarea[aria-label="Dile a LifeUI qué quieres hacer…"]').type(`${text}{enter}`);

describe("LifeUI", () => {
  it("first run: shows how it works and points to the chat", () => {
    cy.visitFresh();
    cy.contains("h1", /Buen(os|as) (días|tardes|noches)/);
    cy.contains("Cierre honesto");
    cy.contains("díselo a LifeUI en el chat");
    cy.contains("No hay modelo cargado");
  });

  it("runs a whole day through the chat", () => {
    cy.viewport(1440, 900);
    script([
      call("start_day"),
      say("Día empezado."),
      call("add_to_plan", { title: "Escribir informe", minutes: 30 }),
      say("Añadido al plan."),
      call("start_activity", { item: "Escribir informe" }),
      say("En marcha."),
      call("finish_activity", { how_it_went: "bien, hecho", satisfaction: 7 }),
      say("Cerrado: +30 tempos."),
      call("log_event", { name: "Café" }),
      say("Café registrado."),
      call("end_day"),
      say("Hasta mañana."),
    ]);
    visitWithModel();

    // Auto mode: changes run at once, each one as a card
    chat().contains('[role="radio"]', "Auto").click();
    write("empiezo el día");
    chat().contains("Día empezado.");
    cy.contains("h1", "Hoy");

    write("tengo que escribir el informe, unos 30 minutos");
    chat().contains("Añadir «Escribir informe» · Por hacer");
    chat().contains("Añadido al plan.");
    cy.get("main").contains("Escribir informe");

    write("empiezo con el informe");
    chat().contains("En marcha.");
    cy.get('section[aria-label="En marcha"]').should("contain", "Escribir informe");
    cy.title().should("contain", "Escribir informe");

    write("terminé, salió bien");
    // 30 estimated minutes x 7 / 7 = 30, never showing the score
    chat().contains("li", "Cerrar «Escribir informe»").should("contain", "+30");
    chat().contains("Cerrado: +30 tempos.");
    cy.get("main").contains("30");

    write("me tomé un café");
    chat().contains("Registrar «Café»");
    chat().contains("Café registrado.");

    // Ending the day asks even in auto mode
    write("terminé por hoy");
    chat().contains("Terminar el día");
    chat().contains("button", "Hazlo").click();
    chat().contains("Hasta mañana.");

    cy.visit("/review");
    cy.contains("td", "Escribir informe");
    cy.get('section[aria-label="Tempos del día"]').should("contain", "30");
  });

  it("on mobile, navigates with the bottom bar and opens the chat", () => {
    cy.viewport(375, 812);
    cy.visitFresh();
    cy.get('nav[aria-label="Principal"]')
      .filter(":visible")
      .within(() => {
        cy.contains("Biblioteca").click();
      });
    cy.location("pathname").should("eq", "/library");
    cy.get('button[aria-label="Hablar con LifeUI"]').click();
    cy.get('section[aria-label="Chat"]').filter(":visible").should("exist");
  });
});

describe("Language", () => {
  it("first visit is English even with a Spanish browser", () => {
    cy.visit("/settings", {
      onBeforeLoad(win) {
        win.localStorage.clear();
        win.localStorage.setItem("lifeui.theme", "light");
        Object.defineProperty(win.navigator, "language", { value: "es-ES" });
        Object.defineProperty(win.navigator, "languages", { value: ["es-ES", "es"] });
      },
    });
    cy.contains("h1", "Settings");
    cy.get("html").should("have.attr", "lang", "en");
    cy.contains('[role="radio"]', "Español").click();
    cy.contains("h1", "Ajustes");
    cy.get("html").should("have.attr", "lang", "es");
    cy.reload();
    cy.contains("h1", "Ajustes");
    cy.get("html").should("have.attr", "lang", "es");
  });

  it("you can switch to English from Settings and it is remembered", () => {
    cy.visitFresh("/settings");
    cy.contains("h1", "Ajustes");
    cy.contains('[role="radio"]', "English").click();
    cy.contains("h1", "Settings");
    cy.contains("nav a", "Library");
    cy.reload();
    cy.contains("h1", "Settings");
    cy.get("html").should("have.attr", "lang", "en");
  });

  it("legacy Spanish routes redirect", () => {
    cy.visitFresh("/resumen");
    cy.location("pathname").should("eq", "/review");
  });
});
