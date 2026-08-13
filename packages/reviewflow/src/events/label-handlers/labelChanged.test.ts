import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Probot } from "probot";
import { voidTeamSlack } from "../../context/slack/voidTeamSlack.ts";
import { initializeProbotApp, nock } from "../../tests/setup.ts";
import type { ProbotEvent } from "../probot-types.ts";

vi.mock("../../context/slack/initTeamSlack", () => ({
  initTeamSlack: () => Promise.resolve(voidTeamSlack()),
}));

nock.disableNetConnect();

const account = { id: 1, login: "reviewflow", type: "Organization" };
const repository = {
  id: 42,
  name: "reviewflow-test",
  full_name: "reviewflow/reviewflow-test",
  owner: account,
};

const label = {
  id: 1_285_313_520,
  node_id: "MDU6TGFiZWwxMjg1MzEzNTIw",
  url: "https://api.github.com/repos/reviewflow/reviewflow-test/labels/automerge",
  name: ":vertical_traffic_light: automerge",
  color: "238636",
  default: false,
  description: "Auto merge - Synced by reviewflow",
};

const createPayload = (
  action: "created" | "deleted" | "edited",
  changes?: object,
): ProbotEvent<"label.created">["payload"] =>
  ({
    action,
    label,
    changes,
    repository,
    installation: { id: 1 },
  }) as unknown as ProbotEvent<"label.created">["payload"];

describe("label changed", (): void => {
  let probot: Probot;
  const upsertOneLabel = vi.fn(() => Promise.resolve());
  const deleteByKeyLabel = vi.fn(() => Promise.resolve());
  const partialUpdateManyPrs = vi.fn(() => Promise.resolve());

  beforeEach(async () => {
    vi.clearAllMocks();
    probot = await initializeProbotApp({
      labels: { upsertOne: upsertOneLabel, deleteByKey: deleteByKeyLabel },
      prs: { partialUpdateMany: partialUpdateManyPrs },
    });
  });

  test("stores a created label", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "label",
      payload: createPayload("created"),
    });

    expect(upsertOneLabel).toHaveBeenCalledWith({
      _id: label.id,
      account,
      repo: { id: 42, name: "reviewflow-test" },
      name: label.name,
      color: label.color,
      description: label.description,
    });
    expect(partialUpdateManyPrs).not.toHaveBeenCalled();
  });

  test("updates an edited label without touching pull requests when the name did not change", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "label",
      payload: createPayload("edited", { color: { from: "ffffff" } }),
    });

    expect(upsertOneLabel).toHaveBeenCalledWith(
      expect.objectContaining({ _id: label.id, color: label.color }),
    );
    expect(partialUpdateManyPrs).not.toHaveBeenCalled();
  });

  test("updates the label name embedded in the pull requests when it was renamed", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "label",
      payload: createPayload("edited", {
        name: { from: ":vertical_traffic_light: previous-name" },
      }),
    });

    expect(partialUpdateManyPrs).toHaveBeenCalledWith(
      { "repo.id": 42, "labels.id": label.id },
      { $set: { "labels.$.name": label.name } },
    );
  });

  test("deletes a removed label and pulls it from the pull requests", async (): Promise<void> => {
    await probot.receive({
      id: "1",
      name: "label",
      payload: createPayload("deleted"),
    });

    expect(deleteByKeyLabel).toHaveBeenCalledWith(label.id);
    expect(partialUpdateManyPrs).toHaveBeenCalledWith(
      { "repo.id": 42, "labels.id": label.id },
      { $pull: { labels: { id: label.id } } },
    );
  });
});
