import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { RepoContext } from '../../context/repoContext';

const addStatusCheck = async function<
  E extends Webhooks.WebhookPayloadPullRequest
>(context: Context<E>, statusInfo: any): Promise<void> {
  const pr = context.payload.pull_request;

  await context.github.checks.create(
    context.repo({
      name: process.env.NAME,
      head_sha: pr.head.sha,
      ...statusInfo,
    }),
  );
};

const createInProgressStatusCheck = <
  E extends Webhooks.WebhookPayloadPullRequest
>(
  context: Context<E>,
): Promise<void> =>
  addStatusCheck(context, {
    status: 'in_progress',
  });

const createFailedStatusCheck = <E extends Webhooks.WebhookPayloadPullRequest>(
  context: Context<E>,
  message: string,
): Promise<void> =>
  addStatusCheck(context, {
    status: 'completed',
    conclusion: 'failure',
    started_at: context.payload.pull_request.created_at,
    completed_at: new Date(),
    output: {
      title: message,
      summary: '',
    },
  });

const createDoneStatusCheck = (context: Context): Promise<void> =>
  addStatusCheck(context, {
    status: 'completed',
    conclusion: 'success',
    started_at: context.payload.pull_request.created_at,
    completed_at: new Date(),
    output: {
      title: '✓ All reviews done !',
      summary: 'Pull request was successfully reviewed',
    },
  });

export const updateStatusCheckFromLabels = async (
  context: Context<any>,
  repoContext: RepoContext,
  labels: LabelResponse[] = context.payload.pull_request.labels || [],
): Promise<void> => {
  context.log.info('updateStatusCheckFromLabels', {
    labels: labels.map((l) => l && l.name),
    hasNeedsReview: repoContext.hasNeedsReview(labels),
    hasApprovesReview: repoContext.hasApprovesReview(labels),
  });

  if (repoContext.hasNeedsReview(labels)) {
    if (
      repoContext.config.requiresReviewRequest &&
      !repoContext.hasRequestedReview(labels)
    ) {
      await createFailedStatusCheck(
        context,
        'You need to request someone to review the PR',
      );
      return;
    }
    await createInProgressStatusCheck(context);
  } else if (repoContext.hasApprovesReview(labels)) {
    await createDoneStatusCheck(context);
  }
};
