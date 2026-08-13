import { describe, expect, test, vi } from "vitest";
import type { AppContext } from "../../../../../context/AppContext.ts";
import type { LabelResponse } from "../../../../../context/initRepoLabels.ts";
import type { ReviewflowPr } from "../../../../../mongo.ts";
import {
  toLabelEmbeds,
  updateReviewflowPrLabels,
} from "./reviewflowPrLabels.ts";

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

const createAppContext = () => {
  const partialUpdateOne = vi.fn(() => Promise.resolve());
  return {
    partialUpdateOne,
    appContext: {
      mongoStores: { prs: { partialUpdateOne } },
    } as unknown as AppContext,
  };
};

const createReviewflowPr = (labels?: ReviewflowPr["labels"]): ReviewflowPr =>
  ({ _id: "pr-1", pr: { number: 1 }, labels }) as unknown as ReviewflowPr;

describe("toLabelEmbeds", () => {
  test("keeps only the id and the name", () => {
    expect(toLabelEmbeds([automergeLabel])).toEqual([
      { id: 1, name: "automerge" },
    ]);
  });
});

describe("updateReviewflowPrLabels", () => {
  test("writes the labels never observed before", async () => {
    const { appContext, partialUpdateOne } = createAppContext();
    const reviewflowPr = createReviewflowPr();

    await updateReviewflowPrLabels({
      appContext,
      reviewflowPr,
      labels: [automergeLabel],
    });

    expect(partialUpdateOne).toHaveBeenCalledWith(reviewflowPr, {
      $set: { labels: [{ id: 1, name: "automerge" }] },
    });
    expect(reviewflowPr.labels).toEqual([{ id: 1, name: "automerge" }]);
  });

  test("writes an empty array for a pull request without label", async () => {
    const { appContext, partialUpdateOne } = createAppContext();

    await updateReviewflowPrLabels({
      appContext,
      reviewflowPr: createReviewflowPr(),
      labels: [],
    });

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.any(Object), {
      $set: { labels: [] },
    });
  });

  test("does not write when the same labels are already stored", async () => {
    const { appContext, partialUpdateOne } = createAppContext();

    await updateReviewflowPrLabels({
      appContext,
      reviewflowPr: createReviewflowPr([{ id: 1, name: "automerge" }]),
      labels: [automergeLabel],
    });

    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  test("does not write when the order changed", async () => {
    const { appContext, partialUpdateOne } = createAppContext();

    await updateReviewflowPrLabels({
      appContext,
      reviewflowPr: createReviewflowPr([
        { id: 2, name: "code/needs-review" },
        { id: 1, name: "automerge" },
      ]),
      labels: [automergeLabel, needsReviewLabel],
    });

    expect(partialUpdateOne).not.toHaveBeenCalled();
  });

  test("writes when a label was removed", async () => {
    const { appContext, partialUpdateOne } = createAppContext();

    await updateReviewflowPrLabels({
      appContext,
      reviewflowPr: createReviewflowPr([
        { id: 1, name: "automerge" },
        { id: 2, name: "code/needs-review" },
      ]),
      labels: [automergeLabel],
    });

    expect(partialUpdateOne).toHaveBeenCalledWith(expect.any(Object), {
      $set: { labels: [{ id: 1, name: "automerge" }] },
    });
  });
});
