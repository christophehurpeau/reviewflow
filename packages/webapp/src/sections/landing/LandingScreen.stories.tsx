import type { Meta, StoryObj } from "@storybook/react-native";
import { fn } from "storybook/test";
import { LandingScreen } from "./LandingScreen.tsx";

const meta = {
  component: LandingScreen,
  parameters: {
    componentSubtitle: "Signed-out home: pitch, features and the sign in",
  },
  args: { loggedOut: false, onSignIn: fn() },
} satisfies Meta<typeof LandingScreen>;

export default meta;

export const DefaultStory: StoryObj<typeof LandingScreen> = {
  name: "LandingScreen Default",
};

export const LoggedOutStory: StoryObj<typeof LandingScreen> = {
  name: "LandingScreen Logged out",
  args: { loggedOut: true },
};

export const ErrorStory: StoryObj<typeof LandingScreen> = {
  name: "LandingScreen Error",
  args: { error: "GitHub refused the sign in: access denied" },
};
