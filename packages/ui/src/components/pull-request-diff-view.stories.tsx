import type { DiffImpactsResponse } from "@reviewflow/sdk";
import type { Meta, StoryObj } from "@storybook/react-native";
import { ScreenScrollView } from "alouette";
import type { ReactNode } from "react";
import type { PullRequestImpactsState } from "../dataSource.ts";
import { PullRequestReviewDraftProvider } from "../services/PullRequestReviewDraftProvider.tsx";
import { Story } from "../stories/Story.tsx";
import * as fixtures from "../stories/fixtures.ts";
import { MockDataSourceProvider } from "../stories/mockDataSource.tsx";
import { DiffSettingsProvider } from "./branch-diff/use-diff-settings.tsx";
import { DiffRefused, PullRequestDiffView } from "./pull-request-diff-view.tsx";

const meta = {
  component: PullRequestDiffView,
  parameters: {
    componentSubtitle:
      "One range of the pull request's diff, with its toolbar, in @pierre/diffs",
  },
} satisfies Meta<typeof PullRequestDiffView>;

export default meta;

export const PreviewStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Preview",
  render: () => (
    <MockDataSourceProvider>
      <DiffSettingsProvider>
        <PullRequestReviewDraftProvider
          latest={{ head: fixtures.headSha, base: fixtures.baseSha }}
        >
          <ScreenScrollView
            className="bg-screen"
            contentContainerClassName="p-l"
          >
            <PullRequestDiffView
              range={{
                ...fixtures.ref,
                head: fixtures.headSha,
                base: fixtures.baseSha,
              }}
            />
          </ScreenScrollView>
        </PullRequestReviewDraftProvider>
      </DiffSettingsProvider>
    </MockDataSourceProvider>
  ),
};

export const ReadingOrderStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Reading order",
  render: () => (
    <MockDataSourceProvider diff={{ value: fixtures.readingOrderDiff }}>
      <DiffSettingsProvider fileOrder="reading">
        <PullRequestReviewDraftProvider
          latest={{ head: fixtures.headSha, base: fixtures.baseSha }}
        >
          <ScreenScrollView
            className="bg-screen"
            contentContainerClassName="p-l"
          >
            <PullRequestDiffView
              range={{
                ...fixtures.ref,
                head: fixtures.headSha,
                base: fixtures.baseSha,
              }}
            />
          </ScreenScrollView>
        </PullRequestReviewDraftProvider>
      </DiffSettingsProvider>
    </MockDataSourceProvider>
  ),
};

interface ImpactsStoryProps {
  impacts?: Partial<PullRequestImpactsState>;
}

function ImpactsView({ impacts }: ImpactsStoryProps): ReactNode {
  return (
    <MockDataSourceProvider
      diff={{ value: fixtures.readingOrderDiff }}
      impacts={impacts}
    >
      <DiffSettingsProvider fileOrder="reading">
        <PullRequestReviewDraftProvider
          latest={{ head: fixtures.headSha, base: fixtures.baseSha }}
        >
          <ScreenScrollView
            className="bg-screen"
            contentContainerClassName="p-l"
          >
            <PullRequestDiffView
              range={{
                ...fixtures.ref,
                head: fixtures.headSha,
                base: fixtures.baseSha,
              }}
            />
          </ScreenScrollView>
        </PullRequestReviewDraftProvider>
      </DiffSettingsProvider>
    </MockDataSourceProvider>
  );
}

export const ImpactsStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Impacts",
  render: () => <ImpactsView />,
};

export const ImpactsReadingStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Impacts reading",
  render: () => <ImpactsView impacts={{ value: null, reading: true }} />,
};

export const ImpactsFailedStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Impacts failed",
  render: () => (
    <ImpactsView impacts={{ value: null, error: "git diff failed" }} />
  ),
};

export const ImpactsTooLargeStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Impacts too large",
  render: () => (
    <ImpactsView impacts={{ value: { tooLarge: true, reason: "files" } }} />
  ),
};

const widelyUsed: DiffImpactsResponse = {
  tooLarge: false,
  files: [
    {
      path: "packages/sdk/src/cart/totals.ts",
      exports: [
        {
          name: "totalsOf",
          removed: false,
          importers: Array.from({ length: 60 }, (_, index) => ({
            path: `packages/ui/src/screen-${String(index)}.tsx`,
            test: index % 4 === 0,
          })),
        },
      ],
    },
  ],
  notAnalyzed: [],
  unresolvedIn: [],
};

export const ImpactsWidelyUsedStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Impacts past 50 files",
  render: () => <ImpactsView impacts={{ value: widelyUsed }} />,
};

export const RefusedStory: StoryObj<typeof PullRequestDiffView> = {
  name: "PullRequestDiffView Refusal",
  render: () => (
    <Story>
      <Story.Section title="not configured">
        <DiffRefused
          refused={{
            reason: "notConfigured",
            ownerRepo: fixtures.ownerRepo,
            configPath: "/Users/ada/.reviewflow-app/config.json",
            detail: "acme/storefront is not in the config file.",
          }}
        />
      </Story.Section>
      <Story.Section title="invalid path">
        <DiffRefused
          refused={{
            reason: "invalidPath",
            ownerRepo: fixtures.ownerRepo,
            configPath: "/Users/ada/.reviewflow-app/config.json",
            detail: "The path does not exist.",
          }}
        />
      </Story.Section>
    </Story>
  ),
};
