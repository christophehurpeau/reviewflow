import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { RepoContext } from '../context/repoContext';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';

const autoApproveAndAutoMerge = async (
  context: Context<Webhooks.WebhookPayloadPullRequest>,
  repoContext: RepoContext,
): Promise<void> => {
  // const autoMergeLabel = repoContext.labels['merge/automerge'];
  const codeApprovedLabel = repoContext.labels['code/approved'];
  const prLabels = context.payload.pull_request.labels;
  if (prLabels.find((l): boolean => l.id === codeApprovedLabel.id)) {
    await context.github.pulls.createReview(
      context.issue({ event: 'APPROVE' }),
    );
  }

  await autoMergeIfPossible(context, repoContext);
};

export default function opened(app: Application): void {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        const fromRenovate = context.payload.pull_request.head.ref.startsWith(
          'renovate/',
        );

        await Promise.all<unknown>([
          autoAssignPRToCreator(context, repoContext),
          editOpenedPR(context, repoContext),
          fromRenovate
            ? autoApproveAndAutoMerge(context, repoContext)
            : updateReviewStatus(context, repoContext, 'dev', {
                add: ['needsReview'],
                remove: ['approved', 'changesRequested'],
              }),
        ]);
      },
    ),
  );
}
