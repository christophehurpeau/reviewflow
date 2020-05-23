import { Application } from 'probot';
import { AppContext } from '../context/AppContext';
import { createHandlerPullRequestChange } from './utils';
import { autoAssignPRToCreator } from './actions/autoAssignPRToCreator';
import { editOpenedPR } from './actions/editOpenedPR';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { autoApproveAndAutoMerge } from './actions/autoApproveAndAutoMerge';
import { readCommitsAndUpdateInfos } from './actions/readCommitsAndUpdateInfos';

export default function opened(app: Application, appContext: AppContext): void {
  app.on(
    'pull_request.opened',
    createHandlerPullRequestChange(
      appContext,
      async (pr, context, repoContext): Promise<void> => {
        const fromRenovate = pr.head.ref.startsWith('renovate/');

        await Promise.all<unknown>([
          autoAssignPRToCreator(pr, context, repoContext),
          editOpenedPR(pr, context, repoContext).then(() => {
            return readCommitsAndUpdateInfos(pr, context, repoContext);
          }),
          fromRenovate
            ? autoApproveAndAutoMerge(pr, context, repoContext).then(
                async (approved: boolean): Promise<void> => {
                  if (!approved) {
                    await updateReviewStatus(pr, context, repoContext, 'dev', {
                      add: ['needsReview'],
                    });
                  }
                },
              )
            : updateReviewStatus(pr, context, repoContext, 'dev', {
                add: ['needsReview'],
                remove: ['approved', 'changesRequested'],
              }),
        ]);
      },
    ),
  );
}
