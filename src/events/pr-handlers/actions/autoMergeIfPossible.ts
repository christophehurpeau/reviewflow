import { Context, Octokit } from 'probot';
import Webhooks from '@octokit/webhooks';
import { AutomergeLog } from 'mongo';
import { AppContext } from 'context/AppContext';
import { RepoContext } from 'context/repoContext';
import { LabelResponse } from 'context/initRepoLabels';
import {
  PrContext,
  PrContextWithUpdatedPr,
  createPullRequestContextFromPullResponse,
} from '../utils/createPullRequestContext';
import { PullRequestData } from '../utils/PullRequestData';
import { parseBody } from './utils/body/parseBody';
import hasLabelInPR from './utils/hasLabelInPR';

const hasFailedStatusOrChecks = async (
  pr: PullRequestData,
  context: Context<any>,
): Promise<boolean> => {
  const checks = await context.github.checks.listForRef(
    context.repo({
      ref: pr.head.sha,
      per_page: 100,
    }),
  );

  const failedChecks = checks.data.check_runs.filter(
    (check) => check.conclusion === 'failure',
  );

  if (failedChecks.length !== 0) {
    context.log.info(`automerge not possible: failed check pr ${pr.id}`, {
      checks: failedChecks.map((check) => check.name),
    });
    return true;
  }

  const combinedStatus = await context.github.repos.getCombinedStatusForRef(
    context.repo({
      ref: pr.head.sha,
      per_page: 100,
    }),
  );

  if (combinedStatus.data.state === 'failure') {
    const failedStatuses = combinedStatus.data.statuses.filter(
      (status) => status.state === 'failure' || status.state === 'error',
    );

    context.log.info(`automerge not possible: failed status pr ${pr.id}`, {
      statuses: failedStatuses.map((status) => status.context),
    });

    return true;
  }

  return false;
};

export const autoMergeIfPossibleOptionalPrContext = async (
  appContext: AppContext,
  repoContext: RepoContext,
  pr:
    | Octokit.PullsGetResponse
    | Webhooks.WebhookPayloadPullRequest['pull_request'],
  context: Context<any>,
  prContext?:
    | PrContext<Octokit.PullsGetResponse>
    | PrContext<Webhooks.WebhookPayloadPullRequest['pull_request']>
    | PrContextWithUpdatedPr,
  prLabels: LabelResponse[] = pr.labels,
): Promise<boolean> => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];

  if (!hasLabelInPR(prLabels, autoMergeLabel)) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      'no automerge label',
    );
    return false;
  }

  const isRenovatePr = pr.head.ref.startsWith('renovate/');

  const createMergeLockPrFromPr = () => ({
    id: pr.id,
    number: pr.number,
    branch: pr.head.ref,
  });

  if (pr.state !== 'open') {
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      'pr is not opened',
    );
  }

  const addLog = (
    type: AutomergeLog['type'],
    action: AutomergeLog['action'],
  ): void => {
    const repoFullName = pr.head.repo.full_name;
    context.log.info(`automerge: ${repoFullName}#${pr.id} ${type}`);
    appContext.mongoStores.automergeLogs.insertOne({
      account: repoContext.accountEmbed,
      repoFullName,
      pr: {
        id: pr.id,
        number: pr.number,
        isRenovate: isRenovatePr,
        mergeableState: pr.mergeable_state,
      },
      type,
    });
  };

  if (
    repoContext.hasNeedsReview(prLabels) ||
    repoContext.hasRequestedReview(prLabels)
  ) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      'blocking labels',
    );
    return false;
  }

  if (pr.requested_reviewers.length !== 0) {
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      'still has requested reviewers',
    );
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();
  if (lockedPr && String(lockedPr.number) !== String(pr.number)) {
    context.log.info('automerge not possible: locked pr', {
      prId: pr.id,
      prNumber: pr.number,
    });
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pr.mergeable == null) {
    const prResult = await context.github.pulls.get(
      context.repo({
        pull_number: pr.number,
      }),
    );
    pr = prResult.data;
  }

  if (pr.merged) {
    addLog('already merged', 'remove');
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      'pr already merged',
    );
    return false;
  }

  context.log.info(
    `automerge?: ${pr.id}, #${pr.number}, mergeable=${pr.mergeable} state=${pr.mergeable_state}`,
  );

  // https://github.com/octokit/octokit.net/issues/1763
  if (
    !(
      pr.mergeable_state === 'clean' ||
      pr.mergeable_state === 'has_hooks' ||
      pr.mergeable_state === 'unstable'
    )
  ) {
    if (!pr.mergeable_state || pr.mergeable_state === 'unknown') {
      addLog('unknown mergeable_state', 'reschedule');
      // GitHub is determining whether the pull request is mergeable
      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (isRenovatePr) {
      if (pr.mergeable_state === 'behind' || pr.mergeable_state === 'dirty') {
        addLog('rebase-renovate', 'wait');

        // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120
        if (pr.body.includes('<!-- rebase-check -->')) {
          if (pr.body.includes('[x] <!-- rebase-check -->')) {
            return false;
          }

          const renovateRebaseBody = pr.body.replace(
            '[ ] <!-- rebase-check -->',
            '[x] <!-- rebase-check -->',
          );
          await context.github.issues.update(
            context.repo({
              issue_number: pr.number,
              body: renovateRebaseBody,
            }),
          );
        } else if (!pr.title.startsWith('rebase!')) {
          await context.github.issues.update(
            context.repo({
              issue_number: pr.number,
              title: `rebase!${pr.title}`,
            }),
          );
        }

        return false;
      }

      if (await hasFailedStatusOrChecks(pr, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(
          context,
          pr.number,
          'failed status or checks',
        );
        return false;
      } else if (pr.mergeable_state === 'blocked') {
        addLog('blocked mergeable_state', 'wait');
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }

      context.log.info(
        `automerge not possible: renovate with mergeable_state=${pr.mergeable_state}`,
      );
      return false;
    }

    if (pr.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(pr, context)) {
        addLog('failed status or checks', 'remove');
        repoContext.removePrFromAutomergeQueue(
          context,
          pr.number,
          'failed status or checks',
        );
        return false;
      } else {
        addLog('blocked mergeable_state', 'wait');
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }
    }

    if (pr.mergeable_state === 'behind') {
      addLog('behind mergeable_state', 'update branch');
      context.log.info('automerge not possible: update branch', {
        head: pr.head.ref,
        base: pr.base.ref,
      });

      await context.github.repos.merge({
        owner: pr.head.repo.owner.login,
        repo: pr.head.repo.name,
        head: pr.base.ref,
        base: pr.head.ref,
      });

      return false;
    }

    addLog('not mergeable', 'remove');
    repoContext.removePrFromAutomergeQueue(
      context,
      pr.number,
      `mergeable_state=${pr.mergeable_state}`,
    );
    context.log.info(
      `automerge not possible: not mergeable mergeable_state=${pr.mergeable_state}`,
    );
    return false;
  }

  try {
    context.log.info(`automerge pr #${pr.number}`);
    if (!prContext)
      prContext = await createPullRequestContextFromPullResponse(
        appContext,
        repoContext,
        context,
        pr,
        {},
      );

    const parsedBody = parseBody(
      prContext.commentBody,
      repoContext.config.prDefaultOptions,
    );
    const options = parsedBody?.options || repoContext.config.prDefaultOptions;

    const mergeResult = await context.github.pulls.merge({
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      pull_number: pr.number,
      commit_title: options.featureBranch
        ? undefined
        : `${pr.title}${options.autoMergeWithSkipCi ? ' [skip ci]' : ''} (#${
            pr.number
          })`,
      commit_message: options.featureBranch ? undefined : '', // TODO add BC
    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removePrFromAutomergeQueue(context, pr.number, 'merged');
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err.message);
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};

export const autoMergeIfPossible = async (
  prContext:
    | PrContext<Octokit.PullsGetResponse>
    | PrContext<Webhooks.WebhookPayloadPullRequest['pull_request']>
    | PrContextWithUpdatedPr,
  context: Context<any>,
  prLabels?: LabelResponse[],
): Promise<boolean> => {
  const pr:
    | Octokit.PullsGetResponse
    | Webhooks.WebhookPayloadPullRequest['pull_request'] =
    prContext.updatedPr ||
    (prContext as
      | PrContext<Octokit.PullsGetResponse>
      | PrContext<Webhooks.WebhookPayloadPullRequest['pull_request']>).pr;
  return autoMergeIfPossibleOptionalPrContext(
    prContext.appContext,
    prContext.repoContext,
    pr,
    context,
    prContext,
    prLabels,
  );
};
