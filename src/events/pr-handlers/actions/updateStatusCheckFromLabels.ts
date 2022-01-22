import type { AppContext } from 'context/AppContext';
import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { StatusInfo } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import createStatus, { isSameStatus } from './utils/createStatus';

const addStatusCheck = async function <EventName extends EventsWithRepository>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  { state, description }: { state: 'failure' | 'success'; description: string },
  previousSha?: string,
): Promise<void> {
  const previousStatus = reviewflowPrContext.reviewflowPr.flowStatus;

  let prCheck;
  if (!previousStatus) {
    const {
      data: { check_runs: checkRuns },
    } = await context.octokit.checks.listForRef(
      context.repo({
        ref: pullRequest.head.sha,
      }),
    );
    prCheck = checkRuns.find(
      (check): boolean => check.name === process.env.REVIEWFLOW_NAME,
    );
  }

  context.log.debug({ prCheck, state, description }, 'add status check');

  const newStatus: StatusInfo = {
    type: state,
    title: description,
    summary: '',
  };

  if (prCheck) {
    if (prCheck.conclusion !== state || prCheck.output.title !== description) {
      await context.octokit.checks.create(
        context.repo({
          name: process.env.REVIEWFLOW_NAME!,
          head_sha: pullRequest.head.sha,
          started_at: pullRequest.created_at,
          status: 'completed',
          conclusion: state,
          completed_at: new Date().toISOString(),
          output: {
            title: description,
            summary: '',
          },
        }),
      );
    }
  } else {
    const shouldUpdateStatus =
      !!previousSha ||
      reviewflowPrContext.reviewflowPr.lastFlowStatusCommit !==
        pullRequest.head.sha ||
      !previousStatus ||
      !isSameStatus(previousStatus, newStatus);

    await Promise.all([
      previousSha &&
        (previousStatus
          ? previousStatus.type === 'failure'
          : state === 'failure') &&
        createStatus(context, '', previousSha, {
          type: 'success',
          title: 'New commits have been pushed',
          summary: '',
        }),

      shouldUpdateStatus &&
        createStatus(context, '', pullRequest.head.sha, newStatus),
    ]);

    if (shouldUpdateStatus) {
      await appContext.mongoStores.prs.partialUpdateOne(
        reviewflowPrContext.reviewflowPr,
        {
          $set: {
            lastFlowStatusCommit: pullRequest.head.sha,
            flowStatus: newStatus,
          },
        },
      );
    }
  }
};

export const updateStatusCheckFromLabels = <
  EventName extends EventsWithRepository,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  labels: PullRequestLabels = pullRequest.labels || [],
  previousSha?: string,
): Promise<void> => {
  context.log.debug(
    {
      labels: labels.map((l) => l?.name),
      hasNeedsReview: repoContext.hasNeedsReview(labels),
      hasApprovesReview: repoContext.hasApprovesReview(labels),
    },
    'updateStatusCheckFromLabels',
  );

  const createFailedStatusCheck = (description: string): Promise<void> =>
    addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: 'failure',
        description,
      },
      previousSha,
    );

  if (pullRequest.draft) {
    return createFailedStatusCheck('PR is still in draft');
  }

  if (
    (pullRequest.requested_reviewers &&
      pullRequest.requested_reviewers.length > 0) ||
    (pullRequest.requested_teams && pullRequest.requested_teams.length > 0)
  ) {
    return createFailedStatusCheck(
      `Awaiting review from: ${[
        ...(pullRequest.requested_reviewers || []),
        ...(pullRequest.requested_teams || []),
      ]
        .map((rr) => (!rr ? undefined : 'name' in rr ? rr.name : rr.login))
        .filter(ExcludesFalsy)
        .join(', ')}`,
    );
  }

  if (repoContext.hasChangesRequestedReview(labels)) {
    return createFailedStatusCheck(
      'Changes requested ! Push commits or discuss changes then re-request a review.',
    );
  }

  const needsReviewGroupNames = repoContext.getNeedsReviewGroupNames(labels);

  if (needsReviewGroupNames.length > 0) {
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
    pullRequest,
    context,
    appContext,
    reviewflowPrContext,
    {
      state: 'success',
      description: '✓ PR ready to merge !',
    },
    previousSha,
  );
  // }
};
