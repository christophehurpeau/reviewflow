import type { Preview } from "@storybook/react-native";
import { AlouetteProvider, SafeAreaProvider, VStack } from "alouette";
import { themeVariables } from "#/themeVariables.ts";

/**
 * The `/storybook` route renders outside the app providers, so every global a
 * component may need is wired here instead.
 */
const preview: Preview = {
  decorators: [
    (Story) => (
      <SafeAreaProvider>
        <AlouetteProvider themeVariables={themeVariables}>
          <VStack className="flex-1 bg-screen">
            <Story />
          </VStack>
        </AlouetteProvider>
      </SafeAreaProvider>
    ),
  ],
  parameters: {
    // Stories own the whole frame: storybook insets them by 8px a side by
    // default, which a screen sized from its own layout never accounts for.
    layout: "fullscreen",
    controls: {
      matchers: { color: /(background|color)$/i, date: /Date$/ },
    },
  },
};

export default preview;
