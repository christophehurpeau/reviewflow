import type { Meta, StoryObj } from "@storybook/react-native";
import { ScreenScrollView, Text } from "alouette";
import { fn } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import { boardResponse } from "./fixtures.ts";
import { PullRequestRow } from "./pull-request-row.tsx";

const meta = {
  component: PullRequestRow,
  parameters: {
    componentSubtitle: "One pull request of a reviewflow bucket",
  },
} satisfies Meta<typeof PullRequestRow>;

export default meta;

const groups = boardResponse.board?.groups ?? [];
const prs = groups.flatMap((group) =>
  group.buckets.flatMap((bucket) =>
    bucket.prs.map((pr) => ({
      pr,
      bucketKey: bucket.key,
      groupKey: group.key,
    })),
  ),
);

export const RowStory: StoryObj<typeof PullRequestRow> = {
  name: "PullRequestRow Preview",
  render: () => (
    <ScreenScrollView className="bg-screen" contentContainerClassName="p-l">
      <PullRequestRow row={prs[0]!} viewer="grace" onOpenPullRequest={fn()} />
    </ScreenScrollView>
  ),
};

export const RowVariantsStory: StoryObj<typeof PullRequestRow> = {
  name: "PullRequestRow Variants",
  render: () => (
    <Story>
      {prs.map((row) => (
        <Story.Section
          key={row.pr.id}
          title={`${row.bucketKey} #${String(row.pr.number)}`}
        >
          <PullRequestRow
            row={row}
            viewer="grace"
            renderRowExtra={
              row.pr.number === 482
                ? () => <Text className="text-xs text-muted">extra slot</Text>
                : undefined
            }
            onOpenPullRequest={fn()}
          />
        </Story.Section>
      ))}
      <Story.Section title="with the Start review button">
        <PullRequestRow
          row={prs[0]!}
          viewer="grace"
          onOpenPullRequest={fn()}
          onStartReview={fn(() => Promise.resolve())}
        />
      </Story.Section>
      <Story.Section title="Start review refused by GitHub">
        <PullRequestRow
          row={prs[0]!}
          viewer="grace"
          onOpenPullRequest={fn()}
          onStartReview={fn(() =>
            Promise.reject(new Error("Can not review this pull request")),
          )}
        />
      </Story.Section>
    </Story>
  ),
};
