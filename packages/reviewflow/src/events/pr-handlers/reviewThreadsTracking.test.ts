import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
import reviewCommentCreated from "../../__fixtures__/pull_request_review_comment.created.json";
import reviewThreadResolved from "../../__fixtures__/pull_request_review_thread.resolved.json";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../../tests/setup.ts";
import { createEmptyReviews } from "./utils/groupReviewsWithState.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const prUrl = "https://github.com/reviewflow/reviewflow-test/pull/30";

const thread = (id: number, authorLogin: string | null = "reviewer") => ({
  rootCommentId: id,
  url: `${prUrl}#discussion_r${id}`,
  path: "src/index.ts",
  authorLogin,
});

const graphqlNode = (id: number, isResolved: boolean) => ({
  isResolved,
  comments: {
    nodes: [
      {
        databaseId: id,
        url: `${prUrl}#discussion_r${id}`,
        path: "src/index.ts",
        author: { login: "reviewer" },
      },
    ],
  },
});

describe("review threads tracking", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const findOnePr = vi.fn();
  const graphqlCalled = vi.fn();
  let seededThreads: ReturnType<typeof graphqlNode>[] = [];

  const storedPr = (unresolvedThreads?: ReturnType<typeof thread>[]) => ({
    commentId: 1,
    reviews: createEmptyReviews(),
    assignees: [],
    ...(unresolvedThreads ? { unresolvedThreads } : {}),
  });

  const receiveThread = (action: "resolved" | "unresolved") =>
    probot.receive({
      id: "1",
      name: "pull_request_review_thread",
      payload: { ...reviewThreadResolved.payload, action } as any,
    });

  const receiveComment = (
    action: "created" | "deleted",
    comment: Record<string, unknown> = {},
  ) =>
    probot.receive({
      id: "1",
      name: "pull_request_review_comment",
      payload: {
        ...reviewCommentCreated.payload,
        action,
        comment: { ...reviewCommentCreated.payload.comment, ...comment },
      } as any,
    });

  const unresolvedThreadsWrites = () =>
    partialUpdateOnePr.mock.calls.filter(
      ([, update]) => update?.$set && "unresolvedThreads" in update.$set,
    );

  beforeEach(async () => {
    partialUpdateOnePr.mockReset();
    findOnePr.mockReset();
    graphqlCalled.mockReset();
    seededThreads = [];
    nock.cleanAll();
    probot = await initializeProbotApp({
      prs: { findOne: findOnePr, partialUpdateOne: partialUpdateOnePr },
      orgMembers: { findOne: () => Promise.resolve(undefined) },
      // commentEditedOrDeleted runs on the same deletion
      slackSentMessages: { deleteMany: () => Promise.resolve() },
    });
    mockAccessToken();
    mockLabels();
    // before the generic post below, which would answer graphql too
    nock("https://api.github.com")
      .persist()
      .post("/graphql")
      .reply(200, () => {
        graphqlCalled();
        return {
          data: {
            repository: {
              pullRequest: {
                reviewThreads: {
                  pageInfo: { hasNextPage: false, endCursor: null },
                  nodes: seededThreads,
                },
              },
            },
          },
        };
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
      .reply(200, pullRequestOpened.payload.pull_request)
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

  test("resolved removes the thread of the root comment", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101), thread(200)]));

    await receiveThread("resolved");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { unresolvedThreads: [thread(200)] },
    });
    expect(graphqlCalled).not.toHaveBeenCalled();
  });

  test("resolved writes nothing when the thread was not stored", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(200)]));

    await receiveThread("resolved");

    expect(unresolvedThreadsWrites()).toHaveLength(0);
  });

  test("unresolved adds the thread from the payload", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(200)]));

    await receiveThread("unresolved");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { unresolvedThreads: [thread(200), thread(101)] },
    });
    expect(graphqlCalled).not.toHaveBeenCalled();
  });

  test("unresolved writes nothing when the thread is already stored", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101)]));

    await receiveThread("unresolved");

    expect(unresolvedThreadsWrites()).toHaveLength(0);
  });

  test("a new root comment adds a thread", async () => {
    findOnePr.mockResolvedValue(storedPr([]));

    await receiveComment("created");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { unresolvedThreads: [thread(101)] },
    });
    expect(graphqlCalled).not.toHaveBeenCalled();
  });

  test("a reply changes nothing", async () => {
    findOnePr.mockResolvedValue(storedPr([]));

    await receiveComment("created", { id: 102, in_reply_to_id: 101 });

    expect(unresolvedThreadsWrites()).toHaveLength(0);
    expect(graphqlCalled).not.toHaveBeenCalled();
  });

  test("a deleted comment reads the threads again", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101), thread(200)]));
    seededThreads = [graphqlNode(200, false), graphqlNode(300, true)];

    await receiveComment("deleted");

    expect(graphqlCalled).toHaveBeenCalledTimes(1);
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { unresolvedThreads: [thread(200)] },
    });
  });

  test("an absent list is read instead of updated by the event", async () => {
    findOnePr.mockResolvedValue(storedPr());
    seededThreads = [graphqlNode(200, false)];

    await receiveThread("resolved");

    expect(graphqlCalled).toHaveBeenCalledTimes(1);
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { unresolvedThreads: [thread(200)] },
    });
  });

  describe("pull requests from before the tracking", () => {
    const receiveSynchronize = () =>
      probot.receive({
        id: "1",
        name: "pull_request",
        payload: {
          ...pullRequestOpened.payload,
          action: "synchronize",
          before: "0".repeat(40),
          after: pullRequestOpened.payload.pull_request.head.sha,
        } as any,
      });

    test("an open pull request without the field is read once", async () => {
      findOnePr.mockResolvedValue(storedPr());
      seededThreads = [graphqlNode(200, false), graphqlNode(300, true)];

      await receiveSynchronize();

      expect(graphqlCalled).toHaveBeenCalledTimes(1);
      expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
        $set: expect.objectContaining({ unresolvedThreads: [thread(200)] }),
      });
    });

    test("a pull request already read is not read again", async () => {
      findOnePr.mockResolvedValue(storedPr([]));

      await receiveSynchronize();

      expect(graphqlCalled).not.toHaveBeenCalled();
    });
  });
});
