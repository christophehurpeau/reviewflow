import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { PrContext } from '../utils/createPullRequestContext';

interface UpdatePr {
  title?: string;
  body?: string;
  commentBody?: string;
}

const cleanNewLines = (text: string): string => text.replace(/\r\n/g, '\n');
const checkIfHasDiff = (text1: string, text2: string): boolean =>
  cleanNewLines(text1) !== cleanNewLines(text2);

export const updatePrIfNeeded = async <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  prContext: PrContext<E['pull_request'] | Octokit.PullsGetResponse>,
  context: Context<E>,
  update: UpdatePr,
): Promise<void> => {
  const hasDiffInTitle = update.title && prContext.pr.title !== update.title;
  const hasDiffInBody =
    update.body && checkIfHasDiff(prContext.pr.body, update.body);
  const promises = [];

  if (hasDiffInTitle || hasDiffInBody) {
    const diff: Partial<Record<'title' | 'body', string>> = {};
    if (hasDiffInTitle) {
      diff.title = update.title;
      prContext.pr.title = update.title as string;
    }
    if (hasDiffInBody) {
      console.log({
        diff,
        originalTitle: prContext.pr.title,
        originalBody: cleanNewLines(prContext.pr.body),
        updatedBody: update.body && cleanNewLines(update.body),
        hasBodyDiff: hasDiffInBody,
      });

      diff.body = update.body;
      prContext.pr.body = update.body as string;
    }

    promises.push(
      context.github.pulls.update(
        context.repo({
          pull_number: prContext.pr.number,
          ...diff,
        }),
      ),
    );
  }

  if (
    update.commentBody &&
    checkIfHasDiff(prContext.commentBody, update.commentBody)
  ) {
    if (update.commentBody.includes('Explain here why this PR')) {
      throw new Error('Not valid comment body');
    }

    promises.push(
      context.github.issues.updateComment(
        context.repo({
          comment_id: prContext.reviewflowPr.commentId,
          body: update.commentBody,
        }),
      ),
    );
  }

  await Promise.all(promises);
};
