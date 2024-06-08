import type { AccountInfo } from "../../../context/getOrCreateAccount";
import type {
  PullRequestWithDecentData,
  PullRequestWithDecentDataFromWebhook,
} from "./PullRequestData";
import type { Reviewer } from "./getReviewersAndReviewStates";

export interface RequestedReviewers extends AccountInfo {
  isRequestedByName: boolean;
  requestedByTeams: string[];
}

interface GetRolesFromPullRequestAndReviewersOptions {
  excludeIds?: number[];
}

interface PullRequestOwners {
  owner: PullRequestWithDecentDataFromWebhook["user"];
  assigneesNotOwner: PullRequestWithDecentDataFromWebhook["assignees"];
}

export function getOwnersFromPullRequest(
  pullRequest: PullRequestWithDecentData,
): PullRequestOwners {
  const pr = pullRequest as PullRequestWithDecentDataFromWebhook; // fix typings
  return {
    owner: pr.user,
    assigneesNotOwner: pr.assignees
      ? pr.assignees.filter((u) => u.id !== pr.user.id)
      : [],
  } satisfies PullRequestOwners;
}

export function getRolesFromPullRequestAndReviewers(
  pullRequest: PullRequestWithDecentDataFromWebhook,
  reviewers: Reviewer[],
  { excludeIds = [] }: GetRolesFromPullRequestAndReviewersOptions = {},
): {
  owner: PullRequestWithDecentDataFromWebhook["user"];
  assigneesNotOwner: PullRequestWithDecentDataFromWebhook["assignees"];
  assignees: PullRequestWithDecentDataFromWebhook["assignees"];
  reviewers: Reviewer[];
  requestedReviewers: RequestedReviewers[];
  followers: AccountInfo[];
} {
  const assignees = pullRequest.assignees.filter(
    (a) => !excludeIds.includes(a.id),
  );

  const assigneeIds = assignees.map((a) => a.id);

  const followers = reviewers.filter(
    (user) => !assigneeIds.includes(user.id) && !excludeIds.includes(user.id),
  );
  const requestedReviewers: RequestedReviewers[] = (
    pullRequest.requested_reviewers || []
  )
    .filter((rr) => !excludeIds.includes(rr.id))
    .map((rr) => ({
      id: rr.id,
      login: (rr as any).login,
      type: (rr as any).type,
      isRequestedByName: true,
      requestedByTeams: [],
    }));

  if (pullRequest.requested_teams) {
    // TODO
    // requestedReviewers.push ...
    // And figure a way to keep `silentTeams` working
  }

  if (requestedReviewers) {
    followers.push(
      ...requestedReviewers.filter((rr) => {
        return (
          !followers.some((f) => f.id === rr.id) && !assigneeIds.includes(rr.id)
        );
      }),
    );
  }

  return {
    ...getOwnersFromPullRequest(pullRequest),
    assignees,
    reviewers,
    requestedReviewers,
    followers,
  };
}
