import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5174",
    specPattern: "cypress/e2e/**/*.cy.ts",
    // README screenshots are generated separately (cypress.screenshots.config.ts)
    excludeSpecPattern: "cypress/e2e/readme-screenshots.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 6000,
    video: false,
  },
});
