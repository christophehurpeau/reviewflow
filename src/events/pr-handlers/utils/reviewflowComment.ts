import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { Context } from 'probot';
import type { PullRequestWithDecentDataFromWebhook } from './PullRequestData';

export const createReviewflowComment = <T>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook['number'],
  context: Context<T>,
  body: string,
): Promise<
  RestEndpointMethodTypes['issues']['createComment']['response']['data']
> => {
  return context.octokit.issues
    .createComment(context.repo({ issue_number: pullRequestNumber, body }))
    .then(({ data }) => data);
};

export const getReviewflowCommentById = <T>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook['number'],
  context: Context<T>,
  commentId: number,
): Promise<
  RestEndpointMethodTypes['issues']['getComment']['response']['data'] | null
> => {
  return context.octokit.issues
    .getComment(
      context.repo({
        issue_number: pullRequestNumber,
        comment_id: commentId,
      }),
    )
    .then(
      ({ data }) => data,
      () => null,
    );
};
