import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestEdited from "../../__fixtures__/pull_request_30.edited.json";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
import reviewCommentCreated from "../../__fixtures__/pull_request_review_comment.created.json";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import { initializeProbotApp, nock } from "../../tests/setup.ts";

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

const comment = {
  id: 7,
  user: commenter,
  body: "Looks good",
  html_url: `${pullRequest.html_url}#issuecomment-7`,
  created_at: "2026-10-18T10:00:00Z",
  updated_at: "2026-10-18T10:05:00Z",
};

const reviewComment = {
  ...reviewCommentCreated.payload.comment,
  created_at: "2026-10-18T11:00:00Z",
  updated_at: "2026-10-18T11:05:00Z",
};

const byPullRequest = (payload: {
  repository: { id: number; owner: { id: number } };
}) =>
  expect.objectContaining({
    "account.id": payload.repository.owner.id,
    "repo.id": payload.repository.id,
    "pr.number": 30,
  });

const flowDateSet = (flowDate: string, date: unknown) => ({
  $set: { [`flowDates.${flowDate}`]: date },
});

describe("activity flow dates", (): void => {
  let probot: Probot;
  const partialUpdateManyPr = vi.fn();

  // the other handlers of these events need github mocks these tests have no
  // use for: their failures are not what is tested
  const receive = (name: string, payload: unknown) =>
    probot
      .receive({ id: "1", name: name as any, payload: payload as any })
      .catch(() => {});

  const receiveIssueComment = (
    action: "created" | "deleted" | "edited",
    sender = commenter,
  ) =>
    receive("issue_comment", { ...eventBase, action, issue, comment, sender });

  const receiveReviewComment = (
    action: "created" | "deleted" | "edited",
    sender = commenter,
  ) =>
    receive("pull_request_review_comment", {
      ...reviewCommentCreated.payload,
      action,
      comment: reviewComment,
      sender,
    });

  const findSetAt = (flowDate: string): Date =>
    partialUpdateManyPr.mock.calls.find(
      ([, update]) => update.$set[`flowDates.${flowDate}`],
    )![1].$set[`flowDates.${flowDate}`];

  beforeEach(async () => {
    partialUpdateManyPr.mockReset();
    partialUpdateManyPr.mockResolvedValue(undefined);
    probot = await initializeProbotApp({
      prs: { partialUpdateMany: partialUpdateManyPr },
    });
  });

  test("dates a created conversation comment, by pull request", async () => {
    await receiveIssueComment("created");

    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      byPullRequest(eventBase),
      flowDateSet("lastCommentActivityAt", new Date("2026-10-18T10:00:00Z")),
    );
  });

  test("dates an edited comment with its edition time", async () => {
    await receiveIssueComment("edited");

    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      byPullRequest(eventBase),
      flowDateSet("lastCommentActivityAt", new Date("2026-10-18T10:05:00Z")),
    );
  });

  test("dates a deleted comment with the receipt time", async () => {
    const before = Date.now();
    await receiveIssueComment("deleted");

    expect(findSetAt("lastCommentActivityAt").getTime()).toBeGreaterThanOrEqual(
      before,
    );
  });

  test("dates reviewflow's own comments and edits", async () => {
    await receiveIssueComment("created", reviewflowBot);
    await receiveIssueComment("edited", reviewflowBot);

    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      byPullRequest(eventBase),
      flowDateSet("lastCommentActivityAt", new Date("2026-10-18T10:00:00Z")),
    );
    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      byPullRequest(eventBase),
      flowDateSet("lastCommentActivityAt", new Date("2026-10-18T10:05:00Z")),
    );
  });

  test("leaves out comments on issues", async () => {
    await receive("issue_comment", {
      ...eventBase,
      action: "created",
      issue: { ...issue, pull_request: undefined },
      comment,
      sender: commenter,
    });

    expect(partialUpdateManyPr).not.toHaveBeenCalled();
  });

  test("dates review comments apart from the conversation", async () => {
    await receiveReviewComment("created");
    await receiveReviewComment("edited");

    const target = byPullRequest(reviewCommentCreated.payload);
    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      target,
      flowDateSet(
        "lastReviewCommentActivityAt",
        new Date("2026-10-18T11:00:00Z"),
      ),
    );
    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      target,
      flowDateSet(
        "lastReviewCommentActivityAt",
        new Date("2026-10-18T11:05:00Z"),
      ),
    );
    expect(partialUpdateManyPr).not.toHaveBeenCalledWith(
      expect.anything(),
      flowDateSet("lastCommentActivityAt", expect.anything()),
    );
  });

  test("dates a deleted review comment with the receipt time", async () => {
    const before = Date.now();
    await receiveReviewComment("deleted");

    expect(
      findSetAt("lastReviewCommentActivityAt").getTime(),
    ).toBeGreaterThanOrEqual(before);
  });

  test("dates a body edit, reviewflow's own included", async () => {
    await receive("pull_request", pullRequestEdited.payload);
    await receive("pull_request", {
      ...pullRequestEdited.payload,
      sender: reviewflowBot,
    });

    expect(partialUpdateManyPr).toHaveBeenCalledTimes(2);
    expect(partialUpdateManyPr).toHaveBeenCalledWith(
      byPullRequest(pullRequestEdited.payload),
      flowDateSet("lastBodyEditedAt", new Date("2020-05-22T12:38:13Z")),
    );
  });

  test("does not date the body when only the title changed", async () => {
    await receive("pull_request", {
      ...pullRequestEdited.payload,
      changes: { title: { from: "old title" } },
    });

    expect(partialUpdateManyPr).not.toHaveBeenCalled();
  });
});
