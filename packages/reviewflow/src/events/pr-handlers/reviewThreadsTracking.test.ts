import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
import reviewCommentCreated from "../../__fixtures__/pull_request_review_comment.created.json";
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

const thread = (id: number, authorLogin: string | null = "reviewer") => ({
  rootCommentId: id,
  url: `${prUrl}#discussion_r${id}`,
  path: "src/index.ts",
  authorLogin,
  reviewId: 7,
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
        pullRequestReview: { databaseId: 7 },
      },
    ],
  },
});

describe("review threads tracking", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const findOnePr = vi.fn();
  const graphqlCalled = vi.fn();
  const statusCreated = vi.fn();
  const findAllSlackSentMessages = vi.fn();
  const partialUpdateManySlackSentMessages = vi.fn();
  let seededThreads: ReturnType<typeof graphqlNode>[] = [];
  let reviewState = "COMMENTED";

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
    statusCreated.mockReset();
    findAllSlackSentMessages.mockReset();
    findAllSlackSentMessages.mockResolvedValue([]);
    partialUpdateManySlackSentMessages.mockReset();
    seededThreads = [];
    reviewState = "COMMENTED";
    nock.cleanAll();
    probot = await initializeProbotApp({
      prs: { findOne: findOnePr, partialUpdateOne: partialUpdateOnePr },
      orgMembers: { findOne: () => Promise.resolve(undefined) },
      // commentEditedOrDeleted runs on the same deletion
      slackSentMessages: {
        deleteMany: () => Promise.resolve(),
        findAll: findAllSlackSentMessages,
        partialUpdateMany: partialUpdateManySlackSentMessages,
      },
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
      .post(/\/statuses\//)
      .reply(200, () => {
        statusCreated();
        return {};
      });
    // before the generic reviews below
    nock("https://api.github.com")
      .persist()
      .get(/\/pulls\/30\/reviews\/7$/)
      .reply(200, () => ({ id: 7, state: reviewState }));
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

  test("the status is left alone when conversation resolution is not required", async () => {
    findOnePr.mockResolvedValue(storedPr([thread(101)]));

    await receiveThread("resolved");

    expect(unresolvedThreadsWrites()).toHaveLength(1);
    expect(statusCreated).not.toHaveBeenCalled();
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

  describe("slack messages of the thread comments", () => {
    const sentMessage = (typeId: number, isMarkedAsDone = false) => ({
      type: "review-comment",
      typeId,
      isMarkedAsDone,
      message: { text: `comment ${typeId}` },
      sentTo: [{ user: { id: "U1" }, ts: `ts${typeId}`, channel: "C1" }],
    });

    const sentMessagesOf = (ids: number[], isMarkedAsDone: boolean) =>
      findAllSlackSentMessages.mockImplementation((criteria) =>
        Promise.resolve(
          ids
            .filter((id) => id === criteria.typeId)
            .map((id) => sentMessage(id, isMarkedAsDone)),
        ),
      );

    test("resolved marks the messages of every comment of the thread", async () => {
      findOnePr.mockResolvedValue(storedPr([thread(101)]));
      sentMessagesOf([101, 102], false);

      await receiveThread("resolved");

      expect(partialUpdateManySlackSentMessages).toHaveBeenCalledTimes(2);
      for (const typeId of [101, 102]) {
        expect(partialUpdateManySlackSentMessages).toHaveBeenCalledWith(
          expect.objectContaining({ type: "review-comment", typeId }),
          { $set: { isMarkedAsDone: true } },
        );
      }
    });

    test("unresolved unmarks the struck messages", async () => {
      findOnePr.mockResolvedValue(storedPr([thread(101)]));
      sentMessagesOf([101], true);

      await receiveThread("unresolved");

      expect(partialUpdateManySlackSentMessages).toHaveBeenCalledTimes(1);
      expect(partialUpdateManySlackSentMessages).toHaveBeenCalledWith(
        expect.objectContaining({ type: "review-comment", typeId: 101 }),
        { $set: { isMarkedAsDone: false } },
      );
    });

    test("unresolved leaves messages that are not struck", async () => {
      findOnePr.mockResolvedValue(storedPr([thread(101)]));
      sentMessagesOf([101], false);

      await receiveThread("unresolved");

      expect(partialUpdateManySlackSentMessages).not.toHaveBeenCalled();
    });

    test("resolved marks even when the threads were never read", async () => {
      findOnePr.mockResolvedValue(storedPr());
      sentMessagesOf([101], false);

      await receiveThread("resolved");

      expect(partialUpdateManySlackSentMessages).toHaveBeenCalledWith(
        expect.objectContaining({ typeId: 101 }),
        { $set: { isMarkedAsDone: true } },
      );
    });
  });

  describe("slack message of the review", () => {
    const reviewMessage = (isMarkedAsDone: boolean) => ({
      type: "review-submitted",
      typeId: 7,
      isMarkedAsDone,
      message: { text: "commented on your PR" },
      sentTo: [{ user: { id: "U1" }, ts: "ts7", channel: "C1" }],
    });

    const reviewMessageStored = (isMarkedAsDone: boolean) =>
      findAllSlackSentMessages.mockImplementation((criteria) =>
        Promise.resolve(
          criteria.type === "review-submitted" && criteria.typeId === 7
            ? [reviewMessage(isMarkedAsDone)]
            : [],
        ),
      );

    const reviewMessageWrites = () =>
      partialUpdateManySlackSentMessages.mock.calls.filter(
        ([criteria]) => criteria.type === "review-submitted",
      );

    test("resolving the last thread of a commented review strikes it", async () => {
      findOnePr.mockResolvedValue(storedPr([thread(101)]));
      reviewMessageStored(false);

      await receiveThread("resolved");

      expect(reviewMessageWrites()).toEqual([
        [
          expect.objectContaining({ typeId: 7 }),
          { $set: { isMarkedAsDone: true } },
        ],
      ]);
    });

    test("a thread of the same review still open keeps it", async () => {
      findOnePr.mockResolvedValue(
        storedPr([thread(101), { ...thread(200), reviewId: 7 }]),
      );
      reviewMessageStored(false);

      await receiveThread("resolved");

      expect(reviewMessageWrites()).toHaveLength(0);
    });

    test("an approval is not struck", async () => {
      findOnePr.mockResolvedValue(storedPr([thread(101)]));
      reviewMessageStored(false);
      reviewState = "APPROVED";

      await receiveThread("resolved");

      expect(reviewMessageWrites()).toHaveLength(0);
    });

    test("unresolved restores a struck review message", async () => {
      findOnePr.mockResolvedValue(storedPr([]));
      reviewMessageStored(true);

      await receiveThread("unresolved");

      expect(reviewMessageWrites()).toEqual([
        [
          expect.objectContaining({ typeId: 7 }),
          { $set: { isMarkedAsDone: false } },
        ],
      ]);
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
