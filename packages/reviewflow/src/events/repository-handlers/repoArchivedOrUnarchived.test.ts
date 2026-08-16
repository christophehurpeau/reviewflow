import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

nock.disableNetConnect();

const buildPayload = (
  action: "archived" | "unarchived",
): ProbotEvent<"repository.archived">["payload"] =>
  ({
    action,
    repository: {
      id: 42,
      name: "reviewflow-test",
      full_name: "reviewflow/reviewflow-test",
      owner: { id: 1, login: "reviewflow", type: "Organization" },
    },
    installation: { id: 1 },
  }) as unknown as ProbotEvent<"repository.archived">["payload"];

describe("repository archived or unarchived", (): void => {
  let probot: Probot;
  const deleteManyPrs = vi.fn(() => Promise.resolve());
  const deleteManyLabels = vi.fn(() => Promise.resolve());
  const deleteManyRepositories = vi.fn(() => Promise.resolve());
  const partialUpdateByKeyRepository = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      prs: { deleteMany: deleteManyPrs },
      labels: { deleteMany: deleteManyLabels },
      repositories: {
        deleteMany: deleteManyRepositories,
        partialUpdateByKey: partialUpdateByKeyRepository,
      },
    });
  });

  test("flags the repository and drops its pull requests when archived", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "repository",
      payload: buildPayload("archived"),
    });

    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(42, {
      $set: { archived: true },
    });
    expect(deleteManyPrs).toHaveBeenCalledWith({ "repo.id": 42 });
    expect(deleteManyLabels).not.toHaveBeenCalled();
    expect(deleteManyRepositories).not.toHaveBeenCalled();
  });

  test("clears the flag when unarchived", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "repository",
      payload: buildPayload("unarchived"),
    });

    expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(42, {
      $set: { archived: false },
    });
    expect(deleteManyPrs).not.toHaveBeenCalled();
  });
});
