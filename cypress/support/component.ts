/// <reference types="cypress" />

// Import commands.js using ES2015 syntax:
// import './commands'

// Alternatively you can use CommonJS syntax:
// require('./commands')

import { mount } from "cypress/react18";

Cypress.Commands.add("mount", mount);

// Ejemplo de comando personalizado para pruebas de componentes
Cypress.Commands.add("findByTestId", (testId: string) => {
  return cy.get(`[data-testid=${testId}]`);
});

// Declaración de tipos para TypeScript
declare global {
  namespace Cypress {
    interface Chainable {
      mount: typeof mount;
      findByTestId(testId: string): Chainable<JQuery<HTMLElement>>;
    }
  }
}
