import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestOpened from "../../__fixtures__/pull_request_30.opened.json";
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

describe("review requested", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();
  const requestedReviewer = {
    ...pullRequestOpened.payload.sender,
    id: 42,
    login: "reviewer",
  };
  const pullRequest = {
    ...pullRequestOpened.payload.pull_request,
    requested_reviewers: [requestedReviewer],
  };

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    probot = await initializeProbotApp({
      prs: {
        findOne: () =>
          Promise.resolve({
            commentId: 1,
            reviews: createEmptyReviews(),
            assignees: [],
            flowDates: {
              createdAt: new Date("2021-11-10T16:18:08Z"),
              openedAt: new Date("2021-11-10T16:18:08Z"),
            },
          }),
        partialUpdateOne: partialUpdateOnePr,
      },
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
      .reply(200, pullRequest)
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

  test("stores the receipt time of the request", async () => {
    await probot.receive({
      id: "1",
      name: "pull_request",
      payload: {
        action: "review_requested",
        pull_request: pullRequest,
        requested_reviewer: requestedReviewer,
        repository: pullRequestOpened.payload.repository,
        organization: pullRequestOpened.payload.organization,
        installation: pullRequestOpened.payload.installation,
        sender: pullRequestOpened.payload.sender,
      } as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: {
        reviews: expect.objectContaining({
          reviewRequested: [
            expect.objectContaining({
              id: 42,
              requestedAt: expect.any(Date),
            }),
          ],
        }),
        reviewState: "requested",
      },
    });
  });
});
