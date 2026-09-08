import type { Meta, StoryObj } from "@storybook/react-native";
import {
  SkeletonBlock,
  SkeletonList,
  SkeletonSections,
} from "#/components/skeleton.tsx";
import { Story } from "#storybook/Story.tsx";

const meta = {
  component: SkeletonList,
  parameters: {
    componentSubtitle:
      "Loading placeholders for a list, a set of sections or a block",
  },
} satisfies Meta<typeof SkeletonList>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "Skeleton Preview",
  args: { rows: 3 },
};

export const VariantsStory: StoryObj<typeof meta> = {
  name: "Skeleton Variants",
  render: () => (
    <Story>
      <Story.Section title="SkeletonList, rows=1">
        <SkeletonList rows={1} />
      </Story.Section>
      <Story.Section title="SkeletonList, default rows">
        <SkeletonList />
      </Story.Section>
      <Story.Section title="SkeletonSections, sections=1">
        <SkeletonSections sections={1} />
      </Story.Section>
      <Story.Section title="SkeletonSections, default sections">
        <SkeletonSections />
      </Story.Section>
      <Story.Section title="SkeletonBlock">
        <SkeletonBlock />
      </Story.Section>
    </Story>
  ),
};
