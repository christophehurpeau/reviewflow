/* eslint-disable max-lines */
import { Context } from 'probot';
// eslint-disable-next-line import/no-cycle
import { RepoContext } from '../../context/repoContext';
import { LabelResponse } from '../../context/initRepoLabels';
import { parseBody } from './utils/parseBody';

const hasFailedStatusOrChecks = async (
  context: Context<any>,
  repoContext: RepoContext,
  pr: any,
) => {
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

export const autoMergeIfPossible = async (
  context: Context<any>,
  repoContext: RepoContext,
  pr: any = context.payload.pull_request,
  prLabels: LabelResponse[] = pr.labels,
): Promise<boolean> => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];
  if (!autoMergeLabel) return false;

  const createMergeLockPrFromPr = () => ({
    id: pr.id,
    number: pr.number,
    branch: pr.head.ref,
  });

  if (!prLabels.find((l): boolean => l.id === autoMergeLabel.id)) {
    context.log.debug('automerge not possible: no label', {
      prId: pr.id,
      prNumber: pr.number,
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return false;
  }

  if (pr.state !== 'open') {
    context.log.debug('automerge not possible: pr is not opened', {
      prId: pr.id,
      prNumber: pr.number,
    });
    repoContext.removePrFromAutomergeQueue(context, pr.number);
  }

  if (
    repoContext.hasNeedsReview(prLabels) ||
    repoContext.hasRequestedReview(prLabels)
  ) {
    context.log.debug('automerge not possible: blocking labels', {
      prId: pr.id,
      prNumber: pr.number,
    });
    // repoContext.removePrFromAutomergeQueue(context, pr.number);
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();
  if (lockedPr && lockedPr.number !== pr.number) {
    context.log.info('automerge not possible: locked pr', {
      prId: pr.id,
      prNumber: pr.number,
    });
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pr.mergeable === undefined) {
    const prResult = await context.github.pulls.get(
      context.repo({
        pull_number: pr.number,
      }),
    );
    pr = prResult.data;
  }

  if (pr.merged) {
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info('automerge not possible: already merged pr', {
      prId: pr.id,
      prNumber: pr.number,
    });
    return false;
  }

  context.log.info(
    `automerge?: ${pr.id}, #${pr.number}, mergeable=${pr.mergeable} state=${
      pr.mergeable_state
    }`,
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
      context.log.info(`automerge not possible: rescheduling ${pr.id}`);
      // GitHub is determining whether the pull request is mergeable
      repoContext.reschedule(context, createMergeLockPrFromPr());
      return false;
    }

    if (pr.head.ref.startsWith('renovate/')) {
      if (pr.mergeable_state === 'behind' || pr.mergeable_state === 'dirty') {
        context.log.info(
          `automerge not possible: rebase renovate branch pr ${pr.id}`,
        );
        // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120

        await context.github.issues.update(
          context.repo({
            number: pr.number,
            body: pr.body.replace(
              '[ ] <!-- renovate-rebase -->',
              '[x] <!-- renovate-rebase -->',
            ),
          }),
        );
        return false;
      }

      if (await hasFailedStatusOrChecks(context, repoContext, pr)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else if (pr.mergeable_state === 'blocked') {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }

      context.log.info(
        `automerge not possible: renovate with mergeable_state=${
          pr.mergeable_state
        }`,
      );
      return false;
    }

    if (pr.mergeable_state === 'blocked') {
      if (await hasFailedStatusOrChecks(context, repoContext, pr)) {
        repoContext.removePrFromAutomergeQueue(context, pr.number);
        return false;
      } else {
        // waiting for reschedule in status (pr-handler/status.ts)
        return false;
      }
    }

    if (pr.mergeable_state === 'behind') {
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

    repoContext.removePrFromAutomergeQueue(context, pr.number);
    context.log.info(
      `automerge not possible: not mergeable mergeable_state=${
        pr.mergeable_state
      }`,
    );
    return false;
  }

  try {
    context.log.info(`automerge pr #${pr.number}`);

    const parsedBody = parseBody(pr.body, repoContext.config.prDefaultOptions);
    const options =
      (parsedBody && parsedBody.options) || repoContext.config.prDefaultOptions;

    const mergeResult = await context.github.pulls.merge({
      merge_method: options.featureBranch ? 'merge' : 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      pull_number: pr.number,
      commit_title: `${pr.title}${
        options.autoMergeWithSkipCi ? ' [skip ci]' : ''
      } (#${pr.number})`,
      commit_message: '', // TODO add BC
    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removePrFromAutomergeQueue(context, pr.number);
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err.message);
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};
