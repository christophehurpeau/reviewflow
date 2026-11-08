import type { PullRequestReactionContent } from "../api/pullRequest.ts";

/** In the order GitHub's picker offers them. */
export const pullRequestReactionContents: readonly PullRequestReactionContent[] =
  [
    "thumbsUp",
    "thumbsDown",
    "laugh",
    "hooray",
    "confused",
    "heart",
    "rocket",
    "eyes",
  ];

export const isPullRequestReactionContent = (
  value: unknown,
): value is PullRequestReactionContent =>
  pullRequestReactionContents.includes(value as PullRequestReactionContent);
