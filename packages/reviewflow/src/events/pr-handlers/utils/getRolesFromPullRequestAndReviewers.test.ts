import { describe, expect, it } from "vitest";
import type { PullRequestWithDecentDataFromWebhook } from "./PullRequestData";
import { getRolesFromPullRequestAndReviewers } from "./getRolesFromPullRequestAndReviewers.ts";

const author = { id: 1, login: "author", type: "User" } as const;
const colleague = { id: 2, login: "colleague", type: "User" } as const;
const reviewer = { id: 3, login: "reviewer", type: "User" } as const;
const renovate = { id: 4, login: "renovate[bot]", type: "Bot" } as const;

const buildPr = (
  user: { id: number; login: string; type: string },
  assignees: { id: number; login: string; type: string }[],
): PullRequestWithDecentDataFromWebhook =>
  ({
    user,
    assignees,
    requested_reviewers: [],
  }) as unknown as PullRequestWithDecentDataFromWebhook;

describe("getRolesFromPullRequestAndReviewers", () => {
  it("notifies the author as owner when they are not assigned", () => {
    const roles = getRolesFromPullRequestAndReviewers(buildPr(author, []), []);

    expect(roles.ownerToNotify).toEqual(author);
    expect(roles.assigneesNotOwner).toEqual([]);
  });

  it("keeps notifying the author when someone else is assigned", () => {
    const roles = getRolesFromPullRequestAndReviewers(
      buildPr(author, [colleague]),
      [],
    );

    expect(roles.ownerToNotify).toEqual(author);
    expect(roles.assigneesNotOwner).toEqual([colleague]);
  });

  it("does not notify the author twice when they are assigned", () => {
    const roles = getRolesFromPullRequestAndReviewers(
      buildPr(author, [author, colleague]),
      [],
    );

    expect(roles.ownerToNotify).toEqual(author);
    expect(roles.assigneesNotOwner).toEqual([colleague]);
  });

  it("does not notify the author of their own action", () => {
    const roles = getRolesFromPullRequestAndReviewers(
      buildPr(author, [author, colleague]),
      [],
      { excludeIds: [author.id] },
    );

    expect(roles.ownerToNotify).toBeUndefined();
    expect(roles.assigneesNotOwner).toEqual([colleague]);
  });

  it("leaves out an excluded assignee", () => {
    const roles = getRolesFromPullRequestAndReviewers(
      buildPr(author, [colleague]),
      [],
      { excludeIds: [colleague.id] },
    );

    expect(roles.assigneesNotOwner).toEqual([]);
  });

  /** replying in a review thread lists the author among the reviewers */
  it("leaves the author out of the followers", () => {
    const roles = getRolesFromPullRequestAndReviewers(buildPr(author, []), [
      author,
      reviewer,
    ]);

    expect(roles.followers).toEqual([reviewer]);
  });

  it("notifies the assignee of a pull request opened by a bot", () => {
    const roles = getRolesFromPullRequestAndReviewers(
      buildPr(renovate, [colleague]),
      [],
    );

    expect(roles.assigneesNotOwner).toEqual([colleague]);
  });
});
