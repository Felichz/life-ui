import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5174", // life-ui vite server (5173 ocupado por otro proyecto)
    specPattern: "cypress/e2e/**/*.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/e2e.ts",
    videosFolder: "cypress/videos",
    screenshotsFolder: "cypress/screenshots",
    viewportWidth: 1280,
    viewportHeight: 720,
    defaultCommandTimeout: 6000,
    experimentalStudio: true,
  },
  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
    specPattern: "cypress/component/**/*.{js,jsx,ts,tsx}",
    supportFile: "cypress/support/component.ts",
  },
  retries: {
    runMode: 0,
    openMode: 0,
  },
});
