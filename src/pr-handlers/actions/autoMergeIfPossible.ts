import { Context } from 'probot';
// eslint-disable-next-line import/no-cycle
import { RepoContext } from '../../context/repoContext';
import { LabelResponse } from '../../context/initRepoLabels';

export const autoMergeIfPossible = async (
  context: Context<any>,
  repoContext: RepoContext,
  pr: any = context.payload.pull_request,
  prLabels: LabelResponse[] = pr.labels,
): Promise<boolean> => {
  const autoMergeLabel = repoContext.labels['merge/automerge'];
  if (!autoMergeLabel) return false;

  if (!prLabels.find((l: LabelResponse) => l.id === autoMergeLabel.id)) {
    context.log.debug('automerge not possible: no label');
    return false;
  }

  if (
    repoContext.hasNeedsReview(prLabels) ||
    repoContext.hasRequestedReview(prLabels)
  ) {
    context.log.debug('automerge not possible: blocking labels');
    return false;
  }

  const lockedPrNumber = repoContext.getMergeLocked();
  if (lockedPrNumber && lockedPrNumber !== pr.number) {
    context.log.info(`automerge not possible: locked pr ${pr.id}`);
    repoContext.pushAutomergeQueue(pr.id, pr.number);
    return false;
  }

  repoContext.addMergeLock(pr.number);

  if (pr.mergeable === undefined) {
    const prResult = await context.github.pulls.get(
      context.repo({
        number: pr.number,
      }),
    );
    pr = prResult.data;
  }

  if (pr.merged) {
    context.log.info(`automerge not possible: already merged pr ${pr.id}`);
    return false;
  }

  if (!pr.mergeable) {
    if (pr.mergeable_state === undefined) {
      // GitHub is determining whether the pull request is mergeable
      repoContext.reschedule(context, String(pr.id), pr.number);
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
          repoContext.removeMergeLocked(context, pr.number);
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
          repoContext.removeMergeLocked(context, pr.number);
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

    repoContext.removeMergeLocked(context, pr.number);
    context.log.info(
      `automerge not possible: not mergeable mergeable_state=${
        pr.mergeable_state
      }`,
    );
    return false;
  }

  try {
    context.log.info(`automerge pr #${pr.number}`);
    const mergeResult = await context.github.pulls.merge({
      merge_method: 'squash',
      owner: pr.head.repo.owner.login,
      repo: pr.head.repo.name,
      number: pr.number,
      commit_title: `${pr.title} (#${pr.number})`,
      commit_message: '', // TODO add BC
    });
    context.log.debug('merge result:', mergeResult.data);
    repoContext.removeMergeLocked(context, pr.number);
    return Boolean(mergeResult.data.merged);
  } catch (err) {
    context.log.info('could not merge:', err);
    repoContext.removeMergeLocked(context, pr.number);
    return false;
  }
};
