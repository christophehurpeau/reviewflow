import type { Probot } from "probot";
import { beforeEach, describe, expect, test, vi } from "vitest";
import pullRequestEdited from "../../__fixtures__/pull_request_30.edited.json";
import pullRequestCommits from "../../__fixtures__/pull_request_30_commits.json";
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

    expect(partialUpdateOnePr).toHaveBeenCalled();
    expect(scope.pendingMocks()).toEqual([]);
    expect(scope.activeMocks()).toEqual([]);
  });
});
