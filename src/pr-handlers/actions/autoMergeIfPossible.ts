import { Context } from 'probot';
// eslint-disable-next-line import/no-cycle
import { RepoContext } from '../../context/repoContext';
import { LabelResponse } from '../../context/initRepoLabels';
import { parseBody } from './utils/parseBody';

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

  if (!prLabels.find((l: LabelResponse) => l.id === autoMergeLabel.id)) {
    context.log.debug('automerge not possible: no label');
    repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
    return false;
  }

  if (
    repoContext.hasNeedsReview(prLabels) ||
    repoContext.hasRequestedReview(prLabels)
  ) {
    context.log.debug('automerge not possible: blocking labels');
    // repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
    return false;
  }

  const lockedPr = repoContext.getMergeLockedPr();
  if (lockedPr && lockedPr.number !== pr.number) {
    context.log.info(`automerge not possible: locked pr ${pr.id}`);
    repoContext.pushAutomergeQueue(createMergeLockPrFromPr());
    return false;
  }

  repoContext.addMergeLockPr(createMergeLockPrFromPr());

  if (pr.mergeable === undefined) {
    const prResult = await context.github.pulls.get(
      context.repo({
        number: pr.number,
      }),
    );
    pr = prResult.data;
  }

  if (pr.merged) {
    repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
    context.log.info(`automerge not possible: already merged pr ${pr.id}`);
    return false;
  }

  context.log.info(
    `automerge?: ${pr.id}, mergeable=${pr.mergeable} state=${
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
      } else {
        const checks = await context.github.checks.listForRef(
          context.repo({
            ref: pr.head.sha,
            per_page: 100,
          }),
        );

        const hasFailedChecks = checks.data.check_runs.some(
          (check) => check.conclusion === 'failure',
        );
        if (hasFailedChecks) {
          context.log.info(`automerge not possible: failed check pr ${pr.id}`);
          repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
          return false;
        }

        const statuses = await context.github.repos.listStatusesForRef(
          context.repo({
            ref: pr.head.sha,
            per_page: 100,
          }),
        );

        const hasFailedStatuses = statuses.data.some(
          (status) => status.state === 'failure',
        );
        if (hasFailedStatuses) {
          context.log.info(`automerge not possible: failed status pr ${pr.id}`);
          repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
          return false;
        }
      }

      context.log.info(
        `automerge not possible: renovate with mergeable_state=${
          pr.mergeable_state
        }`,
      );
      return false;
    }

    if (pr.mergeable_state === 'behind') {
      context.log.info('automerge not possible: update branch');

      await context.github.repos.merge({
        owner: pr.head.repo.owner.login,
        repo: pr.head.repo.name,
        base: pr.head.name,
        head: pr.head.name,
      });

      return false;
    }

    repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
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
    const mergeResult = await context.github.pulls.merge({
      merge_method:
        parsedBody && parsedBody.options.featureBranch ? 'merge' : 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      number: pr.number,
      commit_title: `${pr.title} (#${pr.number})`,
      commit_message: '', // TODO add BC
    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removeMergeLockedPr(context, createMergeLockPrFromPr());
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err.message);
    repoContext.reschedule(context, createMergeLockPrFromPr());
    return false;
  }
};
