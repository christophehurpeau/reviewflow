/* eslint-disable max-lines */
import type { EmitterWebhookEventName } from '@octokit/webhooks';
import { Lock } from 'lock';
import type { Config } from '../accountConfigs';
import { accountConfigs, defaultConfig } from '../accountConfigs';
import type { GroupLabels } from '../accountConfigs/types';
import { autoMergeIfPossible } from '../events/pr-handlers/actions/autoMergeIfPossible';
import { parseRepositoryOptions } from '../events/pr-handlers/actions/utils/body/repositoryOptions';
import type {
  PullRequestDataMinimumData,
  PullRequestLabels,
} from '../events/pr-handlers/utils/PullRequestData';
import { getReviewflowPrContext } from '../events/pr-handlers/utils/createPullRequestContext';
import { fetchPr } from '../events/pr-handlers/utils/fetchPr';
import type { ProbotEvent } from '../events/probot-types';
import type { RepositoryMergeQueue, Repository } from '../mongo';
import { ExcludesFalsy } from '../utils/Excludes';
import type { AppContext } from './AppContext';
import type { AccountContext } from './accountContext';
import { obtainAccountContext } from './accountContext';
import type { LabelResponse, LabelsRecord } from './initRepoLabels';
import { initRepoLabels } from './initRepoLabels';
import { getKeys, getEmojiFromRepoDescription } from './utils';

export interface LockedMergePr {
  id: number;
  number: number;
  branch: string;
}

export type CustomExtract<T, U extends T> = U;

export type EventsWithRepository = CustomExtract<
  EmitterWebhookEventName,
  | 'pull_request.assigned'
  | 'pull_request.auto_merge_disabled'
  | 'pull_request.auto_merge_enabled'
  | 'pull_request.closed'
  | 'pull_request.converted_to_draft'
  | 'pull_request.edited'
  | 'pull_request.labeled'
  | 'pull_request.locked'
  | 'pull_request.opened'
  | 'pull_request.ready_for_review'
  | 'pull_request.reopened'
  | 'pull_request.review_request_removed'
  | 'pull_request.review_requested'
  | 'pull_request.synchronize'
  | 'pull_request.unassigned'
  | 'pull_request.unlabeled'
  | 'pull_request.unlocked'
  | 'pull_request_review.dismissed'
  | 'pull_request_review.edited'
  | 'pull_request_review.submitted'
  | 'pull_request_review_comment'
  | 'pull_request_review_comment.created'
  | 'pull_request_review_comment.deleted'
  | 'pull_request_review_comment.edited'
  | 'push'
  | 'repository.archived'
  | 'repository.created'
  | 'repository.deleted'
  | 'repository.edited'
  | 'repository.privatized'
  | 'repository.publicized'
  | 'repository.renamed'
  | 'repository.transferred'
  | 'repository.unarchived'
  | 'status'
  | 'issue_comment.created'
  | 'issue_comment.deleted'
  | 'issue_comment.edited'
  | 'commit_comment.created'
  // | 'commit_comment.deleted'
  // | 'commit_comment.edited'
  | 'check_run.completed'
  | 'check_suite.completed'
  | 'status'
>;

type RescheduleTime = 'short' | 'long+timeout';

interface RepoContextWithoutTeamContext<GroupNames extends string> {
  appContext: AppContext;
  repoFullName: string;
  repoEmbed: { id: number; name: string };
  repoEmoji: string | undefined;
  defaultBranch: string;
  labels: LabelsRecord;
  protectedLabelIds: readonly LabelResponse['id'][];
  shouldIgnore: boolean;

  hasNeedsReview: (labels: PullRequestLabels) => boolean;
  hasRequestedReview: (labels: PullRequestLabels) => boolean;
  hasChangesRequestedReview: (labels: PullRequestLabels) => boolean;
  hasApprovesReview: (labels: PullRequestLabels) => boolean;
  getNeedsReviewGroupNames: (labels: PullRequestLabels) => GroupNames[];
  lockPullRequest: (
    eventName: string,
    pullRequest: PullRequestDataMinimumData,
    callback: () => Promise<void> | void,
  ) => Promise<void>;

  /** @deprecated */
  lockPR: (
    eventName: string,
    prId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ) => Promise<void>;

  getMergeLockedPr: () => LockedMergePr;
  addMergeLockPr: (pr: LockedMergePr) => Promise<void>;
  removePrFromAutomergeQueue: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: PullRequestDataMinimumData,
    reason: string,
  ) => Promise<void>;
  reschedule: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: PullRequestDataMinimumData,
    time: RescheduleTime,
  ) => Promise<void>;
  rescheduleOnChecksUpdated: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: PullRequestDataMinimumData,
    isSuccessful: boolean,
  ) => Promise<void>;
  pushAutomergeQueue: (pr: LockedMergePr) => Promise<void>;
}

export type RepoContext<GroupNames extends string = any> =
  AccountContext<GroupNames> & RepoContextWithoutTeamContext<GroupNames>;

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

const createGetReviewLabelIds = <GroupNames extends string>(
  shouldIgnore: boolean,
  config: Config<GroupNames>,
  reviewGroupNames: GroupNames[],
  labels: LabelsRecord,
): ((labelKey: GroupLabels) => number[]) => {
  if (shouldIgnore) return (labelKey: GroupLabels): number[] => [];
  return (labelKey: GroupLabels): number[] =>
    reviewGroupNames
      .map((key) => config.labels.review[key][labelKey])
      .filter(Boolean)
      .map((name) => labels[name].id);
};

export const allRepoContexts = new Map<string, RepoContext<any>>();

async function initRepoContext<
  T extends EventsWithRepository,
  GroupNames extends string,
>(
  appContext: AppContext,
  context: ProbotEvent<T>,
  config: Config<GroupNames>,
): Promise<RepoContext<GroupNames>> {
  const {
    id,
    name,
    full_name: fullName,
    owner: org,
    description,
  } = context.payload.repository;

  const accountContext = await obtainAccountContext<T>(
    appContext,
    context,
    config,
    org,
  );
  const repoContext = Object.create(accountContext) as RepoContext<GroupNames>;

  const shouldIgnore = shouldIgnoreRepo(name, config);

  const findOrCreateRepository = async (): Promise<Repository> => {
    const res = await appContext.mongoStores.repositories.findByKey(id, {
      'account.id': accountContext.accountEmbed.id,
    });

    if (res) {
      return res;
    }

    const repoEmoji = getEmojiFromRepoDescription(description);
    return appContext.mongoStores.repositories.insertOne({
      _id: id,
      account: accountContext.accountEmbed,
      emoji: repoEmoji,
      fullName,
      options: parseRepositoryOptions(context.payload.repository),
    });
  };
  const findOrCreateRepositoryMergeQueue =
    async (): Promise<RepositoryMergeQueue> => {
      const res = await appContext.mongoStores.repositoryMergeQueue.findOne({
        'account.id': accountContext.accountEmbed.id,
        'repo.id': id,
      });

      if (res) {
        return res;
      }

      return appContext.mongoStores.repositoryMergeQueue.insertOne({
        account: accountContext.accountEmbed,
        repo: { id, name },
        queue: [],
      });
    };

  const [repoLabels, repository, repositoryMergeQueue] = await Promise.all([
    shouldIgnore ? {} : initRepoLabels(context, config),
    findOrCreateRepository(),
    findOrCreateRepositoryMergeQueue(),
  ]);

  const reviewGroupNames = getKeys(config.groups);
  const getReviewLabelIds = createGetReviewLabelIds(
    shouldIgnore,
    config,
    reviewGroupNames,
    repoLabels,
  );

  const needsReviewLabelIds = getReviewLabelIds('needsReview');
  const requestedReviewLabelIds = getReviewLabelIds('requested');
  const changesRequestedLabelIds = getReviewLabelIds('changesRequested');
  const approvedReviewLabelIds = getReviewLabelIds('approved');

  const protectedLabelIds = [
    ...requestedReviewLabelIds,
    ...changesRequestedLabelIds,
    ...approvedReviewLabelIds,
  ];

  const labelIdToGroupName = new Map<LabelResponse['id'], GroupNames>();
  if (!shouldIgnore) {
    reviewGroupNames.forEach((key) => {
      const reviewGroupLabels = config.labels.review[key];
      getKeys(reviewGroupLabels).forEach((labelKey) => {
        labelIdToGroupName.set(
          (repoLabels as any)[reviewGroupLabels[labelKey]].id,
          key,
        );
      });
    });
  }

  // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const hasNeedsReview = (labels: PullRequestLabels): boolean =>
    labels.some((label) => label.id && needsReviewLabelIds.includes(label.id));
  const hasRequestedReview = (labels: PullRequestLabels): boolean =>
    labels.some(
      (label) => label.id && requestedReviewLabelIds.includes(label.id),
    );
  const hasChangesRequestedReview = (labels: PullRequestLabels): boolean =>
    labels.some(
      (label) => label.id && changesRequestedLabelIds.includes(label.id),
    );
  const hasApprovesReview = (labels: PullRequestLabels): boolean =>
    labels.some(
      (label) => label.id && approvedReviewLabelIds.includes(label.id),
    );

  const getNeedsReviewGroupNames = (labels: PullRequestLabels): GroupNames[] =>
    labels
      .filter((label) => label.id && needsReviewLabelIds.includes(label.id))
      .map((label) => labelIdToGroupName.get(label.id!))
      .filter(ExcludesFalsy);

  const lock = Lock();
  const waitingToReschedule = new Map<string, ReturnType<typeof setTimeout>>();

  let automergeQueue: LockedMergePr[] = repositoryMergeQueue.queue;

  if (automergeQueue.length > 0) {
    setTimeout(() => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define, @typescript-eslint/no-floating-promises
      reschedule(context, automergeQueue[0], 'short');
    }, 10);
  }

  const updateAutomergeQueueInDb = async (
    newQueue: LockedMergePr[],
  ): Promise<void> => {
    automergeQueue = newQueue;
    await appContext.mongoStores.repositoryMergeQueue.partialUpdateByKey(
      repositoryMergeQueue._id,
      {
        $set: {
          queue: automergeQueue,
        },
      },
    );
  };

  const clearWaitingToReschedule = (prId: number): void => {
    const prIdAsString = String(prId);
    const timeout = waitingToReschedule.get(prIdAsString);
    if (timeout) {
      clearTimeout(timeout);
      waitingToReschedule.delete(prIdAsString);
    }
  };

  const lockPR = (
    eventName: string,
    prOrPrIssueId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const prNumberAsString = String(prNumber);
      const logInfos = {
        eventName,
        repo: fullName,
        prOrPrIssueId,
        prNumber,
      };
      context.log.debug(logInfos, 'lock: try to lock pr');
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      lock(prNumberAsString, async (createReleaseCallback) => {
        const release = createReleaseCallback(() => {});
        context.log.info(logInfos, 'lock: lock pr acquired');
        try {
          await callback();
        } catch (err) {
          context.log.info(logInfos, 'lock: release pr (with error)');
          release();
          reject(err);
          return;
        }
        context.log.info(logInfos, 'lock: release pr');
        release();
        resolve();
      });
    });

  const lockPullRequest = (
    eventName: string,
    pullRequest: PullRequestDataMinimumData,
    callback: () => Promise<void> | void,
  ): Promise<void> => {
    return lockPR(
      eventName,
      String(pullRequest.id),
      pullRequest.number,
      callback,
    );
  };

  const removePrFromAutomergeQueue = async (
    removePrContext: ProbotEvent<any>,
    pr: PullRequestDataMinimumData,
    reason: string,
  ): Promise<void> => {
    let lockMergePr = automergeQueue[0];
    if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
      removePrContext.log(
        `merge lock: remove ${fullName}#${pr.number}: ${reason}`,
      );
      automergeQueue.shift();
      lockMergePr = automergeQueue[0];
      if (!lockMergePr) {
        removePrContext.log(`merge lock: nothing next ${fullName}`);
        await updateAutomergeQueueInDb(automergeQueue);
      } else {
        removePrContext.log(lockMergePr, `merge lock: next ${fullName}`);
        await Promise.all([
          // eslint-disable-next-line @typescript-eslint/no-use-before-define
          reschedule(removePrContext, lockMergePr, 'short'),
          updateAutomergeQueueInDb(automergeQueue),
        ]);
      }
    } else {
      const previousLength = automergeQueue.length;
      automergeQueue = automergeQueue.filter(
        (value) => String(value.number) !== String(pr.number),
      );
      if (automergeQueue.length !== previousLength) {
        removePrContext.log(
          `merge lock: remove ${fullName}#${pr.number}: ${reason}`,
        );
        await updateAutomergeQueueInDb(automergeQueue);
        // TODO update status check in PR
      }
    }
  };

  const reschedule = async (
    rescheduleContext: ProbotEvent<any>,
    pr: PullRequestDataMinimumData,
    time: RescheduleTime,
  ): Promise<void> => {
    if (!pr) throw new Error('Cannot reschedule undefined');

    clearWaitingToReschedule(pr.id);
    rescheduleContext.log.info(pr, 'reschedule', { time });
    const timeout = setTimeout(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        lockPR('reschedule', 'reschedule', -1, () => {
          return lockPR('reschedule', String(pr.id), pr.number, async () => {
            try {
              const [pullRequest, reviewflowPrContext] = await Promise.all([
                fetchPr(context, pr.number),
                getReviewflowPrContext(pr, rescheduleContext, repoContext),
              ]);
              const didMerge = await autoMergeIfPossible(
                pullRequest,
                rescheduleContext,
                repoContext,
                reviewflowPrContext,
              );
              if (!didMerge && time === 'long+timeout') {
                await removePrFromAutomergeQueue(
                  rescheduleContext,
                  pr,
                  'reschedule: !didMerge && longTime => abort lock',
                );
              }
            } catch (err) {
              await removePrFromAutomergeQueue(
                rescheduleContext,
                pr,
                'reschedule: error caught, removing from queue',
              );
              throw err;
            }
          });
        });
      },
      time === 'long+timeout' ? 60_000 * 10 /* 10 min */ : 10_000 /* 10s */,
    );
    waitingToReschedule.set(String(pr.id), timeout);
  };

  const rescheduleOnChecksUpdated = async (
    rescheduleContext: ProbotEvent<any>,
    pr: PullRequestDataMinimumData,
    isSuccessful: boolean,
  ): Promise<void> => {
    // - if already in queue and locked pr is another PR
    const lockedPr = repoContext.getMergeLockedPr();
    if (
      lockedPr &&
      String(lockedPr.number) !== String(pr.number) &&
      automergeQueue.some((item) => item.number === pr.number)
    ) {
      // Note: some unsucessful checks are ignored, so we should not remove the PR from queue here
      // if (!isSuccessful) {
      //   await removePrFromAutomergeQueue(
      //     rescheduleContext,
      //     pr,
      //     'check not successful',
      //   );
      // }

      // no need to reschedule: will reschedule when queue will get to this PR.
      return;
    }

    if (isSuccessful) {
      // - if is merge locked => will run automerge and might merge
      // - if not in queue => might add it back if other conditions are met
      // TODO: save condition in mongo to avoid rescheduling if not necessary
      await reschedule(rescheduleContext, pr, 'short');
    } else {
      // remove from queue as the check was not successful
      // Note: some unsucessful checks are ignored, so we should not remove the PR from queue here
      await reschedule(rescheduleContext, pr, 'short');
      // await removePrFromAutomergeQueue(
      //   rescheduleContext,
      //   pr,
      //   'check not successful',
      // );
    }
  };

  return Object.assign(repoContext, {
    appContext,
    labels: repoLabels,
    repoFullName: fullName,
    repoEmbed: { id, name },
    repoEmoji: repository.emoji,
    defaultBranch: context.payload.repository.default_branch,
    protectedLabelIds,
    shouldIgnore,
    hasNeedsReview,
    hasRequestedReview,
    hasChangesRequestedReview,
    hasApprovesReview,
    getNeedsReviewGroupNames,

    getMergeLockedPr: () => automergeQueue[0],
    addMergeLockPr: async (pr: LockedMergePr): Promise<void> => {
      // eslint-disable-next-line no-console
      console.log('merge lock: lock', {
        repo: fullName,
        pr,
      });
      const lockMergePr = automergeQueue[0];
      if (lockMergePr && String(lockMergePr.number) === String(pr.number)) {
        return;
      }
      if (lockMergePr) throw new Error('Already have lock');
      await updateAutomergeQueueInDb([pr]);
    },
    removePrFromAutomergeQueue,
    pushAutomergeQueue: async (pr: LockedMergePr): Promise<void> => {
      context.log(
        {
          repo: fullName,
          pr,
          automergeQueue,
        },
        'merge lock: push queue',
      );
      if (!automergeQueue.some((p) => p.number === pr.number)) {
        automergeQueue.push(pr);
        await updateAutomergeQueueInDb(automergeQueue);
      }
    },
    reschedule,
    rescheduleOnChecksUpdated,

    lockPR,
    lockPullRequest,
  } as RepoContextWithoutTeamContext<GroupNames>);
}

const repoContextsPromise = new Map<number, Promise<RepoContext>>();
const repoContexts = new Map<number, RepoContext>();

export const obtainRepoContext = <T extends EventsWithRepository>(
  appContext: AppContext,
  context: ProbotEvent<T>,
): Promise<RepoContext> | RepoContext => {
  const repo = context.payload.repository;
  const owner = repo.owner;
  const key = repo.id;

  const existingRepoContext = repoContexts.get(key);
  if (existingRepoContext) return existingRepoContext;

  const existingPromise = repoContextsPromise.get(key);
  if (existingPromise) return Promise.resolve(existingPromise);

  let accountConfig = accountConfigs[owner.login];

  if (!accountConfig) {
    context.log(`using default config for ${owner.login}`);
    accountConfig = defaultConfig as Config<any, any>;
  }

  const promise = initRepoContext(appContext, context, accountConfig);
  repoContextsPromise.set(key, promise);

  return promise.then((repoContext) => {
    repoContextsPromise.delete(key);
    repoContexts.set(key, repoContext);
    return repoContext;
  });
};
