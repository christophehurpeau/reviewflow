import type { Meta, StoryObj } from "@storybook/react-native";
import { ResourcesServerError } from "liwi-resources-client";
import { StartReviewScreen } from "./StartReviewScreen.tsx";

const meta = {
  component: StartReviewScreen,
  parameters: {
    componentSubtitle:
      "Waits while the review is started, then leaves for github",
  },
} satisfies Meta<typeof StartReviewScreen>;

export default meta;

export const LoadingStory: StoryObj<typeof StartReviewScreen> = {
  name: "StartReviewScreen Loading",
  args: { error: undefined },
};

export const RefusedByGithubStory: StoryObj<typeof StartReviewScreen> = {
  name: "StartReviewScreen Refused by github",
  args: {
    error: new ResourcesServerError(
      "BAD_REQUEST",
      "Can not approve your own pull request",
    ),
  },
};

export const MissingPrIdStory: StoryObj<typeof StartReviewScreen> = {
  name: "StartReviewScreen Missing pull request",
  args: { error: new Error("This link carries no pull request") },
};
