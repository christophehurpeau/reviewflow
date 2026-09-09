import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSlackHomeWorker } from "./home.ts";

describe("createSlackHomeWorker", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("scheduleUpdateOrg returns early when org lacks Slack config", async () => {
    const mongoStores: any = {
      prs: { findAll: vi.fn() },
      slackTeams: { findByKey: vi.fn() },
      orgMembers: { cursor: vi.fn() },
      orgs: { cursor: vi.fn() },
    };
    const log = { error: vi.fn() } as any;
    const worker = createSlackHomeWorker(mongoStores, log);

    const octokitRest = {} as any;
    // org missing both slackToken and slackTeamId -> should return early
    await expect(
      worker.scheduleUpdateOrg(octokitRest, {
        slackTeamId: undefined,
        slackToken: undefined,
      } as any),
    ).resolves.toBeUndefined();
  });

  it("scheduleUpdateAllOrgs skips orgs without slack or installationId", async () => {
    let called = false;
    const mongoStores: any = {
      orgs: {
        cursor: vi.fn().mockResolvedValue({
          forEach(cb: (org: any) => void) {
            // one org without slackToken and without installationId
            cb({
              slackToken: undefined,
              slackTeamId: undefined,
              installationId: undefined,
              status: "active",
            });
          },
        }),
      },
      prs: { findAll: vi.fn() },
      slackTeams: { findByKey: vi.fn() },
      orgMembers: { cursor: vi.fn() },
    };
    const log = { error: vi.fn() } as any;
    const worker = createSlackHomeWorker(mongoStores, log);

    const auth = () => {
      called = true;
      return {} as any;
    };

    await worker.scheduleUpdateAllOrgs(auth as any);
    expect(called).toBe(false);
  });

  it("scheduleUpdateMember does nothing when member has no slack id", () => {
    const mongoStores: any = {
      prs: { findAll: vi.fn() },
    };
    const log = { error: vi.fn() } as any;
    const worker = createSlackHomeWorker(mongoStores, log);

    const octokitRest = {} as any;
    const member = { slack: undefined } as any;

    // should not throw
    worker.scheduleUpdateMember(octokitRest, {} as any, member);
  });

  it("updateMember publishes a minimal home view when no PRs", async () => {
    const publish = vi.fn().mockResolvedValue({});
    const fakeSlackClient = { views: { publish } } as any;

    const mongoStores: any = {
      prs: { findAll: vi.fn().mockResolvedValue([]) },
      slackTeams: { findByKey: vi.fn() },
      orgMembers: { cursor: vi.fn() },
      orgs: { cursor: vi.fn() },
    };

    const log = { error: vi.fn(), info: vi.fn() } as any;
    const worker = createSlackHomeWorker(mongoStores, log);

    const octokitRest: any = {
      search: {
        issuesAndPullRequests: vi
          .fn()
          .mockResolvedValue({ data: { total_count: 0, items: [] } }),
      },
    };

    const member = {
      slack: { id: "U123" },
      org: { id: "1", login: "org" },
      user: { id: "2", login: "user" },
    } as any;

    await worker.updateMember(octokitRest, fakeSlackClient, member);

    expect(publish).toHaveBeenCalled();
    const arg = (publish as any).mock.calls[0][0];
    const blocks = arg.view.blocks;
    // the settings link, the first header, and the line below
    expect(blocks).toHaveLength(3);
    const lastBlock = blocks.at(-1);
    expect(lastBlock.text).toBeDefined();
    expect(lastBlock.text.type).toBe("mrkdwn");
    expect(lastBlock.text.text).toContain(
      "It looks like you don't have any PR to review!",
    );
  });

  it("updateMember publishes blocks when there are mongo PRs", async () => {
    const publish = vi.fn().mockResolvedValue({});
    const fakeSlackClient = { views: { publish } } as any;

    const mockPr = {
      account: { login: "org" },
      repo: { name: "repo" },
      pr: { number: 1 },
      title: "My PR",
      isDraft: false,
      assignees: [{ login: "bob", avatar_url: "https://example.com/b.png" }],
      creator: { login: "alice", avatar_url: "https://example.com/a.png" },
      flowDates: { openedAt: new Date("2020-01-01T00:00:00Z") },
      changesInformation: { changedFiles: 2, additions: 5, deletions: 1 },
      reviews: {
        reviewRequested: [{ login: "charlie" }, { login: "bob" }],
        teamReviewRequested: [{ name: "team1" }],
        approved: [],
      },
    } as any;

    const mongoStores: any = {
      prs: { findAll: vi.fn().mockResolvedValue([mockPr]) },
      slackTeams: { findByKey: vi.fn() },
      orgMembers: { cursor: vi.fn() },
      orgs: { cursor: vi.fn() },
    };

    const log = { error: vi.fn(), info: vi.fn() } as any;
    const worker = createSlackHomeWorker(mongoStores, log);

    const octokitRest: any = {
      search: {
        issuesAndPullRequests: vi
          .fn()
          .mockResolvedValue({ data: { total_count: 0, items: [] } }),
      },
    };

    const member = {
      slack: { id: "U123" },
      org: { id: "1", login: "org" },
      user: { id: "2", login: "user" },
    } as any;

    await worker.updateMember(octokitRest, fakeSlackClient, member);

    expect(publish).toHaveBeenCalled();
    const arg = (publish as any).mock.calls[0][0];
    const blocks = arg.view.blocks;
    // should include title header and at least one PR section
    expect(
      blocks.some(
        (b: any) =>
          b.type === "header" ||
          (b.type === "section" && b.text?.type === "mrkdwn"),
      ),
    ).toBe(true);

    // find PR section that contains the PR URL
    const prIndex: number = blocks.findIndex(
      (b: any) =>
        b.type === "section" &&
        b.text?.type === "mrkdwn" &&
        b.text.text.includes("/pull/1"),
    );
    expect(prIndex).toBeGreaterThanOrEqual(0);
    const prSection = blocks[prIndex];
    const text = prSection.text.text as string;
    // should contain link to PR (repo#number), title link and the changes
    expect(text).toContain("https://github.com/org/repo/pull/1|repo#1");
    expect(text).toContain("https://github.com/org/repo/pull/1|My PR");
    expect(text).toContain(
      "https://github.com/org/repo/pull/1/files|2 files (+5 −1)",
    );

    // context block following the PR section should include assignee image and login
    const context = blocks[prIndex + 1];
    expect(context).toBeDefined();
    const elements = context.elements || [];
    // image element for assignee
    expect(
      elements.some(
        (e: any) =>
          e.type === "image" && e.image_url === "https://example.com/b.png",
      ),
    ).toBe(true);
    // the owners label names both the author and the assignee it went to
    expect(
      elements.some(
        (e: any) =>
          e.type === "mrkdwn" && e.text === "by @alice · assigned to @bob",
      ),
    ).toBe(true);

    // should include review requested text with both users and team
    expect(
      elements.some(
        (e: any) =>
          e.type === "mrkdwn" &&
          e.text.includes("requested @charlie, @bob, #team1"),
      ),
    ).toBe(true);

    // the same pull request is in every bucket here, and the sections under
    // "Your PRs in progress" ask who it waits on rather than who it requests
    expect(
      blocks.some(
        (b: any) =>
          b.type === "context" &&
          b.elements?.some(
            (e: any) =>
              e.type === "mrkdwn" &&
              e.text?.includes("awaiting @charlie, @bob, #team1"),
          ),
      ),
    ).toBe(true);
  });

  /**
   * github drops a pull request from the review-requested search as soon as the
   * review is submitted, so this section is the only thing keeping a review
   * under way on the home.
   */
  describe("reviews asked of the member again", () => {
    const publishedTitles = async (
      startedPrs: unknown[],
    ): Promise<string[]> => {
      const publish = vi.fn().mockResolvedValue({});

      const mongoStores: any = {
        prs: {
          // the re-requested bucket asks for the id itself, every other
          // bucket either excludes it (`$ne`) or does not mention it
          findAll: vi.fn((criteria: Record<string, unknown>) => {
            const reviewedId = criteria["reviews.reviewed.id"];
            const asksForReviewedBefore =
              reviewedId !== undefined && typeof reviewedId !== "object";
            return Promise.resolve(asksForReviewedBefore ? startedPrs : []);
          }),
        },
        slackTeams: { findByKey: vi.fn() },
        orgMembers: { cursor: vi.fn() },
        orgs: { cursor: vi.fn() },
      };

      const worker = createSlackHomeWorker(mongoStores, {
        error: vi.fn(),
        info: vi.fn(),
      } as any);

      await worker.updateMember(
        {
          search: {
            issuesAndPullRequests: vi
              .fn()
              .mockResolvedValue({ data: { total_count: 0, items: [] } }),
          },
        } as any,
        { views: { publish } } as any,
        {
          slack: { id: "U123" },
          org: { id: "1", login: "org" },
          user: { id: "2", login: "user" },
        } as any,
      );

      return publish.mock.calls[0]![0].view.blocks.filter(
        (block: any) =>
          block.type === "section" && block.text?.type === "mrkdwn",
      ).map((block: any) => block.text.text as string);
    };

    const startedPr = {
      account: { login: "org" },
      repo: { name: "repo" },
      pr: { number: 7 },
      title: "My PR",
      isDraft: false,
      assignees: [],
      reviews: {
        reviewRequested: [{ id: 2, login: "user" }],
        teamReviewRequested: [],
        approved: [],
        reviewed: [{ id: 2, login: "user" }],
      },
    };

    it("titles a section for them", async () => {
      const titles = await publishedTitles([startedPr]);

      expect(titles).toContain("*:eyeglasses: Re-Requested reviews*");
    });

    it("says nothing when none was asked again", async () => {
      const titles = await publishedTitles([]);

      expect(titles).not.toContain("*:eyeglasses: Re-Requested reviews*");
      expect(titles).toContain(
        ":tada: It looks like you don't have any PR to review!",
      );
    });
  });
});
