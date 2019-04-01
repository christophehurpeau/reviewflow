import Webhooks from '@octokit/webhooks';
import { Handler } from '../utils';

export const autoMergeIfPossible: Handler<
  Webhooks.WebhookPayloadPullRequest
> = async (context, repoContext) => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];
  if (!autoMergeLabel) return;

  const pr = context.payload.pull_request;

  if (!pr.labels.find((l) => l.id === autoMergeLabel.id)) return;

  if (pr.mergeable) {
    const mergeResult = await context.github.pulls.merge({
      merge_method: 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      number: pr.number,
      commit_title: `${pr.title} (#${pr.number})`,
      commit_message: '', // TODO add BC
    });
    context.log.info('merge result:', mergeResult);
  }
};
