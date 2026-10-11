import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestClosed from "../../__fixtures__/pull_request.closed.json";
import pullRequestReopened from "../../__fixtures__/pull_request.reopened.json";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../../tests/setup.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

describe("closed and reopened", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();

  beforeEach(async () => {
    partialUpdateOnePr.mockClear();
    probot = await initializeProbotApp({
      prs: { partialUpdateOne: partialUpdateOnePr },
    });
    mockAccessToken();
    mockLabels();
    nock("https://api.github.com")
      .persist()
      .get(/\/issues\/comments\/1/)
      .reply(200, { id: 1, body: "### Progress\n\n### Options:\n" })
      .get(/\/check-runs/)
      .reply(200, { check_runs: [] })
      .get(/\/pulls\/30$/)
      .reply(200, pullRequestReopened.payload.pull_request)
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

  test.each([true, false])("stores merged=%s on close", async (merged) => {
    await probot.receive({
      id: "1",
      name: "pull_request",
      payload: {
        ...pullRequestClosed.payload,
        pull_request: { ...pullRequestClosed.payload.pull_request, merged },
      } as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({ isClosed: true, isMerged: merged }),
    });
  });

  test("resets merged on reopen", async () => {
    await probot.receive({
      id: "1",
      name: "pull_request",
      payload: pullRequestReopened.payload as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({ isMerged: false }),
      $unset: {},
    });
  });
});
