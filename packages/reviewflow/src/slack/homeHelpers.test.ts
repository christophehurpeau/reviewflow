import { describe, expect, it, vi } from "vitest";
import type { KnownBlock } from "@slack/web-api";
import type { ReviewflowPr } from "reviewflow-core";
import {
  type GithubSearchResponse,
  allocateRowBudget,
  buildBlocksForDataFromGithubAndMongo,
  buildBlocksForDataFromMongo,
  createBlocksForDataFromMongoPr,
  maxHomeBlocks,
} from "./homeHelpers.ts";

const createMockPr = (overrides: Partial<ReviewflowPr> = {}): ReviewflowPr => ({
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
    createdAt: new Date("2020-01-01T00:00:00Z"),
    openedAt: new Date("2020-01-01T00:00:00Z"),
  },
  creator: {
    id: 11,
    login: "alice",
    avatar_url: "https://example.com/a.png",
  },
  created: new Date("2020-01-01T00:00:00Z"),
  updated: new Date("2020-01-01T00:00:00Z"),
  ...overrides,
});

const createGithubResponse = (items: unknown[]): GithubSearchResponse =>
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

describe("homeHelpers", () => {
  it("createBlocksForDataFromMongoPr returns section and context for a PR with assignee", () => {
    const mockPr = createMockPr();

    const blocks = createBlocksForDataFromMongoPr(mockPr, "bob");
    expect(blocks).toHaveLength(2);
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

  it("createBlocksForDataFromMongoPr renders a plain pr", () => {
    expect(createBlocksForDataFromMongoPr(createMockPr(), "bob"))
      .toMatchInlineSnapshot(`
        [
          {
            "text": {
              "text": "<https://github.com/org/repo/pull/1|repo#1> · *<https://github.com/org/repo/pull/1|My PR>*",
              "type": "mrkdwn",
            },
            "type": "section",
          },
          {
            "elements": [
              {
                "alt_text": "alice",
                "image_url": "https://example.com/a.png",
                "type": "image",
              },
              {
                "alt_text": "bob",
                "image_url": "https://example.com/b.png",
                "type": "image",
              },
              {
                "text": "by @alice · assigned to _you_",
                "type": "mrkdwn",
              },
              {
                "text": "opened Jan 1, 2020, 12:00 AM",
                "type": "mrkdwn",
              },
            ],
            "type": "context",
          },
        ]
      `);
  });

  it("createBlocksForDataFromMongoPr renders every field it knows", () => {
    const mockPr = createMockPr({
      isDraft: true,
      title: "Fix flaky worker retry loop",
      changesInformation: { changedFiles: 5, additions: 120, deletions: 8 },
      checksConclusion: {
        "1_ci/build": { name: "ci/build", conclusion: "failure" },
        "1_ci/test": { name: "ci/test", conclusion: "success" },
      },
      statusesConclusion: {
        lint: { context: "lint", state: "failure" },
      },
      lintStatuses: [
        {
          name: "notion-ticket",
          status: {
            type: "success",
            inBody: true,
            title: "✓ Notion ticket: GEN-1234",
            summary: "[GEN-1234](https://www.notion.so/elaxenergie/GEN-1234)",
            url: "https://www.notion.so/elaxenergie/GEN-1234",
          },
        },
        {
          name: "lint-pr",
          status: { type: "failure", title: "Title is invalid", summary: "" },
        },
      ],
      reviews: {
        approved: [{ id: 12, login: "dan" }],
        changesRequested: [{ id: 13, login: "erin" }],
        reviewRequested: [
          { id: 10, login: "bob" },
          { id: 14, login: "carol" },
        ],
        teamReviewRequested: [{ id: 20, name: "core" }],
        dismissed: [],
        commented: [],
        reviewed: [{ id: 14, login: "carol" }],
      },
      flowDates: {
        createdAt: new Date("2020-01-01T00:00:00Z"),
        openedAt: new Date("2020-01-01T00:00:00Z"),
        approvedAt: new Date("2020-01-02T09:12:00Z"),
      },
    });

    expect(createBlocksForDataFromMongoPr(mockPr, "bob"))
      .toMatchInlineSnapshot(`
        [
          {
            "text": {
              "text": "<https://github.com/org/repo/pull/1|repo#1> · <https://www.notion.so/elaxenergie/GEN-1234|GEN-1234> · *<https://github.com/org/repo/pull/1|Fix flaky worker retry loop>* · <https://github.com/org/repo/pull/1/files|5 files (+120 −8)>",
              "type": "mrkdwn",
            },
            "type": "section",
          },
          {
            "elements": [
              {
                "alt_text": "alice",
                "image_url": "https://example.com/a.png",
                "type": "image",
              },
              {
                "alt_text": "bob",
                "image_url": "https://example.com/b.png",
                "type": "image",
              },
              {
                "text": "by @alice · assigned to _you_",
                "type": "mrkdwn",
              },
              {
                "text": "*checks failed: \`ci/build\`, \`lint\` · pr lint failed* · changes requested by @erin · _draft_ · approved by @dan · awaiting _you_, @carol, #core",
                "type": "mrkdwn",
              },
              {
                "text": "approved Jan 2, 2020, 9:12 AM",
                "type": "mrkdwn",
              },
            ],
            "type": "context",
          },
        ]
      `);
  });

  /**
   * slack cannot act as the reviewer, so the link hands the webapp the pull
   * request id and lets it start the review and forward to github.
   */
  it("createBlocksForDataFromMongoPr links to the webapp to start the review", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example");

    const [section] = createBlocksForDataFromMongoPr(
      createMockPr({ _id: "pr 1/2" }),
      "bob",
      { showStartReview: true },
    );
    if (section?.type !== "section") throw new Error("expected section block");

    expect(section.text?.text).toContain(
      "<https://reviewflow.example/start-review?prId=pr%201%2F2|Start the review>",
    );
  });

  it("createBlocksForDataFromMongoPr keeps the link out by default", () => {
    const [section] = createBlocksForDataFromMongoPr(createMockPr(), "bob");
    if (section?.type !== "section") throw new Error("expected section block");

    expect(section.text?.text).not.toContain("Start the review");
  });

  it("createBlocksForDataFromMongoPr drops what the section already states", () => {
    const mockPr = createMockPr({
      isDraft: true,
      checksConclusion: {
        "1_ci/build": { name: "ci/build", conclusion: "success" },
      },
      reviews: {
        approved: [],
        changesRequested: [],
        reviewRequested: [{ id: 10, login: "bob" }],
        teamReviewRequested: [],
        dismissed: [],
        commented: [],
        reviewed: [{ id: 10, login: "bob" }],
      },
    });

    expect(
      createBlocksForDataFromMongoPr(mockPr, "bob", {
        showDraft: false,
        showPassedChecks: false,
        showReRequests: false,
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "text": {
            "text": "<https://github.com/org/repo/pull/1|repo#1> · *<https://github.com/org/repo/pull/1|My PR>*",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        {
          "elements": [
            {
              "alt_text": "alice",
              "image_url": "https://example.com/a.png",
              "type": "image",
            },
            {
              "alt_text": "bob",
              "image_url": "https://example.com/b.png",
              "type": "image",
            },
            {
              "text": "by @alice · assigned to _you_",
              "type": "mrkdwn",
            },
            {
              "text": "opened Jan 1, 2020, 12:00 AM",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
      ]
    `);
  });

  /** naming the viewer on their own pull request tells them nothing */
  it("createBlocksForDataFromMongoPr hides owners that are only the viewer", () => {
    const mockPr = createMockPr({
      creator: {
        id: 10,
        login: "bob",
        avatar_url: "https://example.com/b.png",
      },
      assignees: [
        { id: 10, login: "bob", avatar_url: "https://example.com/b.png" },
      ],
    });

    const [, context] = createBlocksForDataFromMongoPr(mockPr, "bob");
    if (context?.type !== "context") throw new Error("expected context block");

    expect(context.elements).toMatchInlineSnapshot(`
      [
        {
          "text": "opened Jan 1, 2020, 12:00 AM",
          "type": "mrkdwn",
        },
      ]
    `);
  });

  it("createBlocksForDataFromMongoPr caps the failed check names", () => {
    const mockPr = createMockPr({
      checksConclusion: Object.fromEntries(
        Array.from({ length: 12 }, (_, index) => [
          `1_check-${index}`,
          { name: `check-${index}`, conclusion: "failure" },
        ]),
      ),
    });

    const [, context] = createBlocksForDataFromMongoPr(mockPr, "bob");
    if (context?.type !== "context") throw new Error("expected context block");
    // the two avatars and the owners label come first
    expect(
      (context.elements[3] as { text: string }).text,
    ).toMatchInlineSnapshot(
      `"*checks failed: \`check-0\`, \`check-1\`, \`check-2\`, \`check-3\`, \`check-4\`, \`check-5\`, \`check-6\`, \`check-7\`, \`check-8\` +3*"`,
    );
  });

  it("buildBlocksForDataFromMongo wraps rows in a titled section", () => {
    expect(
      buildBlocksForDataFromMongo({
        userLogin: "bob",
        title: ":eyes: Requested reviews",
        results: [createMockPr()],
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "text": {
            "text": "*:eyes: Requested reviews*",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        {
          "type": "divider",
        },
        {
          "text": {
            "text": "<https://github.com/org/repo/pull/1|repo#1> · *<https://github.com/org/repo/pull/1|My PR>*",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        {
          "elements": [
            {
              "alt_text": "alice",
              "image_url": "https://example.com/a.png",
              "type": "image",
            },
            {
              "alt_text": "bob",
              "image_url": "https://example.com/b.png",
              "type": "image",
            },
            {
              "text": "by @alice · assigned to _you_",
              "type": "mrkdwn",
            },
            {
              "text": "opened Jan 1, 2020, 12:00 AM",
              "type": "mrkdwn",
            },
          ],
          "type": "context",
        },
        {
          "elements": [
            {
              "alt_text": "placeholder",
              "image_url": "https://api.slack.com/img/blocks/bkb_template_images/placeholder.png",
              "type": "image",
            },
          ],
          "type": "context",
        },
      ]
    `);
  });

  it("buildBlocksForDataFromGithubAndMongo uses github items when mongo empty", () => {
    const githubResponse = createGithubResponse([
      {
        number: 2,
        repository_url: "https://api.github.com/repos/org/repo",
        html_url: "https://github.com/org/repo/pull/2",
        draft: false,
        title: "Other PR",
        user: { login: "carol", avatar_url: "https://example.com/c.png" },
      },
    ]);

    const blocks = buildBlocksForDataFromGithubAndMongo({
      userLogin: "bob",
      title: ":eyes:",
      response: githubResponse,
    });
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

  describe("a pull request only github knows about", () => {
    const githubOnlyResponse = createGithubResponse([
      {
        number: 2,
        repository_url: "https://api.github.com/repos/org/repo",
        html_url: "https://github.com/org/repo/pull/2",
        draft: false,
        title: "Other PR",
        user: { login: "carol" },
      },
    ]);

    const hasUntrackedRow = (blocks: KnownBlock[]): boolean =>
      blocks.some(
        (block) =>
          block.type === "section" &&
          block.text?.type === "mrkdwn" &&
          block.text.text.includes("_not tracked by reviewflow_"),
      );

    it("marks the row as untracked", () => {
      const blocks = buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes:",
        response: githubOnlyResponse,
      });

      expect(hasUntrackedRow(blocks)).toBe(true);
    });

    it("reports it to the caller", () => {
      const onUntrackedPr = vi.fn();

      buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes:",
        response: githubOnlyResponse,
        onUntrackedPr,
      });

      expect(onUntrackedPr).toHaveBeenCalledWith({
        repoFullName: "org/repo",
        number: 2,
        url: "https://github.com/org/repo/pull/2",
      });
    });

    it("says nothing when mongo has the pull request", () => {
      const onUntrackedPr = vi.fn();

      const blocks = buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes:",
        response: githubOnlyResponse,
        mongoResults: [createMockPr({ pr: { number: 2 }, title: "Other PR" })],
        onUntrackedPr,
      });

      expect(onUntrackedPr).not.toHaveBeenCalled();
      expect(hasUntrackedRow(blocks)).toBe(false);
    });
  });

  describe("a pull request another section already renders", () => {
    const createItem = (number: number): unknown => ({
      number,
      repository_url: "https://api.github.com/repos/org/repo",
      html_url: `https://github.com/org/repo/pull/${number}`,
      draft: false,
      title: `PR ${number}`,
      user: { login: "carol" },
    });

    const excludedResults = [createMockPr({ _id: "2", pr: { number: 2 } })];

    const sectionTexts = (blocks: KnownBlock[]): string[] =>
      blocks.flatMap((block) =>
        block.type === "section" && block.text?.type === "mrkdwn"
          ? [block.text.text]
          : [],
      );

    it("drops its row instead of reporting it as untracked", () => {
      const onUntrackedPr = vi.fn();

      const texts = sectionTexts(
        buildBlocksForDataFromGithubAndMongo({
          userLogin: "bob",
          title: ":eyes:",
          response: createGithubResponse([createItem(2), createItem(3)]),
          excludedResults,
          onUntrackedPr,
        }),
      );

      expect(texts.some((text) => text.includes("repo#2"))).toBe(false);
      expect(texts.some((text) => text.includes("repo#3"))).toBe(true);
      expect(onUntrackedPr).toHaveBeenCalledTimes(1);
      expect(onUntrackedPr).toHaveBeenCalledWith(
        expect.objectContaining({ number: 3 }),
      );
    });

    it("does not count it in the rows left over", () => {
      const blocks = buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes:",
        response: createGithubResponse([createItem(2), createItem(3)]),
        excludedResults,
      });

      expect(
        blocks.some(
          (block) =>
            block.type === "context" &&
            block.elements.some(
              (element: any) =>
                element.type === "mrkdwn" && element.text.includes("more"),
            ),
        ),
      ).toBe(false);
    });

    it("renders no section when it is the only result", () => {
      expect(
        buildBlocksForDataFromGithubAndMongo({
          userLogin: "bob",
          title: ":eyes:",
          response: createGithubResponse([createItem(2)]),
          excludedResults,
        }),
      ).toEqual([]);
    });
  });

  it("buildBlocksForDataFromGithubAndMongo reports a github outage", () => {
    expect(
      buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes: Requested reviews",
        response: undefined,
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "text": {
            "text": "*:eyes: Requested reviews*",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        {
          "type": "divider",
        },
        {
          "text": {
            "text": "No response from GitHub",
            "type": "plain_text",
          },
          "type": "section",
        },
      ]
    `);
  });

  it("buildBlocksForDataFromGithubAndMongo reports a github error shape", () => {
    expect(
      buildBlocksForDataFromGithubAndMongo({
        userLogin: "bob",
        title: ":eyes: Requested reviews",
        response: { error: "boom" } as unknown as GithubSearchResponse,
      }),
    ).toMatchInlineSnapshot(`
      [
        {
          "text": {
            "text": "*:eyes: Requested reviews*",
            "type": "mrkdwn",
          },
          "type": "section",
        },
        {
          "type": "divider",
        },
        {
          "text": {
            "text": "Error from GitHub",
            "type": "plain_text",
          },
          "type": "section",
        },
      ]
    `);
  });

  /** the rows the budget cut still have to be reachable from the home */
  it("buildBlocksForDataFromMongo links to the webapp for the rows it drops", () => {
    vi.stubEnv("REVIEWFLOW_APP_URL", "https://reviewflow.example");

    const blocks = buildBlocksForDataFromMongo({
      userLogin: "bob",
      title: ":eyes: Requested reviews",
      results: [createMockPr(), createMockPr(), createMockPr()],
      limit: 1,
    });

    // the last block is the spacer closing the section
    expect(blocks.at(-2)).toMatchInlineSnapshot(`
      {
        "elements": [
          {
            "text": "<https://reviewflow.example/prs|+2 more>",
            "type": "mrkdwn",
          },
        ],
        "type": "context",
      }
    `);
  });

  it("buildBlocksForDataFromMongo says nothing more when every row fits", () => {
    const blocks = buildBlocksForDataFromMongo({
      userLogin: "bob",
      title: ":eyes: Requested reviews",
      results: [createMockPr()],
      limit: 1,
    });

    expect(JSON.stringify(blocks)).not.toContain("more");
  });

  describe("allocateRowBudget", () => {
    /** title, divider, trailing spacer, and the `+X more` truncation may need */
    const blocksPerSection = 4;
    const blocksPerRow = 2;

    const blocksSpent = (counts: number[], allocated: number[]): number => {
      let total = 0;
      for (const [index, count] of counts.entries()) {
        if (count === 0) continue;
        total += blocksPerSection + blocksPerRow * allocated[index]!;
      }
      return total;
    };

    it("gives every section all of its rows when they fit", () => {
      const counts = [2, 3, 1];

      expect(allocateRowBudget(counts, maxHomeBlocks)).toEqual(counts);
    });

    it("ignores the sections that hold nothing", () => {
      expect(allocateRowBudget([0, 2, 0], maxHomeBlocks)).toEqual([0, 2, 0]);
    });

    it("stays under the budget it is given", () => {
      const counts = [40, 40, 40, 40, 40, 40, 40];
      const allocated = allocateRowBudget(counts, maxHomeBlocks - 3);

      expect(blocksSpent(counts, allocated)).toBeLessThanOrEqual(
        maxHomeBlocks - 3,
      );
    });

    /**
     * The home ranks its sections, so a bucket that alone exceeds the budget
     * must not push the ones after it off the view entirely.
     */
    it("serves the later sections before filling the first one", () => {
      const allocated = allocateRowBudget([40, 2, 2], 40);

      expect(allocated).toEqual([10, 2, 2]);
    });

    it("leaves nothing to a budget too small for any row", () => {
      expect(allocateRowBudget([5, 5], 6)).toEqual([0, 0]);
    });
  });
});
