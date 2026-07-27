import type { Probot } from "probot";
import { beforeEach, describe, expect, test, vi } from "vitest";
import pullRequestEdited from "../__fixtures__/pull_request_30.edited.json";
import pullRequestCommits from "../__fixtures__/pull_request_30_commits.json";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../tests/setup.ts";
import { voidTeamSlack } from "./slack/voidTeamSlack.ts";

vi.mock("./slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const repositoryOwnedByPreviousAccount = {
  _id: 167_861_157,
  account: { id: 1, login: "previous-owner", type: "User" },
  fullName: "previous-owner/reviewflow-test",
  settings: {
    allowAutoMerge: true,
    allowMergeCommit: true,
    allowRebaseMerge: true,
    allowSquashMerge: true,
    defaultBranch: "main",
    defaultBranchProtectionRules: { requiresStatusChecks: true },
    deleteBranchOnMerge: true,
    lastUpdated: new Date(2099, 0, 1),
  },
};

const currentAccount = {
  id: 64_312_233,
  login: "reviewflow",
  type: "Organization",
};

describe("repository transferred without receiving the webhook", (): void => {
  let probot: Probot;
  const partialUpdateByKeyRepository = vi.fn(() => Promise.resolve());
  const findAllPrs = vi.fn(() => Promise.resolve([]));

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      repositories: {
        findByKey: () => Promise.resolve(repositoryOwnedByPreviousAccount),
        partialUpdateByKey: partialUpdateByKeyRepository,
      },
      prs: {
        findAll: findAllPrs,
        partialUpdateOne: vi.fn(),
      },
    });
    mockAccessToken();
    mockLabels();
  });

  test("moves the repository to its current account on the next pull request event", async (): Promise<void> => {
    nock("https://api.github.com")
      .get("/repos/reviewflow/reviewflow-test/pulls/30")
      .times(1)
      .reply(200, pullRequestEdited.payload.pull_request)

      .get(
        "/repos/reviewflow/reviewflow-test/issues/comments/1?issue_number=30",
      )
      .times(1)
      .reply(200, { id: 1, body: "" })

      .patch("/repos/reviewflow/reviewflow-test/issues/comments/1")
      .reply(200, (uri, body) => body)

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
      )
      .times(2)
      .reply(200, {});

    await probot.receive({
      id: "1",
      name: pullRequestEdited.event as any,
      payload: pullRequestEdited.payload,
    });

    expect(partialUpdateByKeyRepository).toHaveBeenCalledTimes(1);
    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(167_861_157, {
      $set: {
        account: currentAccount,
        fullName: "reviewflow/reviewflow-test",
      },
    });
    expect(findAllPrs).toHaveBeenCalledWith({
      "repo.id": 167_861_157,
      "account.id": { $ne: 64_312_233 },
    });
  });
});
