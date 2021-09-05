import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { GroupLabels } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from '../utils/PullRequestData';
import { updateStatusCheckFromLabels } from './updateStatusCheckFromLabels';

export const updateReviewStatus = async <
  E extends { repository: EventPayloads.PayloadRepository },
  GroupNames extends string = any,
>(
  pullRequest: PullRequestWithDecentData,
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
): Promise<PullRequestLabels> => {
  context.log.debug(
    {
      reviewGroup,
      labelsToAdd,
      labelsToRemove,
    },
    'updateReviewStatus',
  );

  let prLabels: PullRequestLabels = pullRequest.labels || [];
  if (!reviewGroup) return prLabels;

  const newLabelNames = new Set<string>(
    prLabels.map((label) => label.name).filter(ExcludesFalsy),
  );

  const toAdd = new Set<GroupLabels | string>();
  const toAddNames = new Set<string>();
  const toDelete = new Set<GroupLabels>();
  const toDeleteNames = new Set<string>();
  const labels = repoContext.labels;

  const getLabelFromKey = (
    key: GroupLabels,
  ): undefined | PullRequestLabels[number] => {
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
      if (
        !label ||
        !label.name ||
        prLabels.some((prLabel) => prLabel.id === label.id)
      ) {
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
      if (existing && existing.name) {
        newLabelNames.delete(existing.name);
        toDelete.add(key);
        toDeleteNames.add(existing.name);
      }
    });
  }

  // TODO move that elsewhere
  if (pullRequest.user) {
    repoContext.getTeamsForLogin(pullRequest.user.login).forEach((teamName) => {
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
  }

  // if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return;

  if (toAdd.size > 0 || toDelete.size > 0) {
    if (toDelete.size === 0 || toDelete.size < 4) {
      context.log.debug(
        {
          reviewGroup,
          toAdd: [...toAdd],
          toDelete: [...toDelete],
          toAddNames: [...toAddNames],
          toDeleteNames: [...toDeleteNames],
        },
        'updateReviewStatus',
      );

      if (toAdd.size > 0) {
        const result = await context.octokit.issues.addLabels(
          context.issue({
            labels: [...toAddNames],
          }),
        );
        prLabels = result.data;
      }

      if (toDelete.size > 0) {
        for (const toDeleteName of toDeleteNames) {
          try {
            const result = await context.octokit.issues.removeLabel(
              context.issue({
                name: toDeleteName,
              }),
            );
            prLabels = result.data;
          } catch (err) {
            context.log.warn(
              {
                err: err?.message,
              },
              'error removing label',
            );
          }
        }
      }
    } else {
      const newLabelNamesArray = [...newLabelNames];

      context.log.debug(
        {
          reviewGroup,
          toAdd: [...toAdd],
          toDelete: [...toDelete],
          oldLabels: prLabels.map((l) => l.name),
          newLabelNames: newLabelNamesArray,
        },
        'updateReviewStatus',
      );

      const result = await context.octokit.issues.setLabels(
        context.issue({
          labels: newLabelNamesArray as string[] & { name: string }[],
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
  await updateStatusCheckFromLabels(
    pullRequest,
    context,
    repoContext,
    prLabels,
  );
  // }

  return prLabels;
};
