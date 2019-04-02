import { Context } from 'probot';
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

  if (!pr.mergeable) {
    context.log.debug('automerge not possible: not mergeable');
    return false;
  }

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
