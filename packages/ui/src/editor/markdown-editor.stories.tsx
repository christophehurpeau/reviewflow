import type { Meta, StoryObj } from "@storybook/react-native";
import { useState } from "react";
import type { ReactNode } from "react";
import { Story } from "../stories/Story.tsx";
import { CodeEditor } from "./code-editor.tsx";
import { MarkdownEditor } from "./markdown-editor.tsx";

const sample = [
  "---",
  "name: Deslop",
  "---",
  "# Heading",
  "",
  "Some **bold**, _italic_, ~~struck~~ and `inline code`, a [link](https://github.com) and :rocket:.",
  "",
  "- [x] done",
  "- [ ] to do",
  "",
  "> a quote",
  "",
  "```ts",
  "const answer = 42;",
  "```",
].join("\n");

function Controlled({ compact = false }: { compact?: boolean }): ReactNode {
  const [value, setValue] = useState(sample);
  return (
    <MarkdownEditor
      emoji
      aria-label="Markdown"
      value={value}
      compact={compact}
      onChange={setValue}
    />
  );
}

const meta = {
  component: MarkdownEditor,
  parameters: {
    componentSubtitle:
      "A markdown file edited as the text it is, every marker left visible (web; a plain text area on native)",
  },
} satisfies Meta<typeof MarkdownEditor>;

export default meta;

export const EditorStory: StoryObj<typeof MarkdownEditor> = {
  name: "MarkdownEditor Editor",
  render: () => (
    <Story>
      <Controlled />
    </Story>
  ),
};

export const VariantsStory: StoryObj<typeof MarkdownEditor> = {
  name: "MarkdownEditor Variants",
  render: () => (
    <Story>
      <Story.Section title="compact (a comment)">
        <MarkdownEditor
          compact
          emoji
          aria-label="Comment"
          value=""
          onChange={() => undefined}
        />
      </Story.Section>
      <Story.Section title="readOnly">
        <MarkdownEditor readOnly aria-label="Read only" value={sample} />
      </Story.Section>
      <Story.Section title="CodeEditor json">
        <CodeEditor
          aria-label="json"
          language="json"
          value={'{\n  "repos": { "acme/web": "/Users/ada/dev/web" }\n}\n'}
        />
      </Story.Section>
      <Story.Section title="CodeEditor markdown">
        <CodeEditor aria-label="markdown" language="markdown" value={sample} />
      </Story.Section>
    </Story>
  ),
};
