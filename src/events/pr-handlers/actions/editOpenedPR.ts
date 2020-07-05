import { Context, Octokit } from 'probot';
import Webhooks from '@octokit/webhooks';
import { StatusError, StatusInfo } from '../../../accountConfigs/types';
import { ExcludesFalsy } from '../../../utils/ExcludesFalsy';
import { PrContext } from '../utils/createPullRequestContext';
import { cleanTitle } from './utils/cleanTitle';
import { updatePrIfNeeded } from './updatePr';
import createStatus from './utils/createStatus';
import {
  updateCommentBodyInfos,
  defaultCommentBody,
  createCommentBody,
  removeDeprecatedReviewflowInPrBody,
} from './utils/body/updateBody';
import { calcDefaultOptions } from './syncLabelsAfterCommentBodyEdited';
import { readCommitsAndUpdateInfos } from './readCommitsAndUpdateInfos';

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
  E extends Webhooks.WebhookPayloadPullRequest
>(
  prContext: PrContext<E['pull_request'] | Octokit.PullsGetResponse>,
  context: Context<E>,
  shouldUpdateCommentBodyInfos: boolean,
  previousSha?: string,
): Promise<void> => {
  const { repoContext } = prContext;
  const pr = prContext.updatedPr || prContext.pr;

  const title = repoContext.config.trimTitle ? cleanTitle(pr.title) : pr.title;

  const isPrFromBot = pr.user.type === 'Bot';

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
    await context.github.checks.listForRef(
      context.repo({
        ref: pr.head.sha,
      }),
    )
  ).data.check_runs.find(
    (check): boolean => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`,
  );

  const promises = Promise.all<any>(
    [
      ...statuses.map(
        ({ name, error, info }): Promise<void> =>
          createStatus(
            context,
            name,
            pr.head.sha,
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
        context.github.checks.create(
          context.repo({
            name: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
            head_sha: pr.head.sha,
            status: 'completed' as 'completed',
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
          pr.head.sha,
          errorRule ? 'failure' : 'success',
          errorRule ? errorRule.error.title : '✓ Your PR is valid',
        ),
    ].filter(ExcludesFalsy),
  );

  const commentBodyInfos = statuses
    .filter((status) => status.info && status.info.inBody)
    .map((status) => status.info) as StatusInfo[];

  const shouldCreateCommentBody = prContext.commentBody === defaultCommentBody;

  const commentBody = shouldCreateCommentBody
    ? createCommentBody(calcDefaultOptions(repoContext, pr), commentBodyInfos)
    : updateCommentBodyInfos(prContext.commentBody, commentBodyInfos);

  const body = removeDeprecatedReviewflowInPrBody(pr.body);

  if (shouldCreateCommentBody || shouldUpdateCommentBodyInfos) {
    await Promise.all([
      promises,
      updatePrIfNeeded(prContext, context, { title, body }),
      readCommitsAndUpdateInfos(prContext, context, commentBody),
    ]);
  } else {
    await Promise.all([
      promises,
      updatePrIfNeeded(prContext, context, { title, body, commentBody }),
    ]);
  }
};
