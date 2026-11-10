import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// A hook run from a linked worktree (pre-push) exports GIT_DIR and the like:
// inherited by the workers, they point the tests' git calls in their temporary
// checkouts at this repository instead, which `git init` then turns bare.
for (const name of execFileSync("git", ["rev-parse", "--local-env-vars"], {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean)) {
  Reflect.deleteProperty(process.env, name);
}

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
    "@reviewflow/core/tests": fileURLToPath(
      new URL("./packages/core/src/tests/testMongoStores.ts", import.meta.url),
    ),
    "@reviewflow/core": fileURLToPath(
      new URL("./packages/core/src/index.ts", import.meta.url),
    ),
    "@reviewflow/sdk/files": fileURLToPath(
      new URL("./packages/sdk/src/files.ts", import.meta.url),
    ),
    "@reviewflow/sdk/git": fileURLToPath(
      new URL("./packages/sdk/src/git.ts", import.meta.url),
    ),
    "@reviewflow/sdk": fileURLToPath(
      new URL("./packages/sdk/src/index.ts", import.meta.url),
    ),
    "@reviewflow/modules": fileURLToPath(
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
      // same for the expo app, see its own config
      "packages/app-expo/vitest.config.ts",
      {
        resolve,
        test: {
          name: "core",
          root: "packages/core",
          testTimeout,
          // real mongod, see src/tests/testMongoStores.ts
          globalSetup: [mongoGlobalSetup],
          include: ["src/**/*.test.ts?(x)"],
          exclude: ["src/**/*.load.test.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "core-load",
          root: "packages/core",
          testTimeout,
          globalSetup: [mongoGlobalSetup],
          include: ["src/**/*.load.test.ts"],
          // they measure event loop delays: run once every other project is
          // done, so the cpu is not shared with the rest of the suite
          sequence: { groupOrder: 1 },
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
          name: "sdk",
          root: "packages/sdk",
          testTimeout,
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        resolve,
        test: {
          name: "ui",
          root: "packages/ui",
          testTimeout,
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        resolve,
        test: {
          name: "app",
          root: "packages/app",
          testTimeout,
          include: ["src/**/*.test.ts?(x)"],
        },
      },
      {
        resolve,
        test: {
          name: "app-expo",
          root: "packages/app-expo",
          testTimeout,
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
