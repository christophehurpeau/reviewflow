import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import { WhitespaceButton } from "./branch-diff/whitespace-button.tsx";

const meta = {
  component: WhitespaceButton,
  parameters: {
    componentSubtitle: "Toggle hiding the whitespace-only changes of a diff",
  },
  args: { whitespace: "show", onToggle: fn() },
} satisfies Meta<typeof WhitespaceButton>;

export default meta;

export const PreviewStory: StoryObj<typeof WhitespaceButton> = {
  name: "WhitespaceButton Preview",
};

export const VariantsStory: StoryObj<typeof WhitespaceButton> = {
  name: "WhitespaceButton Variants",
  render: () => (
    <Story>
      <Story.Section title="whitespace shown">
        <WhitespaceButton whitespace="show" onToggle={fn()} />
      </Story.Section>
      <Story.Section title="whitespace hidden">
        <WhitespaceButton whitespace="hide" onToggle={fn()} />
      </Story.Section>
      <Story.Section title="disabled with a reason">
        <WhitespaceButton
          whitespace="show"
          disabledReason="Reading the diff…"
          onToggle={fn()}
        />
      </Story.Section>
    </Story>
  ),
};
