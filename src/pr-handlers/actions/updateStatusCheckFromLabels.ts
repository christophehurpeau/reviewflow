import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { RepoContext } from '../../context/repoContext';

const addStatusCheck = async function<
  E extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<E>,
  pr: any,
  { state, description }: { state: 'failure' | 'success'; description: string },
): Promise<void> {
  const hasPrCheck = (await context.github.checks.listForRef(
    context.repo({
      ref: pr.head.sha,
    }),
  )).data.check_runs.find((check) => check.name === process.env.NAME);

  context.log.info('add status check', { hasPrCheck, state, description });

  if (hasPrCheck) {
    await context.github.checks.create(
      context.repo({
        name: process.env.NAME as string,
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
        context: process.env.NAME,
        sha: pr.head.sha,
        state,
        target_url: undefined,
        description,
      }),
    );
  }
};

const createFailedStatusCheck = <E extends Webhooks.WebhookPayloadPullRequest>(
  context: Context<E>,
  pr: any,
  description: string,
): Promise<void> =>
  addStatusCheck(context, pr, {
    state: 'failure',
    description,
  });

export const updateStatusCheckFromLabels = (
  context: Context<any>,
  repoContext: RepoContext,
  pr: any = context.payload.pull_request,
  labels: LabelResponse[] = pr.labels || [],
): Promise<void> => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map((l) => l && l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels),
  });

  if (pr.requested_reviewers.length !== 0) {
    return createFailedStatusCheck(
      context,
      pr,
      `Awaiting review from: ${pr.requested_reviewers
        .map((rr: any) => rr.login)
        .join(', ')}`,
    );
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck(
      context,
      pr,
      'Changes requested ! Push commits or discuss changes then re-request a review.',
    );
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length !== 0) {
    return createFailedStatusCheck(
      context,
      pr,
      `Awaiting review from: ${needsReviewGroupNames.join(
        ', ',
      )}... perhaps you can request someone ?`,
    );
  }

  if (!repoContext.hasApprovesReview(labels)) {
    if (repoContext.config.requiresReviewRequest) {
      return createFailedStatusCheck(
        context,
        pr,
        'Awaiting review... perhaps you can request someone ?',
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
  return addStatusCheck(context, pr, {
    state: 'success',
    description: '✓ PR ready to merge !',
  });
  // }
};
