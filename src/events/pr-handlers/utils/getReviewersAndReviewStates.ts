import type { EmitterWebhookEventName } from '@octokit/webhooks';
import type { AccountInfo } from 'context/getOrCreateAccount';
import type { ProbotEvent } from 'events/probot-types';
import type { RepoContext } from '../../../context/repoContext';
import { getKeys } from '../../../context/utils';

type ReviewState = 'APPROVED' | 'CHANGES_REQUESTED' | 'DISMISSED';

interface ReviewStates {
  approved: number;
  changesRequested: number;
  dismissed: number;
}

export type Reviewer = AccountInfo;

export const getReviewersAndReviewStates = async <
  EventName extends EmitterWebhookEventName,
  GroupNames extends string,
>(
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<GroupNames>,
): Promise<{
  reviewers: Reviewer[];
  reviewStates: Record<GroupNames, ReviewStates>;
}> => {
  const userIds = new Set<number>();
  const reviewers: Reviewer[] = [];
  const reviewStatesByUser = new Map<number, ReviewState>();

  await context.octokit.paginate(
    context.octokit.pulls.listReviews,
    context.pullRequest({ page: undefined }),
    ({ data: reviews }) => {
      reviews.forEach((review) => {
        if (!review.user) return;
        if (!userIds.has(review.user.id)) {
          userIds.add(review.user.id);
          reviewers.push({
            id: review.user.id,
            login: review.user.login,
            type: review.user.type,
          });
        }
        const state = review.state.toUpperCase();
        if (state !== 'COMMENTED') {
          reviewStatesByUser.set(review.user.id, state as ReviewState);
        }
      });

      return [];
    },
  );

  const reviewStates: Record<GroupNames, ReviewStates> = {} as Record<
    GroupNames,
    ReviewStates
  >;

  getKeys(repoContext.config.groups).forEach((groupName) => {
    reviewStates[groupName] = {
      approved: 0,
      changesRequested: 0,
      dismissed: 0,
    };
  });

  reviewers.forEach((reviewer) => {
    const group = repoContext.getReviewerGroup(reviewer.login);
    if (group) {
      const state = reviewStatesByUser.get(reviewer.id);
      switch (state) {
        case 'APPROVED':
          reviewStates[group].approved++;
          break;
        case 'CHANGES_REQUESTED':
          reviewStates[group].changesRequested++;
          break;
        case 'DISMISSED':
          reviewStates[group].dismissed++;
          break;
        case undefined:
          break;
      }
    }
  });

  return { reviewers, reviewStates };
};
