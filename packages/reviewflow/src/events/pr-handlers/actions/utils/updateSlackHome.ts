import type { AccountEmbedWithoutType } from "reviewflow-core";
import type { RepoContext } from "../../../../context/repoContext";
import type { PullRequestWithDecentData } from "../../utils/PullRequestData";

interface UpdateSlackHomeForPrOptions {
  /** the author and the assignees */
  owners?: boolean;
  requestedReviewers?: boolean;
  requestedTeams?: boolean;
  teamMembers?: AccountEmbedWithoutType[];
  otherLogins?: string[];
}

export function updateSlackHomeForPr(
  repoContext: RepoContext,
  pullRequest: PullRequestWithDecentData,
  {
    owners,
    requestedReviewers,
    requestedTeams,
    teamMembers,
    otherLogins,
  }: UpdateSlackHomeForPrOptions,
): void {
  if (repoContext.slack) {
    const logins = new Set<string>(otherLogins);

    if (owners) {
      if (pullRequest.user) logins.add(pullRequest.user.login);
      pullRequest.assignees?.forEach((assignee) => {
        if (!assignee) return;
        logins.add(assignee.login);
      });
    }

    if (requestedReviewers && pullRequest.requested_reviewers) {
      pullRequest.requested_reviewers.forEach((requestedReviewer) => {
        if (!requestedReviewer) return;
        if (!("login" in requestedReviewer)) return;
        logins.add(requestedReviewer.login);
      });
    }

    if (requestedTeams && pullRequest.requested_teams && teamMembers) {
      teamMembers.forEach((member) => {
        logins.add(member.login);
      });
    }

    logins.forEach((login) => {
      repoContext.slack.updateHome(login);
    });
  }
}
