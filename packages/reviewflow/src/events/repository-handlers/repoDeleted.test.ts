import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

nock.disableNetConnect();

const payload = {
  action: "deleted",
  repository: {
    id: 42,
    name: "reviewflow-test",
    full_name: "reviewflow/reviewflow-test",
    owner: { id: 1, login: "reviewflow", type: "Organization" },
  },
  installation: { id: 1 },
} as unknown as ProbotEvent<"repository.deleted">["payload"];

describe("repository deleted", (): void => {
  let probot: Probot;
  const deleteManyPrs = vi.fn(() => Promise.resolve());
  const deleteManyLabels = vi.fn(() => Promise.resolve());
  const deleteByKeyRepository = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      prs: { deleteMany: deleteManyPrs },
      labels: { deleteMany: deleteManyLabels },
      repositories: { deleteByKey: deleteByKeyRepository },
    });
  });

  test("removes everything mirrored for the repository", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "repository",
      payload,
    });

    expect(deleteManyPrs).toHaveBeenCalledWith({ "repo.id": 42 });
    expect(deleteManyLabels).toHaveBeenCalledWith({ "repo.id": 42 });
    expect(deleteByKeyRepository).toHaveBeenCalledWith(42);
  });
});
