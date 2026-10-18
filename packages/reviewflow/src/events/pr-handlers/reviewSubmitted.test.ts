import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
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

describe("review submitted", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const findOnePr = vi.fn();
  const flowDates = {
    createdAt: new Date("2021-11-10T16:18:08Z"),
    openedAt: new Date("2021-11-10T16:18:08Z"),
  };

  const receiveReview = (reviewerLogin: string) =>
    probot.receive({
      id: "1",
      name: "pull_request_review",
      payload: {
        action: "submitted",
        pull_request: pullRequestOpened.payload.pull_request,
        repository: pullRequestOpened.payload.repository,
        organization: pullRequestOpened.payload.organization,
        installation: pullRequestOpened.payload.installation,
        sender: { ...pullRequestOpened.payload.sender, login: reviewerLogin },
        review: {
          id: 5,
          user: {
            ...pullRequestOpened.payload.sender,
            id: reviewerLogin === "reviewer" ? 42 : 302_891,
            login: reviewerLogin,
          },
          state: "commented",
          body: null,
          html_url: "https://github.com/reviewflow/reviewflow-test/pull/30",
        },
      } as any,
    });

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    findOnePr.mockReset();
    probot = await initializeProbotApp({
      prs: { findOne: findOnePr, partialUpdateOne: partialUpdateOnePr },
      orgMembers: { findOne: () => Promise.resolve(undefined) },
    });
    mockAccessToken();
    mockLabels();
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

  test("stores the receipt time of a review", async () => {
    findOnePr.mockResolvedValue({
      ...storedPrIdentity,
      commentId: 1,
      reviews: createEmptyReviews(),
      assignees: [],
      flowDates,
    });

    await receiveReview("reviewer");

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: { "flowDates.lastReviewSubmittedAt": expect.any(Date) },
    });
  });

  test("leaves a document without flowDates untouched", async () => {
    findOnePr.mockResolvedValue({
      ...storedPrIdentity,
      commentId: 1,
      reviews: createEmptyReviews(),
      assignees: [],
    });

    await receiveReview("reviewer");

    expect(partialUpdateOnePr).toHaveBeenCalled();
    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(expect.anything(), {
      $set: { "flowDates.lastReviewSubmittedAt": expect.anything() },
    });
  });
});
