import type { RepoContext } from 'src/context/repoContext';
import type { AccountEmbedWithoutType } from '../../../../mongo';
import type { PullRequestWithDecentData } from '../../utils/PullRequestData';

interface UpdateSlackHomeForPrOptions {
  user?: boolean;
  assignees?: boolean;
  requestedReviewers?: boolean;
  requestedTeams?: boolean;
  teamMembers?: AccountEmbedWithoutType[];
  otherLogins?: string[];
}

export function updateSlackHomeForPr(
  repoContext: RepoContext,
  pullRequest: PullRequestWithDecentData,
  {
    user,
    assignees,
    requestedReviewers,
    requestedTeams,
    teamMembers,
    otherLogins,
  }: UpdateSlackHomeForPrOptions,
): void {
  if (repoContext.slack) {
    const logins = new Set<string>(otherLogins);

    if (user && pullRequest.user) {
      logins.add(pullRequest.user.login);
    }
    if (assignees && pullRequest.assignees) {
      pullRequest.assignees.forEach((assignee) => {
        logins.add(assignee.login);
      });
    }

    if (requestedReviewers && pullRequest.requested_reviewers) {
      pullRequest.requested_reviewers.forEach((requestedReviewer) => {
        if (!('login' in requestedReviewer)) return;
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
