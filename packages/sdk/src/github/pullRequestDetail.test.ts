import { describe, expect, it } from "vitest";
import type {
  GhPullRequestDetail,
  GhPullRequestTimeline,
  PullRequestCandidatesData,
  PullRequestPartData,
} from "./pullRequestDetail.ts";
import {
  parsePullRequestCandidates,
  parsePullRequestChecks,
  parsePullRequestCommits,
  parsePullRequestDetail,
  parsePullRequestFiles,
  parsePullRequestTimeline,
} from "./pullRequestDetail.ts";

const pullRequest = (
  overrides: Partial<GhPullRequestDetail> = {},
): GhPullRequestDetail => ({
  id: "PR_node",
  number: 12,
  url: "https://github.com/acme/app/pull/12",
  title: "Add the thing",
  body: "Why it is needed",
  state: "OPEN",
  isDraft: false,
  author: { login: "alice", avatarUrl: "https://avatars/alice" },
  headRefName: "feat/thing",
  baseRefName: "main",
  headRefOid: "abc123",
  baseRefOid: "def456",
  createdAt: "2026-10-01T10:00:00Z",
  updatedAt: "2026-10-02T10:00:00Z",
  lastEditedAt: null,
  additions: 10,
  deletions: 2,
  changedFiles: 1,
  mergeable: "MERGEABLE",
  mergeStateStatus: "CLEAN",
  viewerCanUpdate: true,
  viewerCanUpdateBranch: false,
  viewerCanApplySuggestion: true,
  mergeCommitHeadline: "Merge pull request #12 from acme/feat/thing",
  mergeCommitBody: "Add the thing",
  squashCommitHeadline: "Add the thing (#12)",
  squashCommitBody: "Why it is needed",
  viewerCanReact: true,
  reactionGroups: [],
  reviewDecision: "REVIEW_REQUIRED",
  labels: { nodes: [] },
  assignees: { nodes: [] },
  reviewRequests: { nodes: [] },
  latestReviews: { nodes: [] },
  commits: { totalCount: 0 },
  ...overrides,
});

type MergeSettings = Omit<
  NonNullable<PullRequestPartData<unknown>["repository"]>,
  "pullRequest"
>;

const answer = <GhPart>(part: GhPart, repository: MergeSettings = {}) => ({
  data: {
    viewer: { login: "bob" },
    repository: { pullRequest: part, ...repository },
  },
  errors: [],
  ownerRepo: "acme/app",
  number: 12,
  fetchedAt: "2026-10-16T00:00:00Z",
});

const parse = (
  overrides: Partial<GhPullRequestDetail> = {},
  repository: MergeSettings = {},
) => parsePullRequestDetail(answer(pullRequest(overrides), repository));

const parseTimeline = (overrides: Partial<GhPullRequestTimeline> = {}) =>
  parsePullRequestTimeline(
    answer({
      timelineItems: {
        filteredCount: 0,
        pageInfo: { hasPreviousPage: false },
        nodes: [],
      },
      reviewThreads: { totalCount: 0, nodes: [] },
      ...overrides,
    }),
  );

describe("parsePullRequestDetail", () => {
  it("folds the draft flag into the state, closed and merged winning over it", () => {
    expect(parse({ isDraft: true }).pullRequest.state).toBe("draft");
    expect(parse().pullRequest.state).toBe("open");
    expect(parse({ state: "MERGED", isDraft: true }).pullRequest.state).toBe(
      "merged",
    );
    expect(parse({ state: "CLOSED" }).pullRequest.state).toBe("closed");
  });

  it("keeps the description's reactions someone gave, in GitHub's order", () => {
    const reactors = (totalCount: number) => ({ totalCount });
    const { reactions, viewerCanReact } = parse({
      viewerCanReact: false,
      reactionGroups: [
        { content: "THUMBS_UP", viewerHasReacted: true, reactors: reactors(3) },
        {
          content: "THUMBS_DOWN",
          viewerHasReacted: false,
          reactors: reactors(0),
        },
        { content: "ROCKET", viewerHasReacted: false, reactors: reactors(1) },
        { content: "UNKNOWN", viewerHasReacted: false, reactors: reactors(2) },
      ],
    }).pullRequest;

    expect(viewerCanReact).toBe(false);
    expect(reactions).toEqual([
      { content: "thumbsUp", count: 3, viewerHasReacted: true },
      { content: "rocket", count: 1, viewerHasReacted: false },
    ]);
  });

  it("reads users and teams among the requested reviewers", () => {
    const { requestedReviewers } = parse({
      reviewRequests: {
        nodes: [
          {
            requestedReviewer: {
              __typename: "User",
              login: "carol",
              avatarUrl: null,
            },
          },
          {
            requestedReviewer: {
              __typename: "Team",
              slug: "frontend",
              name: "Frontend",
            },
          },
          { requestedReviewer: null },
        ],
      },
    }).pullRequest;

    expect(requestedReviewers).toEqual([
      { kind: "user", login: "carol", avatarUrl: null },
      { kind: "team", slug: "frontend", name: "Frontend" },
    ]);
  });

  it("lists failing checks first and reads a running check run as pending", () => {
    const { checks, checksTotal } = parsePullRequestChecks(
      answer({
        headCommits: {
          nodes: [
            {
              commit: {
                statusCheckRollup: {
                  contexts: {
                    totalCount: 140,
                    nodes: [
                      {
                        __typename: "CheckRun",
                        name: "lint",
                        status: "COMPLETED",
                        conclusion: "SUCCESS",
                        title: "",
                        detailsUrl: null,
                      },
                      {
                        __typename: "CheckRun",
                        name: "test",
                        status: "IN_PROGRESS",
                        conclusion: null,
                        title: "12 of 40 suites",
                        detailsUrl: null,
                      },
                      {
                        __typename: "CheckRun",
                        name: "build",
                        status: "QUEUED",
                        conclusion: null,
                        title: null,
                        detailsUrl: null,
                      },
                      {
                        __typename: "StatusContext",
                        context: "deploy",
                        state: "FAILURE",
                        description: "Deploy failed",
                        targetUrl: "https://ci/deploy",
                      },
                      {
                        __typename: "StatusContext",
                        context: "hold",
                        state: "PENDING",
                        description: "Your job is on hold",
                        targetUrl: null,
                      },
                    ],
                  },
                },
              },
            },
          ],
        },
      }),
    );

    expect(checks).toEqual([
      {
        name: "deploy",
        outcome: "failed",
        running: false,
        description: "Deploy failed",
        url: "https://ci/deploy",
      },
      {
        name: "test",
        outcome: "pending",
        running: true,
        description: "12 of 40 suites",
        url: null,
      },
      {
        name: "build",
        outcome: "pending",
        running: false,
        description: null,
        url: null,
      },
      {
        name: "hold",
        outcome: "pending",
        running: false,
        description: "Your job is on hold",
        url: null,
      },
      {
        name: "lint",
        outcome: "passed",
        running: false,
        description: null,
        url: null,
      },
    ]);
    expect(checksTotal).toBe(140);
  });

  it("reads files with their change and the viewer's viewed mark", () => {
    const { files } = parsePullRequestFiles(
      answer({
        latestReviews: { nodes: [] },
        files: {
          nodes: [
            {
              path: "src/a.ts",
              additions: 3,
              deletions: 1,
              changeType: "MODIFIED",
              viewerViewedState: "VIEWED",
            },
            {
              path: "src/b.ts",
              additions: 0,
              deletions: 9,
              changeType: "DELETED",
              viewerViewedState: "DISMISSED",
            },
          ],
        },
      }),
    );

    expect(files).toEqual([
      {
        path: "src/a.ts",
        additions: 3,
        deletions: 1,
        change: "modified",
        viewed: "viewed",
      },
      {
        path: "src/b.ts",
        additions: 0,
        deletions: 9,
        change: "deleted",
        viewed: "dismissed",
      },
    ]);
  });

  it("orders comments, reviews that said something and threads into one timeline", () => {
    const base = {
      author: { login: "carol", avatarUrl: "https://avatars/carol" },
      url: "https://github.com/acme/app/pull/12#x",
      lastEditedAt: null,
      viewerCanUpdate: false,
      viewerCanReact: true,
      reactionGroups: [],
    };
    const review = ({
      id,
      createdAt,
      state,
      body = "",
    }: {
      id: number;
      createdAt: string;
      state: string;
      body?: string;
    }) => ({
      __typename: "PullRequestReview" as const,
      ...base,
      id: `R${String(id)}`,
      databaseId: id,
      body,
      createdAt,
      state,
      submittedAt: state === "PENDING" ? null : createdAt,
      commit: { oid: "abc123" },
    });
    const { timeline, timelineTruncated } = parseTimeline({
      timelineItems: {
        filteredCount: 4,
        pageInfo: { hasPreviousPage: false },
        nodes: [
          {
            __typename: "IssueComment",
            ...base,
            id: "C1",
            databaseId: 1,
            body: "c",
            createdAt: "2026-10-03T00:00:00Z",
            lastEditedAt: "2026-10-03T01:00:00Z",
            viewerCanUpdate: true,
            reactionGroups: [
              {
                content: "HEART",
                viewerHasReacted: false,
                reactors: { totalCount: 2 },
              },
            ],
          },
          review({
            id: 2,
            createdAt: "2026-10-04T00:00:00Z",
            state: "APPROVED",
          }),
          // the shell of the inline comments below: shown as its thread
          review({
            id: 3,
            createdAt: "2026-10-02T00:00:00Z",
            state: "COMMENTED",
          }),
          // the viewer's unsent draft
          review({
            id: 4,
            createdAt: "2026-10-05T00:00:00Z",
            state: "PENDING",
            body: "draft",
          }),
        ],
      },
      reviewThreads: {
        totalCount: 2,
        nodes: [
          {
            id: "T1",
            isResolved: false,
            isOutdated: true,
            path: "src/a.ts",
            line: null,
            startLine: null,
            diffSide: "LEFT",
            startDiffSide: null,
            originalLine: 4,
            originalStartLine: null,
            viewerCanResolve: true,
            viewerCanUnresolve: false,
            viewerCanReply: true,
            comments: {
              totalCount: 25,
              nodes: [
                {
                  ...base,
                  id: "TC1",
                  databaseId: 10,
                  body: "t",
                  createdAt: "2026-10-02T00:00:00Z",
                  diffHunk: "@@ -1 +1 @@\n-old\n+new",
                },
              ],
            },
          },
        ],
      },
    });

    expect(timeline.map((item) => item.kind)).toEqual([
      "thread",
      "comment",
      "review",
    ]);
    expect(timeline[0]).toMatchObject({
      id: "T1",
      path: "src/a.ts",
      line: null,
      startLine: null,
      side: "LEFT",
      startSide: null,
      originalLine: 4,
      originalStartLine: null,
      outdated: true,
      viewerCanResolve: true,
      viewerCanUnresolve: false,
      commentsTotal: 25,
      comments: [
        {
          id: "TC1",
          databaseId: 10,
          author: { login: "carol", avatarUrl: "https://avatars/carol" },
        },
      ],
    });
    expect(timeline[1]).toMatchObject({
      id: "C1",
      lastEditedAt: "2026-10-03T01:00:00Z",
      viewerCanUpdate: true,
      viewerCanReact: true,
      reactions: [{ content: "heart", count: 2, viewerHasReacted: false }],
    });
    expect(timeline[2]).toMatchObject({
      state: "approved",
      body: "",
      lastEditedAt: null,
      databaseId: 2,
      commitOid: "abc123",
    });
    // the threads connection held one more than it returned
    expect(timelineTruncated).toBe(true);
  });

  it("lets the viewer edit only a review submitted with a body", () => {
    const review = (id: number, body: string) => ({
      __typename: "PullRequestReview" as const,
      author: { login: "carol", avatarUrl: "https://avatars/carol" },
      url: "https://github.com/acme/app/pull/12#x",
      lastEditedAt: null,
      viewerCanUpdate: true,
      viewerCanReact: true,
      reactionGroups: [],
      id: `R${String(id)}`,
      databaseId: id,
      body,
      createdAt: "2026-10-04T00:00:00Z",
      state: "APPROVED",
      submittedAt: "2026-10-04T00:00:00Z",
      commit: { oid: "abc123" },
    });
    const { timeline } = parseTimeline({
      timelineItems: {
        filteredCount: 2,
        pageInfo: { hasPreviousPage: false },
        nodes: [review(1, ""), review(2, "looks good")],
      },
      reviewThreads: { totalCount: 0, nodes: [] },
    });

    expect(timeline).toMatchObject([
      { databaseId: 1, viewerCanUpdate: false },
      { databaseId: 2, viewerCanUpdate: true },
    ]);
  });

  it("flags a timeline whose older items were left out", () => {
    expect(
      parseTimeline({
        timelineItems: {
          filteredCount: 130,
          pageInfo: { hasPreviousPage: true },
          nodes: [],
        },
      }).timelineTruncated,
    ).toBe(true);
    expect(parseTimeline().timelineTruncated).toBe(false);
  });

  it("maps every kind of event, with its subject, label and detail", () => {
    const actor = { login: "erin", avatarUrl: null };
    const at = (n: number) => `2026-10-0${String(n)}T00:00:00Z`;
    const label = { name: "bug", color: "d73a4a", description: "" };
    const { timeline } = parseTimeline({
      timelineItems: {
        filteredCount: 14,
        pageInfo: { hasPreviousPage: false },
        nodes: [
          {
            __typename: "PullRequestCommit",
            commit: {
              abbreviatedOid: "1234567",
              messageHeadline: "feat: thing",
              committedDate: at(1),
              author: { name: "Frank", user: null },
            },
          },
          {
            __typename: "AssignedEvent",
            actor,
            createdAt: at(2),
            assignee: { login: "gina" },
          },
          {
            __typename: "UnassignedEvent",
            actor,
            createdAt: at(2),
            assignee: { login: "gina" },
          },
          { __typename: "LabeledEvent", actor, createdAt: at(3), label },
          { __typename: "UnlabeledEvent", actor, createdAt: at(3), label },
          {
            __typename: "ReviewRequestedEvent",
            actor,
            createdAt: at(4),
            requestedReviewer: { login: "hal" },
          },
          {
            __typename: "ReviewRequestRemovedEvent",
            actor,
            createdAt: at(4),
            requestedReviewer: { name: "Frontend" },
          },
          {
            __typename: "HeadRefForcePushedEvent",
            actor,
            createdAt: at(5),
            afterCommit: { abbreviatedOid: "89abcde" },
          },
          {
            __typename: "BaseRefChangedEvent",
            actor,
            createdAt: at(5),
            currentRefName: "next",
            previousRefName: "main",
          },
          {
            __typename: "RenamedTitleEvent",
            actor,
            createdAt: at(6),
            currentTitle: "New",
            previousTitle: "Old",
          },
          {
            __typename: "ReviewDismissedEvent",
            actor,
            createdAt: at(6),
            review: { author: { login: "ivy" } },
          },
          { __typename: "ConvertToDraftEvent", actor, createdAt: at(7) },
          { __typename: "ReadyForReviewEvent", actor, createdAt: at(7) },
          { __typename: "AutoMergeEnabledEvent", actor, createdAt: at(7) },
          {
            __typename: "AutoMergeDisabledEvent",
            actor: null,
            createdAt: at(7),
          },
          { __typename: "ClosedEvent", actor, createdAt: at(8) },
          { __typename: "ReopenedEvent", actor, createdAt: at(8) },
          { __typename: "MergedEvent", actor, createdAt: at(9) },
        ],
      },
    });

    const summary = timeline.map((item) =>
      item.kind === "event"
        ? [
            item.action,
            item.actor?.login ?? null,
            item.subject,
            item.label?.name ?? null,
            item.detail,
          ]
        : null,
    );
    expect(summary).toEqual([
      ["committed", "Frank", "feat: thing", null, "1234567"],
      ["assigned", "erin", "gina", null, null],
      ["unassigned", "erin", "gina", null, null],
      ["labeled", "erin", "bug", "bug", null],
      ["unlabeled", "erin", "bug", "bug", null],
      ["reviewRequested", "erin", "hal", null, null],
      ["reviewRequestRemoved", "erin", "Frontend", null, null],
      ["headRefForcePushed", "erin", null, null, "89abcde"],
      ["baseRefChanged", "erin", "next", null, "main"],
      ["renamed", "erin", "New", null, "Old"],
      ["reviewDismissed", "erin", "ivy", null, null],
      ["convertedToDraft", "erin", null, null, null],
      ["readyForReview", "erin", null, null, null],
      ["autoMergeEnabled", "erin", null, null, null],
      ["autoMergeDisabled", null, null, null, null],
      ["closed", "erin", null, null, null],
      ["reopened", "erin", null, null, null],
      ["merged", "erin", null, null, null],
    ]);
    expect(timeline[3]).toMatchObject({
      label: { name: "bug", color: "d73a4a", description: null },
    });
  });

  it("reads the merge state, the methods GitHub offers and the viewer's rights", () => {
    const behind = parse(
      { mergeStateStatus: "HAS_HOOKS", viewerCanUpdateBranch: true },
      {
        mergeCommitAllowed: true,
        squashMergeAllowed: true,
        rebaseMergeAllowed: false,
        viewerDefaultMergeMethod: "SQUASH",
      },
    ).pullRequest;

    expect(behind).toMatchObject({
      id: "PR_node",
      mergeState: "hasHooks",
      mergeMethods: ["squash", "merge"],
      mergeCommitMessages: {
        merge: {
          title: "Merge pull request #12 from acme/feat/thing",
          body: "Add the thing",
        },
        squash: { title: "Add the thing (#12)", body: "Why it is needed" },
      },
      viewerCanUpdate: true,
      viewerCanUpdateBranch: true,
      viewerCanApplySuggestion: true,
    });
    expect(parse({ mergeStateStatus: "BEHIND" }).pullRequest).toMatchObject({
      mergeState: "behind",
      mergeMethods: [],
    });
    expect(parse({ mergeStateStatus: "???" }).pullRequest.mergeState).toBe(
      "unknown",
    );
  });

  it("reads the commits and the viewer's last reviewed head", () => {
    const { commits } = parsePullRequestCommits(
      answer({
        commits: {
          totalCount: 120,
          nodes: [
            {
              commit: {
                oid: "c2",
                parents: { totalCount: 2, nodes: [{ oid: "c1" }] },
                messageHeadline: "fix: it",
                messageBody: "\nbecause\n",
                committedDate: "2026-10-02T00:00:00Z",
                author: {
                  name: "Frank",
                  user: { login: "frank", avatarUrl: "https://avatars/frank" },
                },
              },
            },
            {
              commit: {
                oid: "c1",
                parents: { totalCount: 0, nodes: [] },
                messageHeadline: "feat: it",
                messageBody: "",
                committedDate: "2026-10-01T00:00:00Z",
                author: { name: "Gina", user: null },
              },
            },
          ],
        },
      }),
    );
    const lastReview = (
      nodes: {
        viewerDidAuthor: boolean;
        submittedAt: string | null;
        commit: { oid: string } | null;
      }[],
    ) =>
      parsePullRequestFiles(
        answer({ files: { nodes: [] }, latestReviews: { nodes } }),
      ).viewerLastReview;

    expect(
      parse({ commits: { totalCount: 120 } }).pullRequest.commitsTotal,
    ).toBe(120);
    expect(commits).toEqual([
      {
        oid: "c2",
        parentOid: "c1",
        merge: true,
        headline: "fix: it",
        body: "because",
        author: { login: "frank", avatarUrl: "https://avatars/frank" },
        committedAt: "2026-10-02T00:00:00Z",
      },
      {
        oid: "c1",
        parentOid: null,
        merge: false,
        headline: "feat: it",
        body: "",
        author: { login: "Gina", avatarUrl: null },
        committedAt: "2026-10-01T00:00:00Z",
      },
    ]);
    expect(
      lastReview([
        {
          viewerDidAuthor: false,
          submittedAt: "2026-10-03T00:00:00Z",
          commit: { oid: "other" },
        },
        {
          viewerDidAuthor: true,
          submittedAt: "2026-10-02T00:00:00Z",
          commit: { oid: "mine" },
        },
      ]),
    ).toEqual({ oid: "mine", submittedAt: "2026-10-02T00:00:00Z" });
    expect(
      lastReview([{ viewerDidAuthor: true, submittedAt: null, commit: null }]),
    ).toBeNull();
    expect(lastReview([])).toBeNull();
  });

  it("raises GitHub's reason when there is no pull request to show", () => {
    expect(() =>
      parsePullRequestDetail({
        data: { viewer: { login: "bob" }, repository: null },
        errors: ["Could not resolve to a Repository with the name 'acme/app'."],
        ownerRepo: "acme/app",
        number: 12,
        fetchedAt: "2026-10-16T00:00:00Z",
      }),
    ).toThrow(
      "no pull request #12 in acme/app: Could not resolve to a Repository",
    );
  });
});

const candidates = (
  data: Partial<NonNullable<PullRequestCandidatesData["repository"]>> = {},
  repositoryOwner: PullRequestCandidatesData["repositoryOwner"] = null,
) =>
  parsePullRequestCandidates({
    data: {
      repositoryOwner,
      repository: {
        labels: { nodes: [] },
        assignableUsers: { nodes: [] },
        pullRequest: { author: { login: "alice" }, suggestedReviewers: [] },
        ...data,
      },
    },
    errors: [],
  });

describe("parsePullRequestCandidates", () => {
  it("offers suggested reviewers apart, never the author nor anyone twice", () => {
    const { suggestedReviewers, reviewerCandidates } = candidates({
      pullRequest: {
        author: { login: "alice" },
        suggestedReviewers: [
          { reviewer: { login: "dave", avatarUrl: null } },
          { reviewer: { login: "alice", avatarUrl: null } },
        ],
      },
      assignableUsers: {
        nodes: [
          { login: "zoe", avatarUrl: null },
          { login: "alice", avatarUrl: null },
          { login: "dave", avatarUrl: null },
          { login: "carl", avatarUrl: null },
        ],
      },
    });

    expect(suggestedReviewers.map(({ login }) => login)).toEqual(["dave"]);
    expect(reviewerCandidates.map(({ login }) => login)).toEqual([
      "carl",
      "zoe",
    ]);
  });

  it("offers an organisation's teams, and none for a user's repository", () => {
    const organisation = candidates(
      {},
      { teams: { nodes: [{ slug: "frontend", name: "Frontend" }, null] } },
    );

    expect(organisation.teamCandidates).toEqual([
      { slug: "frontend", name: "Frontend" },
    ]);
    expect(candidates().teamCandidates).toEqual([]);
  });

  it("offers every assignable user, the author included, by login", () => {
    const { assigneeCandidates, repoLabels } = candidates({
      assignableUsers: {
        nodes: [
          { login: "zoe", avatarUrl: null },
          { login: "alice", avatarUrl: "https://avatars/alice" },
        ],
      },
      labels: { nodes: [{ name: "bug", color: "d73a4a", description: "" }] },
    });

    expect(assigneeCandidates.map(({ login }) => login)).toEqual([
      "alice",
      "zoe",
    ]);
    expect(repoLabels).toEqual([
      { name: "bug", color: "d73a4a", description: null },
    ]);
  });

  it("still offers the repository's people when the pull request is not readable", () => {
    const { reviewerCandidates } = candidates({
      pullRequest: null,
      assignableUsers: { nodes: [{ login: "zoe", avatarUrl: null }] },
    });

    expect(reviewerCandidates.map(({ login }) => login)).toEqual(["zoe"]);
  });

  it("raises GitHub's reason when there is no repository to read", () => {
    expect(() =>
      parsePullRequestCandidates({
        data: { repository: null },
        errors: ["Could not resolve to a Repository with the name 'acme/app'."],
      }),
    ).toThrow("Could not resolve to a Repository");
  });
});
