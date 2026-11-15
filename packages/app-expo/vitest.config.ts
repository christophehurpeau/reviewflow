/// <reference types="vitest/config" />
import path from "node:path";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vite";

const dirname = import.meta.dirname;

/**
 * Renders every story in a real browser and fails on a render error or a failed
 * `play`. The framework in `.storybook-web` supplies the react-native-web
 * aliasing, so nothing here needs to know about react-native.
 */
export default defineConfig({
  plugins: [storybookTest({ configDir: path.join(dirname, ".storybook-web") })],
  // the package exports point at its rollup build: load the sources instead,
  // so the stories never render against a stale build
  resolve: {
    alias: {
      "@reviewflow/sdk": path.join(dirname, "../sdk/src/index.ts"),
      "@reviewflow/ui": path.join(dirname, "../ui/src/index.ts"),
    },
  },
  // only a web worker imports it, so the dependency scan misses it: found
  // mid-run, vite re-optimizes and reloads, and stories still loading fail
  optimizeDeps: {
    include: ["@pierre/diffs/worker/worker-portable.js"],
  },
  test: {
    name: "app-expo-storybook",
    browser: {
      enabled: true,
      headless: true,
      provider: playwright({}),
      instances: [{ browser: "chromium" }],
    },
    setupFiles: [path.join(dirname, ".storybook-web/vitest.setup.ts")],
  },
});
