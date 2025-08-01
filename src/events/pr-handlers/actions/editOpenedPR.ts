import type { Update } from "liwi-mongo";
import type { StatusInfo } from "../../../accountConfigs/types.ts";
import type { AppContext } from "../../../context/AppContext.ts";
import type {
  EventsWithRepository,
  RepoContext,
} from "../../../context/repoContext.ts";
import { getKeys } from "../../../context/utils.ts";
import type { ReviewflowPr } from "../../../mongo";
import { ExcludesFalsy } from "../../../utils/Excludes.ts";
import { checkIfUserIsBot } from "../../../utils/github/isBotUser.ts";
import type { ChecksAndStatuses } from "../../../utils/github/pullRequest/checksAndStatuses.ts";
import { isPrFromRenovateBot } from "../../../utils/github/renovate.ts";
import type { ProbotEvent } from "../../probot-types.ts";
import type {
  PullRequestLabels,
  PullRequestWithDecentData,
} from "../utils/PullRequestData.ts";
import { toBasicUser } from "../utils/PullRequestData.ts";
import type { ReviewflowPrContext } from "../utils/createPullRequestContext.ts";
import { readCommitsAndUpdateInfos } from "./readCommitsAndUpdateInfos.ts";
import { updatePrIfNeeded } from "./updatePr.ts";
import { updatePrCommentBodyIfNeeded } from "./updatePrCommentBody.ts";
import { calcDefaultOptions } from "./utils/body/prOptions.ts";
import {
  createCommentBody,
  defaultCommentBody,
  removeDeprecatedReviewflowInPrBody,
  updateCommentBodyInfos,
  updateCommentBodyProgress,
} from "./utils/body/updateBody.ts";
import { lintCommitMessage } from "./utils/commitMessages.ts";
import createStatus, { isSameStatus } from "./utils/createStatus.ts";
import { cleanTitle } from "./utils/prTitle.ts";
import type { StepsState } from "./utils/steps/calcStepsState.ts";
import { updateSlackHomeForPr } from "./utils/updateSlackHome.ts";

export interface ReviewflowStatus {
  name: string;
  status: StatusInfo;
}

export interface EditOpenedPullRequestOptions<
  EventName extends EventsWithRepository,
  TeamNames extends string,
> {
  fromOpenedEvent?: boolean;
  pullRequest: PullRequestWithDecentData;
  pullRequestLabels?: PullRequestLabels;
  context: ProbotEvent<EventName>;
  appContext: AppContext;
  repoContext: RepoContext<TeamNames>;
  reviewflowPrContext: ReviewflowPrContext;
  shouldUpdateCommentBodyInfos: boolean;
  shouldUpdateCommentBodyProgress: boolean;
  shouldUpdateSlackHomeOnTitleChange?: boolean;
  stepsState: StepsState;
  previousSha?: string;
  checksAndStatuses?: ChecksAndStatuses;
  reviews?: ReviewflowPr["reviews"];
}

export const editOpenedPR = async <
  EventName extends EventsWithRepository,
  TeamNames extends string,
>({
  fromOpenedEvent,
  pullRequest,
  pullRequestLabels = pullRequest.labels,
  context,
  appContext,
  repoContext,
  reviewflowPrContext,
  shouldUpdateCommentBodyInfos,
  shouldUpdateCommentBodyProgress,
  shouldUpdateSlackHomeOnTitleChange,
  stepsState,
  previousSha,
  checksAndStatuses,
  reviews,
}: EditOpenedPullRequestOptions<EventName, TeamNames>): Promise<void> => {
  const title = repoContext.config.cleanTitle
    ? cleanTitle(
        pullRequest.title,
        repoContext.config.cleanTitle === "conventionalCommit",
      )
    : pullRequest.title;

  const parsePRValue = {
    title,
    body: pullRequest.body || "",
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  };

  const isPrFromBot = !pullRequest.user
    ? false
    : checkIfUserIsBot(repoContext, pullRequest.user);

  const isRenovatePr = isPrFromRenovateBot(pullRequest);

  const statuses: ReviewflowStatus[] = [];
  let errorStatus: StatusInfo | undefined;

  if (
    repoContext.config.lintPullRequestTitleWithConventionalCommit === true ||
    (repoContext.config.lintPullRequestTitleWithConventionalCommit &&
      repoContext.config.lintPullRequestTitleWithConventionalCommit.test(
        repoContext.repoEmbed.name,
      ))
  ) {
    try {
      const lintOutcome = await lintCommitMessage(title);
      if (!lintOutcome.valid) {
        errorStatus = {
          inBody: true,
          type: "failure",
          title: "Title does not match conventional commit.",
          summary: "",
          url: "https://www.conventionalcommits.org/",
          details: `Pull Request's title does not match [conventional commit](https://www.conventionalcommits.org/):\n${lintOutcome.errors
            .map((error) => `:x: ${error.message}`)
            .join("\n")}`,
        };
      }
    } catch {
      errorStatus = {
        type: "failure",
        title: "Failed to lint title with conventional commit linter.",
        summary: "",
      };
    }
  }

  if (repoContext.config.parsePR) {
    const parsePR = repoContext.config.parsePR;
    getKeys(parsePR).forEach((parsePRKey) => {
      const rules = parsePR[parsePRKey];
      if (!rules) return;

      const value = parsePRValue[parsePRKey];
      rules.forEach((rule) => {
        if (rule.bot === false && isPrFromBot) return;

        const match = rule.regExp.exec(value);
        const status = rule.createStatusInfo(match, parsePRValue, isPrFromBot);

        if (status !== null) {
          if (rule.status) {
            statuses.push({ name: rule.status, status });
          } else if (status.type === "failure") {
            if (!errorStatus) {
              errorStatus = status;
            }
          }
        }
      });
    });
  }

  const date = new Date().toISOString();

  let hasLegacyLintPrCheck = false;

  if (checksAndStatuses) {
    hasLegacyLintPrCheck =
      `${process.env.REVIEWFLOW_NAME}/lint-pr` in
      checksAndStatuses.checksConclusionRecord;
  } else if (!reviewflowPrContext.reviewflowPr.lintStatuses) {
    // if it is the first time we see this PR or it's before we started saving statuses
    const {
      data: { check_runs: checkRuns },
    } = await context.octokit.checks.listForRef(
      context.repo({
        ref: pullRequest.head.sha,
        per_page: 100,
      }),
    );
    hasLegacyLintPrCheck = checkRuns.some(
      (check): boolean =>
        check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`,
    );
  } else {
    hasLegacyLintPrCheck = !reviewflowPrContext.reviewflowPr.lintStatuses.some(
      (status) => status.name === "lint-pr",
    );
  }

  const lintStatus: ReviewflowStatus = {
    name: "lint-pr",
    status: {
      type: errorStatus ? "failure" : "success",
      title: errorStatus ? errorStatus.title : "✓ PR is valid",
      summary: errorStatus ? errorStatus.summary : "",
      url: errorStatus ? errorStatus.url : undefined,
      inBody: errorStatus ? errorStatus.inBody : undefined,
      details: errorStatus ? errorStatus.details : undefined,
    },
  };

  if (!hasLegacyLintPrCheck || previousSha) {
    statuses.push(lintStatus);
  }

  const updateStatusesPromises: Promise<unknown>[] = [
    ...statuses.map(({ name, status }): Promise<void> | undefined => {
      const previousStatus =
        reviewflowPrContext.reviewflowPr.lintStatuses?.find(
          (reviewflowStatus) => reviewflowStatus.name === name,
        )?.status;

      if (
        previousSha ||
        reviewflowPrContext.reviewflowPr.lastLintStatusesCommit !==
          pullRequest.head.sha ||
        !previousStatus ||
        !isSameStatus(previousStatus, status)
      ) {
        return createStatus(context, name, pullRequest.head.sha, status);
      }

      return undefined;
    }),
    ...(previousSha
      ? (reviewflowPrContext.reviewflowPr.lintStatuses || statuses)
          .filter(({ status }) => status.type === "failure")
          .map(({ name }): Promise<void> | undefined =>
            createStatus(context, name, previousSha, {
              type: "success",
              title: "New commits have been pushed",
              summary: "",
            }),
          )
      : []),
    hasLegacyLintPrCheck &&
      !previousSha &&
      context.octokit.checks.create(
        context.repo({
          name: lintStatus.name,
          head_sha: pullRequest.head.sha,
          status: "completed",
          conclusion: errorStatus ? "failure" : "success",
          started_at: date,
          completed_at: date,
          output: {
            title: lintStatus.status.title,
            summary: lintStatus.status.summary,
          },
        }),
      ),
  ].filter(ExcludesFalsy);

  const body = removeDeprecatedReviewflowInPrBody(pullRequest.body);

  const partialUpdateReviewflowPr: Update<ReviewflowPr>["$set"] = {
    title,
    isDraft: pullRequest.draft === true,
    isClosed: !!pullRequest.closed_at,
  };

  if ("changed_files" in pullRequest) {
    partialUpdateReviewflowPr.changesInformation = {
      changedFiles: pullRequest.changed_files,
      additions: pullRequest.additions,
      deletions: pullRequest.deletions,
    };
  }

  if (
    fromOpenedEvent &&
    repoContext.config.autoAssignToCreator &&
    pullRequest.assignees?.length === 0 &&
    pullRequest.user
  ) {
    partialUpdateReviewflowPr.assignees = [toBasicUser(pullRequest.user)];
  } else if ("assignees" in pullRequest && pullRequest.assignees) {
    partialUpdateReviewflowPr.assignees =
      pullRequest.assignees.map(toBasicUser);
  }

  const promises: (Promise<unknown> | undefined)[] = [
    Promise.all(updateStatusesPromises).then(() => {
      // only update reviewflowPr if all create successful
      return appContext.mongoStores.prs.partialUpdateOne(
        reviewflowPrContext.reviewflowPr,
        {
          $set: {
            lastLintStatusesCommit: pullRequest.head.sha,
            lintStatuses: statuses,
          },
        },
      );
    }),
    checksAndStatuses
      ? appContext.mongoStores.prs.partialUpdateOne(
          reviewflowPrContext.reviewflowPr,
          {
            $set: {
              headSha: pullRequest.head.sha,
              ...partialUpdateReviewflowPr,
              checksConclusion: checksAndStatuses.checksConclusionRecord,
              statusesConclusion: checksAndStatuses.statusesConclusionRecord,
              ...(reviews ? { reviews } : {}),
            },
          },
        )
      : appContext.mongoStores.prs.partialUpdateOne(
          reviewflowPrContext.reviewflowPr,
          {
            $set: {
              ...partialUpdateReviewflowPr,
              // update old data
              ...(!reviewflowPrContext.reviewflowPr.assignees &&
              pullRequest.assignees
                ? { assignees: pullRequest.assignees.map(toBasicUser) }
                : {}),
            },
          },
        ),
  ];

  const commentBodyInfos: StatusInfo[] = statuses
    .filter((status) => status.status.inBody)
    .map((status) => status.status);

  if (
    // not a bot
    !isPrFromBot &&
    // should not happen, but ts needs it
    pullRequest.user.login &&
    // belongs to the organization
    pullRequest.head.repo?.full_name === pullRequest.base.repo.full_name &&
    // has not connected its slack account yet
    repoContext.slack.shouldShowLoginMessage(pullRequest.user.login)
  ) {
    commentBodyInfos.push({
      type: "failure",
      title: `@${pullRequest.user.login} Connect your account to Slack to get notifications for your PRs !`,
      url: `${process.env.REVIEWFLOW_APP_URL}/org/${context.payload.repository.owner.login}`,
      summary: "",
    });
  }

  const shouldCreateCommentBody =
    reviewflowPrContext.commentBody === defaultCommentBody;

  let newCommentBody = shouldCreateCommentBody
    ? createCommentBody(
        repoContext.settings,
        context.payload.repository.html_url,
        repoContext.config.labels.list,
        calcDefaultOptions(repoContext, pullRequestLabels),
        stepsState,
        commentBodyInfos,
      )
    : updateCommentBodyInfos(reviewflowPrContext.commentBody, commentBodyInfos);

  if (shouldUpdateCommentBodyProgress) {
    newCommentBody = updateCommentBodyProgress(newCommentBody, stepsState);
  }

  const hasDiffInTitle = title && pullRequest.title !== title;

  if (shouldCreateCommentBody || shouldUpdateCommentBodyInfos) {
    promises.push(
      readCommitsAndUpdateInfos(
        pullRequest,
        context,
        repoContext,
        reviewflowPrContext,
        title,
        body,
        newCommentBody,
      ),
    );
  } else {
    promises.push(
      updatePrIfNeeded(pullRequest, context, { title, body }),
      updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newCommentBody),
    );
  }

  await Promise.all(promises);

  if (shouldUpdateSlackHomeOnTitleChange && hasDiffInTitle) {
    const teamMembers = await repoContext.getMembersForTeams(
      pullRequest.requested_teams
        ? pullRequest.requested_teams.map((team) => team.id)
        : [],
    );
    updateSlackHomeForPr(repoContext, pullRequest, {
      assignees: true,
      requestedReviewers: true,
      requestedTeams: true,
      teamMembers,
    });
  }

  if (
    isRenovatePr &&
    repoContext.config.experimentalFeatures?.autoCloseAbandonedPrs &&
    pullRequest.title.endsWith(" - abandoned")
  ) {
    await context.octokit.pulls.update(
      context.repo({
        pull_number: pullRequest.number,
        state: "closed",
      }),
    );
  }
};
