import type {
  EmitterWebhookEvent,
  EmitterWebhookEventName,
} from '@octokit/webhooks';
import type { Context } from 'probot';

export type ProbotEvent<Name extends EmitterWebhookEventName> =
  EmitterWebhookEvent<Name> & Omit<Context, keyof EmitterWebhookEvent>;
