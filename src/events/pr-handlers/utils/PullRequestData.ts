import type { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods';
import type { EventPayloads } from '@octokit/webhooks';

export type PullRequestWithDecentDataFromWebhook =
  | EventPayloads.WebhookPayloadPullRequest['pull_request']
  | EventPayloads.WebhookPayloadPullRequestReviewPullRequest;

export type PullRequestLabels = EventPayloads.WebhookPayloadPullRequest['pull_request']['labels'];

export type PullRequestFromWebhook =
  | PullRequestWithDecentDataFromWebhook
  | EventPayloads.WebhookPayloadCheckRunCheckRunPullRequestsItem;

export type PullRequestFromRestEndpoint = RestEndpointMethodTypes['pulls']['get']['response']['data'];

export type PullRequestData =
  | PullRequestFromRestEndpoint
  | PullRequestFromWebhook;

export type PullRequestWithDecentData =
  | PullRequestFromRestEndpoint
  | PullRequestWithDecentDataFromWebhook;
