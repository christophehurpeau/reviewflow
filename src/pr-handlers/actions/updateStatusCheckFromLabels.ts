import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { RepoContext } from '../../context/repoContext';
import createStatus from './utils/createStatus';

const addStatusCheck = async function <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  pr: Octokit.PullsGetResponse,
  context: Context<E>,
  { state, description }: { state: 'failure' | 'success'; description: string },
  previousSha?: string,
): Promise<void> {
  const hasPrCheck = (
    await context.github.checks.listForRef(
      context.repo({
        ref: pr.head.sha,
      }),
    )
  ).data.check_runs.find((check) => check.name === process.env.REVIEWFLOW_NAME);

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
  } else if (previousSha && state === 'failure') {
    await Promise.all([
      createStatus(
        context,
        '',
        previousSha,
        'success',
        'New commits have been pushed',
      ),
      createStatus(context, '', pr.head.sha, state, description),
    ]);
  } else {
    await createStatus(context, '', pr.head.sha, state, description);
  }
};

export const updateStatusCheckFromLabels = (
  pr: Octokit.PullsGetResponse,
  context: Context<any>,
  repoContext: RepoContext,
  labels: LabelResponse[] = pr.labels || [],
  previousSha?: string,
): Promise<void> => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map((l) => l?.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels),
  });

  const createFailedStatusCheck = (description: string): Promise<void> =>
    addStatusCheck(
      pr,
      context,
      {
        state: 'failure',
        description,
      },
      previousSha,
    );

  if (pr.requested_reviewers.length !== 0) {
    return createFailedStatusCheck(
      `Awaiting review from: ${pr.requested_reviewers
        .map((rr: any) => rr.login)
        .join(', ')}`,
    );
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck(
      'Changes requested ! Push commits or discuss changes then re-request a review.',
    );
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length !== 0) {
    return createFailedStatusCheck(
      `Awaiting review from: ${needsReviewGroupNames.join(
        ', ',
      )}. Perhaps request someone ?`,
    );
  }

  if (!repoContext.hasApprovesReview(labels)) {
    if (repoContext.config.requiresReviewRequest) {
      return createFailedStatusCheck(
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
  return addStatusCheck(
    pr,
    context,
    {
      state: 'success',
      description: '✓ PR ready to merge !',
    },
    previousSha,
  );
  // }
};
