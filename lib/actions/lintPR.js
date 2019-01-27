'use strict';

exports.lintPR = (repoContext, context) => {
  if (!repoContext.config.prLint) return;

  const repo = context.payload.repository;
  const pr = context.payload.pull_request;

  // do not lint pr from forks
  if (pr.head.repo.id !== repo.id) return;

  const errorRule = repoContext.config.prLint.title.find(
    (rule) => !rule.regExp.test(pr.title)
  );

  const date = new Date();

  return context.github.checks.create(
    context.repo({
      name: 'reviewflow/lint-pr',
      head_sha: pr.head.sha,
      status: 'completed',
      conclusion: errorRule ? 'failure' : 'success',
      started_at: date,
      completed_at: date,
      output: errorRule
        ? errorRule.error
        : {
            title: '✓ Your PR is valid',
            summary: '',
          },
    })
  );
};
