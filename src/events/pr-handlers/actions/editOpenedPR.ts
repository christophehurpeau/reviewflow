import type { EventsWithRepository, RepoContext } from 'context/repoContext';
import type { ProbotEvent } from 'events/probot-types';
import type { StatusInfo } from '../../../accountConfigs/types';
import type { AppContext } from '../../../context/AppContext';
import { getKeys } from '../../../context/utils';
import { ExcludesFalsy } from '../../../utils/Excludes';
import { checkIfUserIsBot } from '../../../utils/github/isBotUser';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { readCommitsAndUpdateInfos } from './readCommitsAndUpdateInfos';
import { updatePrIfNeeded } from './updatePr';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import { calcDefaultOptions } from './utils/body/prOptions';
import { parseRepositoryOptions } from './utils/body/repositoryOptions';
import {
  updateCommentBodyInfos,
  defaultCommentBody,
  createCommentBody,
  removeDeprecatedReviewflowInPrBody,
} from './utils/body/updateBody';
import { lintCommitMessage } from './utils/commitMessages';
import createStatus, { isSameStatus } from './utils/createStatus';
import { cleanTitle } from './utils/prTitle';

export interface ReviewflowStatus {
  name: string;
  status: StatusInfo;
}

export interface EditOpenedPullRequestOptions<
  Name extends EventsWithRepository,
> {
  pullRequest: PullRequestWithDecentData;
  context: ProbotEvent<Name>;
  appContext: AppContext;
  repoContext: RepoContext;
  reviewflowPrContext: ReviewflowPrContext;
  shouldUpdateCommentBodyInfos: boolean;
  previousSha?: string;
}

export const editOpenedPR = async <Name extends EventsWithRepository>({
  pullRequest,
  context,
  appContext,
  repoContext,
  reviewflowPrContext,
  shouldUpdateCommentBodyInfos,
  previousSha,
}: EditOpenedPullRequestOptions<Name>): Promise<void> => {
  const title = repoContext.config.trimTitle
    ? cleanTitle(pullRequest.title)
    : pullRequest.title;

  const parsePRValue = {
    title,
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  };

  const isPrFromBot = !pullRequest.user
    ? false
    : checkIfUserIsBot(repoContext, pullRequest.user);

  const statuses: ReviewflowStatus[] = [];
  let errorStatus: StatusInfo | undefined;

  if (
    repoContext.config.experimentalFeatures
      ?.lintPullRequestTitleWithConventionalCommit
  ) {
    try {
      const lintOutcome = await lintCommitMessage(title);
      if (!lintOutcome.valid) {
        errorStatus = {
          inBody: true,
          type: 'failure',
          title: 'Title does not match conventional commit.',
          summary: '',
          url: 'https://www.conventionalcommits.org/',
          details: `Pull Request's title does not match [conventional commit](https://www.conventionalcommits.org/):\n${lintOutcome.errors
            .map((error) => `:x: ${error.message}`)
            .join('\n')}`,
        };
      }
    } catch {
      errorStatus = {
        type: 'failure',
        title: 'Failed to lint title with conventional commit linter.',
        summary: '',
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
          } else if (status.type === 'failure') {
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

  if (!reviewflowPrContext.reviewflowPr.lintStatuses) {
    // if it is the first time we see this PR or it's before we started saving statuses
    const {
      data: { check_runs: checkRuns },
    } = await context.octokit.checks.listForRef(
      context.repo({
        ref: pullRequest.head.sha,
      }),
    );
    hasLegacyLintPrCheck = checkRuns.some(
      (check): boolean =>
        check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`,
    );
  } else {
    hasLegacyLintPrCheck = !reviewflowPrContext.reviewflowPr.lintStatuses.some(
      (status) => status.name === 'lint-pr',
    );
  }

  const lintStatus: ReviewflowStatus = {
    name: 'lint-pr',
    status: {
      type: errorStatus ? 'failure' : 'success',
      title: errorStatus ? errorStatus.title : '✓ PR is valid',
      summary: errorStatus ? errorStatus.summary : '',
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
          .filter(({ status }) => status.type === 'failure')
          .map(({ name }): Promise<void> | undefined =>
            createStatus(context, name, previousSha, {
              type: 'success',
              title: 'New commits have been pushed',
              summary: '',
            }),
          )
      : []),
    hasLegacyLintPrCheck &&
      !previousSha &&
      context.octokit.checks.create(
        context.repo({
          name: lintStatus.name,
          head_sha: pullRequest.head.sha,
          status: 'completed',
          conclusion: errorStatus ? 'failure' : 'success',
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

  const promises: Promise<unknown>[] = [
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
  ];

  const commentBodyInfos: StatusInfo[] = statuses
    .filter((status) => status.status.inBody)
    .map((status) => status.status);

  if (
    // not a bot
    !isPrFromBot &&
    // should not happen, but ts needs it
    pullRequest.user?.login &&
    // belongs to the organization
    repoContext.getReviewerGroup(pullRequest.user.login) &&
    // has not connected its slack account yet
    repoContext.slack.shouldShowLoginMessage(pullRequest.user.login)
  ) {
    commentBodyInfos.push({
      type: 'failure',
      title: `@${pullRequest.user.login} Connect your account to Slack to get notifications for your PRs !`,
      url: `${process.env.REVIEWFLOW_APP_URL}/org/${context.payload.repository.owner.login}`,
      summary: '',
    });
  }

  const shouldCreateCommentBody =
    reviewflowPrContext.commentBody === defaultCommentBody;

  const newCommentBody = shouldCreateCommentBody
    ? createCommentBody(
        parseRepositoryOptions(context.payload.repository),
        context.payload.repository.html_url,
        repoContext.config.labels.list,
        calcDefaultOptions(repoContext, pullRequest),
        commentBodyInfos,
      )
    : updateCommentBodyInfos(reviewflowPrContext.commentBody, commentBodyInfos);

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
};
