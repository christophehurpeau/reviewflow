import { beforeEach, describe, expect, test, vi } from "vitest";
import type { LabelResponse } from "../../../context/initRepoLabels.ts";
import type { RepoContext } from "../../../context/repoContext.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type { PullRequestLabels } from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import type { PullRequestFromRestEndpoint } from "../utils/fetchPr.ts";
import {
  tryToAutomerge,
  tryToAutomergeFromReschedule,
} from "./tryToAutomerge.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";

const createLabel = (id: number, name: string): LabelResponse => ({
  id,
  node_id: `MDU6TGFiZWwke${id}`,
  url: `https://api.github.com/repos/reviewflow/reviewflow-test/labels/${name}`,
  name,
  description: null,
  color: "238636",
  default: false,
});

const autoMergeLabel = createLabel(
  1_285_313_520,
  ":vertical_traffic_light: automerge",
);
const codeNeedsReviewLabel = createLabel(
  1_210_432_920,
  ":ok_hand: code/needs-review",
);

const headSha = "b8f2e0a6b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8";

const merge = vi.fn(() => Promise.resolve({}));
const graphql = vi.fn(() => Promise.resolve({}));
const createComment = vi.fn(() => Promise.resolve({}));
const reschedule = vi.fn(() => Promise.resolve());
const listForRef = vi.fn(() => Promise.resolve({ data: { check_runs: [] } }));
const getCombinedStatusForRef = vi.fn(() =>
  Promise.resolve({ data: { statuses: [] } }),
);

const createContext = (): ProbotEvent<"check_suite.completed"> =>
  ({
    octokit: {
      rest: {
        pulls: { merge },
        issues: { createComment },
        checks: { listForRef },
        repos: { getCombinedStatusForRef },
      },
      graphql,
    },
    log: { info: vi.fn(), error: vi.fn() },
    repo: (object: object) => ({
      owner: "reviewflow",
      repo: "reviewflow-test",
      ...object,
    }),
    payload: {},
  }) as unknown as ProbotEvent<"check_suite.completed">;

const createRepoContext = (allowAutoMerge = true): RepoContext =>
  ({
    labels: { "merge/automerge": autoMergeLabel },
    settings: {
      allowAutoMerge,
      defaultBranchProtectionRules: { requiresStatusChecks: true },
    },
    config: {
      disableAutoMerge: false,
      prDefaultOptions: {
        autoMerge: false,
        autoMergeWithSkipCi: false,
        deleteAfterMerge: true,
      },
    },
    accountEmbed: { id: 64_312_233, login: "reviewflow", type: "Organization" },
    repoFullName: "reviewflow/reviewflow-test",
    reschedule,
  }) as unknown as RepoContext;

const repo = { full_name: "reviewflow/reviewflow-test" };

const createPullRequest = (
  labels: PullRequestLabels,
): PullRequestFromRestEndpoint =>
  ({
    number: 30,
    node_id: "MDExOlB1bGxSZXF1ZXN0MzI0NjA5ODUw",
    title: "feat: update README.md",
    labels,
    draft: false,
    state: "open",
    merged_at: null,
    closed_at: null,
    auto_merge: null,
    mergeable_state: "clean",
    user: { id: 302_891, login: "christophehurpeau", type: "User" },
    head: { repo, sha: headSha },
    base: {
      repo: {
        ...repo,
        name: "reviewflow-test",
        owner: { login: "reviewflow" },
      },
    },
  }) as unknown as PullRequestFromRestEndpoint;

const createReviewflowPrContext = (
  failedCheckName?: string,
): ReviewflowPrContext =>
  ({
    commentBody: "",
    reviewflowPr: {
      headSha,
      checksConclusion: failedCheckName
        ? {
            "1_build": { name: failedCheckName, conclusion: "failure" },
          }
        : {},
      statusesConclusion: {},
      reviews: {
        approved: [],
        changesRequested: [],
        dismissed: [],
        commented: [],
      },
    },
  }) as unknown as ReviewflowPrContext;

const reviewflowPrContext = createReviewflowPrContext();

const createStepsState = (codeReviewPassed: boolean): StepsState =>
  ({
    write: { state: "passed" },
    checks: { state: "passed" },
    codeReview: { state: codeReviewPassed ? "passed" : "not-started" },
    merge: { state: "not-started" },
  }) as unknown as StepsState;

describe("tryToAutomergeFromReschedule", (): void => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not merge when the automerge label is not on the pull request", async (): Promise<void> => {
    const result = await tryToAutomergeFromReschedule({
      pullRequest: createPullRequest([codeNeedsReviewLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext,
      fromRescheduleTime: "short",
      fromRescheduleAttempt: 0,
    });

    expect(merge).not.toHaveBeenCalled();
    expect(graphql).not.toHaveBeenCalled();
    expect(reschedule).not.toHaveBeenCalled();
    expect(result).toEqual({
      wasMerged: false,
      didFailedToEnableAutoMerge: true,
    });
  });

  test("does not merge when the repository does not allow automerge", async (): Promise<void> => {
    await tryToAutomergeFromReschedule({
      pullRequest: createPullRequest([autoMergeLabel]),
      context: createContext(),
      repoContext: createRepoContext(false),
      reviewflowPrContext,
      fromRescheduleTime: "short",
      fromRescheduleAttempt: 0,
    });

    expect(merge).not.toHaveBeenCalled();
    expect(graphql).not.toHaveBeenCalled();
  });

  test("merges when the automerge label is still there", async (): Promise<void> => {
    const result = await tryToAutomergeFromReschedule({
      pullRequest: createPullRequest([autoMergeLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext,
      fromRescheduleTime: "short",
      fromRescheduleAttempt: 0,
    });

    expect(merge).toHaveBeenCalledWith({
      merge_method: "squash",
      owner: "reviewflow",
      repo: "reviewflow-test",
      pull_number: 30,
      commit_title: "feat: update README.md (#30)",
      commit_message: "",
    });
    expect(result).toEqual({ wasMerged: true });
  });

  test("does not merge when a check failed on the head commit", async (): Promise<void> => {
    const result = await tryToAutomergeFromReschedule({
      pullRequest: createPullRequest([autoMergeLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext: createReviewflowPrContext("build"),
      fromRescheduleTime: "short",
      fromRescheduleAttempt: 0,
    });

    expect(merge).not.toHaveBeenCalled();
    expect(graphql).not.toHaveBeenCalled();
    expect(reschedule).not.toHaveBeenCalled();
    expect(result).toEqual({ wasMerged: false, hasFailedChecks: true });
  });

  test("re-fetches the checks when the stored conclusions are from another commit", async (): Promise<void> => {
    listForRef.mockResolvedValueOnce({
      data: {
        check_runs: [
          {
            name: "build",
            conclusion: "failure",
            check_suite: { id: 2 },
          },
        ],
      },
    } as unknown as Awaited<ReturnType<typeof listForRef>>);

    const reviewflowPrContextWithOtherSha = createReviewflowPrContext();
    reviewflowPrContextWithOtherSha.reviewflowPr.headSha = "another-sha";

    const result = await tryToAutomergeFromReschedule({
      pullRequest: createPullRequest([autoMergeLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext: reviewflowPrContextWithOtherSha,
      fromRescheduleTime: "short",
      fromRescheduleAttempt: 0,
    });

    expect(listForRef).toHaveBeenCalled();
    expect(merge).not.toHaveBeenCalled();
    expect(result).toEqual({ wasMerged: false, hasFailedChecks: true });
  });
});

describe("tryToAutomerge", (): void => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("does not merge when the automerge label is not on the pull request", async (): Promise<void> => {
    await tryToAutomerge({
      pullRequest: createPullRequest([codeNeedsReviewLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext,
      stepsState: createStepsState(true),
    });

    expect(merge).not.toHaveBeenCalled();
    expect(graphql).not.toHaveBeenCalled();
  });

  test("waits instead of merging when a step is not passed", async (): Promise<void> => {
    const result = await tryToAutomerge({
      pullRequest: createPullRequest([autoMergeLabel]),
      context: createContext(),
      repoContext: createRepoContext(),
      reviewflowPrContext,
      stepsState: createStepsState(false),
    });

    expect(merge).not.toHaveBeenCalled();
    expect(reschedule).toHaveBeenCalledWith(
      expect.anything(),
      { number: 30 },
      "short",
      undefined,
    );
    expect(result).toEqual({ wasMerged: false, isRescheduled: true });
  });
});
