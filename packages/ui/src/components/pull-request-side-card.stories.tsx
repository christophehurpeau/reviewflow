import type { PullRequestDetail } from "@reviewflow/sdk";
import type { Meta, StoryObj } from "@storybook/react-native";
import { View } from "alouette";
import { expect, fn, within } from "storybook/test";
import { Story } from "../stories/Story.tsx";
import * as fixtures from "../stories/fixtures.ts";
import { PullRequestSideCard } from "./pull-request-side-card.tsx";

const answered = { value: fixtures.checks, error: null };

const withPullRequest = (
  pullRequest: Partial<PullRequestDetail>,
): typeof fixtures.detail => ({
  ...fixtures.detail,
  pullRequest: { ...fixtures.detail.pullRequest, ...pullRequest },
});

const onEdit = fn(() => Promise.resolve());

const meta = {
  component: PullRequestSideCard,
  parameters: {
    componentSubtitle:
      "A pull request at a glance in a side column: status, merge, checks and reviewers",
  },
  args: {
    detail: fixtures.detail,
    checks: answered,
    summary: fixtures.summary,
    candidates: fixtures.candidates,
    onEdit,
  },
} satisfies Meta<typeof PullRequestSideCard>;

export default meta;

export const PreviewStory: StoryObj<typeof PullRequestSideCard> = {
  name: "PullRequestSideCard Preview",
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("2 passing")).toBeVisible();
    await expect(canvas.getByText("awaiting")).toBeVisible();
    await expect(canvas.getByText("e2e / checkout")).toBeVisible();
  },
};

export const VariantsStory: StoryObj<typeof PullRequestSideCard> = {
  name: "PullRequestSideCard Variants",
  render: () => (
    <Story>
      <Story.Section title="open, in a 320px column">
        <View className="w-[320px]">
          <PullRequestSideCard
            detail={fixtures.detail}
            checks={answered}
            summary={fixtures.summary}
            candidates={fixtures.candidates}
            onEdit={onEdit}
          />
        </View>
      </Story.Section>
      <Story.Section title="open, approved, behind its base, read by its author">
        <PullRequestSideCard
          detail={{
            ...withPullRequest({
              mergeState: "behind",
              viewerCanUpdateBranch: true,
            }),
            viewer: "ada",
          }}
          checks={answered}
          summary={{ ...fixtures.summary, reviewState: "approved" }}
          candidates={fixtures.candidates}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="open, conflicting, one merge method">
        <PullRequestSideCard
          detail={withPullRequest({
            mergeable: "conflicting",
            mergeState: "dirty",
            mergeMethods: ["squash"],
          })}
          checks={answered}
          summary={fixtures.summary}
          candidates={fixtures.candidates}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="open, without reviewflow nor candidates">
        <PullRequestSideCard
          detail={fixtures.detail}
          checks={answered}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="draft">
        <PullRequestSideCard
          detail={withPullRequest({ state: "draft", mergeState: "draft" })}
          checks={answered}
          summary={{ ...fixtures.summary, state: "draft" }}
          candidates={fixtures.candidates}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="draft, read by someone who cannot update it">
        <PullRequestSideCard
          detail={withPullRequest({
            state: "draft",
            mergeState: "draft",
            viewerCanUpdate: false,
          })}
          checks={answered}
          candidates={fixtures.candidates}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="merged">
        <PullRequestSideCard
          detail={withPullRequest({ state: "merged" })}
          checks={answered}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="closed">
        <PullRequestSideCard
          detail={withPullRequest({ state: "closed" })}
          checks={answered}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="checks being read">
        <PullRequestSideCard
          detail={fixtures.detail}
          checks={{ value: null, error: null }}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="checks failed to read">
        <PullRequestSideCard
          detail={fixtures.detail}
          checks={{ value: null, error: "GitHub answered 502" }}
          onEdit={onEdit}
        />
      </Story.Section>
      <Story.Section title="no checks, partial answer">
        <PullRequestSideCard
          detail={{
            ...fixtures.detail,
            errors: ["Resource not accessible by integration"],
          }}
          checks={{
            value: { ...fixtures.checks, checks: [], checksTotal: 0 },
            error: null,
          }}
          onEdit={onEdit}
        />
      </Story.Section>
    </Story>
  ),
};
