/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Opens the app with empty storage (first run), in the given language. */
      visitFresh(path?: string, locale?: "es" | "en"): Chainable<void>;
    }
  }
}

Cypress.Commands.add("visitFresh", (path = "/", locale = "es") => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem("lifeui.theme", "light");
      win.localStorage.setItem("lifeui.locale", locale);
    },
  });
});

export {};
