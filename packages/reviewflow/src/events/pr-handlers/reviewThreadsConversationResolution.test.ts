import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
import reviewThreadResolved from "../../__fixtures__/pull_request_review_thread.resolved.json";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../../tests/setup.ts";
import { createEmptyReviews } from "./utils/groupReviewsWithState.ts";

nock.disableNetConnect();

const prUrl = "https://github.com/reviewflow/reviewflow-test/pull/30";
const automergeLabel = {
  id: 1_285_313_520,
  name: ":vertical_traffic_light: automerge",
};

const thread = (id: number) => ({
  rootCommentId: id,
  url: `${prUrl}#discussion_r${id}`,
  path: "src/index.ts",
  authorLogin: "reviewer",
});

describe("review threads and conversation resolution", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const findOnePr = vi.fn();
  const statuses: { state: string; description: string }[] = [];
  const pullRequestFetched = vi.fn();

  const receiveThread = (
    action: "resolved" | "unresolved",
    labels: { id: number; name: string }[] = [],
  ) =>
    probot.receive({
      id: "1",
      name: "pull_request_review_thread",
      payload: {
        ...reviewThreadResolved.payload,
        action,
        pull_request: {
          ...reviewThreadResolved.payload.pull_request,
          labels,
          requested_reviewers: [],
          requested_teams: [],
        },
      } as any,
    });

  const storedPr = (unresolvedThreads: ReturnType<typeof thread>[]) => ({
    commentId: 1,
    reviews: {
      ...createEmptyReviews(),
      approved: [{ id: 2, login: "approver" }],
    },
    assignees: [],
    unresolvedThreads,
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    statuses.length = 0;
    nock.cleanAll();
    probot = await initializeProbotApp({
      prs: { findOne: findOnePr, partialUpdateOne: partialUpdateOnePr },
      orgMembers: { findOne: () => Promise.resolve(undefined) },
      repositories: {
        findByKey: () =>
          Promise.resolve({
            _id: 167_861_157,
            account: {
              id: 64_312_233,
              login: "reviewflow",
              type: "Organization",
            },
            fullName: "reviewflow/reviewflow-test",
            settings: {
              allowAutoMerge: true,
              allowMergeCommit: true,
              allowRebaseMerge: true,
              allowSquashMerge: true,
              defaultBranch: "main",
              defaultBranchProtectionRules: {
                requiresStatusChecks: true,
                requiresConversationResolution: true,
              },
              deleteBranchOnMerge: true,
              lastUpdated: new Date(2099, 0, 1),
            },
          }),
      },
    });
    mockAccessToken();
    mockLabels();
    nock("https://api.github.com")
      .persist()
      .post(/\/statuses\//)
      .reply(200, (_uri, body) => {
        statuses.push(body as { state: string; description: string });
        return {};
      });
    nock("https://api.github.com")
      .persist()
      .get(/\/issues\/comments\/1/)
      .reply(200, { id: 1, body: "### Progress\n\n### Options:\n" })
      .get(/\/check-runs/)
      .reply(200, { check_runs: [] })
      .get(/\/status/)
      .reply(200, { statuses: [] })
      .get(/\/pulls\/30$/)
      .reply(200, () => {
        pullRequestFetched();
        return pullRequestOpened.payload.pull_request;
      })
      .get(/\/pulls\/30\/commits/)
      .reply(200, [])
      .get(/\/pulls\/30\/comments/)
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

  test("a conversation opened again is counted in a status that stays success", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(200)]));

    await receiveThread("unresolved");

    expect(statuses).toEqual([
      expect.objectContaining({
        state: "success",
        description: "✓ Ready to merge once 2 conversations are resolved",
      }),
    ]);
  });

  test("a single remaining conversation is singular", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101), thread(200)]));

    await receiveThread("resolved");

    expect(statuses).toEqual([
      expect.objectContaining({
        state: "success",
        description: "✓ Ready to merge once 1 conversation is resolved",
      }),
    ]);
  });

  test("nothing is recomputed when the list does not change", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(200)]));

    await receiveThread("resolved");

    expect(statuses).toHaveLength(0);
  });

  test("last conversation resolved with the automerge label tries to automerge", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101)]));

    await receiveThread("resolved", [automergeLabel]);

    expect(pullRequestFetched).toHaveBeenCalledTimes(1);
  });

  test("last conversation resolved without the label does not fetch the pull request", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101)]));

    await receiveThread("resolved");

    expect(statuses).toEqual([
      expect.objectContaining({
        state: "success",
        description: "✓ PR ready to merge !",
      }),
    ]);
    expect(pullRequestFetched).not.toHaveBeenCalled();
  });

  test("a conversation resolved while others remain does not automerge", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101), thread(200)]));

    await receiveThread("resolved", [automergeLabel]);

    expect(pullRequestFetched).not.toHaveBeenCalled();
  });

  test("a conversation opened again does not automerge", async () => {
    findOnePr.mockResolvedValue(storedPr([]));

    await receiveThread("unresolved", [automergeLabel]);

    expect(pullRequestFetched).not.toHaveBeenCalled();
  });
});
