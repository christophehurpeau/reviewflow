import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

nock.disableNetConnect();

const removedPayload = {
  action: "removed",
  installation: {
    id: 1,
    account: { id: 64_312_233, login: "reviewflow", type: "Organization" },
  },
  repository_selection: "selected",
  repositories_removed: [
    {
      id: 42,
      name: "reviewflow-test",
      full_name: "reviewflow/reviewflow-test",
    },
    { id: 43, name: "other", full_name: "reviewflow/other" },
  ],
  sender: { id: 1, login: "reviewflow", type: "User" },
} as unknown as ProbotEvent<"installation_repositories.removed">["payload"];

describe("installation repositories removed", (): void => {
  let probot: Probot;
  const deleteManyPrs = vi.fn(() => Promise.resolve());
  const deleteManyLabels = vi.fn(() => Promise.resolve());
  const deleteManyRepositories = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      prs: { deleteMany: deleteManyPrs },
      labels: { deleteMany: deleteManyLabels },
      repositories: { deleteMany: deleteManyRepositories },
    });
  });

  test("removes everything mirrored for each removed repository", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "installation_repositories",
      payload: removedPayload,
    });

    expect(deleteManyPrs).toHaveBeenCalledWith({ "repo.id": 42 });
    expect(deleteManyPrs).toHaveBeenCalledWith({ "repo.id": 43 });
    expect(deleteManyLabels).toHaveBeenCalledWith({ "repo.id": 42 });
    expect(deleteManyLabels).toHaveBeenCalledWith({ "repo.id": 43 });
    expect(deleteManyRepositories).toHaveBeenCalledWith({ _id: 42 });
    expect(deleteManyRepositories).toHaveBeenCalledWith({ _id: 43 });
  });
});
