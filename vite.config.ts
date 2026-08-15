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
          name: "reviewflow",
          root: "packages/reviewflow",
          testTimeout,
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
