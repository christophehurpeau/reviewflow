import type { MessageCategory } from "reviewflow-modules";

export const dmMessageLabels: Record<MessageCategory, string> = {
  "pr-checksAndStatuses": "Your PR has failed checks or statuses",
  "pr-lifecycle": "Your PR is closed, merged, reopened",
  "pr-lifecycle-follow":
    "Someone closed, merged, reopened a PR you're reviewing",
  "pr-review": "You are assigned to a review, someone reviewed your PR",
  "pr-review-follow": "Someone reviewed a PR you're also reviewing",
  "pr-comment": "Someone commented on your PR",
  "pr-comment-bots": "A bot commented on your PR",
  "pr-comment-follow": "Someone commented on a PR you're reviewing",
  "pr-comment-follow-bots": "A bot commented on a PR you're reviewing",
  "pr-comment-mention": "Someone mentioned you in a PR",
  "pr-comment-thread": "Someone replied to a discussion you're in",
  "pr-merge-conflicts": "Your PR has a merge conflict (not implemented)",
  "commit-comment": "Someone commented on your commit",
  "commit-comment-bots": "A bot commented on your commit",
  "commit-comment-follow": "Someone commented on a commit you also commented",
  "commit-comment-follow-bots":
    "A bot commented on a commit you also commented",
  "commit-comment-mention": "Someone mentioned you in a commit comment",
  "issue-comment-mention":
    "Someone mentioned you in an issue (not implemented)",
};

export const dmMessageCategories = Object.keys(
  dmMessageLabels,
) as MessageCategory[];
