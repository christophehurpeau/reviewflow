import { defineConfig } from "vitest/config";

// projects do not inherit the root test options, each one repeats what it needs
const testTimeout = 30000;

export default defineConfig({
  test: {
    testTimeout,
    coverage: {
      include: ["src/**/*.ts?(x)"],
      reportsDirectory: "docs/coverage",
      reporter: (process.env.POB_VITEST_COVERAGE || "json,text").split(","),
    },
    projects: [
      // renders every webapp story in a browser, see its own config
      "packages/webapp/vitest.config.ts",
      {
        test: {
          name: "core",
          root: "packages/core",
          testTimeout,
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        test: {
          name: "modules",
          root: "packages/modules",
          testTimeout,
          // the row formatters date with toLocaleDateString
          env: { TZ: "UTC" },
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        test: {
          name: "reviewflow",
          root: "packages/reviewflow",
          testTimeout,
          // slack blocks format dates with toLocaleDateString
          env: { TZ: "UTC" },
          // builds a probot instance and mocks github with nock
          setupFiles: ["src/tests/setup.ts"],
          include: ["src/**/__tests__/**/*.ts?(x)", "src/**/*.test.ts?(x)"],
        },
      },
      {
        test: {
          name: "webapp-server",
          root: "packages/webapp-server",
          testTimeout,
          setupFiles: ["src/tests/setup.ts"],
          include: ["src/**/*.test.ts?(x)"],
        },
      },
    ],
  },
});
