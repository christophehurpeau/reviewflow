/* eslint-disable max-lines */
import Webhooks from '@octokit/webhooks';
import { StatusError, StatusInfo } from '../../orgsConfigs/types';
import { PRHandler } from '../utils';
import { cleanTitle } from './utils/cleanTitle';
import { updateBody } from './utils/updateBody';
import { autoMergeIfPossible } from './autoMergeIfPossible';
import { updatePrIfNeeded } from './updatePr';
import hasLabelInPR from './utils/hasLabelInPR';
import syncLabel from './utils/syncLabel';

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

const ExcludesFalsy = (Boolean as any) as <T>(
  x: T | false | null | undefined,
) => x is T;

export const editOpenedPR: PRHandler<
  Webhooks.WebhookPayloadPullRequest,
  { skipAutoMerge: boolean }
> = async (pr, context, repoContext) => {
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

  const hasLintPrCheck = (await context.github.checks.listForRef(
    context.repo({
      ref: pr.head.sha,
    }),
  )).data.check_runs.find(
    (check): boolean => check.name === `${process.env.REVIEWFLOW_NAME}/lint-pr`,
  );

  await Promise.all<any>(
    [
      ...statuses.map(({ name, error, info }) =>
        context.github.repos.createStatus(
          context.repo({
            context: `${process.env.REVIEWFLOW_NAME}/${name}`,
            sha: pr.head.sha,
            state: (error ? 'failure' : 'success') as 'failure' | 'success',
            target_url: error ? undefined : (info as StatusInfo).url,
            description: error ? error.title : (info as StatusInfo).title,
          }),
        ),
      ),
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
      !hasLintPrCheck &&
        context.github.repos.createStatus(
          context.repo({
            context: `${process.env.REVIEWFLOW_NAME}/lint-pr`,
            sha: pr.head.sha,
            state: (errorRule ? 'failure' : 'success') as 'failure' | 'success',
            target_url: undefined,
            description: errorRule
              ? errorRule.error.title
              : '✓ Your PR is valid',
          }),
        ),
    ].filter(ExcludesFalsy),
  );

  const featureBranchLabel = repoContext.labels['feature-branch'];
  const automergeLabel = repoContext.labels['merge/automerge'];
  const skipCiLabel = repoContext.labels['merge/skip-ci'];

  const prHasFeatureBranchLabel = hasLabelInPR(pr, featureBranchLabel);
  const prHasSkipCiLabel = hasLabelInPR(pr, skipCiLabel);
  const prHasAutoMergeLabel = hasLabelInPR(pr, automergeLabel);

  const defaultOptions = {
    ...repoContext.config.prDefaultOptions,
    featureBranch: prHasFeatureBranchLabel,
    autoMergeWithSkipCi: prHasSkipCiLabel,
    autoMerge: prHasAutoMergeLabel,
  };

  const { body, options } = updateBody(pr.body, defaultOptions, statuses
    .filter((status) => status.info && status.info.inBody)
    .map((status) => status.info) as StatusInfo[]);
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
            onRemove: async () => {
              await repoContext.removePrFromAutomergeQueue(context, pr.number);
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
