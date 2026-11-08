import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, View } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { TextInput } from "react-native";
import { expect, userEvent, within } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import {
  PullRequestDraftsProvider,
  useDraftText,
} from "./PullRequestDraftsProvider.tsx";

interface DraftEditorProps {
  label: string;
  draftKey: string;
  initial?: string;
}

function DraftEditor({
  label,
  draftKey,
  initial,
}: DraftEditorProps): ReactNode {
  const draft = useDraftText(draftKey, initial);
  return (
    <View className="gap-xxs">
      <TextInput
        aria-label={label}
        value={draft.text}
        onChangeText={draft.setText}
      />
      <Button
        size="sm"
        text={`Discard ${label}`}
        onPress={() => {
          draft.discard();
        }}
      />
    </View>
  );
}

/** A pending comment saved: its body changes and its editor is discarded in one press. */
function PendingCase(): ReactNode {
  const [body, setBody] = useState("saved body");
  const draft = useDraftText("pending:1", body);
  return (
    <View className="gap-xxs">
      <TextInput
        aria-label="Pending"
        value={draft.text}
        onChangeText={draft.setText}
      />
      <Button
        size="sm"
        text="Save the pending comment"
        onPress={() => {
          setBody(draft.text);
          draft.discard();
        }}
      />
    </View>
  );
}

/** Two editors of one key, one of them unmounted and mounted again on demand. */
function DraftsCase(): ReactNode {
  const [shown, setShown] = useState(true);
  return (
    <PullRequestDraftsProvider
      store={undefined}
      pullRequest={{ ownerRepo: "acme/web", number: 12 }}
    >
      <Story>
        <Story.Section title="one key, two editors">
          <DraftEditor label="Conversation reply" draftKey="reply:1" />
          {shown ? <DraftEditor label="Diff reply" draftKey="reply:1" /> : null}
          <Button
            size="sm"
            text={shown ? "Unmount diff reply" : "Mount diff reply"}
            onPress={() => {
              setShown(!shown);
            }}
          />
        </Story.Section>
        <Story.Section title="saved, then edited again">
          <PendingCase />
        </Story.Section>
      </Story>
    </PullRequestDraftsProvider>
  );
}

const meta = {
  component: DraftsCase,
  parameters: {
    componentSubtitle:
      "The text of each editor, shared by key and kept across remounts",
  },
} satisfies Meta<typeof DraftsCase>;

export default meta;

export const SharedAndKeptStory: StoryObj<typeof DraftsCase> = {
  name: "PullRequestDrafts Shared and kept",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      await canvas.findByLabelText("Conversation reply"),
      "hello",
    );
    await expect(canvas.getByLabelText("Diff reply")).toHaveValue("hello");

    await userEvent.click(
      canvas.getByRole("button", { name: "Unmount diff reply" }),
    );
    await userEvent.click(
      canvas.getByRole("button", { name: "Mount diff reply" }),
    );
    await expect(await canvas.findByLabelText("Diff reply")).toHaveValue(
      "hello",
    );

    await userEvent.type(canvas.getByLabelText("Pending"), " more");
    await userEvent.click(
      canvas.getByRole("button", { name: "Save the pending comment" }),
    );
    await expect(canvas.getByLabelText("Pending")).toHaveValue(
      "saved body more",
    );
  },
};
