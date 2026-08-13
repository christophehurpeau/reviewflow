import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    setupFiles: ["packages/reviewflow/src/tests/setup.ts"],
    include: ["packages/reviewflow/src/**/__tests__/**/*.ts?(x)", "packages/reviewflow/src/**/*.test.ts?(x)"],
    coverage: {
      include: ["src/**/*.ts?(x)"],
      reportsDirectory: "docs/coverage",
      reporter: (process.env.POB_VITEST_COVERAGE || "json,text").split(","),
    },
  },
});
