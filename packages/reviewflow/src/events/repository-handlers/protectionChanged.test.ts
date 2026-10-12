import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import {
  initializeProbotApp,
  mockAccessToken,
  mockLabels,
  nock,
} from "../../tests/setup.ts";

nock.disableNetConnect();

const repository = {
  id: 167_861_157,
  name: "reviewflow-test",
  full_name: "reviewflow/reviewflow-test",
  owner: { id: 64_312_233, login: "reviewflow", type: "Organization" },
};

describe("protection changed", (): void => {
  let probot: Probot;
  const partialUpdateByKeyRepository = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    nock.cleanAll();
    probot = await initializeProbotApp({
      repositories: { partialUpdateByKey: partialUpdateByKeyRepository },
    });
    mockAccessToken();
    mockLabels();
  });

  test.each([
    ["branch_protection_rule", "edited", { rule: { name: "main" } }],
    ["repository_ruleset", "created", { repository_ruleset: { id: 1 } }],
  ] as const)(
    "%s %s refreshes the settings of the repository",
    async (name, action, extra): Promise<void> => {
      await probot.receive({
        id: "1",
        name,
        payload: {
          action,
          repository,
          installation: { id: 1 },
          ...extra,
        } as any,
      });

      expect(partialUpdateByKeyRepository).toHaveBeenCalledWith(
        repository.id,
        {
          $set: {
            settings: expect.objectContaining({ defaultBranch: "main" }),
          },
        },
        undefined,
        { touchUpdated: false },
      );
    },
  );

  test("an organization ruleset has no repository: nothing is refreshed", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "repository_ruleset",
      payload: {
        action: "edited",
        organization: { login: "reviewflow", id: 64_312_233 },
        installation: { id: 1 },
        repository_ruleset: { id: 1 },
      } as any,
    });

    expect(partialUpdateByKeyRepository).not.toHaveBeenCalled();
  });
});
