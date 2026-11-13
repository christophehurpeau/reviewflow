import type { PrSummary } from "@reviewflow/modules";
import type { Meta, StoryObj } from "@storybook/react-native";
import { EyeRegularIcon } from "alouette-icons/phosphor-icons/Eye";
import { ResourcesServerError } from "liwi-resources-client";
import { fn } from "storybook/test";
import { StartReviewButton } from "#/components/start-review-button.tsx";
import type { PrBucketResource } from "#/sections/prs/PrBucketSection.tsx";
import { PrBucketSection } from "#/sections/prs/PrBucketSection.tsx";
import { Story } from "#storybook/Story.tsx";

const buildPr = (
  number: number,
  title: string,
  creatorLogin = "frank",
): PrSummary => ({
  _id: `pr-${number}`,
  orgLogin: "elax",
  repoName: "reviewflow",
  number,
  title,
  url: `https://github.com/elax/reviewflow/pull/${number}`,
  headRef: `feat/${number}`,
  isDraft: false,
  checks: { conclusion: "passed", runningCount: 0, failedNames: [] },
  lintFailed: false,
  statusLinks: [],
  labels: [],
  reviewState: "requested",
  approvedBy: [],
  changesRequestedBy: [],
  requestedReviewers: [],
  requestedTeams: [],
  reRequestedReviewers: [],
  assignees: [],
  creator: { id: 9, login: creatorLogin },
  changes: { changedFiles: 5, additions: 120, deletions: 8 },
  unresolvedThreads: null,
  openedAt: new Date("2026-01-05T15:04:00Z"),
});

const prs = [
  buildPr(412, "Fix flaky worker retry loop"),
  buildPr(415, "Scope the slack home sweep to its own org"),
];

const closedPrs: PrSummary[] = [
  {
    ...buildPr(421, "Drop the legacy slack token"),
    closedAt: new Date("2026-11-12T16:20:00Z"),
    isMerged: true,
  },
  {
    ...buildPr(418, "Batch the team embed updates"),
    closedAt: new Date("2026-11-12T09:05:00Z"),
    isMerged: true,
  },
  {
    ...buildPr(409, "Try a second webhook queue"),
    closedAt: new Date("2026-11-10T14:40:00Z"),
    isMerged: false,
  },
];

type WithoutQuery<Resource> = Resource extends unknown
  ? Omit<Resource, "query" | "queryInfo">
  : never;

/** the resource the screen hands down, less the two fields only a websocket builds */
const fakeResource = (
  resource: WithoutQuery<PrBucketResource>,
): PrBucketResource => resource as PrBucketResource;

const loaded = (data: PrSummary[], total = data.length): PrBucketResource =>
  fakeResource({
    initialLoading: false,
    initialError: false,
    fetched: true,
    fetching: false,
    data,
    meta: { total },
    error: undefined,
  });

const loading = fakeResource({
  initialLoading: true,
  initialError: false,
  fetched: false,
  fetching: true,
  data: undefined,
  meta: undefined,
  error: undefined,
});

const failed = fakeResource({
  initialLoading: false,
  initialError: true,
  fetched: false,
  fetching: false,
  data: undefined,
  meta: undefined,
  error: new ResourcesServerError("UNEXPECTED_ERROR", "Could not load"),
});

const meta = {
  component: PrBucketSection,
  parameters: {
    componentSubtitle: "One pull request bucket, with its heading and rows",
  },
  args: { title: "Requested reviews", currentUserLogin: "chris" },
  render: (args) => (
    <PrBucketSection
      {...args}
      icon={<EyeRegularIcon />}
      prs={loaded(prs)}
      onSelectPr={fn()}
    />
  ),
} satisfies Meta<typeof PrBucketSection>;

export default meta;

export const PreviewStory: StoryObj<typeof PrBucketSection> = {
  name: "PrBucketSection Preview",
};

export const VariantsStory: StoryObj<typeof PrBucketSection> = {
  name: "PrBucketSection Variants",
  render: () => (
    <Story>
      <Story.Section title="every row shown">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded(prs)}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="capped, more than the page holds">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded(prs, 137)}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="one row short of the total">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded(prs, 3)}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="accent">
        <PrBucketSection
          title="Changes requested"
          icon={<EyeRegularIcon />}
          accent="danger"
          prs={loaded(prs)}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="filtered, among the rows loaded">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded([...prs, buildPr(420, "Rename a repository", "linus")])}
          filters={{ author: "linus" }}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="filtered, no row left: the section leaves the page">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded(prs)}
          filters={{ checks: "failed" }}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="the section's own control on each row">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded(prs)}
          renderAction={() => <StartReviewButton onStartReview={fn()} />}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="rows split by day">
        <PrBucketSection
          title="Closed pull requests"
          icon={<EyeRegularIcon />}
          prs={loaded(closedPrs)}
          showPassedChecks={false}
          dayOf={(pr) => pr.closedAt}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="loading">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loading}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="pending, the account filter is unresolved">
        <PrBucketSection
          pending
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loading}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="failed">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={failed}
          onSelectPr={fn()}
        />
      </Story.Section>
      <Story.Section title="empty, the section leaves the page">
        <PrBucketSection
          title="Requested reviews"
          icon={<EyeRegularIcon />}
          prs={loaded([])}
          onSelectPr={fn()}
        />
      </Story.Section>
    </Story>
  ),
};
