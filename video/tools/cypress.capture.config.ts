import { defineConfig } from "cypress";
import baseConfig from "../../cypress.config";

/** Runs only the film capture (video/tools/capture.cy.ts). */
export default defineConfig({
  ...baseConfig,
  e2e: {
    ...baseConfig.e2e,
    specPattern: "video/tools/capture*.cy.ts",
    excludeSpecPattern: [],
  },
});
