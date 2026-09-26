/// <reference types="cypress" />

declare global {
  namespace Cypress {
    interface Chainable {
      /** Abre la app con el almacenamiento vacío (primer uso). */
      visitFresh(path?: string): Chainable<void>;
    }
  }
}

Cypress.Commands.add("visitFresh", (path = "/") => {
  cy.visit(path, {
    onBeforeLoad(win) {
      win.localStorage.clear();
      win.localStorage.setItem("qualia.theme", "light");
    },
  });
});

export {};
