import { Context, Octokit } from 'probot';
import { RepoContext } from '../../../context/repoContext';
import { contextPr, getKeys } from '../../../context/utils';

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

export const getReviewersAndReviewStates = async <
  GroupNames extends string = any
>(
  context: Context,
  repoContext: RepoContext<GroupNames>,
): Promise<{
  reviewers: Reviewer[];
  reviewStates: Record<GroupNames, ReviewStates>;
}> => {
  const userIds = new Set<number>();
  const reviewers: Reviewer[] = [];
  const reviewStatesByUser = new Map<number, ReviewState>();

  await context.github.paginate(
    context.github.pulls.listReviews.endpoint.merge(contextPr(context)),
    ({ data: reviews }: Octokit.Response<Octokit.PullsListReviewsResponse>) => {
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
