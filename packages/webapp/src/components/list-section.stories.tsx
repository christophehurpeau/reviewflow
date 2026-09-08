import type { Meta, StoryObj } from "@storybook/react-native";
import { PressableListItem, Text } from "alouette";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/EyeRegularIcon";
import { GitPullRequestRegularIcon } from "alouette-icons/phosphor-icons/GitPullRequestRegularIcon";
import { WarningRegularIcon } from "alouette-icons/phosphor-icons/WarningRegularIcon";
import type { ReactNode } from "react";
import { fn } from "storybook/test";
import { ListSection } from "#/components/list-section.tsx";
import { Story } from "#storybook/Story.tsx";

function rows(labels: string[]): ReactNode {
  return labels.map((label) => (
    <PressableListItem key={label} onPress={fn()}>
      <Text className="font-body-bold">{label}</Text>
    </PressableListItem>
  ));
}

const meta = {
  component: ListSection,
  parameters: {
    componentSubtitle: "Heading above a list of pressable rows",
  },
  args: {
    title: "Pull requests",
  },
  render: (args) => (
    <ListSection {...args}>
      {rows(["Add storybook", "Fix the merge queue"])}
    </ListSection>
  ),
} satisfies Meta<typeof ListSection>;

export default meta;

export const PreviewStory: StoryObj<typeof ListSection> = {
  name: "ListSection Preview",
};

export const VariantsStory: StoryObj<typeof ListSection> = {
  name: "ListSection Variants",
  render: () => (
    <Story>
      <Story.Section title="no icon">
        <ListSection title="Repositories">
          {rows(["reviewflow", "alouette"])}
        </ListSection>
      </Story.Section>
      <Story.Section title="icon, no accent">
        <ListSection title="Pull requests" icon={<GitPullRequestRegularIcon />}>
          {rows(["Add storybook"])}
        </ListSection>
      </Story.Section>
      <Story.Section title="iconAccent">
        <ListSection
          title="To review"
          icon={<EyeRegularIcon />}
          iconAccent="info"
        >
          {rows(["Add storybook"])}
        </ListSection>
      </Story.Section>
      <Story.Section title="title long enough to wrap">
        <ListSection
          title="Pull requests waiting on a review from one of your teams"
          icon={<WarningRegularIcon />}
          iconAccent="warning"
        >
          {rows(["Add storybook"])}
        </ListSection>
      </Story.Section>
      <Story.Section title="no row">
        <ListSection title="Merged today">{null}</ListSection>
      </Story.Section>
    </Story>
  ),
};
