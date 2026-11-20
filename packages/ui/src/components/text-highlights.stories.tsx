import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, Text, View } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { EditorHighlight } from "../editor/highlights.ts";
import { Story } from "../stories/Story.tsx";
import { MarkdownText } from "./markdown-text.tsx";
import { TextHighlights } from "./text-highlights.tsx";

const plan = [
  "# Plan",
  "",
  "1. Add a **hello.txt** file at the root.",
  "2. Check its content with `cat hello.txt`.",
].join("\n");

/** Select a passage, press Comment: it is marked, and pressing it activates it. */
function Annotated(): ReactNode {
  const [highlights, setHighlights] = useState<EditorHighlight[]>([
    // the rendered text starts "Plan1.Add a": the heading, then the number
    { id: "1", from: 6, to: 11 },
  ]);
  const [active, setActive] = useState<string | null>(null);
  return (
    <View className="gap-xs">
      <TextHighlights
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
      >
        <MarkdownText text={plan} />
      </TextHighlights>
      <Text className="text-muted text-sm">{`active: ${active ?? "none"}`}</Text>
    </View>
  );
}

const meta = {
  component: TextHighlights,
  parameters: {
    componentSubtitle:
      "Marks passages of rendered content and acts on its selection (web)",
  },
} satisfies Meta<typeof TextHighlights>;

export default meta;

const marked = (name: string): string[] =>
  [...(CSS.highlights.get(name) ?? [])].map((range) =>
    (range as Range).toString(),
  );

export const AnnotatedStory: StoryObj<typeof TextHighlights> = {
  name: "TextHighlights Annotated",
  render: () => (
    <Story>
      <Annotated />
    </Story>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() => {
      expect(marked("reviewflow-text-highlight")).toEqual(["Add a"]);
    });

    const step = await canvas.findByText(/Check its content/);
    const range = document.createRange();
    range.selectNodeContents(step);
    const selection = document.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);

    await userEvent.click(await canvas.findByText("Comment"));
    await waitFor(() => {
      expect(marked("reviewflow-text-highlight-active")).toEqual([
        "Check its content with ",
      ]);
    });

    document.getSelection()?.removeAllRanges();
    const first = await canvas.findByText("Add a", { exact: false });
    const box = first.getBoundingClientRect();
    await userEvent.pointer({
      keys: "[MouseLeft]",
      coords: { clientX: box.left + 4, clientY: box.top + box.height / 2 },
      target: first,
    });
    await expect(await canvas.findByText("active: 1")).toBeVisible();
  },
};
