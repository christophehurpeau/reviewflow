/* eslint-disable max-lines */
import type { EmitterWebhookEventName } from '@octokit/webhooks';
import { Lock } from 'lock';
import type { ProbotEvent } from 'events/probot-types';
import type { Config } from '../accountConfigs';
import { accountConfigs, defaultConfig } from '../accountConfigs';
import type { GroupLabels } from '../accountConfigs/types';
import { autoMergeIfPossible } from '../events/pr-handlers/actions/autoMergeIfPossible';
import type {
  PullRequestDataMinimumData,
  PullRequestLabels,
} from '../events/pr-handlers/utils/PullRequestData';
import { getReviewflowPrContext } from '../events/pr-handlers/utils/createPullRequestContext';
import { fetchPr } from '../events/pr-handlers/utils/fetchPr';
import { ExcludesFalsy } from '../utils/Excludes';
import type { AppContext } from './AppContext';
import type { AccountContext } from './accountContext';
import { obtainAccountContext } from './accountContext';
import type { LabelResponse, LabelsRecord } from './initRepoLabels';
import { initRepoLabels } from './initRepoLabels';
import { getEmojiFromRepoDescription } from './utils';

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
  | 'check_run.completed'
  | 'check_suite.completed'
  | 'status'
>;

interface RepoContextWithoutTeamContext<GroupNames extends string> {
  appContext: AppContext;
  repoFullName: string;
  repoEmbed: { id: number; name: string };
  repoEmoji: string | undefined;
  labels: LabelsRecord;
  protectedLabelIds: readonly LabelResponse['id'][];
  shouldIgnore: boolean;

  hasNeedsReview: (labels: PullRequestLabels) => boolean;
  hasRequestedReview: (labels: PullRequestLabels) => boolean;
  hasChangesRequestedReview: (labels: PullRequestLabels) => boolean;
  hasApprovesReview: (labels: PullRequestLabels) => boolean;
  getNeedsReviewGroupNames: (labels: PullRequestLabels) => GroupNames[];
  lockPullRequest: (
    pullRequest: PullRequestDataMinimumData,
    callback: () => Promise<void> | void,
  ) => Promise<void>;

  /** @deprecated */
  lockPR: (
    prId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ) => Promise<void>;

  getMergeLockedPr: () => LockedMergePr;
  addMergeLockPr: (pr: LockedMergePr) => void;
  removePrFromAutomergeQueue: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    prNumber: number,
    reason: string,
  ) => void;
  reschedule: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: LockedMergePr,
  ) => void;
  pushAutomergeQueue: (pr: LockedMergePr) => void;
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
  const repoEmoji = getEmojiFromRepoDescription(description);

  const accountContext = await obtainAccountContext<T>(
    appContext,
    context,
    config,
    org,
  );
  const repoContext = Object.create(accountContext);

  const shouldIgnore = shouldIgnoreRepo(name, config);

  const labels = shouldIgnore ? {} : await initRepoLabels(context, config);

  const reviewGroupNames = Object.keys(config.groups) as GroupNames[];
  const getReviewLabelIds = createGetReviewLabelIds(
    shouldIgnore,
    config,
    reviewGroupNames,
    labels,
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
      const reviewGroupLabels = config.labels.review[key] as any;
      Object.keys(reviewGroupLabels).forEach((labelKey: string) => {
        labelIdToGroupName.set(labels[reviewGroupLabels[labelKey]].id, key);
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
  let lockMergePr: LockedMergePr | undefined;
  let automergeQueue: LockedMergePr[] = [];

  const lockPR = (
    prOrPrIssueId: string,
    prNumber: number,
    callback: () => Promise<void> | void,
  ): Promise<void> =>
    new Promise((resolve, reject) => {
      const logInfos = {
        repo: fullName,
        prOrPrIssueId,
        prNumber,
      };
      context.log.debug(logInfos, 'lock: try to lock pr');
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      lock(String(prNumber), async (createReleaseCallback) => {
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
    pullRequest: PullRequestDataMinimumData,
    callback: () => Promise<void> | void,
  ): Promise<void> => {
    return lockPR(String(pullRequest.id), pullRequest.number, callback);
  };

  const reschedule = (context: ProbotEvent<any>, pr: LockedMergePr): void => {
    if (!pr) throw new Error('Cannot reschedule undefined');
    context.log.info(pr, 'reschedule');
    setTimeout(() => {
      lockPR('reschedule', -1, () => {
        return lockPR(String(pr.id), pr.number, async () => {
          const [pullRequest, reviewflowPrContext] = await Promise.all([
            fetchPr(context, pr.number),
            getReviewflowPrContext(pr.number, context, repoContext),
          ]);
          await autoMergeIfPossible(
            pullRequest,
            context,
            repoContext,
            reviewflowPrContext,
          );
        });
      });
    }, 10_000);
  };

  return Object.assign(repoContext, {
    appContext,
    labels,
    repoFullName: fullName,
    repoEmbed: { id, name },
    repoEmoji,
    protectedLabelIds,
    shouldIgnore,
    hasNeedsReview,
    hasRequestedReview,
    hasChangesRequestedReview,
    hasApprovesReview,
    getNeedsReviewGroupNames,

    getMergeLockedPr: () => lockMergePr,
    addMergeLockPr: (pr: LockedMergePr): void => {
      // eslint-disable-next-line no-console
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
        if (lockMergePr) {
          context.log(lockMergePr, `merge lock: next ${fullName}`);
        } else {
          context.log(`merge lock: nothing next ${fullName}`);
        }
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
      context.log(
        {
          repo: fullName,
          pr,
          lockMergePr,
          automergeQueue,
        },
        'merge lock: push queue',
      );
      if (!automergeQueue.some((p) => p.number === pr.number)) {
        automergeQueue.push(pr);
      }
    },
    reschedule,

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
