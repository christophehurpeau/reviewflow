import Webhooks from '@octokit/webhooks';
import { Application } from 'probot';
import { AppContext } from '../../context/AppContext';
import { contextPr, contextIssue } from '../../context/utils';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import { updatePrCommentBody } from './actions/updatePrCommentBody';
import hasLabelInPR from './actions/utils/hasLabelInPR';
import { fetchPullRequestAndCreateContext } from './utils/createPullRequestContext';

const isFromRenovate = (
  payload: Webhooks.WebhookPayloadPullRequest,
): boolean => {
  const sender = payload.sender;
  return (
    sender.type === 'Bot' &&
    sender.login === 'renovate[bot]' &&
    payload.pull_request.head.ref.startsWith('renovate/')
  );
};

export default function labelsChanged(
  app: Application,
  appContext: AppContext,
): void {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    createPullRequestHandler<
      Webhooks.WebhookPayloadPullRequest,
      Webhooks.WebhookPayloadPullRequest['pull_request']
    >(
      appContext,
      (payload, context, repoContext) => {
        if (payload.sender.type === 'Bot' && !isFromRenovate(payload)) {
          return null;
        }

        if (repoContext.shouldIgnore) return null;

        return payload.pull_request;
      },
      async (prContext, context, repoContext) => {
        const fromRenovate = isFromRenovate(context.payload);
        const updatedPrContext = await fetchPullRequestAndCreateContext(
          context,
          prContext,
        );
        const { updatedPr: pr } = updatedPrContext;

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

              let labels = pr.labels;
              const autoMergeWithSkipCi =
                autoMergeSkipCiLabel &&
                repoContext.config.autoMergeRenovateWithSkipCi;
              if (autoMergeWithSkipCi) {
                const result = await context.github.issues.addLabels(
                  contextIssue(context, {
                    labels: [autoMergeSkipCiLabel.name],
                  }),
                );
                labels = result.data;
              }
              await updateStatusCheckFromLabels(
                updatedPrContext,
                pr,
                context,
                labels,
              );
              await updatePrCommentBody(updatedPrContext, context, {
                autoMergeWithSkipCi,
                // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                autoMerge: hasLabelInPR(labels, autoMergeLabel)
                  ? true
                  : repoContext.config.prDefaultOptions.autoMerge,
              });
              // }
            } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
              await updatePrCommentBody(updatedPrContext, context, {
                autoMerge: true,
                // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
                autoMergeWithSkipCi: hasLabelInPR(pr.labels, codeApprovedLabel)
                  ? true
                  : repoContext.config.prDefaultOptions.autoMergeWithSkipCi,
              });
            }
            await autoMergeIfPossible(updatedPrContext, context);
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

        await updateStatusCheckFromLabels(updatedPrContext, pr, context);

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
          await updatePrCommentBody(updatedPrContext, context, {
            [option]: context.payload.action === 'labeled',
          });
        } // not an else if
        if (automergeLabel && label.id === automergeLabel.id) {
          if (context.payload.action === 'labeled') {
            await autoMergeIfPossible(updatedPrContext, context);
          } else {
            repoContext.removePrFromAutomergeQueue(
              context,
              pr.number,
              'automerge label removed',
            );
          }
        }
      },
    ),
  );
}
