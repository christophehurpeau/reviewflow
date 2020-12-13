import type { EventPayloads } from '@octokit/webhooks';

type WebhookPr =
  | EventPayloads.WebhookPayloadPullRequest['pull_request']
  | EventPayloads.WebhookPayloadPullRequestReviewPullRequest;

type PullRequestHandlerAllowedPayloads =
  | {
      repository: EventPayloads.PayloadRepository;
      pull_request: WebhookPr;
    }
  | {
      repository: EventPayloads.PayloadRepository;
      issue: EventPayloads.WebhookPayloadIssueCommentIssue;
    };

export type PullRequestFromPayload<
  T extends PullRequestHandlerAllowedPayloads
> = T extends { pull_request: WebhookPr }
  ? T['pull_request']
  : T extends { issue: EventPayloads.WebhookPayloadIssueCommentIssue }
  ? T['issue'] /* & T['issue']['pull_request'] */
  : never;

/** deprecated */
export const getPullRequestFromPayload = <
  T extends PullRequestHandlerAllowedPayloads
>(
  payload: T,
): PullRequestFromPayload<T> => {
  const pullRequest: WebhookPr = (payload as any).pull_request;
  if (pullRequest) {
    return pullRequest as PullRequestFromPayload<T>;
  }

  const issue = (payload as any).issue;
  if (issue?.pull_request) {
    return {
      ...issue,
      ...issue.pull_request,
    };
  }

  throw new Error('No pull_request in payload');
};
