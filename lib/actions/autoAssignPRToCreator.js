'use strict';

exports.autoAssignPRToCreator = (repoContext, context) => {
  if (!repoContext.config.autoAssignToCreator) return;

  const pr = context.payload.pull_request;
  if (pr.assignees.length !== 0) return;
  if (pr.user.type === 'Bot') return;

  return context.github.issues.addAssignees(
    context.issue({
      assignees: [pr.user.login],
    })
  );
};
