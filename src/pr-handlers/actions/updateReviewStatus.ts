import Webhooks from '@octokit/webhooks';
import { Context, Octokit } from 'probot';
import { LabelResponse } from '../../context/initRepoLabels';
import { GroupLabels } from '../../orgsConfigs/types';
import { RepoContext } from '../../context/repoContext';
import { contextIssue } from '../../context/utils';
import { updateStatusCheckFromLabels } from './updateStatusCheckFromLabels';

export const updateReviewStatus = async <
  E extends { repository: Webhooks.PayloadRepository },
  GroupNames extends string = any
>(
  pr: Octokit.PullsGetResponse,
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

  let prLabels: LabelResponse[] = pr.labels || [];
  if (!reviewGroup) return prLabels;

  const newLabelNames = new Set<string>(
    prLabels.map((label: LabelResponse) => label.name),
  );

  const toAdd = new Set<GroupLabels | string>();
  const toAddNames = new Set<string>();
  const toDelete = new Set<GroupLabels>();
  const toDeleteNames = new Set<string>();
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
      toAddNames.add(label.name);
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
        toDeleteNames.add(existing.name);
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
          toAddNames.add(label.name);
        }
      });
    }
  });

  // if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return;

  if (toAdd.size !== 0 || toDelete.size !== 0) {
    if (toDelete.size === 0 || toDelete.size < 4) {
      context.log.info('updateReviewStatus', {
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        toAddNames: [...toAddNames],
        toDeleteNames: [...toDeleteNames],
      });

      if (toAdd.size !== 0) {
        const result = await context.github.issues.addLabels(
          contextIssue(context, {
            labels: [...toAddNames],
          }),
        );
        prLabels = result.data;
      }

      if (toDelete.size !== 0) {
        for (const toDeleteName of [...toDeleteNames]) {
          try {
            const result = await context.github.issues.removeLabel(
              contextIssue(context, {
                name: toDeleteName,
              }),
            );
            prLabels = result.data;
          } catch (err) {
            context.log.warn('error removing label', {
              err: err?.message,
            });
          }
        }
      }
    } else {
      const newLabelNamesArray = [...newLabelNames];

      context.log.info('updateReviewStatus', {
        reviewGroup,
        toAdd: [...toAdd],
        toDelete: [...toDelete],
        oldLabels: prLabels.map((l: LabelResponse) => l.name),
        newLabelNames: newLabelNamesArray,
      });

      const result = await context.github.issues.replaceLabels(
        contextIssue(context, {
          labels: newLabelNamesArray,
        }),
      );
      prLabels = result.data;
    }
  }

  // if (toAdd.has('needsReview')) {
  //   createInProgressStatusCheck(context);
  // } else if (
  //   toDelete.has('needsReview') ||
  //   (prLabels.length === 0 && toAdd.size === 1 && toAdd.has('approved'))
  // ) {
  await updateStatusCheckFromLabels(pr, context, repoContext, prLabels);
  // }

  return prLabels;
};
