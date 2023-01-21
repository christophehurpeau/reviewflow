import type { Probot } from 'probot';
import type { ProbotEvent } from 'events/probot-types';
import type { AppContext } from '../../context/AppContext';
import { autoMergeIfPossible } from './actions/autoMergeIfPossible';
import {
  enableGithubAutoMerge,
  disableGithubAutoMerge,
} from './actions/enableGithubAutoMerge';
import { updateBranch } from './actions/updateBranch';
import { updatePrCommentBodyOptions } from './actions/updatePrCommentBody';
import { updateReviewStatus } from './actions/updateReviewStatus';
import { updateStatusCheckFromStepsState } from './actions/updateStatusCheckFromStepsState';
import hasLabelInPR from './actions/utils/labels/hasLabelInPR';
import { calcStepsState } from './actions/utils/steps/calcStepsState';
import { createPullRequestHandler } from './utils/createPullRequestHandler';
import { fetchPr } from './utils/fetchPr';

const isFromRenovate = (
  payload: ProbotEvent<
    'pull_request.labeled' | 'pull_request.unlabeled'
  >['payload'],
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
  createPullRequestHandler(
    app,
    appContext,
    ['pull_request.labeled', 'pull_request.unlabeled'],
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

      const updateBranchLabel = repoContext.labels['merge/update-branch'];
      const autoMergeLabel = repoContext.labels['merge/automerge'];
      const autoMergeSkipCiLabel = repoContext.labels['merge/skip-ci'];

      const label = context.payload.label;
      let successful = true;

      if (fromRenovate) {
        const codeApprovedLabel = repoContext.labels['code/approved'];
        const codeNeedsReviewLabel = repoContext.labels['code/needs-review'];
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
                context.repo({
                  issue_number: pullRequest.number,
                  labels: [autoMergeSkipCiLabel.name],
                }),
              );
              labels = result.data;
            }
            if (hasLabelInPR(labels, codeNeedsReviewLabel)) {
              labels = await updateReviewStatus(
                updatedPr,
                context,
                repoContext,
                [
                  {
                    reviewGroup: 'dev',
                    remove: ['needsReview'],
                  },
                ],
              );
            }
            const stepsState = calcStepsState({
              pullRequest: updatedPr,
              repoContext,
              labels,
            });

            await Promise.all([
              updateStatusCheckFromStepsState(
                stepsState,
                updatedPr,
                context,
                appContext,
                reviewflowPrContext,
              ),

              updatePrCommentBodyOptions(
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
              ),
            ]);
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

            if (
              repoContext.settings.allowAutoMerge &&
              repoContext.config.experimentalFeatures?.githubAutoMerge
            ) {
              await enableGithubAutoMerge(
                pullRequest,
                context,
                repoContext,
                reviewflowPrContext,
              );
            }
          }

          if (
            !(
              repoContext.settings.allowAutoMerge &&
              repoContext.config.experimentalFeatures?.githubAutoMerge
            )
          ) {
            await autoMergeIfPossible(
              updatedPr,
              context,
              repoContext,
              reviewflowPrContext,
            );
          }
        }
        return;
      }

      if (repoContext.protectedLabelIds.includes(label.id)) {
        if (context.payload.action === 'labeled') {
          await context.octokit.issues.removeLabel(
            context.repo({
              issue_number: pullRequest.number,
              name: label.name,
            }),
          );
        } else {
          await context.octokit.issues.addLabels(
            context.repo({
              issue_number: pullRequest.number,
              labels: [label.name],
            }),
          );
        }
        return;
      }

      const stepsState = calcStepsState({
        repoContext,
        pullRequest: updatedPr,
      });

      await updateStatusCheckFromStepsState(
        stepsState,
        updatedPr,
        context,
        appContext,
        reviewflowPrContext,
      );

      // not an else if
      if (autoMergeLabel && label.id === autoMergeLabel.id) {
        if (context.payload.action === 'labeled') {
          if (
            repoContext.settings.allowAutoMerge &&
            repoContext.config.experimentalFeatures?.githubAutoMerge
          ) {
            successful =
              (await enableGithubAutoMerge(
                pullRequest,
                context,
                repoContext,
                reviewflowPrContext,
                context.payload.sender.login,
              )) !== null;

            // if not successful, remove label
            if (!successful) {
              await context.octokit.issues.removeLabel(
                context.repo({
                  issue_number: pullRequest.number,
                  name: label.name,
                }),
              );
            }
          } else {
            await autoMergeIfPossible(
              updatedPr,
              context,
              repoContext,
              reviewflowPrContext,
            );
          }
        } else {
          // eslint-disable-next-line no-lonely-if
          if (
            repoContext.settings.allowAutoMerge &&
            repoContext.config.experimentalFeatures?.githubAutoMerge
          ) {
            successful = await disableGithubAutoMerge(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
              context.payload.sender.login,
            );
            // if not successful, add label back
            if (!successful) {
              await context.octokit.issues.addLabels(
                context.repo({
                  issue_number: pullRequest.number,
                  labels: [label.name],
                }),
              );
            }
          } else {
            await repoContext.removePrFromAutomergeQueue(
              context,
              pullRequest,
              'automerge label removed',
            );
          }
        }
      }

      if (updateBranchLabel && label.id === updateBranchLabel.id) {
        if (context.payload.action === 'labeled') {
          await updateBranch(updatedPr, context, context.payload.sender.login);
          await context.octokit.issues.removeLabel(
            context.repo({
              issue_number: pullRequest.number,
              name: label.name,
            }),
          );
        }
      }

      if (successful) {
        const option = (() => {
          if (autoMergeLabel && label.id === autoMergeLabel.id) {
            return 'autoMerge';
          }
          if (autoMergeSkipCiLabel && label.id === autoMergeSkipCiLabel.id) {
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
        }
      }
    },
  );
}
