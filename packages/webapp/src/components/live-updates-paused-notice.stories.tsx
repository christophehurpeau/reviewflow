import type { Meta, StoryObj } from "@storybook/react-native";
import { Story } from "#storybook/Story.tsx";
import { LiveUpdatesPausedNotice } from "./live-updates-paused-notice.tsx";

const meta = {
  component: LiveUpdatesPausedNotice,
  parameters: {
    componentSubtitle: "Tells why a screen's data does not update by itself",
  },
  args: { pausedBy: "notEnabled" },
} satisfies Meta<typeof LiveUpdatesPausedNotice>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "LiveUpdatesPausedNotice Preview",
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "LiveUpdatesPausedNotice Variants",
  render: () => (
    <Story>
      <Story.Section title="not enabled">
        <LiveUpdatesPausedNotice pausedBy="notEnabled" />
      </Story.Section>
      <Story.Section title="user limit">
        <LiveUpdatesPausedNotice pausedBy="userLimit" />
      </Story.Section>
      <Story.Section title="server limit">
        <LiveUpdatesPausedNotice pausedBy="serverLimit" />
      </Story.Section>
      <Story.Section title="live">
        <LiveUpdatesPausedNotice pausedBy={undefined} />
      </Story.Section>
    </Story>
  ),
};
