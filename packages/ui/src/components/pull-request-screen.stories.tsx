import type { Meta, StoryObj } from "@storybook/react-native";
import { Button, ScreenScrollView, Text, View } from "alouette";
import { useState } from "react";
import type { ReactNode } from "react";
import { expect, within } from "storybook/test";
import type { DraftStore } from "../services/PullRequestDraftsProvider.tsx";
import * as fixtures from "../stories/fixtures.ts";
import { MockDataSourceProvider } from "../stories/mockDataSource.tsx";
import type { MockDataSourceOptions } from "../stories/mockDataSource.tsx";
import type { PullRequestTab } from "./pull-request-panel.tsx";
import type { PullRequestScreenProps } from "./pull-request-screen.tsx";
import { PullRequestScreen } from "./pull-request-screen.tsx";

interface ScreenCaseProps extends MockDataSourceOptions {
  initialTab: PullRequestTab;
  slots?: Pick<
    PullRequestScreenProps,
    "renderBelowHeader" | "renderHeaderActions"
  >;
  /** the app's button to where checkouts are configured */
  withSettingsAction?: boolean;
  draftStore?: DraftStore;
}

/** The tab is controlled by the app; here, by state, so the tabs can be pressed. */
function ScreenCase({
  initialTab,
  slots,
  withSettingsAction = false,
  draftStore,
  ...options
}: ScreenCaseProps): ReactNode {
  const [tab, setTab] = useState<PullRequestTab>(initialTab);
  return (
    <MockDataSourceProvider {...options}>
      <ScreenScrollView className="bg-screen">
        <PullRequestScreen
          ownerRepo={fixtures.ownerRepo}
          number={fixtures.number}
          tab={tab}
          slots={
            withSettingsAction
              ? {
                  renderRepositoryAction: () => (
                    <Button
                      text="Add it in Settings"
                      accent="neutral"
                      variant="tonal"
                      size="sm"
                    />
                  ),
                }
              : undefined
          }
          draftStore={draftStore}
          onTabChange={setTab}
          {...slots}
        />
      </ScreenScrollView>
    </MockDataSourceProvider>
  );
}

const meta = {
  component: PullRequestScreen,
  parameters: {
    componentSubtitle:
      "A pull request as GitHub's page: header, conversation, commits, checks and review",
  },
} satisfies Meta<typeof PullRequestScreen>;

export default meta;

type Story = StoryObj<typeof PullRequestScreen>;

const sectionTabNames = async (
  canvasElement: HTMLElement,
): Promise<string[]> => {
  const sections = await within(canvasElement).findByRole("tablist", {
    name: "Pull request sections",
  });
  return within(sections)
    .getAllByRole("tab")
    .map((tab) => tab.textContent ?? "");
};

export const ConversationStory: Story = {
  name: "PullRequestScreen Conversation",
  render: () => <ScreenCase initialTab="timeline" />,
  play: async ({ canvasElement }) => {
    await expect(await sectionTabNames(canvasElement)).toEqual([
      "Review (2 files)",
      "Conversation",
      "Commits (2)",
      "Checks (4)",
    ]);
  },
};

export const ConversationAsAuthorStory: Story = {
  name: "PullRequestScreen Conversation, read by its author",
  render: () => (
    <ScreenCase
      initialTab="timeline"
      detail={{
        ...fixtures.detail,
        viewer: fixtures.detail.pullRequest.author?.login ?? "",
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    await expect(await sectionTabNames(canvasElement)).toEqual([
      "Conversation",
      "Commits (2)",
      "Checks (4)",
      "Review (2 files)",
    ]);
  },
};

export const ChecksStory: Story = {
  name: "PullRequestScreen Checks",
  render: () => <ScreenCase initialTab="checks" />,
};

export const CommitsStory: Story = {
  name: "PullRequestScreen Commits",
  render: () => <ScreenCase initialTab="commits" />,
};

export const ReviewStory: Story = {
  name: "PullRequestScreen Review, checks blocking",
  render: () => (
    <ScreenCase
      initialTab="review"
      reviewflowPr={{ pr: fixtures.reviewflowPr }}
    />
  ),
};

export const ReviewChecksPassedStory: Story = {
  name: "PullRequestScreen Review, checks passed",
  render: () => (
    <ScreenCase
      initialTab="review"
      reviewflowPr={{
        pr: {
          ...fixtures.reviewflowPr,
          checks: {
            ...fixtures.reviewflowPr.checks,
            conclusion: "passed",
            failed: 0,
            running: 0,
            failedNames: [],
          },
        },
      }}
    />
  ),
};

export const ReviewUnknownToReviewflowStory: Story = {
  name: "PullRequestScreen Review, unknown to reviewflow",
  render: () => <ScreenCase initialTab="review" reviewflowPr={{ pr: null }} />,
};

export const ReviewDiffByCommitStory: Story = {
  name: "PullRequestScreen Review, commit by commit",
  render: () => (
    <ScreenCase initialTab="review" diffsByHead={fixtures.commitDiffs} />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("1 / 2")).toBeVisible();
    await expect(
      canvas.getByText("feat(cart): add a totals cache"),
    ).toBeVisible();
  },
};

export const ReviewDiffByCommitNoCheckoutStory: Story = {
  name: "PullRequestScreen Review, commit by commit without a checkout",
  render: () => (
    <ScreenCase
      initialTab="review"
      diffsByHead={fixtures.commitDiffs}
      attachment={{
        status: "notConfigured",
        detail: "no checkout is configured for acme/storefront",
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Read commit by commit" }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      canvas.getByRole("button", {
        name: "Order files for reading (experimental)",
      }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(canvas.queryByText("1 / 2")).toBeNull();
  },
};

export const ReviewDiffFetchingStory: Story = {
  name: "PullRequestScreen Review, fetching commits",
  render: () => (
    <ScreenCase
      initialTab="review"
      diff={{ value: null, reading: true, step: "fetching" }}
    />
  ),
};

export const ReviewDiffDiffingStory: Story = {
  name: "PullRequestScreen Review, computing diff",
  render: () => (
    <ScreenCase
      initialTab="review"
      diff={{ value: null, reading: true, step: "diffing" }}
    />
  ),
};

export const ReviewDiffRefusedStory: Story = {
  name: "PullRequestScreen Review, no checkout configured",
  render: () => (
    <ScreenCase
      withSettingsAction
      initialTab="review"
      diff={{
        value: null,
        refused: {
          reason: "notConfigured",
          ownerRepo: fixtures.ownerRepo,
          configPath: "/Users/ada/.reviewflow-app/config.json",
          detail: "acme/storefront is not in the config file.",
        },
      }}
    />
  ),
};

export const ReviewDiffInvalidPathStory: Story = {
  name: "PullRequestScreen Review, invalid checkout path",
  render: () => (
    <ScreenCase
      initialTab="review"
      diff={{
        value: null,
        refused: {
          reason: "invalidPath",
          ownerRepo: fixtures.ownerRepo,
          configPath: "/Users/ada/.reviewflow-app/config.json",
          detail:
            "/Users/ada/dev/storefront has origin acme/web, not acme/storefront.",
        },
      }}
    />
  ),
};

export const NotAttachedStory: Story = {
  name: "PullRequestScreen Repository not attached",
  render: () => (
    <ScreenCase
      withSettingsAction
      initialTab="timeline"
      attachment={{
        status: "notConfigured",
        detail: "no checkout is configured for acme/storefront",
      }}
    />
  ),
};

export const NotAttachedInvalidPathStory: Story = {
  name: "PullRequestScreen Repository attached to a wrong checkout",
  render: () => (
    <ScreenCase
      withSettingsAction
      initialTab="checks"
      attachment={{
        status: "invalidPath",
        detail:
          "remote.origin.url of /Users/ada/dev/storefront is git@github.com:acme/web.git, which does not name acme/storefront",
      }}
    />
  ),
};

const keptComment = "A comment left half written before a reload";

/** What the app's store holds after a reload: the new comment being written. */
const createKeptDrafts = (): DraftStore => {
  const drafts = new Map<string, unknown>([
    [`${fixtures.ownerRepo}#${String(fixtures.number)}:comment`, keptComment],
  ]);
  return {
    retentionDays: 7,
    read: (key) => drafts.get(key),
    write: (key, value) => {
      drafts.set(key, value);
    },
    remove: (key) => {
      drafts.delete(key);
    },
  };
};

export const DraftsKeptStory: Story = {
  name: "PullRequestScreen Conversation, draft kept from an earlier visit",
  render: () => (
    <ScreenCase initialTab="timeline" draftStore={createKeptDrafts()} />
  ),
  play: async ({ canvasElement }) => {
    await expect(
      await within(canvasElement).findByText(keptComment),
    ).toBeInTheDocument();
  },
};

export const LoadingStory: Story = {
  name: "PullRequestScreen Loading",
  render: () => <ScreenCase loading initialTab="timeline" />,
};

export const AppSlotsStory: Story = {
  name: "PullRequestScreen App slots",
  render: () => (
    <ScreenCase
      initialTab="timeline"
      slots={{
        renderHeaderActions: (_ref, detail) =>
          detail === null ? null : (
            <Button
              text="Review in a new session"
              accent="neutral"
              variant="tonal"
              size="sm"
            />
          ),
        renderBelowHeader: (_ref, detail) =>
          detail === null ? null : (
            <View className="flex-row flex-wrap items-center gap-xs">
              <Text className="text-sm text-muted">Task</Text>
              <Text className="font-body-bold text-sm">
                Storefront cart totals
              </Text>
              <Button
                text="Open task"
                accent="neutral"
                variant="tonal"
                size="sm"
              />
            </View>
          ),
      }}
    />
  ),
};

export const SummaryWhileLoadingStory: Story = {
  name: "PullRequestScreen Summary while loading",
  render: () => (
    <ScreenCase loading summary={fixtures.summary} initialTab="timeline" />
  ),
};
