import type { BoardFilters } from "@reviewflow/sdk";
import { defaultBoardFilters } from "@reviewflow/sdk";
import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, ScreenScrollView, Text, View } from "alouette";
import type { JSX, ReactNode } from "react";
import { useState } from "react";
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

function FilteredBoard({
  initial,
}: {
  initial: Partial<BoardFilters>;
}): ReactNode {
  const [value, setValue] = useState<BoardFilters>({
    ...defaultBoardFilters,
    ...initial,
  });
  return render({}, { filtering: { value, onChange: setValue } });
}

export const FiltersStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Filters",
  render: () => <FilteredBoard initial={{}} />,
};

export const FiltersNoMatchStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Filters without a match",
  render: () => <FilteredBoard initial={{ author: "nobody" }} />,
};

export const FiltersActiveStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Filters active",
  render: () => (
    <FilteredBoard
      initial={{ search: "legacy", review: "requested", label: "cleanup" }}
    />
  ),
};

export const ClosedStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Closed",
  render: () => <FilteredBoard initial={{ state: "closed" }} />,
};

export const ReviewStartedStory: StoryObj<typeof PullRequestBoard> = {
  name: "PullRequestBoard Review started",
  render: () =>
    render({
      startedReviews: [{ ownerRepo: "acme/storefront", number: 482 }],
    }),
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
