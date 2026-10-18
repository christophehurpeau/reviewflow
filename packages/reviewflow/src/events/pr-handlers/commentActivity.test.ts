import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
import reviewCommentCreated from "../../__fixtures__/pull_request_review_comment.created.json";
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

const { pull_request: pullRequest, ...eventBase } = pullRequestOpened.payload;
const issue = {
  number: pullRequest.number,
  title: pullRequest.title,
  user: pullRequest.user,
  state: pullRequest.state,
  pull_request: { url: pullRequest.url, html_url: pullRequest.html_url },
};
const commenter = { ...eventBase.sender, id: 42, login: "commenter" };
const reviewflowBot = {
  ...eventBase.sender,
  login: `${process.env.REVIEWFLOW_NAME}[bot]`,
  type: "Bot",
};

const buildComment = (user: typeof commenter, id = 7) => ({
  id,
  user,
  body: "Looks good",
  html_url: `${pullRequest.html_url}#issuecomment-${id}`,
  created_at: "2026-10-18T10:00:00Z",
  updated_at: "2026-10-18T10:05:00Z",
});

const lastCommentActivityAt = (date: unknown) => ({
  $set: { "flowDates.lastCommentActivityAt": date },
});

const lastReviewCommentActivityAt = (date: unknown) => ({
  $set: { "flowDates.lastReviewCommentActivityAt": date },
});

const reviewComment = {
  ...reviewCommentCreated.payload.comment,
  created_at: "2026-10-18T11:00:00Z",
  updated_at: "2026-10-18T11:05:00Z",
};

describe("conversation comment activity", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const findOnePr = vi.fn();

  const receiveIssueComment = (
    action: "created" | "deleted" | "edited",
    comment: ReturnType<typeof buildComment>,
    sender = commenter,
  ) =>
    probot.receive({
      id: "1",
      name: "issue_comment",
      payload: { ...eventBase, action, issue, comment, sender } as any,
    });

  // the activity is recorded first: what follows, the slack notification and
  // the review threads tracking, needs graphql mocks this test has no use for
  const receiveReviewComment = (action: "created" | "deleted" | "edited") =>
    probot
      .receive({
        id: "1",
        name: "pull_request_review_comment",
        payload: {
          ...reviewCommentCreated.payload,
          action,
          comment: reviewComment,
          sender: commenter,
        } as any,
      })
      .catch(() => {});

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    findOnePr.mockReset();
    findOnePr.mockResolvedValue({
      commentId: 1,
      reviews: createEmptyReviews(),
      assignees: [],
      flowDates: {
        createdAt: new Date("2021-11-10T16:18:08Z"),
        openedAt: new Date("2021-11-10T16:18:08Z"),
      },
    });
    probot = await initializeProbotApp({
      prs: { findOne: findOnePr, partialUpdateOne: partialUpdateOnePr },
      orgMembers: { findOne: () => Promise.resolve(undefined) },
      users: { findAll: () => Promise.resolve([]) },
      slackSentMessages: {
        findAll: () => Promise.resolve([]),
        insertOne: () => Promise.resolve({}),
        deleteMany: () => Promise.resolve(),
      },
    });
    mockAccessToken();
    mockLabels();
    nock("https://api.github.com")
      .persist()
      .get(/\/issues\/comments\/1$/)
      .reply(200, { id: 1, body: "### Progress\n\n### Options:\n" })
      .get(/\/pulls\/30$/)
      .reply(200, pullRequest)
      .get(/.*/)
      .reply(200, []);
    nock("https://api.github.com")
      .persist()
      .patch(/.*/)
      .reply(200, {})
      .post(/.*/)
      .reply(200, {});
  });

  test("dates a created comment", async () => {
    await receiveIssueComment("created", buildComment(commenter));

    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      expect.anything(),
      lastCommentActivityAt(new Date("2026-10-18T10:00:00Z")),
    );
  });

  test("dates an edited comment with its edition time", async () => {
    await receiveIssueComment("edited", buildComment(commenter));

    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      expect.anything(),
      lastCommentActivityAt(new Date("2026-10-18T10:05:00Z")),
    );
  });

  test("dates a deleted comment with the receipt time", async () => {
    const before = Date.now();
    await receiveIssueComment("deleted", buildComment(commenter));

    const [, update] = partialUpdateOnePr.mock.calls.find(
      ([, call]) => call.$set["flowDates.lastCommentActivityAt"],
    )!;
    expect(
      update.$set["flowDates.lastCommentActivityAt"].getTime(),
    ).toBeGreaterThanOrEqual(before);
  });

  test("leaves out reviewflow's own comments and edits", async () => {
    await receiveIssueComment("created", buildComment(reviewflowBot, 1));
    await receiveIssueComment("edited", buildComment(commenter), reviewflowBot);

    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(
      expect.anything(),
      lastCommentActivityAt(expect.anything()),
    );
  });

  test("dates a created review comment apart from the conversation", async () => {
    await receiveReviewComment("created");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      expect.anything(),
      lastReviewCommentActivityAt(new Date("2026-10-18T11:00:00Z")),
    );
    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(
      expect.anything(),
      lastCommentActivityAt(expect.anything()),
    );
  });

  test("dates an edited review comment with its edition time", async () => {
    await receiveReviewComment("edited");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      expect.anything(),
      lastReviewCommentActivityAt(new Date("2026-10-18T11:05:00Z")),
    );
  });

  test("dates a deleted review comment with the receipt time", async () => {
    const before = Date.now();
    await receiveReviewComment("deleted");

    const [, update] = partialUpdateOnePr.mock.calls.find(
      ([, call]) => call.$set["flowDates.lastReviewCommentActivityAt"],
    )!;
    expect(
      update.$set["flowDates.lastReviewCommentActivityAt"].getTime(),
    ).toBeGreaterThanOrEqual(before);
  });

  test("leaves a document without flowDates untouched", async () => {
    findOnePr.mockResolvedValue({
      commentId: 1,
      reviews: createEmptyReviews(),
      assignees: [],
    });

    await receiveIssueComment("created", buildComment(commenter));

    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(
      expect.anything(),
      lastCommentActivityAt(expect.anything()),
    );
  });
});
