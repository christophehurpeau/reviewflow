import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestEdited from "../../__fixtures__/pull_request_30.edited.json";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const codeNeedsReviewLabel = {
  id: 1_210_432_920,
  name: ":ok_hand: code/needs-review",
};
const autoMergeLabel = {
  id: 1_285_313_520,
  name: ":vertical_traffic_light: automerge",
};

/*
 * A check suite gives no label, so the reschedule it creates is the only place where the
 * automerge opt-in can be checked. https://github.com/christophehurpeau/check-package-dependencies/pull/900
 * was merged without it.
 */
const checkSuiteCompletedPayload = {
  action: "completed",
  check_suite: {
    id: 1,
    head_sha: "2ab411d5c55f25f3dc2de6a3244f290a804e33da",
    status: "completed",
    conclusion: "success",
    app: { id: 15_368, name: "GitHub Actions", slug: "github-actions" },
    pull_requests: [
      { id: 324_609_850, number: 30 },
      { id: 324_609_851, number: 31 },
    ],
  },
  repository: pullRequestEdited.payload.repository,
  organization: pullRequestEdited.payload.organization,
  sender: pullRequestEdited.payload.sender,
  installation: pullRequestEdited.payload.installation,
};

const mockReviewflowComment = (prNumber: number): void => {
  nock("https://api.github.com")
    .get(
      `/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=${prNumber}`,
    )
    .times(2)
    .reply(200, { id: 1, body: "" });
};

const mockMergeablePr = (
  prNumber: number,
  labels: { id: number; name: string }[],
): nock.Scope =>
  nock("https://api.github.com")
    .get(`/repos/reviewflow/reviewflow-test/pulls/${prNumber}`)
    .reply(200, {
      ...pullRequestEdited.payload.pull_request,
      number: prNumber,
      labels,
      mergeable_state: "clean",
    });

const mockChecksAndStatuses = (
  checkRuns: { name: string; conclusion: string }[] = [],
): nock.Scope =>
  nock("https://api.github.com")
    .get(
      "/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs?per_page=100",
    )
    .reply(200, {
      check_runs: checkRuns.map((checkRun) => ({
        ...checkRun,
        check_suite: { id: 1 },
      })),
    })
    .get(
      "/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/status?per_page=100",
    )
    .reply(200, { statuses: [] });

const mockMerge = (prNumber: number): nock.Scope =>
  nock("https://api.github.com")
    .put(`/repos/reviewflow/reviewflow-test/pulls/${prNumber}/merge`)
    .reply(200, { merged: true });

const waitFor = async (
  condition: () => boolean,
  timeout = 15_000,
): Promise<void> => {
  const end = Date.now() + timeout;
  while (!condition() && Date.now() < end) {
    await new Promise((resolve) => {
      setTimeout(resolve, 100);
    });
  }
};

describe("check_suite.completed", (): void => {
  let probot: Probot;

  beforeEach(async () => {
    probot = await initializeProbotApp();
    mockAccessToken();
    mockLabels();
  });

  // the reschedule created by the check suite runs 10s later
  test("only merges the pull request that has the automerge label", async (): Promise<void> => {
    mockReviewflowComment(30);
    mockReviewflowComment(31);
    const prWithoutAutoMergeScope = mockMergeablePr(30, [codeNeedsReviewLabel]);
    const prWithAutoMergeScope = mockMergeablePr(31, [
      codeNeedsReviewLabel,
      autoMergeLabel,
    ]);
    const mergeWithoutAutoMergeScope = mockMerge(30);
    const mergeWithAutoMergeScope = mockMerge(31);
    mockChecksAndStatuses();

    await probot.receive({
      id: "1",
      name: "check_suite",
      payload:
        checkSuiteCompletedPayload as unknown as ProbotEvent<"check_suite.completed">["payload"],
    });

    await waitFor(
      () =>
        mergeWithAutoMergeScope.isDone() && prWithoutAutoMergeScope.isDone(),
    );

    expect(prWithoutAutoMergeScope.isDone()).toBe(true);
    expect(prWithAutoMergeScope.isDone()).toBe(true);
    expect(mergeWithAutoMergeScope.isDone()).toBe(true);
    expect(mergeWithoutAutoMergeScope.isDone()).toBe(false);
  }, 25_000);

  test("does not merge when another check failed on the head commit", async (): Promise<void> => {
    mockReviewflowComment(31);
    const prScope = mockMergeablePr(31, [codeNeedsReviewLabel, autoMergeLabel]);
    const mergeScope = mockMerge(31);
    const checksScope = mockChecksAndStatuses([
      { name: "lint", conclusion: "failure" },
    ]);

    await probot.receive({
      id: "1",
      name: "check_suite",
      payload: {
        ...checkSuiteCompletedPayload,
        check_suite: {
          ...checkSuiteCompletedPayload.check_suite,
          pull_requests: [{ id: 324_609_851, number: 31 }],
        },
      } as unknown as ProbotEvent<"check_suite.completed">["payload"],
    });

    await waitFor(() => checksScope.isDone());

    expect(prScope.isDone()).toBe(true);
    expect(checksScope.isDone()).toBe(true);
    expect(mergeScope.isDone()).toBe(false);
  }, 25_000);
});
