import { beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { postJson } from "./api.ts";
import { createBoardDataSource } from "./boardDataSource.tsx";
import { startedReviewsQueryKey } from "./reviewflowApi.ts";

vi.mock("./api.ts", () => ({
  getJson: vi.fn(),
  postJson: vi.fn(),
  requestJson: vi.fn(),
}));

// its entry point reaches react-native, which node cannot parse
vi.mock("@reviewflow/ui", () => ({ errorToMessage: String }));

const ref = { ownerRepo: "acme/api", number: 12 };

describe("startReview", () => {
  beforeEach(() => {
    vi.mocked(postJson).mockReset();
  });

  it("remembers the review once GitHub took it", async () => {
    vi.mocked(postJson).mockResolvedValue({
      edited: "startReview",
      followUpError: null,
    });
    const client = new QueryClient();

    await createBoardDataSource(client).startReview(ref);

    expect(postJson).toHaveBeenCalledWith("/api/prs/edit", {
      ...ref,
      edit: { kind: "startReview" },
    });
    expect(client.getQueryData(startedReviewsQueryKey)).toEqual([ref]);
  });

  it("leaves the button when GitHub refuses, for another try", async () => {
    vi.mocked(postJson).mockRejectedValue(new Error("refused"));
    const client = new QueryClient();

    await expect(
      createBoardDataSource(client).startReview(ref),
    ).rejects.toThrow("refused");

    expect(client.getQueryData(startedReviewsQueryKey)).toBeUndefined();
  });
});
