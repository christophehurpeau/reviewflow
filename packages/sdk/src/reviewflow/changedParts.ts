import type { PullRequestPart } from "../api/pullRequest.ts";
import { pullRequestParts } from "../utils/pullRequestPart.ts";
import type { ReviewflowPrDetail } from "./client.ts";

/**
 * What each part of the pull request screen shows, as far as reviewflow knows
 * it. Two reads of a part are the same while its fingerprint is: a push moves
 * every part (each names the head), the checks move the checks and only their
 * conclusion moves the header's merge state, a comment moves the timeline
 * alone, an edited description the header alone. The last open conversation
 * being resolved, or a first one opened, moves the merge state too: a branch
 * protection may require every conversation resolved, while a count going
 * from 2 to 1 changes nothing there and stays the timeline's.
 *
 * What reviewflow does not carry is in no fingerprint and moves nothing: a
 * reaction, the viewed marks, the base branch moving under an unchanged pull
 * request ("behind"), the viewer's rights. A read the app makes after some time,
 * or an explicit refresh, reads those.
 */
const partFields: Record<PullRequestPart, (pr: ReviewflowPrDetail) => unknown> =
  {
    detail: (pr) => [
      pr.title,
      pr.headRef,
      pr.baseRef,
      pr.headSha,
      pr.baseSha,
      pr.state,
      pr.reviewState,
      pr.author,
      pr.checks.conclusion,
      pr.approvedBy,
      pr.changesRequestedBy,
      pr.requestedReviewers,
      pr.reRequestedReviewers,
      pr.requestedTeams,
      pr.assignees,
      pr.labels,
      pr.mergeable,
      pr.unresolvedThreads === 0,
      pr.reviewActivityAt,
      pr.bodyEditedAt,
      pr.closedAt,
    ],
    checks: (pr) => [pr.headSha, pr.checks],
    timeline: (pr) => [
      pr.headSha,
      pr.baseSha,
      pr.baseRef,
      pr.title,
      pr.state,
      pr.labels,
      pr.assignees,
      pr.requestedReviewers,
      pr.reRequestedReviewers,
      pr.requestedTeams,
      pr.approvedBy,
      pr.changesRequestedBy,
      pr.reviewActivityAt,
      pr.commentActivityAt,
      pr.reviewCommentActivityAt,
      pr.unresolvedThreads,
    ],
    commits: (pr) => [pr.headSha, pr.baseSha],
    files: (pr) => [pr.headSha, pr.baseSha],
  };

export const partFingerprint = (
  pr: ReviewflowPrDetail,
  part: PullRequestPart,
): string => JSON.stringify(partFields[part](pr));

/** The parts of the pull request screen a reviewflow change makes stale. */
export const changedPullRequestParts = (
  previous: ReviewflowPrDetail,
  next: ReviewflowPrDetail,
): PullRequestPart[] =>
  pullRequestParts.filter(
    (part) => partFingerprint(previous, part) !== partFingerprint(next, part),
  );
