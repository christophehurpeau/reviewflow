import type { RestEndpointMethodTypes } from '@octokit/rest';
import type { EventsWithRepository } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { PullRequestWithDecentDataFromWebhook } from './PullRequestData';

export const createReviewflowComment = <EventName extends EventsWithRepository>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook['number'],
  context: ProbotEvent<EventName>,
  body: string,
): Promise<
  RestEndpointMethodTypes['issues']['createComment']['response']['data']
> => {
  return context.octokit.issues
    .createComment(context.repo({ issue_number: pullRequestNumber, body }))
    .then(({ data }) => data);
};

export const getReviewflowCommentById = <
  EventName extends EventsWithRepository,
>(
  pullRequestNumber: PullRequestWithDecentDataFromWebhook['number'],
  context: ProbotEvent<EventName>,
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
