import type { Meta, StoryObj } from "@storybook/react-native";
import { expect, within } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import { MarkdownText } from "./markdown-text.tsx";

const sample = [
  "# Heading",
  "",
  "Some **bold**, _italic_, ~~struck~~ and `inline code`, a [link](https://github.com) and :rocket: an emoji.",
  "",
  "- [x] done",
  "- [ ] to do",
  "",
  "> a quote",
  "",
  "| a | b |",
  "| - | - |",
  "| 1 | 2 |",
  "",
  "```ts",
  "const answer = 42;",
  "```",
].join("\n");

const meta = {
  component: MarkdownText,
  parameters: {
    componentSubtitle: "GitHub-flavoured markdown rendered with alouette",
  },
  args: { text: sample, github: true },
} satisfies Meta<typeof MarkdownText>;

export default meta;

export const PreviewStory: StoryObj<typeof MarkdownText> = {
  name: "MarkdownText Preview",
};

export const VariantsStory: StoryObj<typeof MarkdownText> = {
  name: "MarkdownText Variants",
  render: () => (
    <Story>
      <Story.Section title="github">
        <MarkdownText github text={sample} />
      </Story.Section>
      <Story.Section title="plain">
        <MarkdownText text={sample} />
      </Story.Section>
      <Story.Section title="suggestion block">
        <MarkdownText github text={"```suggestion\nconst key = a + b;\n```"} />
      </Story.Section>
      <Story.Section title="raw html">
        <MarkdownText
          github
          text="<details><summary>More</summary>Hidden <b>text</b></details>"
        />
      </Story.Section>
      <Story.Section title="empty">
        <MarkdownText github text="" />
      </Story.Section>
    </Story>
  ),
};

const unsafe = [
  "![tracker](javascript:alert(1)) and [click](javascript:alert(2))",
  "",
  '<img src="intent://scan#Intent;end" alt="intent image">',
].join("\n");

export const UnsafeUrlsStory: StoryObj<typeof MarkdownText> = {
  name: "MarkdownText Unsafe urls",
  render: () => (
    <Story>
      <Story.Section title="github">
        <MarkdownText github text={unsafe} />
      </Story.Section>
      <Story.Section title="plain">
        <MarkdownText text="[click](javascript:alert(3))" />
      </Story.Section>
    </Story>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("intent image")).toBeVisible();
    await expect(canvas.getByText("tracker")).toBeVisible();
    await expect(canvas.queryAllByRole("link")).toEqual([]);
  },
};
