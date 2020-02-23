import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { RepoContext } from '../../context/repoContext';

interface UpdatePr {
  title?: string;
  body?: string;
}

export const updatePrIfNeeded = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  pr: Octokit.PullsGetResponse,
  context: Context<E>,
  repoContext: RepoContext,
  update: UpdatePr,
): Promise<void> => {
  const hasDiffInTitle = update.title && pr.title !== update.title;
  const hasDiffInBody = update.body && pr.body !== update.body;

  if (hasDiffInTitle || hasDiffInBody) {
    const diff: Partial<Record<'title' | 'body', string>> = {};
    if (hasDiffInTitle) {
      diff.title = update.title;
      pr.title = update.title as string;
    }
    if (hasDiffInBody) {
      diff.body = update.body;
      pr.body = update.body as string;
    }

    await context.github.issues.update(context.issue(diff));
  }
};
