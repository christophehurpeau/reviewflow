import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, ScreenScrollView, Text, View } from "alouette";
import type { JSX } from "react";
import { fn } from "storybook/test";
import * as fixtures from "./fixtures.ts";
import type { MockBoardOptions } from "./mockDataSource.tsx";
import { MockBoardSourceProvider } from "./mockDataSource.tsx";
import type { PullRequestBoardProps } from "./pull-request-board.tsx";
import { PullRequestBoard } from "./pull-request-board.tsx";

const meta = {
  component: PullRequestBoard,
  parameters: {
    componentSubtitle:
      "reviewflow's buckets of pull requests, as it sends them, behind a BoardDataSource",
  },
} satisfies Meta<typeof PullRequestBoard>;

export default meta;

const render = (
  options: MockBoardOptions = {},
  props: Partial<PullRequestBoardProps> = {},
): JSX.Element => (
  <MockBoardSourceProvider {...options}>
    <ScreenScrollView className="bg-screen">
      <View className="page-container py-l">
        <PullRequestBoard
          actions={<Button text="Open a pull request" size="sm" />}
          renderConnect={() => (
            <Button text="Connect reviewflow" accent="brand" />
          )}
          onOpenPullRequest={fn()}
          {...props}
        />
      </View>
    </ScreenScrollView>
  </MockBoardSourceProvider>
);

export const BoardStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Preview",
  render: () => render(),
};

export const LoadingStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Loading",
  render: () => render({ board: { value: null, reading: true } }),
};

export const ErrorStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Error",
  render: () =>
    render({
      board: { value: null, error: "reviewflow answered 502: bad gateway" },
    }),
};

export const NotConfiguredStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Not configured",
  render: () =>
    render({
      board: { value: null },
      status: fixtures.notConfiguredStatus,
    }),
};

export const EmptyStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Empty",
  render: () => render({ board: { value: fixtures.emptyBoardResponse } }),
};

export const ExtraSectionStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Buckets and extra section",
  render: () =>
    render(
      {},
      {
        extraSections: fixtures.extraSections,
        renderRowExtra: ({ pr }) => (
          <Text className="text-sm text-muted">{`Task for ${pr.headRef}`}</Text>
        ),
      },
    ),
};

export const ExtraSectionsOnlyStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Extra sections only",
  render: () =>
    render(
      { board: { value: { board: null, viewer: "grace" } } },
      { extraSections: fixtures.extraSections },
    ),
};
