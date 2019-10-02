/* eslint-disable max-lines */

import { Lock } from 'lock';
import { Context } from 'probot';
import minimatch from 'minimatch';
import { orgsConfigs, Config } from '../orgsConfigs';
// eslint-disable-next-line import/no-cycle
import { autoMergeIfPossible } from '../pr-handlers/actions/autoMergeIfPossible';
import { initRepoLabels, LabelResponse, Labels } from './initRepoLabels';
import { obtainOrgContext, OrgContext } from './orgContext';

export interface LockedMergePr {
  id: number;
  number: number;
  branch: string;
}

interface RepoContextWithoutTeamContext<GroupNames extends string> {
  labels: Labels;
  protectedLabelIds: readonly LabelResponse['id'][];

  hasNeedsReview: (labels: LabelResponse[]) => boolean;
  hasRequestedReview: (labels: LabelResponse[]) => boolean;
  hasChangesRequestedReview: (labels: LabelResponse[]) => boolean;
  hasApprovesReview: (labels: LabelResponse[]) => boolean;
  getNeedsReviewGroupNames: (labels: LabelResponse[]) => GroupNames[];

  lockPROrPRS(
    prIdOrIds: string | string[],
    callback: () => Promise<void> | void,
  ): Promise<void>;

  getMergeLockedPr(): LockedMergePr;
  addMergeLockPr(pr: LockedMergePr): void;
  removePrFromAutomergeQueue(context: Context<any>, prNumber: number): void;
  reschedule(context: Context<any>, pr: LockedMergePr): void;
  pushAutomergeQueue(pr: LockedMergePr): void;
}

const ExcludesFalsy = (Boolean as any) as <T>(
  x: T | false | null | undefined,
) => x is T;

export type RepoContext<GroupNames extends string = any> = OrgContext<
  GroupNames
> &
  RepoContextWithoutTeamContext<GroupNames>;

async function initRepoContext<GroupNames extends string>(
  context: Context<any>,
  config: Config<GroupNames>,
): Promise<RepoContext<GroupNames>> {
  const orgContext = await obtainOrgContext(context, config);
  const repoContext = Object.create(orgContext);

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

  const protectedLabelIds = [
    ...requestedReviewLabelIds,
    ...changesRequestedLabelIds,
    ...approvedReviewLabelIds,
  ];

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
  let lockMergePr: LockedMergePr | undefined;
  let automergeQueue: LockedMergePr[] = [];

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

  const reschedule = (context: Context<any>, pr: LockedMergePr) => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info('reschedule', pr);
    setTimeout(() => {
      lockPROrPRS('reschedule', () => {
        return lockPROrPRS(String(pr.id), async () => {
          const prResult = await context.github.pulls.get(
            context.repo({
              pull_number: pr.number,
            }),
          );
          await autoMergeIfPossible(prResult.data, context, repoContext);
        });
      });
    }, 1000);
  };

  return Object.assign(repoContext, {
    labels,
    protectedLabelIds,
    hasNeedsReview,
    hasRequestedReview,
    hasChangesRequestedReview,
    hasApprovesReview,
    getNeedsReviewGroupNames,

    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: (pr: LockedMergePr): void => {
      console.log('merge lock: lock', pr);
      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }
      if (lockMergePr) throw new Error('Already have lock');
      lockMergePr = pr;
    },
    removePrFromAutomergeQueue: (context, prNumber: number | string): void => {
      context.log('merge lock: remove', { prNumber });
      if (lockMergePr && String(lockMergePr.number) === String(prNumber)) {
        lockMergePr = automergeQueue.shift();
        context.log('merge lock: next', { lockMergePr });
        if (lockMergePr) {
          reschedule(context, lockMergePr);
        }
      } else {
        automergeQueue = automergeQueue.filter(
          (value) => String(value.number) !== String(prNumber),
        );
      }
    },
    pushAutomergeQueue: (pr: LockedMergePr): void => {
      console.log('merge lock: push queue', {
        pr,
        lockMergePr,
        automergeQueue,
      });
      if (!automergeQueue.some((p) => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
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
  const repo = context.payload.repository;
  const owner = repo.owner;
  const key = repo.id;

  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;

  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);

  const orgConfig = orgsConfigs[owner.login];

  if (!orgConfig) {
    console.warn(owner.login, Object.keys(orgsConfigs));
    return null;
  }

  if (
    (repo.name === 'reviewflow-test' &&
      process.env.REVIEWFLOW_NAME !== 'reviewflow-test') ||
    (orgConfig.ignoreRepoPattern &&
      minimatch(repo.name, orgConfig.ignoreRepoPattern))
  ) {
    console.warn('repo ignored', { owner: repo.owner.login, name: repo.name });
    return null;
  }

  const promise = initRepoContext(context, orgConfig);
  repoContextsPromise.set(key, promise);

  return promise.then((repoContext) => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
