import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestEdited from "../../__fixtures__/pull_request_30.edited.json";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
  storedPrIdentity,
} from "../../tests/setup.ts";
import { createEmptyReviews } from "./utils/groupReviewsWithState.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const headSha = pullRequestEdited.payload.pull_request.head.sha;

const { repository, organization, sender, installation } =
  pullRequestEdited.payload;

const runningTest = {
  name: "test",
  status: "in_progress",
  conclusion: null as string | null,
  title: "Running",
  details_url: "https://github.com/reviewflow/reviewflow-test/runs/1",
};

const pendingDeploy = {
  context: "ci/deploy",
  state: "pending",
  description: "Deploying preview",
  target_url: "https://deploy.example/1",
};

const checkRunPayload = (
  action: "completed" | "created",
  checkRun: Partial<typeof runningTest>,
) => {
  const { title, ...rest } = { ...runningTest, ...checkRun };
  return {
    action,
    check_run: {
      ...rest,
      id: 1,
      head_sha: headSha,
      output: { title },
      check_suite: { id: 1 },
      pull_requests: [{ id: 324_609_850, number: 30 }],
    },
    repository,
    organization,
    sender,
    installation,
  };
};

const statusPayload = (status: Partial<typeof pendingDeploy>) => ({
  ...pendingDeploy,
  ...status,
  sha: headSha,
  commit: { sha: headSha },
  repository,
  organization,
  sender,
  installation,
});

describe("check run and status details", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();

  const storedPr = () => ({
    _id: "pr-id",
    ...storedPrIdentity,
    commentId: 1,
    headSha,
    reviews: createEmptyReviews(),
    assignees: [],
    unresolvedThreads: [],
    checksConclusion: { "1_test": { ...runningTest } },
    statusesConclusion: { "ci/deploy": { ...pendingDeploy } },
  });

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    probot = await initializeProbotApp({
      prs: {
        findAll: () => Promise.resolve([storedPr()]),
        findOne: () => Promise.resolve(storedPr()),
        partialUpdateOne: partialUpdateOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
    nock("https://api.github.com")
      .persist()
      .get(/\/issues\/comments\/1/)
      .reply(200, { id: 1, body: "### Progress\n\n### Options:\n" })
      .get(/\/pulls\/30$/)
      .reply(200, pullRequestEdited.payload.pull_request)
      .get(/\/pulls\/30\/commits/)
      .reply(200, [])
      .get(/\/(reviews|requested_reviewers)/)
      .reply(200, []);
    nock("https://api.github.com")
      .persist()
      .patch(/.*/)
      .reply(200, {})
      .post(/\/labels$/)
      .reply(200, [])
      .post(/.*/)
      .reply(200, {});
    nock("https://api.github.com").persist().delete(/.*/).reply(200, {});
  });

  test("stores a check run whose title changed, conclusion unchanged", async () => {
    await probot.receive({
      id: "1",
      name: "check_run",
      payload: checkRunPayload("created", { title: "3/5 jobs" }) as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledTimes(1);
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: {
        "checksConclusion.1_test": { ...runningTest, title: "3/5 jobs" },
      },
    });
  });

  test("writes nothing for a check run identical to the stored one", async () => {
    await probot.receive({
      id: "1",
      name: "check_run",
      payload: checkRunPayload("created", {}) as any,
    });

    expect(partialUpdateOnePr).not.toHaveBeenCalled();
  });

  test("stores the details of a check run that completed", async () => {
    nock("https://api.github.com")
      .persist()
      .get(/\/check-runs/)
      .reply(200, { check_runs: [] });

    const completed = {
      status: "completed",
      conclusion: "failure",
      title: "2 tests failed",
    };

    await probot.receive({
      id: "1",
      name: "check_run",
      payload: checkRunPayload("completed", completed) as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { "checksConclusion.1_test": { ...runningTest, ...completed } },
    });
  });

  test("stores a status whose description changed, state unchanged", async () => {
    await probot.receive({
      id: "1",
      name: "status",
      payload: statusPayload({ description: "Almost there" }) as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledTimes(1);
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: {
        "statusesConclusion.ci/deploy": {
          ...pendingDeploy,
          description: "Almost there",
        },
      },
    });
  });
});
