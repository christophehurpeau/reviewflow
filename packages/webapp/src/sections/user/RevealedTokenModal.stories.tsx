import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";
import { RevealedTokenModal } from "./RevealedTokenModal.tsx";

const meta = {
  component: RevealedTokenModal,
  parameters: {
    componentSubtitle: "Shows a new API token once, with a copy button",
  },
  args: {
    token: "rfp_x7KqVb3n0cJ9sWmE2tYhRfLpA8dGzU4kNoX1iQe6vTs",
    onClose: fn(),
  },
} satisfies Meta<typeof RevealedTokenModal>;

export default meta;

export const PreviewStory: StoryObj<typeof meta> = {
  name: "RevealedTokenModal Preview",
};
