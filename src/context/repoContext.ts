import { Lock } from 'lock';
import { Context } from 'probot';
import { fetchPr } from '../events/pr-handlers/utils/fetchPr';
import { accountConfigs, Config, defaultConfig } from '../accountConfigs';
// eslint-disable-next-line import/no-cycle
import { autoMergeIfPossibleOptionalPrContext } from '../events/pr-handlers/actions/autoMergeIfPossible';
import { ExcludesFalsy } from '../utils/ExcludesFalsy';
import { AppContext } from './AppContext';
import { initRepoLabels, LabelResponse, Labels } from './initRepoLabels';
import { obtainAccountContext, AccountContext } from './accountContext';
import { getEmojiFromRepoDescription } from './utils';

export interface LockedMergePr {
  id: number;
  number: number;
  branch: string;
}

interface RepoContextWithoutTeamContext<GroupNames extends string> {
  repoFullName: string;
  repoEmbed: { id: number; name: string };
  repoEmoji: string | undefined;
  labels: Labels;
  protectedLabelIds: readonly LabelResponse['id'][];

  hasNeedsReview: (labels: LabelResponse[]) => boolean;
  hasRequestedReview: (labels: LabelResponse[]) => boolean;
  hasChangesRequestedReview: (labels: LabelResponse[]) => boolean;
  hasApprovesReview: (labels: LabelResponse[]) => boolean;
  getNeedsReviewGroupNames: (labels: LabelResponse[]) => GroupNames[];

  lockPR(
    prId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ): Promise<void>;

  getMergeLockedPr(): LockedMergePr;
  addMergeLockPr(pr: LockedMergePr): void;
  removePrFromAutomergeQueue(
    context: Context<any>,
    prNumber: number,
    reason: string,
  ): void;
  reschedule(context: Context<any>, pr: LockedMergePr): void;
  pushAutomergeQueue(pr: LockedMergePr): void;
}

export type RepoContext<GroupNames extends string = any> = AccountContext<
  GroupNames
> &
  RepoContextWithoutTeamContext<GroupNames>;

async function initRepoContext<GroupNames extends string>(
  appContext: AppContext,
  context: Context<any>,
  config: Config<GroupNames>,
): Promise<RepoContext<GroupNames>> {
  const {
    id,
    name,
    full_name: fullName,
    owner: org,
    description,
  } = context.payload.repository;
  const repoEmoji = getEmojiFromRepoDescription(description);

  const accountContext = await obtainAccountContext(
    appContext,
    context,
    config,
    org,
  );
  const repoContext = Object.create(accountContext);

  const labels = await initRepoLabels(context, config);

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

  const lockPR = (
    prOPrIssueId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const logInfos = {
        repo: fullName,
        prOPrIssueId,
        prNumber,
      };
      context.log.debug('lock: try to lock pr', logInfos);
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      lock(String(prNumber), async (createReleaseCallback) => {
        const release = createReleaseCallback(() => {});
        context.log.info('lock: lock pr acquired', logInfos);
        try {
          await callback();
        } catch (err) {
          context.log.info('lock: release pr (with error)', logInfos);
          release();
          reject(err);
          return;
        }
        context.log.info('lock: release pr', logInfos);
        release();
        resolve();
      });
    });

  const reschedule = (context: Context<any>, pr: LockedMergePr) => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info('reschedule', pr);
    setTimeout(() => {
      lockPR('reschedule', pr.number, () => {
        return lockPR(String(pr.id), pr.number, async () => {
          const updatedPr = await fetchPr(context, pr.number);
          await autoMergeIfPossibleOptionalPrContext(
            appContext,
            repoContext,
            updatedPr,
            context,
          );
        });
      });
    }, 10000);
  };

  return Object.assign(repoContext, {
    labels,
    repoFullName: fullName,
    repoEmbed: { id, name },
    repoEmoji,
    protectedLabelIds,
    hasNeedsReview,
    hasRequestedReview,
    hasChangesRequestedReview,
    hasApprovesReview,
    getNeedsReviewGroupNames,

    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: (pr: LockedMergePr): void => {
      console.log('merge lock: lock', {
        repo: fullName,
        pr,
      });
      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }
      if (lockMergePr) throw new Error('Already have lock');
      lockMergePr = pr;
    },
    removePrFromAutomergeQueue: (
      context,
      prNumber: number | string,
      reason: string,
    ): void => {
      if (lockMergePr && String(lockMergePr.number) === String(prNumber)) {
        lockMergePr = automergeQueue.shift();
        context.log(`merge lock: remove ${fullName}#${prNumber}: ${reason}`);
        context.log(`merge lock: next ${fullName}`, lockMergePr);
        if (lockMergePr) {
          reschedule(context, lockMergePr);
        }
      } else {
        const previousLength = automergeQueue.length;
        automergeQueue = automergeQueue.filter(
          (value) => String(value.number) !== String(prNumber),
        );
        if (automergeQueue.length !== previousLength) {
          context.log(`merge lock: remove ${fullName}#${prNumber}: ${reason}`);
        }
      }
    },
    pushAutomergeQueue: (pr: LockedMergePr): void => {
      context.log('merge lock: push queue', {
        repo: fullName,
        pr,
        lockMergePr,
        automergeQueue,
      });
      if (!automergeQueue.some((p) => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
    },
    reschedule,

    lockPR,
  } as RepoContextWithoutTeamContext<GroupNames>);
}

const repoContextsPromise = new Map<number, Promise<RepoContext>>();
const repoContexts = new Map<number, RepoContext>();

export const shouldIgnoreRepo = (
  repoName: string,
  accountConfig: Config<any, any>,
): boolean => {
  const ignoreRepoRegexp =
    accountConfig.ignoreRepoPattern &&
    new RegExp(`^${accountConfig.ignoreRepoPattern}$`);

  if (repoName === 'reviewflow-test') {
    return process.env.REVIEWFLOW_NAME !== 'reviewflow-dev';
  }

  if (ignoreRepoRegexp) {
    return ignoreRepoRegexp.test(repoName);
  }

  return false;
};

export const obtainRepoContext = (
  appContext: AppContext,
  context: Context<any>,
): Promise<RepoContext> | RepoContext | null => {
  const repo = context.payload.repository;
  const owner = repo.owner;
  const key = repo.id;

  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;

  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);

  let accountConfig = accountConfigs[owner.login];

  if (!accountConfig) {
    console.warn(`using default config for ${owner.login}`);
    accountConfig = defaultConfig as Config<any, any>;
  }

  if (shouldIgnoreRepo(repo.name, accountConfig)) {
    console.warn('repo ignored', { owner: repo.owner.login, name: repo.name });
    return null;
  }

  const promise = initRepoContext(appContext, context, accountConfig);
  repoContextsPromise.set(key, promise);

  return promise.then((repoContext) => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
