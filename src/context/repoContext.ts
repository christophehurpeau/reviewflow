/* eslint-disable max-lines */

import { Lock } from 'lock';
import { Context } from 'probot';
import { teamConfigs, Config } from '../teamconfigs';
// eslint-disable-next-line import/no-cycle
import { autoMergeIfPossible } from '../pr-handlers/actions/autoMergeIfPossible';
import { initRepoLabels, LabelResponse, Labels } from './initRepoLabels';
import { obtainTeamContext, TeamContext } from './teamContext';

interface RepoContextWithoutTeamContext<GroupNames extends string> {
  labels: Labels;
  protectedLabelIds: LabelResponse['id'][];

  hasNeedsReview: (labels: LabelResponse[]) => boolean;
  hasRequestedReview: (labels: LabelResponse[]) => boolean;
  hasChangesRequestedReview: (labels: LabelResponse[]) => boolean;
  hasApprovesReview: (labels: LabelResponse[]) => boolean;
  getNeedsReviewGroupNames: (labels: LabelResponse[]) => GroupNames[];

  lockPROrPRS(
    prIdOrIds: string | string[],
    callback: () => Promise<void> | void,
  ): Promise<void>;

  getMergeLocked(): number | undefined;
  addMergeLock(prNumber: number): void;
  removeMergeLocked(context: Context<any>, prNumber: number): void;
  reschedule(context: Context<any>, prId: string, prNumber: number): void;
  pushAutomergeQueue(prId: string, prNumber: number): void;
}

const ExcludesFalsy = (Boolean as any) as <T>(
  x: T | false | null | undefined,
) => x is T;

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

  const [labels] = await Promise.all([initRepoLabels(context, config)]);

  const reviewGroupNames = Object.keys(config.groups) as GroupNames[];

  const needsReviewLabelIds = reviewGroupNames
    .map((key: GroupNames) => config.labels.review[key].needsReview)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const requestedReviewLabelIds = reviewGroupNames
    .map((key) => config.labels.review[key].requested)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const changesRequestedLabelIds = reviewGroupNames
    .map((key) => config.labels.review[key].changesRequested)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const approvedReviewLabelIds = reviewGroupNames
    .map((key) => config.labels.review[key].approved)
    .filter(Boolean)
    .map((name) => labels[name].id);

  const labelIdToGroupName = new Map<LabelResponse['id'], GroupNames>();
  reviewGroupNames.forEach((key) => {
    const reviewGroupLabels = config.labels.review[key] as any;
    Object.keys(reviewGroupLabels).forEach((labelKey: string) => {
      labelIdToGroupName.set(labels[reviewGroupLabels[labelKey]].id, key);
    });
  });

  // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const hasNeedsReview = (labels: LabelResponse[]) =>
    labels.some((label) => needsReviewLabelIds.includes(label.id));
  const hasRequestedReview = (labels: LabelResponse[]) =>
    labels.some((label) => requestedReviewLabelIds.includes(label.id));
  const hasChangesRequestedReview = (labels: LabelResponse[]) =>
    labels.some((label) => changesRequestedLabelIds.includes(label.id));
  const hasApprovesReview = (labels: LabelResponse[]) =>
    labels.some((label) => approvedReviewLabelIds.includes(label.id));

  const getNeedsReviewGroupNames = (labels: LabelResponse[]): GroupNames[] =>
    labels
      .filter((label) => needsReviewLabelIds.includes(label.id))
      .map((label) => labelIdToGroupName.get(label.id))
      .filter(ExcludesFalsy);

  const lock = Lock();
  let lockMergePrNumber: number | undefined;
  const automergeQueue: { id: string; number: number }[] = [];

  const lockPROrPRS = (
    prIdOrIds: string | string[],
    callback: () => Promise<void> | void,
  ): Promise<void> =>
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
    });

  const reschedule = (
    context: Context<any>,
    prId: string,
    prNumber: number,
  ) => {
    context.log.info('reschedule', { prNumber });
    setTimeout(() => {
      lockPROrPRS('reschedule', () => {
        return lockPROrPRS(prId, async () => {
          const prResult = await context.github.pulls.get(
            context.repo({
              number: prNumber,
            }),
          );
          await autoMergeIfPossible(context, repoContext, prResult.data);
        });
      });
    }, 1000);
  };

  return Object.assign(repoContext, {
    labels,
    protectedLabelIds: [
      ...requestedReviewLabelIds,
      ...changesRequestedLabelIds,
      ...approvedReviewLabelIds,
    ],
    hasNeedsReview,
    hasRequestedReview,
    hasChangesRequestedReview,
    hasApprovesReview,
    getNeedsReviewGroupNames,

    getMergeLocked: () => lockMergePrNumber,
    addMergeLock: (prNumber): void => {
      console.log('merge lock: lock', { prNumber });
      if (lockMergePrNumber === prNumber) return;
      if (lockMergePrNumber) throw new Error('Already have lock id');
      lockMergePrNumber = prNumber;
    },
    removeMergeLocked: (context, prNumber): void => {
      console.log('merge lock: remove', { prNumber });
      if (lockMergePrNumber !== prNumber) return;
      const next = automergeQueue.shift();
      if (!next) {
        lockMergePrNumber = undefined;
        return;
      }

      console.log('merge lock: next', next);
      reschedule(context, next.id, next.number);
    },
    pushAutomergeQueue: (prId, prNumber): void => {
      console.log('merge lock: push queue', {
        prNumber,
        lockMergePrNumber,
        automergeQueue,
      });
      automergeQueue.push({ id: prId, number: prNumber });
    },
    reschedule,

    lockPROrPRS,
  } as RepoContextWithoutTeamContext<GroupNames>);
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
