/* eslint-disable max-lines */
import Webhooks from '@octokit/webhooks';
import { StatusError, StatusInfo } from '../../orgsConfigs/types';
import { PRHandler } from '../utils';
import { ExcludesFalsy } from '../../utils/ExcludesFalsy';
import { cleanTitle } from './utils/cleanTitle';
import { updateBody } from './utils/updateBody';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { updatePrIfNeeded } from './updatePr';
import hasLabelInPR from './utils/hasLabelInPR';
import syncLabel from './utils/syncLabel';
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

export const editOpenedPR: PRHandler<
  Webhooks.WebhookPayloadPullRequest,
  { skipAutoMerge: boolean },
  string
> = async (pr, context, repoContext, previousSha) => {
  const repo = context.payload.repository;

  // do not lint pr from forks
  if (pr.head.repo.id !== repo.id) return { skipAutoMerge: true };

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

  await Promise.all<any>(
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

  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(pr.labels, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pr.labels, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pr.labels, automergeLabel);

  const defaultOptions = {
    ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };

  const { body, options } = updateBody(
    pr.body,
    defaultOptions,
    statuses
      .filter((status) => status.info && status.info.inBody)
      .map((status) => status.info) as StatusInfo[],
  );
  await updatePrIfNeeded(pr, context, repoContext, { title, body });

  if (options && (featureBranchLabel || automergeLabel)) {
    await Promise.all([
      featureBranchLabel &&
        syncLabel(
          pr,
          context,
          options.featureBranch,
          featureBranchLabel,
          prHasFeatureBranchLabel,
        ),
      skipCiLabel &&
        syncLabel(
          pr,
          context,
          options.autoMergeWithSkipCi,
          skipCiLabel,
          prHasSkipCiLabel,
        ),
      automergeLabel &&
        syncLabel(
          pr,
          context,
          options.autoMerge,
          automergeLabel,
          prHasAutoMergeLabel,
          {
            onAdd: async (prLabels) => {
              await autoMergeIfPossible(pr, context, repoContext, prLabels);
            },
            onRemove: () => {
              repoContext.removePrFromAutomergeQueue(context, pr.number);
            },
          },
        ),
    ]);

    if (!automergeLabel) {
      return { skipAutoMerge: true };
    }
  }

  return { skipAutoMerge: false };
};
