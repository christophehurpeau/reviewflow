import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePrIfNeeded } from "./updatePr.ts";

const reviewflowPr = {
  account: { id: 1 },
  repo: { id: 2 },
  pr: { number: 30 },
} as any;

describe("updatePrIfNeeded", () => {
  const partialUpdateMany = vi.fn();
  const pullsUpdate = vi.fn();
  const appContext = { mongoStores: { prs: { partialUpdateMany } } } as any;
  const context = {
    octokit: { rest: { pulls: { update: pullsUpdate } } },
    repo: <T>(params: T) => params,
  } as any;

  const update = (changes: { title?: string; body?: string }) =>
    updatePrIfNeeded({
      appContext,
      pullRequest: { number: 30, title: "feat: a", body: "body" } as any,
      context,
      reviewflowPr,
      update: changes,
    });

  beforeEach(() => {
    partialUpdateMany.mockReset();
    pullsUpdate.mockReset();
    pullsUpdate.mockResolvedValue({
      data: { updated_at: "2026-10-18T10:05:00Z" },
    });
  });

  it("dates a body rewrite with the time github recorded it", async () => {
    await update({ body: "new body" });

    expect(pullsUpdate).toHaveBeenCalledWith({
      pull_number: 30,
      body: "new body",
    });
    expect(partialUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ "pr.number": 30 }),
      {
        $set: {
          "flowDates.lastBodyEditedAt": new Date("2026-10-18T10:05:00Z"),
        },
      },
    );
  });

  it("does not date a title-only rewrite", async () => {
    await update({ title: "feat: b", body: "body" });

    expect(pullsUpdate).toHaveBeenCalledWith({
      pull_number: 30,
      title: "feat: b",
    });
    expect(partialUpdateMany).not.toHaveBeenCalled();
  });

  it("dates nothing when github refused the rewrite", async () => {
    pullsUpdate.mockRejectedValue(new Error("Forbidden"));

    await expect(update({ body: "new body" })).rejects.toThrow("Forbidden");
    expect(partialUpdateMany).not.toHaveBeenCalled();
  });
});
