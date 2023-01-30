import type { LabelResponse } from 'context/initRepoLabels';
import type { CustomExtract, EventsWithRepository } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { EventsWithPullRequest } from './createPullRequestHandler';
import type { PullRequestFromRestEndpoint } from './fetchPr';

export type PullRequestWithDecentDataFromWebhook =
  ProbotEvent<EventsWithPullRequest>['payload']['pull_request'];

export type PullRequestFromWebhook =
  | PullRequestWithDecentDataFromWebhook
  | ProbotEvent<
      CustomExtract<EventsWithRepository, 'check_run.completed'>
    >['payload']['check_run']['pull_requests'][number]
  | ProbotEvent<
      CustomExtract<EventsWithRepository, 'check_suite.completed'>
    >['payload']['check_suite']['pull_requests'][number];

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

export type PullRequestLabels =
  | PullRequestWithDecentData['labels']
  | LabelResponse[];
