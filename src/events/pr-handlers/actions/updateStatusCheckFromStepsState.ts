import type { AppContext } from 'context/AppContext';
import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { StatusInfo } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import createStatus, { isSameStatus } from './utils/createStatus';
import hasLabelInPR from './utils/labels/hasLabelInPR';
import type { StepsState } from './utils/steps/calcStepsState';

type ReviewflowStatusCheckState = 'failure' | 'success';

const addStatusCheck = async function <EventName extends EventsWithRepository>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  {
    state,
    description,
  }: { state: ReviewflowStatusCheckState; description: string },
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
        per_page: 100,
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

export const updateStatusCheckFromStepsState = <
  EventName extends EventsWithRepository,
  GroupNames extends string,
>(
  stepsState: StepsState<GroupNames>,
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<GroupNames>,
  appContext: AppContext,
  reviewflowPrContext: ReviewflowPrContext,
  previousSha?: string,
): Promise<ReviewflowStatusCheckState> => {
  const createFailedStatusCheck = (
    description: string,
  ): Promise<ReviewflowStatusCheckState> =>
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
    ).then(() => 'failure');

  // PR Merged
  if (pullRequest.merged_at) {
    return addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: 'success',
        description: '✓ PR merged',
      },
      previousSha,
    ).then(() => 'success');
  }

  // STEP 1: Draft
  if (stepsState.write.state !== 'passed') {
    if (stepsState.write.isDraft) {
      return createFailedStatusCheck('PR is still in draft');
    }
    if (stepsState.write.isClosed) {
      return createFailedStatusCheck('PR is closed');
    }
    return createFailedStatusCheck('Write step failed, unknown reason');
  }

  // bypass
  const bypassProgressLabel = repoContext.labels['merge/bypass-progress'];
  if (
    bypassProgressLabel &&
    hasLabelInPR(pullRequest.labels, bypassProgressLabel)
  ) {
    return addStatusCheck(
      pullRequest,
      context,
      appContext,
      reviewflowPrContext,
      {
        state: 'success',
        description: '⚠️ PR merge bypass',
      },
      previousSha,
    ).then(() => 'success');
  }

  // STEP 2: CHECKS
  if (stepsState.checks.state !== 'passed') {
    if (stepsState.checks.isFailed) {
      const failedChecks =
        reviewflowPrContext.reviewflowPr.checksConclusion &&
        Object.values(reviewflowPrContext.reviewflowPr.checksConclusion)
          .filter(({ conclusion }) => conclusion === 'failure')
          .map(({ name }) => name);

      const failedStatuses =
        reviewflowPrContext.reviewflowPr.statusesConclusion &&
        Object.values(reviewflowPrContext.reviewflowPr.statusesConclusion)
          .filter(({ state }) => state === 'failure')
          .map(({ context }) => context);

      const failedChecksAndStatuses = [
        ...(failedChecks || []),
        ...(failedStatuses || []),
      ].filter(ExcludesFalsy);

      return createFailedStatusCheck(
        `Checks failed${
          failedChecksAndStatuses.length > 0
            ? `: ${failedChecksAndStatuses.join(', ')}`
            : ''
        }`,
      );
    }

    if (stepsState.checks.isInProgress) {
      return createFailedStatusCheck('Checks in progress');
    }
  }

  // STEP 3: Code Review
  if (stepsState.codeReview.state !== 'passed') {
    if (
      stepsState.codeReview.hasRequestedReviewers ||
      stepsState.codeReview.hasRequestedTeams
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

    if (stepsState.codeReview.hasChangesRequested) {
      return createFailedStatusCheck(
        'Changes requested ! Push commits or discuss changes then re-request a review.',
      );
    }

    const needsReviewGroupNames = stepsState.codeReview.needsReviewGroupNames;
    if (needsReviewGroupNames.length > 0) {
      return createFailedStatusCheck(
        `Awaiting review from: ${needsReviewGroupNames.join(
          ', ',
        )}. Perhaps request someone ?`,
      );
    }
  }

  if (stepsState.codeReview.isMissingApprobation) {
    return createFailedStatusCheck(
      'Awaiting review... Perhaps request someone ?',
    );
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
  ).then(() => 'success');
  // }
};
