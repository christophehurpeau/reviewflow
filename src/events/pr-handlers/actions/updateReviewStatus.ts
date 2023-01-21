import type { RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { GroupLabels } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from '../utils/PullRequestData';
import type { EventsWithPullRequest } from '../utils/createPullRequestHandler';

interface UpdateForReviewGroup<GroupNames extends string> {
  reviewGroup: GroupNames;
  add?: (GroupLabels | false | undefined)[];
  remove?: (GroupLabels | false | undefined)[];
}

export const updateReviewStatus = async <
  EventName extends EventsWithPullRequest,
  GroupNames extends string = any,
>(
  pullRequest: PullRequestWithDecentData,
  context: ProbotEvent<EventName>,
  repoContext: RepoContext<GroupNames>,
  updates: UpdateForReviewGroup<GroupNames>[],
): Promise<PullRequestLabels> => {
  context.log.debug(
    {
      updates,
    },
    'updateReviewStatus',
  );

  let prLabels: PullRequestLabels = pullRequest.labels;
  if (!updates || updates.length === 0) return prLabels;

  const newLabelNames = new Set<string>(
    prLabels.map((label) => label.name).filter(ExcludesFalsy),
  );

  const toAddNames = new Set<string>();
  const toDeleteNames = new Set<string>();
  const labels = repoContext.labels;

  for (const update of updates) {
    const getLabelFromKey = (
      key: GroupLabels,
    ): undefined | PullRequestLabels[number] => {
      const reviewConfig = repoContext.config.labels.review[update.reviewGroup];
      if (!reviewConfig) return undefined;

      return reviewConfig[key] && labels[reviewConfig[key]]
        ? labels[reviewConfig[key]]
        : undefined;
    };

    if (update.add) {
      for (const key of update.add) {
        const label = key ? getLabelFromKey(key) : undefined;

        if (
          label?.name &&
          !prLabels.some((prLabel) => prLabel.id === label.id)
        ) {
          newLabelNames.add(label.name);
          toAddNames.add(label.name);
        }
      }
    }

    if (update.remove) {
      for (const key of update.remove) {
        const label = key ? getLabelFromKey(key) : undefined;

        if (label) {
          const existing = prLabels.find((prLabel) => prLabel.id === label.id);
          if (existing?.name) {
            newLabelNames.delete(existing.name);
            toDeleteNames.add(existing.name);
          }
        }
      }
    }
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
            toAddNames.add(label.name);
          }
        });
      }
    });
  }

  // if (process.env.DRY_RUN && process.env.DRY_RUN !== 'false') return;

  if (toAddNames.size > 0 || toDeleteNames.size > 0) {
    if (toDeleteNames.size === 0 || toDeleteNames.size < 4) {
      context.log.debug(
        {
          toAddNames: [...toAddNames],
          toDeleteNames: [...toDeleteNames],
        },
        'updateReviewStatus',
      );

      if (toAddNames.size > 0) {
        const result = await context.octokit.issues.addLabels(
          context.repo({
            issue_number: pullRequest.number,
            labels: [...toAddNames],
          }),
        );
        prLabels = result.data;
      }

      if (toDeleteNames.size > 0) {
        for (const toDeleteName of toDeleteNames) {
          try {
            const result = await context.octokit.issues.removeLabel(
              context.repo({
                issue_number: pullRequest.number,
                name: toDeleteName,
              }),
            );
            prLabels = result.data;
          } catch (err: any) {
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
          oldLabels: prLabels.map((l) => l.name),
          newLabelNames: newLabelNamesArray,
        },
        'updateReviewStatus',
      );

      const result = await context.octokit.issues.setLabels(
        context.repo({
          issue_number: pullRequest.number,
          labels: newLabelNamesArray as string[] & { name: string }[],
        }),
      );
      prLabels = result.data;
    }
  }

  return prLabels;
};
