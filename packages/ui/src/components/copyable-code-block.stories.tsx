import type { Meta, StoryObj } from "@storybook/react-native";
import { Story } from "../stories/Story.tsx";
import { CopyableCodeBlock } from "./copyable-code-block.tsx";

const meta = {
  component: CopyableCodeBlock,
  parameters: {
    componentSubtitle: "Code block with a copy button beside it",
  },
  args: { text: "pnpm exec vitest run --project ui" },
} satisfies Meta<typeof CopyableCodeBlock>;

export default meta;

export const PreviewStory: StoryObj<typeof CopyableCodeBlock> = {
  name: "CopyableCodeBlock Preview",
};

export const VariantsStory: StoryObj<typeof CopyableCodeBlock> = {
  name: "CopyableCodeBlock Variants",
  render: () => (
    <Story>
      <Story.Section title="one line">
        <CopyableCodeBlock text="git fetch origin" />
      </Story.Section>
      <Story.Section title="long line">
        <CopyableCodeBlock text="git fetch origin refs/pull/482/head:refs/remotes/origin/pr/482 --no-tags --depth=200 --update-head-ok" />
      </Story.Section>
      <Story.Section title="several lines">
        <CopyableCodeBlock text={"git fetch origin\ngit checkout pr/482"} />
      </Story.Section>
    </Story>
  ),
};
