import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { cleanTitle } from './utils/cleanTitle';

export const editOpenedPR = (
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
) => {
  if (!repoContext.config.trimTitle) return;

  const pr = context.payload.pull_request;
  const title = cleanTitle(pr.title);

  if (pr.title !== title) {
    pr.title = title;
    context.github.issues.update(
      context.issue({
        title,
      }),
    );
  }
};
