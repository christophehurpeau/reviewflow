import type { StorybookConfig } from "@storybook/react-native-web-vite";

/**
 * Web mirror of the on-device config in `.storybook`: what vitest renders the
 * stories with (react-native-web + vite). Keep `stories` in sync with it.
 *
 * `@storybook/react-native` deprecates `addons` in an on-device main file, so
 * the vitest addon lives here rather than in a single shared config.
 */
const main: StorybookConfig = {
  framework: "@storybook/react-native-web-vite",
  stories: ["../src/**/*.stories.?(ts|tsx)"],
  addons: ["@storybook/addon-vitest"],
  core: { disableTelemetry: true },
};

export default main;
