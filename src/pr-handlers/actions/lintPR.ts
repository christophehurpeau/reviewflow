import { Context } from 'probot';
import { RepoContext } from '../../context/repoContext';
import { StatusError, StatusInfo } from '../../teamconfigs/types';

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

export const lintPR = async (
  context: Context<any>,
  repoContext: RepoContext,
) => {
  if (!repoContext.config.prLint) return;

  const repo = context.payload.repository;
  const pr = context.payload.pull_request;

  // do not lint pr from forks
  if (pr.head.repo.id !== repo.id) return;

  const isPrFromBot = pr.user.type === 'Bot';

  const statuses: Status[] = [];

  const errorRule = repoContext.config.prLint.title.find((rule) => {
    if (rule.bot === false && isPrFromBot) return false;

    const match = rule.regExp.exec(pr.title);
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
    (check) => check.name === `${process.env.NAME}/lint-pr`,
  );

  await Promise.all<any>(
    [
      ...statuses.map(({ name, error, info }) =>
        context.github.repos.createStatus(
          context.repo({
            context: `${process.env.NAME}/${name}`,
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
            name: `${process.env.NAME}/lint-pr`,
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
            context: `${process.env.NAME}/lint-pr`,
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
};
