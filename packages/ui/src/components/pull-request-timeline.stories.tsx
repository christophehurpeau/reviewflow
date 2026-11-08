import type { Meta, StoryObj } from "@storybook/react-native";
import { ScreenScrollView } from "alouette";
import { fn } from "storybook/test";
import { PullRequestReviewDraftProvider } from "../services/PullRequestReviewDraftProvider.tsx";
import { PullRequestSuggestionBatchProvider } from "../services/PullRequestSuggestionBatchProvider.tsx";
import * as fixtures from "../stories/fixtures.ts";
import { MockDataSourceProvider } from "../stories/mockDataSource.tsx";
import { PullRequestTimeline } from "./pull-request-timeline.tsx";

const meta = {
  component: PullRequestTimeline,
  parameters: {
    componentSubtitle:
      "The description, comments, reviews, threads with suggestions and events, oldest first",
  },
} satisfies Meta<typeof PullRequestTimeline>;

export default meta;

export const TimelineStory: StoryObj<typeof PullRequestTimeline> = {
  name: "PullRequestTimeline Preview",
  render: () => (
    <MockDataSourceProvider>
      <PullRequestReviewDraftProvider
        latest={{ head: fixtures.headSha, base: fixtures.baseSha }}
      >
        <PullRequestSuggestionBatchProvider
          pullRequest={fixtures.detail.pullRequest}
          onEdited={fn(() => Promise.resolve())}
        >
          <ScreenScrollView
            className="bg-screen"
            contentContainerClassName="p-l"
          >
            <PullRequestTimeline
              detail={fixtures.detail}
              onEdited={fn(() => Promise.resolve())}
            />
          </ScreenScrollView>
        </PullRequestSuggestionBatchProvider>
      </PullRequestReviewDraftProvider>
    </MockDataSourceProvider>
  ),
};
