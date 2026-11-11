import type { Config } from "jest";

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.app.json",
      },
    ],
  },
  testRegex: "(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$",
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["./jest.setup.ts"],
  moduleNameMapper: {
    // Vite `?raw` imports (AGENT.md) become a fixed string in tests
    "\\?raw$": "<rootDir>/src/__mocks__/rawText.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
    "^@core/(.*)$": "<rootDir>/src/core/$1",
    // jsdom resolves lucide's ESM build; Jest needs the CommonJS one
    "^lucide-react$": "<rootDir>/node_modules/lucide-react/dist/cjs/lucide-react.js",
  },
};

export default config;
