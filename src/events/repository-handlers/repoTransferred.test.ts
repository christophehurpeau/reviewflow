import type { Probot } from "probot";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const newAccount = { id: 999, login: "new-org", type: "Organization" };

const transferredPayload = {
  action: "transferred",
  repository: {
    id: 42,
    name: "reviewflow-test",
    full_name: "new-org/reviewflow-test",
    owner: newAccount,
  },
  changes: { owner: { from: { user: { id: 1, login: "previous-owner" } } } },
  installation: { id: 1 },
} as unknown as ProbotEvent<"repository.transferred">["payload"];

describe("repository transferred", (): void => {
  let probot: Probot;
  const partialUpdateByKeyRepository = vi.fn(() => Promise.resolve());
  const findAllPrs = vi.fn(() => Promise.resolve([]));
  const partialUpdateOnePr = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      repositories: { partialUpdateByKey: partialUpdateByKeyRepository },
      prs: { findAll: findAllPrs, partialUpdateOne: partialUpdateOnePr },
    });
  });

  test("moves the repository to the account it was transferred to", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "repository",
      payload: transferredPayload,
    });

    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(42, {
      $set: { account: newAccount, fullName: "new-org/reviewflow-test" },
    });
    expect(findAllPrs).toHaveBeenCalledWith({
      "repo.id": 42,
      "account.id": { $ne: 999 },
    });
  });
});
