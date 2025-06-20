import type { EmitterWebhookEventName } from "@octokit/webhooks";
import { Lock } from "lock";
import type { Config } from "../accountConfigs/index.ts";
import { accountConfigs, defaultConfig } from "../accountConfigs/index.ts";
import { mergeOrEnableGithubAutoMerge } from "../events/pr-handlers/actions/enableGithubAutoMerge.ts";
import type { RepositorySettings } from "../events/pr-handlers/actions/utils/body/repositorySettings.ts";
import {
  createRepositorySettings,
  isSettingsLastUpdatedExpired,
} from "../events/pr-handlers/actions/utils/body/repositorySettings.ts";
import type {
  BasicUser,
  PullRequestDataMinimumData,
} from "../events/pr-handlers/utils/PullRequestData.ts";
import { getReviewflowPrContext } from "../events/pr-handlers/utils/createPullRequestContext.ts";
import { fetchPr } from "../events/pr-handlers/utils/fetchPr.ts";
import type { ProbotEvent } from "../events/probot-types";
import type { Repository } from "../mongo.ts";
import { getRepositorySettings } from "../utils/github/repo/getRepositorySettings.ts";
import type { AppContext } from "./AppContext.ts";
import type { AccountContext } from "./accountContext.ts";
import { obtainAccountContext } from "./accountContext.ts";
import type { LabelResponse, LabelsRecord } from "./initRepoLabels.ts";
import { initRepoLabels } from "./initRepoLabels.ts";
import { getEmojiFromRepoDescription } from "./utils.ts";

export interface LockedMergePr {
  id: number;
  number: number;
  branch: string;
}

export type CustomExtract<T, U extends T> = U;

export type EventsWithRepository = CustomExtract<
  EmitterWebhookEventName,
  | "check_run.completed"
  | "check_run.created"
  | "check_run.rerequested"
  | "check_suite.completed"
  | "commit_comment.created"
  | "issue_comment.created"
  | "issue_comment.deleted"
  | "issue_comment.edited"
  | "pull_request_review_comment.created"
  | "pull_request_review_comment.deleted"
  | "pull_request_review_comment.edited"
  | "pull_request_review_comment"
  | "pull_request_review.dismissed"
  | "pull_request_review.edited"
  | "pull_request_review.submitted"
  | "pull_request.assigned"
  | "pull_request.auto_merge_disabled"
  | "pull_request.auto_merge_enabled"
  | "pull_request.closed"
  | "pull_request.converted_to_draft"
  | "pull_request.edited"
  | "pull_request.labeled"
  | "pull_request.locked"
  | "pull_request.opened"
  | "pull_request.ready_for_review"
  | "pull_request.reopened"
  | "pull_request.review_request_removed"
  | "pull_request.review_requested"
  | "pull_request.synchronize"
  | "pull_request.unassigned"
  | "pull_request.unlabeled"
  | "pull_request.unlocked"
  | "push"
  | "repository.archived"
  | "repository.created"
  | "repository.deleted"
  | "repository.edited"
  | "repository.privatized"
  | "repository.publicized"
  | "repository.renamed"
  | "repository.transferred"
  | "repository.unarchived"
  | "status"
  | "workflow_run.completed"
  | "workflow_run.requested"
  // | 'commit_comment.deleted'
  // | 'commit_comment.edited'
  // | 'workflow_run.in_progress'
>;

export type RescheduleTime = "long+timeout" | "short";

interface RepoContextWithoutTeamContext {
  appContext: AppContext;
  repoFullName: string;
  repoEmbed: { id: number; name: string };
  repoEmoji: string | undefined;
  settings: RepositorySettings;
  labels: LabelsRecord;
  protectedLabelIds: readonly LabelResponse["id"][];
  shouldIgnore: boolean;

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

  reschedule: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: PullRequestDataMinimumData,
    time: RescheduleTime,
    user?: BasicUser,
  ) => Promise<void>;
  rescheduleOnChecksUpdated: <EventName extends EmitterWebhookEventName>(
    context: ProbotEvent<EventName>,
    pr: PullRequestDataMinimumData,
    isSuccessful: boolean,
  ) => Promise<void>;
}

export type RepoContext<TeamNames extends string = any> =
  AccountContext<TeamNames> & RepoContextWithoutTeamContext;

export const shouldIgnoreRepo = (
  repoName: string,
  accountConfig: Config<any>,
): boolean => {
  const ignoreRepoRegexp =
    accountConfig.ignoreRepoPattern &&
    new RegExp(`^${accountConfig.ignoreRepoPattern}$`);

  if (repoName === "reviewflow-test") {
    return process.env.REVIEWFLOW_NAME !== "reviewflow-dev";
  }

  if (ignoreRepoRegexp) {
    return ignoreRepoRegexp.test(repoName);
  }

  return false;
};

export const allRepoContexts = new Map<string, RepoContext<any>>();

async function initRepoContext<
  T extends EventsWithRepository,
  TeamNames extends string,
>(
  appContext: AppContext,
  context: ProbotEvent<T>,
  config: Config<TeamNames>,
): Promise<RepoContext<TeamNames>> {
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
  const repoContext = Object.create(accountContext);

  const shouldIgnore = shouldIgnoreRepo(name, config);

  const findOrCreateRepository = async (): Promise<Repository> => {
    const res = await appContext.mongoStores.repositories.findByKey(id, {
      "account.id": accountContext.accountEmbed.id,
    });

    if (res) {
      if (
        !res.settings.lastUpdated ||
        res.settings.defaultBranchProtectionRules === undefined ||
        isSettingsLastUpdatedExpired(res.settings)
      ) {
        const repoSettingsResult = await getRepositorySettings(context);

        const settings = createRepositorySettings(repoSettingsResult);
        res.settings = settings;

        await appContext.mongoStores.repositories.partialUpdateByKey(
          res._id,
          {
            $set: {
              settings,
            },
            // @ts-expect-error -- remove legacy options settings
            $unset: { options: "" },
          },
          {
            "account.id": accountContext.accountEmbed.id,
          },
        );
      }
      return res;
    }

    const repoSettingsResult = await getRepositorySettings(context);

    const repoEmoji = getEmojiFromRepoDescription(description);
    return appContext.mongoStores.repositories.insertOne({
      _id: id,
      account: accountContext.accountEmbed,
      emoji: repoEmoji,
      fullName,
      settings: createRepositorySettings(repoSettingsResult),
    });
  };
  const [repoLabels, repository] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    shouldIgnore ? ({} as LabelsRecord) : initRepoLabels(context, config),
    findOrCreateRepository(),
  ]);

  const getReviewLabel = (name?: string) =>
    name ? repoLabels[name] : undefined;

  const needsReviewLabel = getReviewLabel(config.labels.review?.needsReview);
  const requestedReviewLabel = getReviewLabel(config.labels.review?.requested);
  const changesRequestedLabel = getReviewLabel(
    config.labels.review?.changesRequested,
  );
  const approvedReviewLabel = getReviewLabel(config.labels.review?.approved);

  const protectedLabelIds = [
    needsReviewLabel?.id,
    requestedReviewLabel?.id,
    changesRequestedLabel?.id,
    approvedReviewLabel?.id,
  ].filter(Boolean);

  // const updateStatusCheck = (context, reviewGroup, statusInfo) => {};

  const lock = Lock();
  const waitingToReschedule = new Map<string, ReturnType<typeof setTimeout>>();

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
      context.log.debug(logInfos, "lock: try to lock pr");
      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      lock(prNumberAsString, async (createReleaseCallback) => {
        const release = createReleaseCallback(() => {});
        context.log.info(logInfos, "lock: lock pr acquired");
        try {
          await callback();
        } catch (error) {
          context.log.info(logInfos, "lock: release pr (with error)");
          release();
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
          return;
        }
        context.log.info(logInfos, "lock: release pr");
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

  const reschedule = async (
    rescheduleContext: ProbotEvent<any>,
    pr: PullRequestDataMinimumData,
    time: RescheduleTime,
    user?: BasicUser,
    // eslint-disable-next-line @typescript-eslint/require-await
  ): Promise<void> => {
    if (!pr) throw new Error("Cannot reschedule undefined");
    if (repoContext.config.disableAutoMerge) return;
    if (!repoContext.settings.allowAutoMerge) return;

    clearWaitingToReschedule(pr.id);
    rescheduleContext.log.info(pr, "reschedule", { time });
    const timeout = setTimeout(
      () => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        lockPR("reschedule", "reschedule", -1, () => {
          return lockPR("reschedule", String(pr.id), pr.number, async () => {
            const [pullRequest, reviewflowPrContext] = await Promise.all([
              fetchPr(context, pr.number),
              getReviewflowPrContext(pr, rescheduleContext, repoContext),
            ]);

            await mergeOrEnableGithubAutoMerge(
              pullRequest,
              context,
              repoContext,
              reviewflowPrContext,
              user,
              undefined,
              time,
            );
          });
        });
      },
      time === "long+timeout" ? 60_000 * 10 /* 10 min */ : 10_000 /* 10s */,
    );
    waitingToReschedule.set(String(pr.id), timeout);
  };

  const rescheduleOnChecksUpdated = async (
    rescheduleContext: ProbotEvent<any>,
    pr: PullRequestDataMinimumData,
    isSuccessful: boolean,
  ): Promise<void> => {
    if (
      repoContext.settings.allowAutoMerge ||
      accountContext.config.disableAutoMerge
    ) {
      return;
    }

    if (isSuccessful) {
      // - if is merge locked => will run automerge and might merge
      // - if not in queue => might add it back if other conditions are met
      // TODO: save condition in mongo to avoid rescheduling if not necessary
      await reschedule(rescheduleContext, pr, "short");
    } else {
      // Note: some unsucessful checks are ignored
      await reschedule(rescheduleContext, pr, "short");
    }
  };

  return Object.assign(repoContext, {
    appContext,
    labels: repoLabels,
    repoFullName: fullName,
    repoEmbed: { id, name },
    repoEmoji: repository.emoji,
    settings: repository.settings,
    protectedLabelIds,
    shouldIgnore,

    reschedule,
    rescheduleOnChecksUpdated,

    lockPR,
    lockPullRequest,
  } as RepoContextWithoutTeamContext);
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
    context.log.info(`using default config for ${owner.login}`);
    accountConfig = defaultConfig;
  }

  const promise = initRepoContext(appContext, context, accountConfig).then(
    (repoContext) => {
      // this must be included in the `promise` to make sure `repoContexts.set` is not called after in `deleteRepoContext`
      repoContextsPromise.delete(key);
      repoContexts.set(key, repoContext);
      return repoContext;
    },
  );
  repoContextsPromise.set(key, promise);

  return promise;
};

export const deleteRepoContext = async (
  repositoryId: number,
): Promise<void> => {
  const existingPromise = repoContextsPromise.get(repositoryId);
  if (existingPromise) await existingPromise;
  repoContexts.delete(repositoryId);
};
