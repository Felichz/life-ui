import { defineConfig } from "cypress";
import baseConfig from "./cypress.config";

/**
 * Config to regenerate the README screenshots:
 *   npx cypress run --config-file cypress.screenshots.config.ts
 * Large window and 2x density for crisp images.
 */
export default defineConfig({
  ...baseConfig,
  screenshotsFolder: "cypress/screenshots",
  e2e: {
    ...baseConfig.e2e,
    specPattern: "cypress/e2e/readme-screenshots.cy.ts",
    excludeSpecPattern: [],
    setupNodeEvents(on) {
      on("before:browser:launch", (browser, launchOptions) => {
        if (browser.name === "electron") {
          launchOptions.preferences.width = 1600;
          launchOptions.preferences.height = 1100;
        }
        if (browser.family === "chromium" && browser.name !== "electron") {
          launchOptions.args.push("--window-size=1600,1100", "--force-device-scale-factor=2");
        }
        return launchOptions;
      });
    },
  },
});
