import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { StatusError, StatusInfo } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { readCommitsAndUpdateInfos } from './readCommitsAndUpdateInfos';
import { calcDefaultOptions } from './syncLabelsAfterCommentBodyEdited';
import { updatePrIfNeeded } from './updatePr';
import { updatePrCommentBodyIfNeeded } from './updatePrCommentBody';
import {
  updateCommentBodyInfos,
  defaultCommentBody,
  createCommentBody,
  removeDeprecatedReviewflowInPrBody,
} from './utils/body/updateBody';
import { cleanTitle } from './utils/cleanTitle';
import createStatus from './utils/createStatus';

interface StatusWithInfo {
  name: string;
  info: StatusInfo;
  error?: undefined;
}

interface StatusWithError {
  name: string;
  error: StatusError;
  info?: undefined;
}

type Status = StatusWithInfo | StatusWithError;

export const editOpenedPR = async <
  E extends EventPayloads.WebhookPayloadPullRequest
>(
  pullRequest: PullRequestWithDecentData,
  context: Context<E>,
  repoContext: RepoContext,
  reviewflowPrContext: ReviewflowPrContext,
  shouldUpdateCommentBodyInfos: boolean,
  previousSha?: string,
): Promise<void> => {
  const title = repoContext.config.trimTitle
    ? cleanTitle(pullRequest.title)
    : pullRequest.title;

  const isPrFromBot = pullRequest.user && pullRequest.user.type === 'Bot';

  const statuses: Status[] = [];

  const errorRule = repoContext.config.parsePR.title.find((rule) => {
    if (rule.bot === false && isPrFromBot) return false;

    const match = rule.regExp.exec(title);
    if (match === null) {
      if (rule.status) {
        statuses.push({ name: rule.status, error: rule.error });
      }
      return true;
    }

    if (rule.status && rule.statusInfoFromMatch) {
      statuses.push({
        name: rule.status,
        info: rule.statusInfoFromMatch(match),
      });
      return false;
    }

    return false;
  });

  const date = new Date().toISOString();

  const hasLintPrCheck = (
    await context.octokit.checks.listForRef(
      context.repo({
        ref: pullRequest.head.sha,
      }),
    )
  ).data.check_runs.find(
    (check): boolean => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`,
  );

  const promises: Promise<unknown>[] = [
    ...statuses.map(
      ({ name, error, info }): Promise<void> =>
        createStatus(
          context,
          name,
          pullRequest.head.sha,
          error ? 'failure' : 'success',
          error ? error.title : (info as StatusInfo).title,
          error ? undefined : (info as StatusInfo).url,
        ),
    ),
    ...(previousSha
      ? statuses
          .map(({ name, error, info }): Promise<void> | undefined =>
            error
              ? createStatus(
                  context,
                  name,
                  previousSha,
                  'success',
                  'New commits have been pushed',
                )
              : undefined,
          )
          .filter(ExcludesFalsy)
      : []),
    hasLintPrCheck &&
      context.octokit.checks.create(
        context.repo({
          name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
          head_sha: pullRequest.head.sha,
          status: 'completed' as const,
          conclusion: (errorRule ? 'failure' : 'success') as
            | 'failure'
            | 'success',
          started_at: date,
          completed_at: date,
          output: errorRule
            ? errorRule.error
            : {
                title: '✓ Your PR is valid',
                summary: '',
              },
        }),
      ),
    !hasLintPrCheck && previousSha && errorRule
      ? createStatus(
          context,
          'lint-pr',
          previousSha,
          'success',
          'New commits have been pushed',
        )
      : undefined,
    !hasLintPrCheck &&
      createStatus(
        context,
        'lint-pr',
        pullRequest.head.sha,
        errorRule ? 'failure' : 'success',
        errorRule ? errorRule.error.title : '✓ Your PR is valid',
      ),
  ].filter(ExcludesFalsy);

  const body = removeDeprecatedReviewflowInPrBody(pullRequest.body);
  promises.push(updatePrIfNeeded(pullRequest, context, { title, body }));

  const commentBodyInfos = statuses
    .filter((status) => status.info?.inBody)
    .map((status) => status.info) as StatusInfo[];

  const shouldCreateCommentBody =
    reviewflowPrContext.commentBody === defaultCommentBody;

  const newBody = shouldCreateCommentBody
    ? createCommentBody(
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
        newBody,
      ),
    );
  } else {
    promises.push(
      updatePrCommentBodyIfNeeded(context, reviewflowPrContext, newBody),
    );
  }

  await Promise.all(promises);
};
