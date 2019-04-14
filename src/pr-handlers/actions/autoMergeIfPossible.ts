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

  const lockedPrId = repoContext.getMergeLocked();
  if (lockedPrId && lockedPrId !== pr.id) {
    context.log.info(`automerge not possible: locked pr ${pr.id}`);
    repoContext.pushAutomergeQueue(pr.id);
    return false;
  }

  if (!pr.mergeable) {
    if (pr.head.ref.startsWith('renovate/')) {
      context.log.info('automerge not possible: rebase renovate branch');
      // TODO check if has commits not made by renovate https://github.com/ornikar/shared-configs/pull/47#issuecomment-445767120
      if (pr.mergeable_state === 'behind' || pr.mergeable_state === 'dirty') {
        repoContext.addMergeLock(pr.id);
        await context.github.issues.update(
          context.issue({
            body: pr.body.replace(
              '[ ] <!-- renovate-rebase -->',
              '[x] <!-- renovate-rebase -->',
            ),
          }),
        );
        return false;
      } else {
        repoContext.removeMergeLocked(context, pr.id);
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

    repoContext.removeMergeLocked(context, pr.id);
    context.log.info(
      `automerge not possible: not mergeable mergeable_state=${
        pr.mergeable_state
      }`,
    );
    return false;
  }

  repoContext.addMergeLock(pr.id);

  const mergeResult = await context.github.pulls.merge({
    merge_method: 'squash',
    owner: pr.head.repo.owner.login,
    repo: pr.head.repo.name,
    number: pr.number,
    commit_title: `${pr.title} (#${pr.number})`,
    commit_message: '', // TODO add BC
  });
  context.log.debug('merge result:', mergeResult.data);

  return Boolean(mergeResult.data.merged);
};
