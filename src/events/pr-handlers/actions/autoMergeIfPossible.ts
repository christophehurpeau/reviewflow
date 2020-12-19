import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { AutomergeLog } from 'mongo';
import type {
  PullRequestData,
  PullRequestFromRestEndpoint,
  PullRequestLabels,
} from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { parseBody } from './utils/body/parseBody';
import hasLabelInPR from './utils/hasLabelInPR';

const hasFailedStatusOrChecks = async (
  pr: PullRequestData,
  context: Context<any>,
): Promise<boolean> => {
  const checks = await context.octokit.checks.listForRef(
    context.repo({
      ref: pr.head.sha,
      per_page: 100,
    }),
  );

  const failedChecks = checks.data.check_runs.filter(
    (check) => check.conclusion === 'failure',
  );

  if (failedChecks.length > 0) {
    context.log.info(
      {
        checks: failedChecks.map((check) => check.name),
      },
      `automerge not possible: failed check pr ${pr.id}`,
    );
    return true;
  }

  const combinedStatus = await context.octokit.repos.getCombinedStatusForRef(
    context.repo({
      ref: pr.head.sha,
      per_page: 100,
    }),
  );

  if (combinedStatus.data.state === 'failure') {
    const failedStatuses = combinedStatus.data.statuses.filter(
      (status) => status.state === 'failure' || status.state === 'error',
    );

    context.log.info(
      {
        statuses: failedStatuses.map((status) => status.context),
      },
      `automerge not possible: failed status pr ${pr.id}`,
    );

    return true;
  }

  return false;
};

export const autoMergeIfPossible = async (
  pullRequest: PullRequestFromRestEndpoint,
  context: Context<any>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  prLabels: PullRequestLabels = pullRequest.labels,
): Promise<boolean> => {
  if (reviewflowPrContext === null) return false;

  const autoMergeLabel = repoContext.labels['merge/automerge'];

  if (!hasLabelInPR(prLabels, autoMergeLabel)) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'no automerge label',
    );
    return false;
  }

  const isRenovatePr = pullRequest.head.ref.startsWith('renovate/');

  const createMergeLockPrFromPr = () => ({
    id: pullRequest.id,
    number: pullRequest.number,
    branch: pullRequest.head.ref,
  });

  if (pullRequest.state !== 'open') {
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'pr is not opened',
    );
    return false;
  }

  const addLog = (
    type: AutomergeLog['type'],
    action: AutomergeLog['action'],
  ): void => {
    const repoFullName = pullRequest.head.repo.full_name;
    context.log.info(`automerge: ${repoFullName}#${pullRequest.id} ${type}`);
    repoContext.appContext.mongoStores.automergeLogs.insertOne({
      account: repoContext.accountEmbed,
      repoFullName,
      pr: {
        id: pullRequest.id,
        number: pullRequest.number,
        isRenovate: isRenovatePr,
        mergeableState: pullRequest.mergeable_state,
      },
      type,
      action,
    });
  };

  if (
    repoContext.hasNeedsReview(prLabels) ||
    repoContext.hasRequestedReview(prLabels)
  ) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'blocking labels',
    );
    return false;
  }

  if (pullRequest.requested_reviewers.length > 0) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'still has requested reviewers',
    );
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();
  if (lockedPr && String(lockedPr.number) !== String(pullRequest.number)) {
    context.log.info(
      {
        prId: pullRequest.id,
        prNumber: pullRequest.number,
      },
      'automerge not possible: locked pr',
    );
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pullRequest.mergeable == null) {
    const prResult = await context.octokit.pulls.get(
      context.repo({
        pull_number: pullRequest.number,
      }),
    );
    pullRequest = prResult.data;
  }

  if (pullRequest.merged) {
    addLog('already merged', 'remove');
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'pr already merged',
    );
    return false;
  }

  context.log.info(
    `automerge?: ${pullRequest.id}, #${pullRequest.number}, mergeable=${pullRequest.mergeable} state=${pullRequest.mergeable_state}`,
  );

  // https://github.com/octokit/octokit.net/issues/1763
  if (
    !(
      pullRequest.mergeable_state === 'clean' ||
      pullRequest.mergeable_state === 'has_hooks' ||
      pullRequest.mergeable_state === 'unstable'
    )
  ) {
    if (
      !pullRequest.mergeable_state ||
      pullRequest.mergeable_state === 'unknown'
    ) {
      addLog('unknown mergeable_state', 'reschedule');
      // GitHub is determining whether the pull request is mergeable
      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (isRenovatePr) {
      if (
        pullRequest.mergeable_state === 'behind' ||
        pullRequest.mergeable_state === 'dirty'
      ) {
        addLog('rebase-renovate', 'wait');

        // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120
        if (pullRequest.body.includes('<!-- rebase-check -->')) {
          if (pullRequest.body.includes('[x] <!-- rebase-check -->')) {
            return false;
          }

          const renovateRebaseBody = pullRequest.body.replace(
            '[ ] <!-- rebase-check -->',
            '[x] <!-- rebase-check -->',
          );
          await context.octokit.issues.update(
            context.repo({
              issue_number: pullRequest.number,
              body: renovateRebaseBody,
            }),
          );
        } else if (!pullRequest.title.startsWith('rebase!')) {
          await context.octokit.issues.update(
            context.repo({
              issue_number: pullRequest.number,
              title: `rebase!${pullRequest.title}`,
            }),
          );
        }
        return false;
      }

      if (await hasFailedStatusOrChecks(pullRequest, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(
          context,
          pullRequest.number,
          'failed status or checks',
        );
        return false;
      } else if (pullRequest.mergeable_state === 'blocked') {
        addLog('blocked mergeable_state', 'wait');
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }

      context.log.info(
        `automerge not possible: renovate with mergeable_state=${pullRequest.mergeable_state}`,
      );
      return false;
    }

    if (pullRequest.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(pullRequest, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(
          context,
          pullRequest.number,
          'failed status or checks',
        );
        return false;
      } else {
        addLog('blocked mergeable_state', 'wait');
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }
    }

    if (pullRequest.mergeable_state === 'behind') {
      addLog('behind mergeable_state', 'update branch');
      context.log.info(
        {
          head: pullRequest.head.ref,
          base: pullRequest.base.ref,
        },
        'automerge not possible: update branch',
      );

      await context.octokit.repos.merge({
        owner: pullRequest.head.repo.owner.login,
        repo: pullRequest.head.repo.name,
        head: pullRequest.base.ref,
        base: pullRequest.head.ref,
      });

      return false;
    }

    addLog('not mergeable', 'remove');
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      `mergeable_state=${pullRequest.mergeable_state}`,
    );
    context.log.info(
      `automerge not possible: not mergeable mergeable_state=${pullRequest.mergeable_state}`,
    );
    return false;
  }

  try {
    context.log.info(`automerge pr #${pullRequest.number}`);

    const parsedBody = parseBody(
      reviewflowPrContext.commentBody,
      repoContext.config.prDefaultOptions,
    );
    const options = parsedBody?.options || repoContext.config.prDefaultOptions;

    const mergeResult = await context.octokit.pulls.merge({
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pullRequest.head.repo.owner.login,
      repo: pullRequest.head.repo.name,
      pull_number: pullRequest.number,
      commit_title: options.featureBranch
        ? undefined
        : `${pullRequest.title}${
            options.autoMergeWithSkipCi ? ' [skip ci]' : ''
          } (#${pullRequest.number})`,
      commit_message: options.featureBranch ? undefined : '', // TODO add BC
    });
    context.log.debug(mergeResult.data, 'merge result:');
    repoContext.removePrFromAutomergeQueue(
      context,
      pullRequest.number,
      'merged',
    );
    return Boolean('merged' in mergeResult.data && mergeResult.data.merged);
  } catch (err) {
    context.log.info({ errorMessage: err.message }, 'could not merge:');
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};
