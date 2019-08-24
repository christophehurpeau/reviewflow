import Webhooks from '@octokit/webhooks';
import { PullsGetResponse } from '@octokit/rest';
import { Context } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { RepoContext } from '../../context/repoContext';

const addStatusCheck = async function<
  E extends Webhooks.WebhookPayloadPullRequest
>(
  pr: PullsGetResponse,
  context: Context<E>,
  { state, description }: { state: 'failure' | 'success'; description: string },
): Promise<void> {
  const hasPrCheck = (await context.github.checks.listForRef(
    context.repo({
      ref: pr.head.sha,
    }),
  )).data.check_runs.find(
    (check) => check.name === process.env.REVIEWFLOW_NAME,
  );

  context.log.info('add status check', { hasPrCheck, state, description });

  if (hasPrCheck) {
    await context.github.checks.create(
      context.repo({
        name: process.env.REVIEWFLOW_NAME as string,
        head_sha: pr.head.sha,
        started_at: pr.created_at,
        status: 'completed',
        conclusion: state,
        completed_at: new Date().toISOString(),
        output: {
          title: description,
          summary: '',
        },
      }),
    );
  } else {
    await context.github.repos.createStatus(
      context.repo({
        context: process.env.REVIEWFLOW_NAME,
        sha: pr.head.sha,
        state,
        target_url: undefined,
        description,
      }),
    );
  }
};

const createFailedStatusCheck = <E extends Webhooks.WebhookPayloadPullRequest>(
  pr: PullsGetResponse,
  context: Context<E>,
  description: string,
): Promise<void> =>
  addStatusCheck(pr, context, {
    state: 'failure',
    description,
  });

export const updateStatusCheckFromLabels = (
  pr: PullsGetResponse,
  context: Context<any>,
  repoContext: RepoContext,
  labels: LabelResponse[] = pr.labels || [],
): Promise<void> => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map((l) => l && l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels),
  });

  if (pr.requested_reviewers.length !== 0) {
    return createFailedStatusCheck(
      pr,
      context,
      `Awaiting review from: ${pr.requested_reviewers
        .map((rr: any) => rr.login)
        .join(', ')}`,
    );
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck(
      pr,
      context,
      'Changes requested ! Push commits or discuss changes then re-request a review.',
    );
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length !== 0) {
    return createFailedStatusCheck(
      pr,
      context,
      `Awaiting review from: ${needsReviewGroupNames.join(
        ', ',
      )}. Perhaps request someone ?`,
    );
  }

  if (!repoContext.hasApprovesReview(labels)) {
    if (repoContext.config.requiresReviewRequest) {
      return createFailedStatusCheck(
        pr,
        context,
        'Awaiting review... Perhaps request someone ?',
      );
    }
  }

  // if (
  //   repoContext.config.requiresReviewRequest &&
  //   !repoContext.hasRequestedReview(labels)
  // ) {
  //   return  createFailedStatusCheck(
  //     context,
  //     pr,
  //     'You need to request someone to review the PR',
  //   );
  //   return;
  // }
  // return  createInProgressStatusCheck(context);
  // } else if (repoContext.hasApprovesReview(labels)) {
  return addStatusCheck(pr, context, {
    state: 'success',
    description: '✓ PR ready to merge !',
  });
  // }
};
