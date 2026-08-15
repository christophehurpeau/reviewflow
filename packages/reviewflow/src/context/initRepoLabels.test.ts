import { describe, expect, test, vi } from "vitest";
import type { Config } from "reviewflow-core";
import type { ProbotEvent } from "../events/probot-types.ts";
import type { LabelResponse } from "./initRepoLabels.ts";
import { initRepoLabels } from "./initRepoLabels.ts";

const createLabel = (
  id: number,
  name: string,
  description: string | null = null,
  color = "238636",
): LabelResponse => ({
  id,
  node_id: `MDU6TGFiZWwke${id}`,
  url: `https://api.github.com/repos/reviewflow/reviewflow-test/labels/${name}`,
  name,
  description,
  color,
  default: false,
});

const createConfig = (labels: Config["labels"]): Config<string> =>
  ({ labels }) as unknown as Config<string>;

const createContext = (repoLabels: LabelResponse[]) => {
  const createLabelMock = vi.fn((options: { name: string; color: string }) =>
    Promise.resolve({
      data: createLabel(999, options.name, null, options.color),
    }),
  );
  const updateLabelMock = vi.fn(
    (options: { new_name: string; color: string; description: string }) =>
      Promise.resolve({
        data: createLabel(
          repoLabels[0]!.id,
          options.new_name,
          options.description,
          options.color,
        ),
      }),
  );
  const deleteLabelMock = vi.fn(() => Promise.resolve({}));

  return {
    createLabelMock,
    updateLabelMock,
    deleteLabelMock,
    context: {
      octokit: {
        paginate: () => Promise.resolve(repoLabels),
        rest: {
          issues: {
            listLabelsForRepo: vi.fn(),
            createLabel: createLabelMock,
            updateLabel: updateLabelMock,
            deleteLabel: deleteLabelMock,
          },
        },
      },
      log: { info: vi.fn() },
      repo: (object: object) => ({
        owner: "reviewflow",
        repo: "reviewflow-test",
        ...object,
      }),
    } as unknown as ProbotEvent<"pull_request.opened">,
  };
};

describe("initRepoLabels", () => {
  test("returns every label of the repository, not only the configured ones", async () => {
    const { context } = createContext([
      createLabel(1, "automerge", "Auto merge - Synced by reviewflow"),
      createLabel(2, "dependencies"),
    ]);

    const { labelsRecord, allLabels } = await initRepoLabels(
      context,
      createConfig({
        list: {
          "merge/automerge": {
            name: "automerge",
            color: "#238636",
            description: "Auto merge",
          },
        },
      }),
    );

    expect(Object.keys(labelsRecord)).toEqual(["merge/automerge"]);
    expect(allLabels.map((label) => label.id)).toEqual([1, 2]);
  });

  test("returns the new name of a renamed label", async () => {
    const { context, updateLabelMock } = createContext([
      createLabel(1, "previous-name", "Auto merge - Synced by reviewflow"),
    ]);

    const { allLabels } = await initRepoLabels(
      context,
      createConfig({
        list: {
          "merge/automerge": {
            name: "automerge",
            color: "#238636",
            description: "Auto merge",
          },
        },
      }),
    );

    expect(updateLabelMock).toHaveBeenCalled();
    expect(allLabels).toEqual([
      expect.objectContaining({ id: 1, name: "automerge" }),
    ]);
  });

  test("returns a created label", async () => {
    const { context } = createContext([]);

    const { allLabels } = await initRepoLabels(
      context,
      createConfig({
        list: {
          "merge/automerge": {
            name: "automerge",
            color: "#238636",
            description: "Auto merge",
          },
        },
      }),
    );

    expect(allLabels).toEqual([
      expect.objectContaining({ id: 999, name: "automerge" }),
    ]);
  });

  test("excludes a label removed as legacy", async () => {
    const { context, deleteLabelMock } = createContext([
      createLabel(1, "legacy-label"),
      createLabel(2, "dependencies"),
    ]);

    const { allLabels } = await initRepoLabels(
      context,
      createConfig({
        list: {},
        legacyToRemove: { legacy: { name: "legacy-label", color: "#238636" } },
      }),
    );

    expect(deleteLabelMock).toHaveBeenCalled();
    expect(allLabels.map((label) => label.id)).toEqual([2]);
  });
});
