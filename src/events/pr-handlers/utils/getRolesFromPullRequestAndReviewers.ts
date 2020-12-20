import type { AccountInfo } from 'context/getOrCreateAccount';
import type { PullRequestWithDecentDataFromWebhook } from './PullRequestData';
import type { Reviewer } from './getReviewersAndReviewStates';

export interface RequestedReviewers extends AccountInfo {
  isRequestedByName: boolean;
  requestedByTeams: string[];
}

export function getRolesFromPullRequestAndReviewers(
  pullRequest: PullRequestWithDecentDataFromWebhook,
  reviewers: Reviewer[],
): {
  owner: PullRequestWithDecentDataFromWebhook['user'];
  assignees: PullRequestWithDecentDataFromWebhook['assignees'];
  reviewers: Reviewer[];
  requestedReviewers: RequestedReviewers[];
  followers: AccountInfo[];
} {
  const owner = pullRequest.user;
  const assignees = pullRequest.assignees;
  const assigneeIds = assignees.map((a) => a.id);

  const followers = reviewers.filter((user) => !assigneeIds.includes(user.id));
  const requestedReviewers: RequestedReviewers[] = pullRequest.requested_reviewers.map(
    (rr) => ({
      ...rr,
      isRequestedByName: true,
      requestedByTeams: [],
    }),
  );

  if (pullRequest.requested_teams) {
    // TODO
    // requestedReviewers.push ...
  }

  if (requestedReviewers) {
    followers.push(
      ...requestedReviewers.filter((rr) => {
        return (
          !followers.find((f) => f.id === rr.id) && !assigneeIds.includes(rr.id)
        );
      }),
    );
  }

  return {
    owner,
    assignees,
    reviewers,
    requestedReviewers,
    followers,
  };
}
