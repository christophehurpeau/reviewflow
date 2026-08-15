import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

nock.disableNetConnect();

const account = { id: 64_312_233, login: "reviewflow", type: "Organization" };

const deletedPayload = {
  action: "deleted",
  installation: { id: 1, account },
  sender: { id: 1, login: "reviewflow", type: "User" },
} as unknown as ProbotEvent<"installation.deleted">["payload"];

describe("installation deleted", (): void => {
  let probot: Probot;
  const org = { _id: account.id, login: account.login, installationId: 1 };
  const partialUpdateOneOrg = vi.fn(() => Promise.resolve());
  const findAllRepositories = vi.fn(() => Promise.resolve([{ _id: 42 }]));
  const deleteManyRepositories = vi.fn(() => Promise.resolve());
  const deleteManyPrs = vi.fn(() => Promise.resolve());
  const deleteManyLabels = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      orgs: {
        findOne: () => Promise.resolve(org),
        partialUpdateOne: partialUpdateOneOrg,
      },
      repositories: {
        findAll: findAllRepositories,
        deleteMany: deleteManyRepositories,
      },
      prs: { deleteMany: deleteManyPrs },
      labels: { deleteMany: deleteManyLabels },
    });
  });

  test("marks the org deleted and removes everything mirrored for its repositories", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "installation",
      payload: deletedPayload,
    });

    expect(partialUpdateOneOrg).toHaveBeenCalledWith(org, {
      $set: { status: "deleted" },
    });
    expect(findAllRepositories).toHaveBeenCalledWith({
      "account.id": account.id,
    });
    expect(deleteManyPrs).toHaveBeenCalledWith({ "account.id": account.id });
    expect(deleteManyLabels).toHaveBeenCalledWith({ "account.id": account.id });
    expect(deleteManyRepositories).toHaveBeenCalledWith({
      "account.id": account.id,
    });
  });
});
