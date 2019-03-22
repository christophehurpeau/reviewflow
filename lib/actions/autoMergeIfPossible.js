'use strict';

exports.autoMergeIfPossible = async (repoContext, context, labelAdded) => {
  if (!labelAdded) {
    // TODO check label
  }

  const pr = context.payload.pull_request;

  if (pr.mergeable) {
    await context.github.pulls.merge({
      merge_method: 'squash',
      owner: pr.headRef.repository.owner.login,
      repo: pr.headRef.repository.name,
      number: pr.number,
      commit_title: `${pr.title} (#${pr.number})`,
      commit_message: '', // TODO add BC
    });
  }
};
