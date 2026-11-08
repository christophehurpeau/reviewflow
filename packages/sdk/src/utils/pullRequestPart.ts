import type { PullRequestPart } from "../api/pullRequest.ts";

export const pullRequestParts: readonly PullRequestPart[] = [
  "detail",
  "checks",
  "timeline",
  "commits",
  "files",
];

export const isPullRequestPart = (value: unknown): value is PullRequestPart =>
  pullRequestParts.includes(value as PullRequestPart);
