import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, Text, View } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import { CodeEditor } from "./code-editor.tsx";
import type { EditorHighlight } from "./highlights.ts";
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

const plan = [
  "# Plan",
  "",
  "1. Add a `hello.txt` file at the root.",
  "2. Check its content with `cat hello.txt`.",
].join("\n");

/** Select a passage, press Comment: it is marked, and pressing it activates it. */
function Annotated(): ReactNode {
  const [highlights, setHighlights] = useState<EditorHighlight[]>([
    { id: "1", from: 13, to: 31 },
  ]);
  const [active, setActive] = useState<string | null>(null);
  return (
    <View className="gap-xs">
      <MarkdownEditor
        readOnly
        aria-label="Plan"
        value={plan}
        highlights={highlights}
        activeHighlightId={active}
        renderSelectionAction={(selection) => (
          <Button
            size="sm"
            text="Comment"
            onPress={() => {
              const id = String(highlights.length + 1);
              setHighlights([...highlights, { id, ...selection }]);
              setActive(id);
            }}
          />
        )}
        onHighlightPress={setActive}
      />
      <Text className="text-muted text-sm">{`active: ${active ?? "none"}`}</Text>
    </View>
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
      <Story.Section title="readOnly, annotated">
        <Annotated />
      </Story.Section>
      <Story.Section title="CodeEditor json">
        <CodeEditor
          aria-label="json"
          language="json"
          value={
            '{\n  "repos": { "christophehurpeau/web": "/Users/ada/dev/web" }\n}\n'
          }
        />
      </Story.Section>
      <Story.Section title="CodeEditor markdown">
        <CodeEditor aria-label="markdown" language="markdown" value={sample} />
      </Story.Section>
    </Story>
  ),
};

/** passages, not spans: a mark is split wherever the markdown's own are */
const markedPassages = (root: HTMLElement): number =>
  new Set(
    [...root.querySelectorAll<HTMLElement>(".cm-highlight")].map(
      (element) => element.dataset.highlightId,
    ),
  ).size;

/**
 * A read-only editor is not contenteditable: what is checked is that a
 * selection the browser makes in it still reaches the bubble, and that the
 * passage it comments is marked.
 */
export const AnnotatedStory: StoryObj<typeof MarkdownEditor> = {
  name: "MarkdownEditor Annotated",
  render: () => (
    <Story>
      <Annotated />
    </Story>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(markedPassages(canvasElement)).toBe(1);
    });
    const content = canvasElement.querySelector(".cm-content");
    if (content === null) throw new Error("no editor content");
    const line = [...content.querySelectorAll(".cm-line")].find((element) =>
      element.textContent.startsWith("2."),
    );
    if (line === undefined) throw new Error("no second step");
    const range = document.createRange();
    range.selectNodeContents(line);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    await userEvent.click(await canvas.findByText("Comment"));
    await waitFor(() => {
      expect(markedPassages(canvasElement)).toBe(2);
    });
    await expect(
      [...canvasElement.querySelectorAll(".cm-highlight-active")]
        .map((element) => element.textContent)
        .join(""),
    ).toBe("2. Check its content with `cat hello.txt`.");
  },
};
