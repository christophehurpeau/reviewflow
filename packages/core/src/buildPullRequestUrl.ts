import type { ReviewflowPr } from "./mongo.ts";

export const buildPullRequestUrl = (
  reviewflowPullRequest: ReviewflowPr,
): string =>
  `https://github.com/${reviewflowPullRequest.account.login}/${reviewflowPullRequest.repo.name}/pull/${reviewflowPullRequest.pr.number}`;
