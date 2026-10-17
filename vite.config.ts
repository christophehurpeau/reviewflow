import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// projects do not inherit the root test options, each one repeats what it needs
const testTimeout = 30_000;
// globalSetup paths resolve from each project root
const mongoGlobalSetup = fileURLToPath(
  new URL("./scripts/vitestMongoGlobalSetup.ts", import.meta.url),
);
// the workspace libraries' package exports point at their rollup build: tests
// load the sources instead, so they never run against a stale build
const resolve = {
  alias: {
    "reviewflow-core": fileURLToPath(
      new URL("./packages/core/src/index.ts", import.meta.url),
    ),
    "reviewflow-modules": fileURLToPath(
      new URL("./packages/modules/src/index.ts", import.meta.url),
    ),
  },
};

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
        resolve,
        test: {
          name: "core",
          root: "packages/core",
          testTimeout,
          // real mongod, see src/tests/testMongoStores.ts
          globalSetup: [mongoGlobalSetup],
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        resolve,
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
        resolve,
        test: {
          name: "reviewflow",
          root: "packages/reviewflow",
          testTimeout,
          // slack blocks format dates with toLocaleDateString
          env: { TZ: "UTC" },
          // real mongod, see packages/core/src/tests/testMongoStores.ts
          globalSetup: [mongoGlobalSetup],
          // builds a probot instance and mocks github with nock
          setupFiles: ["src/tests/setup.ts"],
          include: ["src/**/__tests__/**/*.ts?(x)", "src/**/*.test.ts?(x)"],
        },
      },
      {
        resolve,
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
