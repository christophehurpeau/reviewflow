import { Octokit } from 'probot';
import Webhooks from '@octokit/webhooks';

export type PullRequestWithDecentDataFromWebhook =
  | Webhooks.WebhookPayloadPullRequest['pull_request']
  | Webhooks.WebhookPayloadPullRequestReviewPullRequest;

export type PullRequestFromWebhook =
  | PullRequestWithDecentDataFromWebhook
  | Webhooks.WebhookPayloadCheckRunCheckRunPullRequestsItem;

export type PullRequestData = Octokit.PullsGetResponse | PullRequestFromWebhook;

export type PullRequestWithDecentData =
  | Octokit.PullsGetResponse
  | PullRequestWithDecentDataFromWebhook;
