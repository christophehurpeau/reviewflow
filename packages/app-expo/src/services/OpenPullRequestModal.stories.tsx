import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, Text, View } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { OpenPullRequestModal } from "./OpenPullRequestModal.tsx";

function Case({ startOpen }: { startOpen: boolean }): ReactNode {
  const [open, setOpen] = useState(startOpen);
  const [opened, setOpened] = useState<string | null>(null);
  return (
    <View className="gap-m bg-screen p-l">
      <View className="flex-row">
        <Button
          text="Open a pull request"
          onPress={() => {
            setOpen(true);
          }}
        />
      </View>
      {opened === null ? null : <Text>Opened {opened}</Text>}
      <OpenPullRequestModal
        visible={open}
        onClose={() => {
          setOpen(false);
        }}
        onOpen={(ref) => {
          setOpened(`${ref.ownerRepo}#${String(ref.number)}`);
          setOpen(false);
        }}
      />
    </View>
  );
}

const meta = {
  component: OpenPullRequestModal,
  parameters: {
    componentSubtitle:
      "Asks for a pull request: a GitHub url, owner/repo#n or owner/repo/n",
  },
} satisfies Meta<typeof OpenPullRequestModal>;

export default meta;

export const ClosedStory: StoryObj<typeof OpenPullRequestModal> = {
  name: "OpenPullRequestModal Closed",
  render: () => <Case startOpen={false} />,
};

export const OpenStory: StoryObj<typeof OpenPullRequestModal> = {
  name: "OpenPullRequestModal Open",
  render: () => <Case startOpen />,
};
