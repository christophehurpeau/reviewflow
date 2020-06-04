import Webhooks from '@octokit/webhooks';
import { Application, Context } from 'probot';
import { AppContext } from '../../context/AppContext';
import { contextPr, contextIssue } from '../../context/utils';
import { handlerPullRequestChange } from './utils';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { updatePrBody } from './actions/updatePrBody';
import hasLabelInPR from './actions/utils/hasLabelInPR';

export default function labelsChanged(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    async (context: Context<Webhooks.WebhookPayloadPullRequest>) => {
      const sender = context.payload.sender;
      const fromRenovate =
        sender.type === 'Bot' && sender.login === 'renovate[bot]';
      context.payload.pull_request.head.ref.startsWith('renovate/');

      if (sender.type === 'Bot' && !fromRenovate) {
        return;
      }

      await handlerPullRequestChange(
        appContext,
        context,
        { refetchPr: true },
        async (pr, repoContext) => {
          const label = (context.payload as any).label;
          if (fromRenovate) {
            const codeApprovedLabel = repoContext.labels['code/approved'];
            const autoMergeLabel = repoContext.labels['merge/automerge'];
            const autoMergeSkipCiLabel = repoContext.labels['merge/skip-ci'];
            if (context.payload.action === 'labeled') {
              if (codeApprovedLabel && label.id === codeApprovedLabel.id) {
                // const { data: reviews } = await context.github.pulls.listReviews(
                //   contextPr(context, { per_page: 1 }),
                // );
                // if (reviews.length !== 0) {
                await context.github.pulls.createReview(
                  contextPr(context, { event: 'APPROVE' }),
                );
                if (autoMergeSkipCiLabel) {
                  await context.github.issues.addLabels(
                    contextIssue(context, {
                      labels: [autoMergeSkipCiLabel.name],
                    }),
                  );
                }
                await updateStatusCheckFromLabels(pr, context, repoContext);
                await updatePrBody(pr, context, repoContext, {
                  autoMergeWithSkipCi: true,
                  // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                  autoMerge: hasLabelInPR(pr.labels, autoMergeLabel)
                    ? true
                    : repoContext.config.prDefaultOptions.autoMerge,
                });
                // }
              } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
                await updatePrBody(pr, context, repoContext, {
                  autoMerge: true,
                  // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                  // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
                  autoMergeWithSkipCi: hasLabelInPR(
                    pr.labels,
                    codeApprovedLabel,
                  )
                    ? true
                    : repoContext.config.prDefaultOptions.autoMergeWithSkipCi,
                });
              }
              await autoMergeIfPossible(appContext, pr, context, repoContext);
            }
            return;
          }

          if (repoContext.protectedLabelIds.includes(label.id)) {
            if (context.payload.action === 'labeled') {
              await context.github.issues.removeLabel(
                contextIssue(context, { name: label.name }),
              );
            } else {
              await context.github.issues.addLabels(
                contextIssue(context, { labels: [label.name] }),
              );
            }
            return;
          }

          await updateStatusCheckFromLabels(pr, context, repoContext);

          const featureBranchLabel = repoContext.labels['feature-branch'];
          const automergeLabel = repoContext.labels['merge/automerge'];
          const skipCiLabel = repoContext.labels['merge/skip-ci'];

          const option = (() => {
            if (featureBranchLabel && label.id === featureBranchLabel.id)
              return 'featureBranch';
            if (automergeLabel && label.id === automergeLabel.id)
              return 'autoMerge';
            if (skipCiLabel && label.id === skipCiLabel.id)
              return 'autoMergeWithSkipCi';
            return null;
          })();

          if (option) {
            await updatePrBody(pr, context, repoContext, {
              [option]: context.payload.action === 'labeled',
            });
          } // not an else if
          if (automergeLabel && label.id === automergeLabel.id) {
            if (context.payload.action === 'labeled') {
              await autoMergeIfPossible(appContext, pr, context, repoContext);
            } else {
              repoContext.removePrFromAutomergeQueue(
                context,
                pr.number,
                'automerge label removed',
              );
            }
          }
        },
      );
    },
  );
}
