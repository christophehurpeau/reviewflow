import type { Meta, StoryObj } from "@storybook/react-native";
import type { PrSummary } from "reviewflow-modules";
import { PrRow } from "#/components/pr-row.tsx";
import { Story } from "#storybook/Story.tsx";

const basePr: PrSummary = {
  _id: "pr-412",
  orgLogin: "elax",
  repoName: "reviewflow",
  number: 412,
  title: "Fix flaky worker retry loop",
  url: "https://github.com/elax/reviewflow/pull/412",
  isDraft: false,
  checks: { conclusion: "passed", runningCount: 0, failedNames: [] },
  lintFailed: false,
  statusLinks: [],
  approvedCount: 0,
  changesRequestedBy: [],
  requestedReviewers: [],
  requestedTeams: [],
  assignees: [],
  changes: { changedFiles: 5, additions: 120, deletions: 8 },
};

const buildPr = (overrides: Partial<PrSummary>): PrSummary => ({
  ...basePr,
  ...overrides,
});

const failingPr = buildPr({
  checks: {
    conclusion: "failed",
    runningCount: 0,
    failedNames: ["ci/build", "lint"],
  },
});

const meta = {
  component: PrRow,
  parameters: {
    componentSubtitle: "One pull request in a bucket list",
  },
  args: {
    pr: failingPr,
  },
} satisfies Meta<typeof PrRow>;

export default meta;

export const PreviewStory: StoryObj<typeof PrRow> = {
  name: "PrRow Preview",
};

export const VariantsStory: StoryObj<typeof PrRow> = {
  name: "PrRow Variants",
  render: () => (
    <Story>
      <Story.Section title="nothing to report">
        <PrRow
          pr={buildPr({
            checks: {
              conclusion: "unknown",
              runningCount: 0,
              failedNames: [],
            },
            changes: undefined,
          })}
        />
      </Story.Section>

      <Story.Section title="checks passed">
        <PrRow pr={basePr} />
      </Story.Section>

      <Story.Section title="checks passed, hidden by the section">
        <PrRow pr={basePr} showPassedChecks={false} />
      </Story.Section>

      <Story.Section title="checks running">
        <PrRow
          pr={buildPr({
            checks: {
              conclusion: "in-progress",
              runningCount: 3,
              failedNames: [],
            },
          })}
        />
      </Story.Section>

      <Story.Section title="checks failed">
        <PrRow pr={failingPr} />
      </Story.Section>

      <Story.Section title="checks failed and pr lint failed">
        <PrRow pr={buildPr({ ...failingPr, lintFailed: true })} />
      </Story.Section>

      <Story.Section title="more failed checks than the cap">
        <PrRow
          pr={buildPr({
            checks: {
              conclusion: "failed",
              runningCount: 0,
              failedNames: [
                "ci/build",
                "ci/test",
                "ci/e2e",
                "ci/lint",
                "ci/types",
                "ci/bundle",
                "ci/audit",
                "ci/licenses",
                "ci/deploy",
                "netlify",
                "codecov",
              ],
            },
          })}
        />
      </Story.Section>

      <Story.Section title="draft">
        <PrRow pr={buildPr({ isDraft: true })} />
      </Story.Section>

      <Story.Section title="draft, hidden by the section">
        <PrRow pr={buildPr({ isDraft: true })} showDraft={false} />
      </Story.Section>

      <Story.Section title="changes requested">
        <PrRow
          pr={buildPr({
            changesRequestedBy: [
              { id: 1, login: "bob" },
              { id: 2, login: "carol" },
            ],
          })}
        />
      </Story.Section>

      <Story.Section title="approved and awaiting reviewers">
        <PrRow
          pr={buildPr({
            approvedCount: 2,
            requestedReviewers: [
              { id: 1, login: "alice" },
              { id: 2, login: "bob" },
            ],
            requestedTeams: ["core"],
          })}
        />
      </Story.Section>

      <Story.Section title="the viewer among the awaited reviewers">
        <PrRow
          pr={buildPr({
            requestedReviewers: [
              { id: 1, login: "chris" },
              { id: 2, login: "alice" },
            ],
            requestedTeams: ["core"],
          })}
          currentUserLogin="chris"
        />
      </Story.Section>

      <Story.Section title="requested verb, someone else's pull request">
        <PrRow
          pr={buildPr({
            requestedReviewers: [
              { id: 1, login: "chris" },
              { id: 2, login: "alice" },
            ],
          })}
          reviewRequestVerb="requested"
          currentUserLogin="chris"
        />
      </Story.Section>

      <Story.Section title="many reviewers, uncapped">
        <PrRow
          pr={buildPr({
            requestedReviewers: [
              { id: 1, login: "alice" },
              { id: 2, login: "bob" },
              { id: 3, login: "carol" },
              { id: 4, login: "dan" },
              { id: 5, login: "erin" },
            ],
            requestedTeams: ["core", "platform", "design"],
          })}
        />
      </Story.Section>

      <Story.Section title="one status link">
        <PrRow
          pr={buildPr({
            statusLinks: [
              {
                name: "notion-ticket",
                label: "GEN-1234",
                url: "https://www.notion.so/elaxenergie/GEN-1234",
                type: "success",
              },
            ],
          })}
        />
      </Story.Section>

      <Story.Section title="several status links, a failing one dropped">
        <PrRow
          pr={buildPr({
            statusLinks: [
              {
                name: "notion-ticket",
                label: "GEN-1234",
                url: "https://www.notion.so/elaxenergie/GEN-1234",
                type: "success",
              },
              {
                name: "preview",
                label: "preview",
                url: "https://preview.example.com",
                type: "success",
              },
              {
                name: "lint-pr",
                label: "Title does not match conventional commit.",
                url: "https://www.conventionalcommits.org/",
                type: "failure",
              },
            ],
          })}
        />
      </Story.Section>

      <Story.Section title="every state at once">
        <PrRow
          pr={buildPr({
            isDraft: true,
            lintFailed: true,
            checks: {
              conclusion: "failed",
              runningCount: 0,
              failedNames: ["ci/build", "lint"],
            },
            statusLinks: [
              {
                name: "notion-ticket",
                label: "GEN-1234",
                url: "https://www.notion.so/elaxenergie/GEN-1234",
                type: "success",
              },
            ],
            approvedCount: 1,
            changesRequestedBy: [{ id: 1, login: "bob" }],
            requestedReviewers: [{ id: 2, login: "carol" }],
            requestedTeams: ["core"],
          })}
        />
      </Story.Section>

      <Story.Section title="long title">
        <PrRow
          pr={buildPr({
            title:
              "refactor: move the pull request summary derivation into core so the slack home and the webapp stop drifting",
          })}
        />
      </Story.Section>
    </Story>
  ),
};
