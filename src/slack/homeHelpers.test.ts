import { describe, expect, it } from "vitest";
import type { ReviewflowPr } from "../mongo";
import {
  type GithubSearchResponse,
  buildBlocksForDataFromGithubAndMongo,
  createBlocksForDataFromMongoPr,
} from "./homeHelpers.ts";

describe("homeHelpers", () => {
  it("createBlocksForDataFromMongoPr returns section and context for a PR with assignee", () => {
    const mockPr: ReviewflowPr = {
      _id: "1",
      account: { id: 1, login: "org", type: "Organization" },
      repo: { id: 1, name: "repo" },
      pr: { number: 1 },
      commentId: 0,
      title: "My PR",
      isDraft: false,
      isClosed: false,
      reviews: {
        approved: [],
        changesRequested: [],
        reviewRequested: [],
        teamReviewRequested: [],
        dismissed: [],
        commented: [],
      },
      assignees: [
        { id: 10, login: "bob", avatar_url: "https://example.com/b.png" },
      ],
      flowDates: {
        createdAt: new Date(),
        openedAt: new Date("2020-01-01T00:00:00Z"),
      },
      creator: {
        id: 11,
        login: "alice",
        avatar_url: "https://example.com/a.png",
      },
      created: new Date("2020-01-01T00:00:00Z"),
      updated: new Date("2020-01-01T00:00:00Z"),
    };

    const blocks = createBlocksForDataFromMongoPr(mockPr, "bob");
    expect(blocks.length).toBeGreaterThanOrEqual(2);
    const section = blocks[0]!;
    if (section.type !== "section") throw new Error("expected section block");

    const context = blocks[1]!;
    if (context.type !== "context") throw new Error("expected context block");

    expect(
      context.elements.some(
        (e: any) =>
          e.type === "image" && e.image_url === "https://example.com/b.png",
      ),
    ).toBe(true);
  });

  it("buildBlocksForDataFromGithubAndMongo uses github items when mongo empty", () => {
    const makeGithubResponse = (items: unknown[]): GithubSearchResponse =>
      ({
        headers: {},
        status: 200,
        url: "https://api.github.com/search/issues",
        data: {
          total_count: items.length,
          incomplete_results: false,
          items,
        },
      }) as unknown as GithubSearchResponse;

    const githubResponse = makeGithubResponse([
      {
        number: 2,
        repository_url: "https://api.github.com/repos/org/repo",
        html_url: "https://github.com/org/repo/pull/2",
        draft: false,
        title: "Other PR",
        user: { login: "carol", avatar_url: "https://example.com/c.png" },
      },
    ]);

    const blocks = buildBlocksForDataFromGithubAndMongo(
      "bob",
      ":eyes:",
      githubResponse,
      [],
    );
    // should include section for the PR and a context block with user
    const hasPrSection = blocks.some(
      (b) =>
        b.type === "section" &&
        b.text?.type === "mrkdwn" &&
        b.text?.text.includes("repo#2"),
    );
    expect(hasPrSection).toBe(true);
    const hasContextWithImage = blocks.some(
      (b) =>
        (b.type === "context" &&
          b.elements?.some(
            (e: any) =>
              e.type === "image" && e.image_url === "https://example.com/c.png",
          )) ??
        false,
    );
    expect(hasContextWithImage).toBe(true);
  });
});
