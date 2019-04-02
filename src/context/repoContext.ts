/* eslint-disable max-lines */

import Webhooks from '@octokit/webhooks';
import { Lock } from 'lock';
import { Context } from 'probot';
import { teamConfigs, Config } from '../teamconfigs';
import { GroupLabels } from '../teamconfigs/types';
import { initRepoLabels, LabelResponse, Labels } from './initRepoLabels';
import { obtainTeamContext, TeamContext } from './teamContext';

interface RepoContextWithoutTeamContext<GroupNames extends string = any> {
  labels: Labels;

  hasNeedsReview: (labels: LabelResponse[]) => boolean;
  hasRequestedReview: (labels: LabelResponse[]) => boolean;
  hasApprovesReview: (labels: LabelResponse[]) => boolean;

  updateStatusCheckFromLabels<E>(
    context: Context<E>,
    labels?: LabelResponse[],
  ): Promise<void>;

  lockPROrPRS(
    prIdOrIds: string | string[],
    callback: () => Promise<void> | void,
  ): Promise<void>;

  updateReviewStatus<E extends Webhooks.WebhookPayloadPullRequest>(
    context: Context<E>,
    reviewGroup: GroupNames | undefined,
    {
      add: labelsToAdd,
      remove: labelsToRemove,
    }: {
      add?: (GroupLabels | false | undefined)[];
      remove?: (GroupLabels | false | undefined)[];
    },
  ): Promise<LabelResponse[]>;

  addStatusCheckToLatestCommit<E>(context: Context<E>): Promise<void>;
}

export type RepoContext<GroupNames extends string = any> = TeamContext<
  GroupNames
> &
  RepoContextWithoutTeamContext<GroupNames>;

async function initRepoContext<GroupNames extends string>(
  context: Context<any>,
  config: Config<GroupNames>,
): Promise<RepoContext<GroupNames>> {
  const teamContext = await obtainTeamContext(context, config);
  const repoContext = Object.create(teamContext);

  const labels = await initRepoLabels(context, config);
  const reviewKeys = Object.keys(config.groups) as GroupNames[];

  const needsReviewLabelIds = reviewKeys
    .map((key) => config.labels.review[key].needsReview)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const requestedReviewLabelIds = reviewKeys
    .map((key) => config.labels.review[key].requested)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const approvedReviewLabelIds = reviewKeys
    .map((key) => config.labels.review[key].approved)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const addStatusCheck = async function<
    E extends Webhooks.WebhookPayloadPullRequest
  >(context: Context<E>, statusInfo: any): Promise<void> {
    const pr = context.payload.pull_request;

    await context.github.checks.create(
      context.repo({
        name: process.env.NAME,
        head_sha: pr.head.sha,
        ...statusInfo,
      }),
    );
  };

  const createInProgressStatusCheck = <
    E extends Webhooks.WebhookPayloadPullRequest
  >(
    context: Context<E>,
  ): Promise<void> =>
    addStatusCheck(context, {
      status: 'in_progress',
    });

  const createFailedStatusCheck = <
    E extends Webhooks.WebhookPayloadPullRequest
  >(
    context: Context<E>,
    message: string,
  ): Promise<void> =>
    addStatusCheck(context, {
      status: 'completed',
      conclusion: 'failure',
      started_at: context.payload.pull_request.created_at,
      completed_at: new Date(),
      output: {
        title: message,
        summary: '',
      },
    });

  const createDoneStatusCheck = (context: Context): Promise<void> =>
    addStatusCheck(context, {
      status: 'completed',
      conclusion: 'success',
      started_at: context.payload.pull_request.created_at,
      completed_at: new Date(),
      output: {
        title: '✓ All reviews done !',
        summary: 'Pull request was successfully reviewed',
      },
    });

  // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const hasNeedsReview = (labels: LabelResponse[]) =>
    labels.some((label) => needsReviewLabelIds.includes(label.id));
  const hasRequestedReview = (labels: LabelResponse[]) =>
    labels.some((label) => requestedReviewLabelIds.includes(label.id));
  const hasApprovesReview = (labels: LabelResponse[]) =>
    labels.some((label) => approvedReviewLabelIds.includes(label.id));

  const updateStatusCheckFromLabels = async (
    context: Context,
    labels: LabelResponse[] = context.payload.pull_request.labels || [],
  ): Promise<void> => {
    context.log.info('updateStatusCheckFromLabels', {
      labels: labels.map((l) => l && l.name),
      hasNeedsReview: hasNeedsReview(labels),
      hasApprovesReview: hasApprovesReview(labels),
    });

    if (hasNeedsReview(labels)) {
      if (config.requiresReviewRequest && !hasRequestedReview(labels)) {
        await createFailedStatusCheck(
          context,
          'You need to request someone to review the PR',
        );
        return;
      }
      await createInProgressStatusCheck(context);
    } else if (hasApprovesReview(labels)) {
      await createDoneStatusCheck(context);
    }
  };

  const lock = Lock();

  return Object.assign(repoContext, {
    labels,
    updateStatusCheckFromLabels,
    hasNeedsReview,
    hasRequestedReview,
    hasApprovesReview,

    lockPROrPRS: (prIdOrIds, callback): Promise<void> =>
      new Promise((resolve, reject) => {
        console.log('lock: try to lock pr', { prIdOrIds });
        lock(prIdOrIds, async (createReleaseCallback) => {
          const release = createReleaseCallback(() => {});
          console.log('lock: lock acquired', { prIdOrIds });
          try {
            await callback();
          } catch (err) {
            console.log('lock: release pr (with error)', { prIdOrIds });
            release();
            reject(err);
            return;
          }
          console.log('lock: release pr', { prIdOrIds });
          release();
          resolve();
        });
      }),

    updateReviewStatus: async (
      context,
      reviewGroup: GroupNames,
      { add: labelsToAdd, remove: labelsToRemove },
    ): Promise<LabelResponse[]> => {
      context.log.info('updateReviewStatus', {
        reviewGroup,
        labelsToAdd,
        labelsToRemove,
      });

      let prLabels = context.payload.pull_request.labels || [];
      if (!reviewGroup) return prLabels;

      const newLabelNames = new Set<string>(
        prLabels.map((label: LabelResponse) => label.name),
      );

      const toAdd = new Set<GroupLabels>();
      const toDelete = new Set<GroupLabels>();

      const getLabelFromKey = (key: GroupLabels): undefined | LabelResponse => {
        const reviewConfig = config.labels.review[reviewGroup];
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
            prLabels.some((prLabel: LabelResponse) => prLabel.id === label.id)
          ) {
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
          const existing = prLabels.find(
            (prLabel: LabelResponse) => prLabel.id === label.id,
          );
          if (existing) {
            newLabelNames.delete(existing.name);
            toDelete.add(key);
          }
        });
      }

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
      await updateStatusCheckFromLabels(context, prLabels);
      // }

      return prLabels;
    },

    addStatusCheckToLatestCommit: (context) =>
      // old and new sha
      // const { before, after } = context.payload;
      updateStatusCheckFromLabels(context),
  } as RepoContextWithoutTeamContext);
}

const repoContextsPromise = new Map<number, Promise<RepoContext>>();
const repoContexts = new Map<number, RepoContext>();

export const obtainRepoContext = (
  context: Context<any>,
): Promise<RepoContext> | RepoContext | null => {
  const owner = context.payload.repository.owner;
  if (!teamConfigs[owner.login]) {
    console.warn(owner.login, Object.keys(teamConfigs));
    return null;
  }
  const key = context.payload.repository.id;

  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;

  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);

  const promise = initRepoContext(context, teamConfigs[owner.login]);
  repoContextsPromise.set(key, promise);

  return promise.then((repoContext) => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
