import type { ProbotEvent } from 'events/probot-types';
import type { EventsWithPullRequest } from './createPullRequestHandler';
import type { PullRequestFromRestEndpoint } from './fetchPr';

export type PullRequestWithDecentDataFromWebhook =
  ProbotEvent<EventsWithPullRequest>['payload']['pull_request'];

export type PullRequestFromWebhook = PullRequestWithDecentDataFromWebhook;
// | EventPayloads.WebhookPayloadCheckRunCheckRunPullRequestsItem;

export type { PullRequestFromRestEndpoint } from './fetchPr';

export type PullRequestData =
  | PullRequestFromRestEndpoint
  | PullRequestFromWebhook;

export interface PullRequestDataMinimumData {
  id: PullRequestData['id'];
  number: PullRequestData['number'];
}

export type PullRequestWithDecentData =
  | PullRequestFromRestEndpoint
  | PullRequestWithDecentDataFromWebhook;

export type PullRequestLabels = PullRequestWithDecentData['labels'];
