import { describe, expect, it } from "vitest";
import type { ReviewflowPr } from "reviewflow-core";
import {
  type GithubSearchResponse,
  buildBlocksForDataFromGithubAndMongo,
  buildBlocksForDataFromMongo,
  createBlocksForDataFromMongoPr,
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

describe("homeHelpers", () => {
  it("createBlocksForDataFromMongoPr returns section and context for a PR with assignee", () => {
    const mockPr = createMockPr();

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
                "text": "by @alice · assigned to _YOU_",
                "type": "mrkdwn",
              },
              {
                "text": "Opened Jan 1, 2020, 12:00 AM",
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
              "text": ":red_circle: <https://github.com/org/repo/pull/1|repo#1> · _Draft_ · <https://www.notion.so/elaxenergie/GEN-1234|GEN-1234> · *<https://github.com/org/repo/pull/1|Fix flaky worker retry loop>*",
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
                "text": "by @alice · assigned to _YOU_",
                "type": "mrkdwn",
              },
              {
                "text": "<https://github.com/org/repo/pull/1/files|5 files changed (+120 -8)> · checks failed: \`ci/build\`, \`lint\` · pr lint failed · changes requested by @erin · approved by @dan · awaiting _YOU_, @carol, #core",
                "type": "mrkdwn",
              },
              {
                "text": "Approved Jan 2, 2020, 9:12 AM",
                "type": "mrkdwn",
              },
            ],
            "type": "context",
          },
        ]
      `);
  });

  it("createBlocksForDataFromMongoPr drops what the section already states", () => {
    const mockPr = createMockPr({
      isDraft: true,
      checksConclusion: {
        "1_ci/build": { name: "ci/build", conclusion: "success" },
      },
    });

    expect(
      createBlocksForDataFromMongoPr(mockPr, "bob", {
        showDraft: false,
        showPassedChecks: false,
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
              "text": "by @alice · assigned to _YOU_",
              "type": "mrkdwn",
            },
            {
              "text": "Opened Jan 1, 2020, 12:00 AM",
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
          "text": "Opened Jan 1, 2020, 12:00 AM",
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
    expect(
      (context.elements[2] as { text: string }).text,
    ).toMatchInlineSnapshot(`"by @alice · assigned to _YOU_"`);
  });

  it("buildBlocksForDataFromMongo wraps rows in a titled section", () => {
    expect(
      buildBlocksForDataFromMongo("bob", ":eyes: Requested reviews", [
        createMockPr(),
      ]),
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
              "text": "by @alice · assigned to _YOU_",
              "type": "mrkdwn",
            },
            {
              "text": "Opened Jan 1, 2020, 12:00 AM",
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
