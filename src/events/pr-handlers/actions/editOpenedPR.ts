import type { EventPayloads } from '@octokit/webhooks';
import type { Context } from 'probot';
import type { RepoContext } from 'context/repoContext';
import type { ParsePRRule, StatusInfo } from '../../../accountConfigs/types';
import { getKeys } from '../../../context/utils';
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
  error: ParsePRRule['error'];
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

  const parsePRValue = {
    title,
    head: pullRequest.head.ref,
    base: pullRequest.base.ref,
  };

  const isPrFromBot = pullRequest.user && pullRequest.user.type === 'Bot';

  const statuses: Status[] = [];
  const warnings: ParsePRRule['error'][] = [];

  let errorRule: ParsePRRule | undefined;
  getKeys(repoContext.config.parsePR).find((parsePRKey) => {
    const rules = repoContext.config.parsePR[parsePRKey];
    if (!rules) return false;

    const value = parsePRValue[parsePRKey];
    errorRule = rules.find((rule) => {
      if (rule.bot === false && isPrFromBot) return false;

      const match = rule.regExp.exec(value);
      if (match === null) {
        if (rule.status) {
          statuses.push({ name: rule.status, error: rule.error });
          if (rule.warning) {
            warnings.push({ title: `"${rule.status}"`, summary: '' });
            return false;
          }
        }
        if (rule.warning) {
          warnings.push(rule.error);
          return false;
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
    return errorRule;
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

  const errorStatus = errorRule
    ? // eslint-disable-next-line unicorn/no-nested-ternary
      typeof errorRule.error === 'function'
      ? errorRule.error({ title })
      : errorRule.error
    : undefined;

  const promises: Promise<unknown>[] = [
    ...statuses.map(
      ({ name, error, info }): Promise<void> =>
        createStatus(
          context,
          name,
          pullRequest.head.sha,
          error ? 'failure' : 'success',
          error
            ? (typeof error === 'function' ? error({ title }) : error).title
            : (info as StatusInfo).title,
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
          status: 'completed',
          conclusion: (errorRule ? 'failure' : 'success') as
            | 'failure'
            | 'success',
          started_at: date,
          completed_at: date,
          output: errorRule
            ? errorRule.error
            : {
                title:
                  warnings.length === 0
                    ? '✓ Your PR is valid'
                    : `warnings: ${warnings
                        .map((error) =>
                          typeof error === 'function'
                            ? error({ title }).title
                            : error.title,
                        )
                        .join(',')}`,
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
        errorStatus
          ? errorStatus.title
          : // eslint-disable-next-line unicorn/no-nested-ternary
          warnings.length === 0
          ? '✓ Your PR is valid'
          : `warning${
              warnings.length === 1 ? '' : 's'
            }: ${warnings
              .map((error) =>
                typeof error === 'function'
                  ? error({ title }).title
                  : error.title,
              )
              .join(',')}`,
        errorStatus ? errorStatus.url : undefined,
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
