import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Context } from 'probot';
import type { RepoContext } from '../../../context/repoContext';
import { getKeys } from '../../../context/utils';

type ReviewState = 'CHANGES_REQUESTED' | 'APPROVED' | 'DISMISSED';

interface ReviewStates {
  approved: number;
  changesRequested: number;
  dismissed: number;
}
interface Reviewer {
  id: number;
  login: string;
}

export const getReviewersAndReviewStates = async <GroupNames extends string>(
  context: Context,
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
    context.pullRequest(),
    ({
      data: reviews,
    }: RestEndpointMethodTypes['pulls']['listReviews']['response']) => {
      reviews.forEach((review) => {
        if (!userIds.has(review.user.id)) {
          userIds.add(review.user.id);
          reviewers.push({ id: review.user.id, login: review.user.login });
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
      }
    }
  });

  return { reviewers, reviewStates };
};
