import { beforeEach, describe, expect, it, vi } from "vitest";
import { updatePrCommentBodyIfNeeded } from "./updatePrCommentBody.ts";

const reviewflowPr = {
  account: { id: 1 },
  repo: { id: 2 },
  pr: { number: 30 },
  commentId: 7,
};

describe("updatePrCommentBodyIfNeeded", () => {
  const partialUpdateMany = vi.fn();
  const updateComment = vi.fn();
  const appContext = { mongoStores: { prs: { partialUpdateMany } } } as any;
  const context = {
    octokit: { rest: { issues: { updateComment } } },
    repo: <T>(params: T) => params,
  } as any;

  const update = (newBody: string) =>
    updatePrCommentBodyIfNeeded({
      appContext,
      context,
      reviewflowPrContext: { reviewflowPr, commentBody: "before" } as any,
      newBody,
    });

  beforeEach(() => {
    partialUpdateMany.mockReset();
    updateComment.mockReset();
  });

  it("dates the rewrite with the time github recorded it", async () => {
    updateComment.mockResolvedValue({
      data: { updated_at: "2026-10-18T10:05:00Z" },
    });

    await update("after");

    expect(updateComment).toHaveBeenCalledWith({
      comment_id: 7,
      body: "after",
    });
    expect(partialUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        "account.id": 1,
        "repo.id": 2,
        "pr.number": 30,
      }),
      {
        $set: {
          "flowDates.lastCommentActivityAt": new Date("2026-10-18T10:05:00Z"),
        },
      },
    );
  });

  it("dates nothing when github refused the rewrite", async () => {
    updateComment.mockRejectedValue(new Error("Not Found"));

    await expect(update("after")).rejects.toThrow("Not Found");
    expect(partialUpdateMany).not.toHaveBeenCalled();
  });

  it("neither rewrites nor dates an unchanged body", async () => {
    await update("before");

    expect(updateComment).not.toHaveBeenCalled();
    expect(partialUpdateMany).not.toHaveBeenCalled();
  });
});
