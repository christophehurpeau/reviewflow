import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';

interface UpdatePr {
  title?: string;
  body?: string;
}

const cleanNewLines = (text: string | null): string =>
  !text ? '' : text.replace(/\r\n/g, '\n');
const checkIfHasDiff = (text1: string | null, text2: string): boolean =>
  cleanNewLines(text1) !== cleanNewLines(text2);

export const updatePrIfNeeded = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  pullRequest: PullRequestWithDecentData,
  context: Context<E>,
  update: UpdatePr,
): Promise<void> => {
  const hasDiffInTitle = update.title && pullRequest.title !== update.title;
  const hasDiffInBody =
    update.body && checkIfHasDiff(pullRequest.body, update.body);

  if (hasDiffInTitle || hasDiffInBody) {
    const diff: Partial<Record<'title' | 'body', string>> = {};
    if (hasDiffInTitle) {
      diff.title = update.title;
      pullRequest.title = update.title as string;
    }
    if (hasDiffInBody) {
      diff.body = update.body;
      pullRequest.body = update.body as string;
    }

    await context.octokit.pulls.update(
      context.repo({
        pull_number: pullRequest.number,
        ...diff,
      }),
    );
  }
};
