import { Application } from 'probot';
import { LabelResponse } from '../context/initRepoLabels';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';

export default function opened(app: Application): void {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(
      async (context, repoContext): Promise<void> => {
        const fromRenovate = context.payload.pull_request.head.ref.startsWith(
          'renovate/',
        );

        if (fromRenovate) {
          const autoMergeLabel = repoContext.labels['merge/automerge'];
          const prLabels = context.payload.pull_request.labels;
          if (
            autoMergeLabel &&
            prLabels.find((l: LabelResponse) => l.id === autoMergeLabel.id)
          ) {
            await context.github.pulls.createReview(
              context.issue({ event: 'APPROVE' }),
            );
          }
        }

        await Promise.all([
          autoAssignPRToCreator(context, repoContext),
          editOpenedPR(context, repoContext),
          fromRenovate
            ? Promise.resolve(undefined)
            : updateReviewStatus(context, repoContext, 'dev', {
                add: ['needsReview'],
              }),
        ]);
      },
    ),
  );
}
