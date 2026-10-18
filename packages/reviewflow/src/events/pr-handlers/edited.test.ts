import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import pullRequestEdited from "../../__fixtures__/pull_request_30.edited.json";
import pullRequestCommits from "../../__fixtures__/pull_request_30_commits.json";
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

const lastBodyEditedAt = (date: unknown) => ({
  $set: { "flowDates.lastBodyEditedAt": date },
});

describe("edited", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();

  // the date is recorded first: what follows needs github mocks these tests
  // have no use for
  const receiveEdited = (payload: Record<string, unknown>) =>
    probot
      .receive({
        id: "1",
        name: pullRequestEdited.event as any,
        payload: { ...pullRequestEdited.payload, ...payload } as any,
      })
      .catch(() => {});

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
              createdAt: new Date("2020-05-22T12:00:00Z"),
              openedAt: new Date("2020-05-22T12:00:00Z"),
            },
          }),
        partialUpdateOne: partialUpdateOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test("edits the pull request when pull request is edited", async (): Promise<void> => {
    const scope = nock("https://api.github.com")
      .get("/repos/reviewflow/reviewflow-test/pulls/30")
      .times(1)
      .reply(200, pullRequestEdited.payload.pull_request)

      .get(
        "/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=30",
      )
      .times(1)
      .reply(200, {
        id: 1,
        body: '### Progress\n\n☑️ Step 1: ✏️ Write code\n☑️ Step 2: 💚 Checks\n⬜ Step 3: 👌 Code Review\n⬜ Step 4: 🚦 Merge Pull Request\n\n### Options:\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add `[skip ci]` on merge commit\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged',
      })

      .get("/repos/reviewflow/reviewflow-test/pulls/30/commits?per_page=100")
      .reply(200, pullRequestCommits)

      .get(
        "/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/check-runs?per_page=100",
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .get(
        "/repos/reviewflow/reviewflow-test/commits/2ab411d5c55f25f3dc2de6a3244f290a804e33da/status?per_page=100",
      )
      .reply(200, { statuses: [] })

      .post(
        "/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da",
        '{"context":"reviewflow-dev/lint-pr","state":"success","description":"✓ PR is valid"}',
      )
      .reply(200, {})

      .post(
        "/repos/reviewflow/reviewflow-test/statuses/2ab411d5c55f25f3dc2de6a3244f290a804e33da",
        '{"context":"reviewflow-dev","state":"failure","description":"Awaiting review... Perhaps request someone ?"}',
      )
      .reply(200, {});

    await probot.receive({
      id: "1",
      name: pullRequestEdited.event as any,
      payload: pullRequestEdited.payload,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.anything(), {
      $set: expect.objectContaining({
        headRef: "christophehurpeau-patch-2",
        baseRef: "master",
        headRepoFullName: "reviewflow/reviewflow-test",
      }),
    });
    expect(partialUpdateOnePr).toHaveBeenCalledWith(
      expect.anything(),
      lastBodyEditedAt(new Date("2020-05-22T12:38:13Z")),
    );
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });

  test("does not date the body when only the title changed", async () => {
    await receiveEdited({ changes: { title: { from: "old title" } } });

    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(
      expect.anything(),
      lastBodyEditedAt(expect.anything()),
    );
  });

  test("leaves out reviewflow's own body rewrites", async () => {
    await receiveEdited({
      sender: {
        ...pullRequestEdited.payload.sender,
        login: `${process.env.REVIEWFLOW_NAME}[bot]`,
        type: "Bot",
      },
    });

    expect(partialUpdateOnePr).not.toHaveBeenCalledWith(
      expect.anything(),
      lastBodyEditedAt(expect.anything()),
    );
  });
});
