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

describe("synchronize", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    probot = await initializeProbotApp({
      prs: {
        findOne: () =>
          Promise.resolve({
            commentId: 1,
            reviews: createEmptyReviews(),
            assignees: [],
            unresolvedThreads: [],
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

  test("stores the receipt time of a push", async () => {
    await probot.receive({
      id: "1",
      name: "pull_request",
      payload: {
        ...pullRequestOpened.payload,
        action: "synchronize",
        before: "0".repeat(40),
        after: pullRequestOpened.payload.pull_request.head.sha,
      } as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({
        "flowDates.lastPushedAt": expect.any(Date),
      }),
    });
  });
});
