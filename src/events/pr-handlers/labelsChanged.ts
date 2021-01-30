import type { EventPayloads } from '@octokit/webhooks';
import type { Probot } from 'probot';
import type { AppContext } from '../../context/AppContext';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import { updateBranch } from './actions/updateBranch';
import { updatePrCommentBodyOptions } from './actions/updatePrCommentBody';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromLabels } from './actions/updateStatusCheckFromLabels';
import hasLabelInPR from './actions/utils/hasLabelInPR';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

const isFromRenovate = (
  payload: EventPayloads.WebhookPayloadPullRequest,
): boolean => {
  const sender = payload.sender;
  return (
    sender.type === 'Bot' &&
    sender.login === 'renovate[bot]' &&
    payload.pull_request.head.ref.startsWith('renovate/')
  );
};

export default function labelsChanged(
  app: Probot,
  appContext: AppContext,
): void {
  app.on(
    ['pull_request.labeled', 'pull_request.unlabeled'],
    createPullRequestHandler<
      EventPayloads.WebhookPayloadPullRequest,
      EventPayloads.WebhookPayloadPullRequest['pull_request']
    >(
      appContext,
      (payload, context, repoContext) => {
        if (payload.sender.type === 'Bot' && !isFromRenovate(payload)) {
          return null;
        }

        if (repoContext.shouldIgnore) return null;

        return payload.pull_request;
      },
      async (pullRequest, context, repoContext, reviewflowPrContext) => {
        if (reviewflowPrContext === null) return;

        const fromRenovate = isFromRenovate(context.payload);
        const updatedPr = await fetchPr(context, pullRequest.number);

        const label = (context.payload as any).label;
        if (fromRenovate) {
          const codeApprovedLabel = repoContext.labels['code/approved'];
          const codeNeedsReviewLabel = repoContext.labels['code/needs-review'];
          const autoMergeLabel = repoContext.labels['merge/automerge'];
          const autoMergeSkipCiLabel = repoContext.labels['merge/skip-ci'];
          if (context.payload.action === 'labeled') {
            if (codeApprovedLabel && label.id === codeApprovedLabel.id) {
              // const { data: reviews } = await context.octokit.pulls.listReviews(
              //   context.pullRequest({ per_page: 1 }),
              // );
              // if (reviews.length !== 0) {
              await context.octokit.pulls.createReview(
                context.pullRequest({ event: 'APPROVE' }),
              );

              let labels = updatedPr.labels;
              const autoMergeWithSkipCi =
                autoMergeSkipCiLabel &&
                repoContext.config.autoMergeRenovateWithSkipCi;
              if (autoMergeWithSkipCi) {
                const result = await context.octokit.issues.addLabels(
                  context.issue({
                    labels: [autoMergeSkipCiLabel.name],
                  }),
                );
                labels = result.data;
              }
              if (hasLabelInPR(labels, codeNeedsReviewLabel)) {
                await updateReviewStatus(
                  updatedPr,
                  context,
                  repoContext,
                  'dev',
                  {
                    remove: ['needsReview'],
                  },
                );
              } else {
                await updateStatusCheckFromLabels(
                  updatedPr,
                  context,
                  repoContext,
                  labels,
                );
              }

              await updatePrCommentBodyOptions(
                context,
                repoContext,
                reviewflowPrContext,
                {
                  autoMergeWithSkipCi,
                  // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                  autoMerge: hasLabelInPR(labels, autoMergeLabel)
                    ? true
                    : repoContext.config.prDefaultOptions.autoMerge,
                },
              );
              // }
            } else if (autoMergeLabel && label.id === autoMergeLabel.id) {
              await updatePrCommentBodyOptions(
                context,
                repoContext,
                reviewflowPrContext,
                {
                  autoMerge: true,
                  // force label to avoid racing events (when both events are sent in the same time, reviewflow treats them one by one but the second event wont have its body updated)
                  // Note: si c'est renovate qui ajoute le label autoMerge, le label codeApprovedLabel n'aurait pu etre ajouté que par renovate également (on est a quelques secondes de l'ouverture de la pr par renovate)
                  autoMergeWithSkipCi: hasLabelInPR(
                    pullRequest.labels,
                    autoMergeSkipCiLabel,
                  )
                    ? true
                    : repoContext.config.prDefaultOptions.autoMergeWithSkipCi,
                },
              );
            }
            await autoMergeIfPossible(
              updatedPr,
              context,
              repoContext,
              reviewflowPrContext,
            );
          }
          return;
        }

        if (repoContext.protectedLabelIds.includes(label.id)) {
          if (context.payload.action === 'labeled') {
            await context.octokit.issues.removeLabel(
              context.issue({ name: label.name }),
            );
          } else {
            await context.octokit.issues.addLabels(
              context.issue({ labels: [label.name] }),
            );
          }
          return;
        }

        await updateStatusCheckFromLabels(updatedPr, context, repoContext);

        const updateBranchLabel = repoContext.labels['merge/update-branch'];
        const automergeLabel = repoContext.labels['merge/automerge'];
        const skipCiLabel = repoContext.labels['merge/skip-ci'];

        const option = (() => {
          if (automergeLabel && label.id === automergeLabel.id) {
            return 'autoMerge';
          }
          if (skipCiLabel && label.id === skipCiLabel.id) {
            return 'autoMergeWithSkipCi';
          }
          return null;
        })();

        if (option) {
          await updatePrCommentBodyOptions(
            context,
            repoContext,
            reviewflowPrContext,
            {
              [option]: context.payload.action === 'labeled',
            },
          );
        } // not an else if
        if (automergeLabel && label.id === automergeLabel.id) {
          if (context.payload.action === 'labeled') {
            await autoMergeIfPossible(
              updatedPr,
              context,
              repoContext,
              reviewflowPrContext,
            );
          } else {
            repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest.number,
              'automerge label removed',
            );
          }
        }
        if (updateBranchLabel && label.id === updateBranchLabel.id) {
          if (context.payload.action === 'labeled') {
            await updateBranch(
              updatedPr,
              context,
              context.payload.sender.login,
            );
            await context.octokit.issues.removeLabel(
              context.issue({ name: label.name }),
            );
          }
        }
      },
    ),
  );
}
