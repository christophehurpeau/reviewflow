import type { Probot } from "probot";
import { beforeEach, describe, expect, test, vi } from "vitest";
import pullRequestCommits from "../../__fixtures__/pull_request_30_commits.json";
import pullRequestReadyForReview from "../../__fixtures__/pull_request_54.ready_for_review.json";
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

describe("edited", (): void => {
  let probot: Probot;
  const partialUpdateOnePr = vi.fn();

  beforeEach(async () => {
    probot = await initializeProbotApp({
      prs: {
        partialUpdateOne: partialUpdateOnePr,
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test("add code review label when pr is ready to be review", async (): Promise<void> => {
    const scope = nock("https://api.github.com")
      .get(
        "/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=54",
      )
      .times(1)
      .reply(200, {
        id: 1,
        body: '### Progress\n\n☑️ Step 1: ✏️ Write code\n☑️ Step 2: 💚 Checks\n⬜ Step 3: 👌 Code Review\n⬜ Step 4: 🚦 Merge Pull Request\n\n### Options:\n- [ ] <!-- reviewflow-autoMergeWithSkipCi -->Add `[skip ci]` on merge commit\n- [ ] <!-- reviewflow-autoMerge -->Auto merge when this PR is ready and has no failed statuses. (Also has a queue per repo to prevent multiple useless "Update branch" triggers)\n- [x] <!-- reviewflow-deleteAfterMerge -->Automatic branch delete after this PR is merged',
      })

      .get("/repos/reviewflow/reviewflow-test/pulls/54")
      .times(1)
      .reply(200, pullRequestReadyForReview.payload.pull_request)

      .get(
        "/repos/reviewflow/reviewflow-test/commits/f354ffb37cf238108fbb4c915f155d925d82a61b/check-runs?per_page=100",
      )
      .times(2)
      .reply(200, { check_runs: [] })

      .get("/repos/reviewflow/reviewflow-test/pulls/54/commits?per_page=100")
      .reply(200, pullRequestCommits)

      .post(
        "/repos/reviewflow/reviewflow-test/issues/54/labels",
        '{"labels":[":ok_hand: code/needs-review"]}',
      )
      .reply(200, [
        {
          id: 1_210_432_920,
          node_id: "MDU6TGFiZWwxMjEwNDMyOTIw",
          url: "https://api.github.com/repos/reviewflow/reviewflow-test/labels/:ok_hand:%20code/needs-review",
          name: ":ok_hand: code/needs-review",
          color: "9e6a03",
          default: false,
          description: null,
        },
      ])

      .post(
        "/repos/reviewflow/reviewflow-test/statuses/f354ffb37cf238108fbb4c915f155d925d82a61b",
        '{"context":"reviewflow-dev/lint-pr","state":"success","description":"✓ PR is valid"}',
      )
      .times(1)
      .reply(200)

      .post(
        "/repos/reviewflow/reviewflow-test/statuses/f354ffb37cf238108fbb4c915f155d925d82a61b",
        '{"context":"reviewflow-dev","state":"failure","description":"Awaiting review... Perhaps request someone ?"}',
      )
      .times(1)
      .reply(200);

    await probot.receive({
      id: "1",
      name: pullRequestReadyForReview.event as any,
      payload: pullRequestReadyForReview.payload as any,
    });

    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        lastLintStatusesCommit: "f354ffb37cf238108fbb4c915f155d925d82a61b",
        lintStatuses: [
          {
            name: "lint-pr",
            status: {
              summary: "",
              title: "✓ PR is valid",
              type: "success",
              url: undefined,
            },
          },
        ],
      },
    });
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        flowStatus: {
          summary: "",
          title: "Awaiting review... Perhaps request someone ?",
          type: "failure",
        },
        lastFlowStatusCommit: "f354ffb37cf238108fbb4c915f155d925d82a61b",
      },
    });
    expect(partialUpdateOnePr).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        isClosed: false,
        isDraft: false,
        changesInformation: {
          additions: 2,
          changedFiles: 1,
          deletions: 0,
        },
        flowDates: {
          closedAt: undefined,
          createdAt: new Date("2021-11-10T16:18:08Z"),
          openedAt: new Date("2021-11-10T16:18:08Z"),
          readyAt: new Date("2021-11-10T16:18:08Z"),
        },
        title: "feat: test draft",
        assignees: [
          {
            avatar_url: "https://avatars.githubusercontent.com/u/302891?v=4",
            id: 302_891,
            login: "christophehurpeau",
            type: "User",
          },
        ],
      },
    });

    expect(partialUpdateOnePr).toHaveBeenCalledTimes(3);
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
