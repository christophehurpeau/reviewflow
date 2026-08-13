import { describe, expect, test, vi } from "vitest";
import type { AppContext } from "../../../../context/AppContext.ts";
import type { LabelResponse } from "../../../../context/initRepoLabels.ts";
import type { ReviewflowPr } from "../../../../mongo.ts";
import type { ProbotEvent } from "../../../probot-types.ts";
import type { PullRequestWithDecentData } from "../../utils/PullRequestData.ts";
import { syncLabels } from "./syncLabel.ts";

const createLabel = (id: number, name: string): LabelResponse => ({
  id,
  node_id: `MDU6TGFiZWwke${id}`,
  url: `https://api.github.com/repos/reviewflow/reviewflow-test/labels/${name}`,
  name,
  description: null,
  color: "238636",
  default: false,
});

const automergeLabel = createLabel(1, "automerge");
const needsReviewLabel = createLabel(2, "code/needs-review");

const createContext = (addedLabels: LabelResponse[]) => {
  const addLabels = vi.fn(() => Promise.resolve({ data: addedLabels }));
  const removeLabel = vi.fn(() => Promise.resolve({ data: addedLabels }));

  return {
    addLabels,
    context: {
      octokit: { rest: { issues: { addLabels, removeLabel } } },
      repo: (object: object) => ({
        owner: "reviewflow",
        repo: "reviewflow-test",
        ...object,
      }),
    } as unknown as ProbotEvent<"pull_request.opened">,
  };
};

const createPersist = (labels?: ReviewflowPr["labels"]) => {
  const partialUpdateOne = vi.fn(() => Promise.resolve());
  return {
    partialUpdateOne,
    persist: {
      appContext: {
        mongoStores: { prs: { partialUpdateOne } },
      } as unknown as AppContext,
      reviewflowPr: { _id: "pr-1", labels } as unknown as ReviewflowPr,
    },
  };
};

const createPullRequest = (
  labels: LabelResponse[],
): PullRequestWithDecentData =>
  ({ number: 1, labels }) as unknown as PullRequestWithDecentData;

describe("syncLabels", () => {
  test("persists the labels returned by github", async () => {
    const { context } = createContext([automergeLabel, needsReviewLabel]);
    const { persist, partialUpdateOne } = createPersist([
      { id: 1, name: "automerge" },
    ]);

    await syncLabels(
      createPullRequest([automergeLabel]),
      context,
      [{ shouldHaveLabel: true, label: needsReviewLabel }],
      persist,
    );

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.any(Object), {
      $set: {
        labels: [
          { id: 1, name: "automerge" },
          { id: 2, name: "code/needs-review" },
        ],
      },
    });
  });

  /*
   * `pullRequest` can be a payload snapshot taken before another action of the same handler
   * changed the labels, writing it back would then lose a label already stored.
   */
  test("does not persist the pull request snapshot when nothing was synced", async () => {
    const { context, addLabels } = createContext([]);
    const { persist, partialUpdateOne } = createPersist([
      { id: 1, name: "automerge" },
    ]);

    await syncLabels(
      createPullRequest([]),
      context,
      [{ shouldHaveLabel: false, label: needsReviewLabel }],
      persist,
    );

    expect(addLabels).not.toHaveBeenCalled();
    expect(partialUpdateOne).not.toHaveBeenCalled();
  });
});
