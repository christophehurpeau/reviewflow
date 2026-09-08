import type { StorybookConfig } from "@storybook/react-native";

/**
 * On-device storybook: the stories render inside the app itself, on the
 * `/storybook` route. The globs are compiled into a metro `require.context`
 * by `generate()` (see metro.config.cjs), so they must stay static strings.
 */
const main: StorybookConfig = {
  stories: ["../src/**/*.stories.?(ts|tsx)"],
  deviceAddons: [
    "@storybook/addon-ondevice-controls",
    "@storybook/addon-ondevice-actions",
  ],
};

export default main;
