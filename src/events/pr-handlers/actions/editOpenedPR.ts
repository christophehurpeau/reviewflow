import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { StatusInfo } from '../../../accountConfigs/types';
import { getKeys } from '../../../context/utils';
import { ExcludesFalsy } from '../../../utils/Excludes';
import type { PullRequestWithDecentData } from '../utils/PullRequestData';
import type { ReviewflowPrContext } from '../utils/createPullRequestContext';
import { checkIfUserIsBot } from '../utils/isBotUser';
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

interface Status {
  name: string;
  status: StatusInfo;
}

export const editOpenedPR = async <
  E extends EventPayloads.WebhookPayloadPullRequest,
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

  const parsePRValue = {
    title,
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  };

  const isPrFromBot = !pullRequest.user
    ? false
    : checkIfUserIsBot(repoContext, pullRequest.user);

  const statuses: Status[] = [];
  let errorStatus: StatusInfo | undefined;

  getKeys(repoContext.config.parsePR).forEach((parsePRKey) => {
    const rules = repoContext.config.parsePR[parsePRKey];
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
      ({ name, status }): Promise<void> =>
        createStatus(
          context,
          name,
          pullRequest.head.sha,
          status.type,
          status.title,
          status.url,
        ),
    ),
    ...(previousSha
      ? statuses
          .filter(({ status }) => status.type === 'failure')
          .map(({ name }): Promise<void> | undefined =>
            createStatus(
              context,
              name,
              previousSha,
              'success',
              'New commits have been pushed',
            ),
          )
      : []),
    hasLintPrCheck &&
      context.octokit.checks.create(
        context.repo({
          name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
          head_sha: pullRequest.head.sha,
          status: 'completed',
          conclusion: errorStatus ? 'failure' : 'success',
          started_at: date,
          completed_at: date,
          output: errorStatus
            ? {
                title: errorStatus.title,
                summary: errorStatus.summary,
              }
            : {
                title: '✓ PR is valid',
                summary: '',
              },
        }),
      ),
    !hasLintPrCheck && previousSha && errorStatus
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
        errorStatus ? 'failure' : 'success',
        errorStatus ? errorStatus.title : '✓ PR is valid',
        errorStatus ? errorStatus.url : undefined,
      ),
  ].filter(ExcludesFalsy);

  const body = removeDeprecatedReviewflowInPrBody(pullRequest.body);
  promises.push(updatePrIfNeeded(pullRequest, context, { title, body }));

  const commentBodyInfos: StatusInfo[] = statuses
    .filter((status) => status.status.inBody)
    .map((status) => status.status);

  const shouldCreateCommentBody =
    reviewflowPrContext.commentBody === defaultCommentBody;

  const newBody = shouldCreateCommentBody
    ? createCommentBody(
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
