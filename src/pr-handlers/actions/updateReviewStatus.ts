import Webhooks from '@octokit/webhooks';
import { Context } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { GroupLabels } from '../../orgsConfigs/types';
import { RepoContext } from '../../context/repoContext';
import { updateStatusCheckFromLabels } from './updateStatusCheckFromLabels';

export const updateReviewStatus = async <
  E extends Webhooks.WebhookPayloadPullRequest,
  GroupNames extends string = any
>(
  context: Context<E>,
  repoContext: RepoContext,
  reviewGroup: GroupNames,
  {
    add: labelsToAdd,
    remove: labelsToRemove,
  }: {
    add?: (GroupLabels | false | undefined)[];
    remove?: (GroupLabels | false | undefined)[];
  },
): Promise<LabelResponse[]> => {
  context.log.info('updateReviewStatus', {
    reviewGroup,
    labelsToAdd,
    labelsToRemove,
  });

  const pr = context.payload.pull_request;
  let prLabels: LabelResponse[] = pr.labels || [];
  if (!reviewGroup) return prLabels;

  const newLabelNames = new Set<string>(
    prLabels.map((label: LabelResponse) => label.name),
  );

  const toAdd = new Set<GroupLabels | string>();
  const toDelete = new Set<GroupLabels>();
  const labels = repoContext.labels;

  const getLabelFromKey = (key: GroupLabels): undefined | LabelResponse => {
    const reviewConfig = repoContext.config.labels.review[reviewGroup];
    if (!reviewConfig) return undefined;

    return reviewConfig[key] && labels[reviewConfig[key]]
      ? labels[reviewConfig[key]]
      : undefined;
  };

  if (labelsToAdd) {
    labelsToAdd.forEach((key) => {
      if (!key) return;
      const label = getLabelFromKey(key);
      if (!label || prLabels.some((prLabel) => prLabel.id === label.id)) {
        return;
      }
      newLabelNames.add(label.name);
      toAdd.add(key);
    });
  }

  if (labelsToRemove) {
    labelsToRemove.forEach((key) => {
      if (!key) return;
      const label = getLabelFromKey(key);
      if (!label) return;
      const existing = prLabels.find((prLabel) => prLabel.id === label.id);
      if (existing) {
        newLabelNames.delete(existing.name);
        toDelete.add(key);
      }
    });
  }

  // TODO move that elsewhere

  repoContext.getTeamsForLogin(pr.user.login).forEach((teamName) => {
    const team = repoContext.config.teams[teamName];
    if (team.labels) {
      team.labels.forEach((labelKey) => {
        const label = repoContext.labels[labelKey];
        if (label && !prLabels.some((prLabel) => prLabel.id === label.id)) {
          newLabelNames.add(label.name);
          toAdd.add(labelKey);
        }
      });
    }
  });

  const newLabelNamesArray = [...newLabelNames];

  context.log.info('updateReviewStatus', {
    reviewGroup,
    toAdd: [...toAdd],
    toDelete: [...toDelete],
    oldLabels: prLabels.map((l: LabelResponse) => l.name),
    newLabelNames: newLabelNamesArray,
  });

  // if (process.env.DRY_RUN) return;

  if (toAdd.size || toDelete.size) {
    const result = await context.github.issues.replaceLabels(
      context.issue({
        labels: newLabelNamesArray,
      }),
    );
    prLabels = result.data;
  }

  // if (toAdd.has('needsReview')) {
  //   createInProgressStatusCheck(context);
  // } else if (
  //   toDelete.has('needsReview') ||
  //   (prLabels.length === 0 && toAdd.size === 1 && toAdd.has('approved'))
  // ) {
  await updateStatusCheckFromLabels(context, repoContext, pr, prLabels);
  // }

  return prLabels;
};
